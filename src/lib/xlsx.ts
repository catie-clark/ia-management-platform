import { inflateRawSync } from "node:zlib";

type WorkbookEntryMap = Map<string, Buffer>;

type ParsedWorksheet = {
  sheetName?: string;
  headers: string[];
  rows: string[][];
};

const zipSignatures = {
  localFileHeader: 0x04034b50,
  centralDirectoryHeader: 0x02014b50,
  endOfCentralDirectory: 0x06054b50,
} as const;

export async function parseXlsxWorksheet(file: File, expectedSheetName: string): Promise<ParsedWorksheet> {
  const worksheets = await parseXlsxWorkbook(file);
  const worksheet = worksheets.find((candidate) => candidate.sheetName === expectedSheetName);

  if (!worksheet) {
    throw new Error(`The uploaded workbook must include a worksheet named "${expectedSheetName}".`);
  }

  return worksheet;
}

export async function parseXlsxWorkbook(file: File): Promise<Array<ParsedWorksheet & { sheetName: string }>> {
  const workbook = readZipEntries(Buffer.from(await file.arrayBuffer()));
  const sharedStrings = parseSharedStrings(workbook.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const workbookXml = workbook.get("xl/workbook.xml")?.toString("utf8");
  const workbookRelsXml = workbook.get("xl/_rels/workbook.xml.rels")?.toString("utf8");

  if (!workbookXml || !workbookRelsXml) {
    throw new Error("The uploaded workbook is missing required Excel metadata.");
  }

  const worksheetPaths = resolveWorksheetPaths(workbookXml, workbookRelsXml);

  return worksheetPaths.flatMap(({ sheetName, sheetPath }) => {
    const worksheetXml = workbook.get(sheetPath)?.toString("utf8");

    if (!worksheetXml) {
      return [];
    }

    return [{ sheetName, ...parseWorksheetXml(worksheetXml, sharedStrings) }];
  });
}

function readZipEntries(buffer: Buffer): WorkbookEntryMap {
  const entries = new Map<string, Buffer>();
  const eocdOffset = findEndOfCentralDirectory(buffer);

  if (eocdOffset === -1) {
    throw new Error("The uploaded workbook is not a valid .xlsx file.");
  }

  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(cursor) !== zipSignatures.centralDirectoryHeader) {
      throw new Error("The uploaded workbook has an invalid ZIP central directory.");
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");
    const fileData = readLocalFileData(buffer, localHeaderOffset, compressedSize);

    entries.set(fileName, decompressEntry(fileData, compressionMethod));
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65557);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === zipSignatures.endOfCentralDirectory) {
      return offset;
    }
  }

  return -1;
}

function readLocalFileData(buffer: Buffer, localHeaderOffset: number, compressedSize: number) {
  if (buffer.readUInt32LE(localHeaderOffset) !== zipSignatures.localFileHeader) {
    throw new Error("The uploaded workbook has an invalid ZIP file header.");
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  return buffer.subarray(dataStart, dataStart + compressedSize);
}

function decompressEntry(content: Buffer, compressionMethod: number) {
  if (compressionMethod === 0) {
    return content;
  }

  if (compressionMethod === 8) {
    return inflateRawSync(content);
  }

  throw new Error(`The uploaded workbook uses unsupported ZIP compression method ${compressionMethod}.`);
}

function resolveWorksheetPaths(workbookXml: string, workbookRelsXml: string) {
  const relationshipPathById = new Map<string, string>();
  const relationshipPattern = /<Relationship\b([^>]*)\/>/g;
  let relationshipMatch: RegExpExecArray | null = relationshipPattern.exec(workbookRelsXml);

  while (relationshipMatch) {
    const attributes = parseXmlAttributes(relationshipMatch[1] ?? "");
    const relationshipId = attributes.Id;
    const target = attributes.Target;

    if (relationshipId && target) {
      relationshipPathById.set(relationshipId, normalizeWorkbookPath(target));
    }

    relationshipMatch = relationshipPattern.exec(workbookRelsXml);
  }

  const worksheetPaths: Array<{ sheetName: string; sheetPath: string }> = [];
  const sheetPattern = /<sheet\b([^>]*)\/>/g;
  let sheetMatch: RegExpExecArray | null = sheetPattern.exec(workbookXml);

  while (sheetMatch) {
    const attributes = parseXmlAttributes(sheetMatch[1] ?? "");
    const sheetName = decodeXml(attributes.name ?? "");
    const relationshipId = attributes["r:id"];

    if (sheetName && relationshipId) {
      const sheetPath = relationshipPathById.get(relationshipId);

      if (sheetPath) {
        worksheetPaths.push({ sheetName, sheetPath });
      }
    }

    sheetMatch = sheetPattern.exec(workbookXml);
  }

  return worksheetPaths;
}

function parseSharedStrings(sharedStringsXml: string) {
  const values: string[] = [];
  const stringPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let stringMatch: RegExpExecArray | null = stringPattern.exec(sharedStringsXml);

  while (stringMatch) {
    const value = extractTextNodes(stringMatch[1] ?? "");
    values.push(value);
    stringMatch = stringPattern.exec(sharedStringsXml);
  }

  return values;
}

function parseWorksheetXml(worksheetXml: string, sharedStrings: string[]): ParsedWorksheet {
  const cellValues = new Map<number, Map<number, string>>();
  const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
  let cellMatch: RegExpExecArray | null = cellPattern.exec(worksheetXml);

  while (cellMatch) {
    const attributes = parseXmlAttributes(cellMatch[1] ?? cellMatch[3] ?? "");
    const reference = attributes.r;

    if (!reference) {
      cellMatch = cellPattern.exec(worksheetXml);
      continue;
    }

    const { rowIndex, columnIndex } = parseCellReference(reference);
    const rawCellXml = cellMatch[2] ?? "";
    const cellType = attributes.t ?? "";
    const value = readCellValue(cellType, rawCellXml, sharedStrings);

    if (!cellValues.has(rowIndex)) {
      cellValues.set(rowIndex, new Map<number, string>());
    }

    cellValues.get(rowIndex)?.set(columnIndex, value);
    cellMatch = cellPattern.exec(worksheetXml);
  }

  const rowIndexes = [...cellValues.keys()].sort((left, right) => left - right);

  if (rowIndexes.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerRow = buildRowArray(cellValues.get(rowIndexes[0]) ?? new Map());
  const headers = headerRow.map((value) => value.trim());
  const rows = rowIndexes
    .slice(1)
    .map((rowIndex) => buildRowArray(cellValues.get(rowIndex) ?? new Map(), headers.length))
    .filter((row) => row.some((value) => value.trim().length > 0));

  return { headers, rows };
}

function buildRowArray(cells: Map<number, string>, width?: number) {
  const maxColumnIndex = width
    ? Math.max(width - 1, ...cells.keys(), 0)
    : Math.max(...cells.keys(), 0);

  return Array.from({ length: maxColumnIndex + 1 }, (_, index) => cells.get(index) ?? "");
}

function parseCellReference(reference: string) {
  const match = /^([A-Z]+)(\d+)$/.exec(reference);

  if (!match) {
    throw new Error(`Unsupported worksheet cell reference "${reference}".`);
  }

  const [, columnLetters, rowDigits] = match;

  return {
    rowIndex: Number.parseInt(rowDigits, 10),
    columnIndex: columnLettersToIndex(columnLetters),
  };
}

function columnLettersToIndex(columnLetters: string) {
  let value = 0;

  for (const character of columnLetters) {
    value = value * 26 + (character.charCodeAt(0) - 64);
  }

  return value - 1;
}

function readCellValue(cellType: string, cellXml: string, sharedStrings: string[]) {
  if (cellType === "inlineStr") {
    return extractTextNodes(cellXml).trim();
  }

  const valueMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellXml);

  if (!valueMatch) {
    return "";
  }

  const rawValue = decodeXml(valueMatch[1] ?? "");

  if (cellType === "s") {
    const sharedStringIndex = Number.parseInt(rawValue, 10);
    return Number.isFinite(sharedStringIndex) ? sharedStrings[sharedStringIndex] ?? "" : "";
  }

  return rawValue.trim();
}

function extractTextNodes(xmlFragment: string) {
  const textPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  const values: string[] = [];
  let textMatch: RegExpExecArray | null = textPattern.exec(xmlFragment);

  while (textMatch) {
    values.push(decodeXml(textMatch[1] ?? ""));
    textMatch = textPattern.exec(xmlFragment);
  }

  return values.join("");
}

function parseXmlAttributes(attributeBlob: string) {
  const attributes: Record<string, string> = {};
  const attributePattern = /([A-Za-z0-9:_-]+)="([^"]*)"/g;
  let attributeMatch: RegExpExecArray | null = attributePattern.exec(attributeBlob);

  while (attributeMatch) {
    attributes[attributeMatch[1]] = decodeXml(attributeMatch[2] ?? "");
    attributeMatch = attributePattern.exec(attributeBlob);
  }

  return attributes;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeWorkbookPath(target: string) {
  const sanitized = target.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  return sanitized.startsWith("xl/") ? sanitized : `xl/${sanitized}`;
}
