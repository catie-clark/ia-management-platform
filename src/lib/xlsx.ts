import { inflateRawSync } from "node:zlib";

type WorkbookEntryMap = Map<string, Buffer>;

type ParsedWorksheet = {
  sheetName?: string;
  headers: string[];
  rows: string[][];
};

export type WorkbookCellStyle =
  | "default"
  | "body"
  | "title"
  | "sectionBand"
  | "label"
  | "tableHeader"
  | "tableCell"
  | "pass"
  | "fail"
  | "notTested"
  | "exception"
  | "metaKey"
  | "metaValue";

export type WorkbookCell = { value: string | number | null | undefined; style?: WorkbookCellStyle };
type WorkbookRow = Array<string | number | null | undefined | WorkbookCell>;

type WorkbookSheet = {
  name: string;
  rows: WorkbookRow[];
  columns?: Array<{ width: number }>;
  merges?: string[];
  freezeRow?: number;
};

const styleIndexByKey: Record<WorkbookCellStyle, number> = {
  default: 0,
  body: 1,
  title: 2,
  sectionBand: 3,
  label: 4,
  tableHeader: 5,
  tableCell: 6,
  pass: 7,
  fail: 8,
  notTested: 9,
  exception: 10,
  metaKey: 11,
  metaValue: 12,
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

export function buildXlsxWorkbook(sheets: WorkbookSheet[]) {
  const normalizedSheets = normalizeWorkbookSheets(sheets);
  const worksheetEntries = normalizedSheets.map((sheet, index) => ({
    path: `xl/worksheets/sheet${index + 1}.xml`,
    content: Buffer.from(buildWorksheetXml(sheet), "utf8"),
  }));
  const entries = [
    {
      path: "[Content_Types].xml",
      content: Buffer.from(buildContentTypesXml(normalizedSheets.length), "utf8"),
    },
    {
      path: "_rels/.rels",
      content: Buffer.from(buildRootRelationshipsXml(), "utf8"),
    },
    {
      path: "xl/workbook.xml",
      content: Buffer.from(buildWorkbookXml(normalizedSheets.map((sheet) => sheet.name)), "utf8"),
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: Buffer.from(buildWorkbookRelationshipsXml(normalizedSheets.length), "utf8"),
    },
    {
      path: "xl/styles.xml",
      content: Buffer.from(buildStylesXml(), "utf8"),
    },
    ...worksheetEntries,
  ];

  return buildZipArchive(entries);
}

function normalizeWorkbookSheets(sheets: WorkbookSheet[]): WorkbookSheet[] {
  const usedNames = new Set<string>();
  const fallbackSheets = sheets.length > 0 ? sheets : [{ name: "Testing Matrix", rows: [] }];

  return fallbackSheets.map((sheet, index) => {
    const baseName = sanitizeWorksheetName(sheet.name || `Testing Matrix ${index + 1}`) || `Testing Matrix ${index + 1}`;
    const name = dedupeWorksheetName(baseName, usedNames);

    return {
      name,
      rows: sheet.rows,
      columns: sheet.columns,
      merges: sheet.merges,
      freezeRow: sheet.freezeRow,
    };
  });
}

function sanitizeWorksheetName(value: string) {
  return value.replace(/[\[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
}

function dedupeWorksheetName(baseName: string, usedNames: Set<string>) {
  let candidate = baseName.slice(0, 31);
  let suffix = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    const suffixText = ` ${suffix}`;
    candidate = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function buildContentTypesXml(sheetCount: number) {
  const worksheetOverrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${worksheetOverrides}
</Types>`;
}

function buildRootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildWorkbookXml(sheetNames: string[]) {
  const sheetsXml = sheetNames
    .map((sheetName, index) => `<sheet name="${escapeXml(sheetName)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetsXml}</sheets>
</workbook>`;
}

function buildWorkbookRelationshipsXml(sheetCount: number) {
  const worksheetRelationships = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  const stylesRelationship = `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${worksheetRelationships}${stylesRelationship}</Relationships>`;
}

function buildWorksheetXml(sheet: WorkbookSheet) {
  const rows = sheet.rows;
  const columnCount = Math.max(2, ...rows.map((row) => row.length), 0);
  const columnsXml = buildColumnsXml(columnCount, sheet.columns);
  const columnWidths = resolveColumnWidths(columnCount, sheet.columns);
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const rowHeight = estimateRowHeight(row, columnWidths);
      const heightAttributes = rowHeight ? ` ht="${rowHeight}" customHeight="1"` : "";
      const cells = row
        .map((entry, columnIndex) => buildCellXml(entry, rowNumber, columnIndex))
        .filter(Boolean)
        .join("");

      return `<row r="${rowNumber}"${heightAttributes}>${cells}</row>`;
    })
    .join("");

  const sheetViewsXml = sheet.freezeRow && sheet.freezeRow > 0
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRow}" topLeftCell="A${sheet.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";

  const mergeCellsXml = sheet.merges && sheet.merges.length > 0
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${sheetViewsXml}${columnsXml}
<sheetData>${rowXml}</sheetData>
${mergeCellsXml}</worksheet>`;
}

function resolveColumnWidths(columnCount: number, override?: Array<{ width: number }>) {
  return Array.from({ length: columnCount }, (_, index) => {
    const explicit = override?.[index]?.width;

    if (typeof explicit === "number" && explicit > 0) {
      return explicit;
    }

    return index === 0 ? 24 : index === 1 ? 96 : 24;
  });
}

function buildColumnsXml(columnCount: number, override?: Array<{ width: number }>) {
  const widths = resolveColumnWidths(columnCount, override);
  const columns = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");

  return `<cols>${columns}</cols>`;
}

function estimateRowHeight(row: WorkbookSheet["rows"][number], columnWidths: number[]) {
  const maxLineCount = row.reduce<number>((currentMax, entry, index) => {
    const value = extractCellValue(entry);

    if (value === null || value === undefined || value === "") {
      return currentMax;
    }

    const text = String(value);
    const columnWidth = columnWidths[index] ?? 24;
    const wrappedLineLength = Math.max(8, Math.floor(columnWidth));
    const lineCount = text
      .split(/\r?\n/)
      .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / wrappedLineLength)), 0);

    return Math.max(currentMax, lineCount);
  }, 1);

  return maxLineCount > 1 ? Math.min(409, Math.max(30, maxLineCount * 18)) : null;
}

function buildCellXml(entry: WorkbookRow[number], rowNumber: number, columnIndex: number) {
  const value = extractCellValue(entry);

  if (value === null || value === undefined || value === "") {
    return "";
  }

  const reference = `${indexToColumnLetters(columnIndex)}${rowNumber}`;
  const text = String(value);
  const preserveSpace = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  const styleKey = isWorkbookCell(entry) && entry.style ? entry.style : "body";
  const styleIndex = styleIndexByKey[styleKey];

  return `<c r="${reference}" s="${styleIndex}" t="inlineStr"><is><t${preserveSpace}>${escapeXml(text)}</t></is></c>`;
}

function isWorkbookCell(entry: WorkbookRow[number]): entry is WorkbookCell {
  return Boolean(entry) && typeof entry === "object" && entry !== null && "value" in (entry as Record<string, unknown>);
}

function extractCellValue(entry: WorkbookRow[number]) {
  if (isWorkbookCell(entry)) {
    return entry.value;
  }

  return entry;
}

function buildStylesXml() {
  const fonts = [
    `<font><sz val="11"/><name val="Calibri"/><color rgb="FF333333"/></font>`,
    `<font><b/><sz val="18"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>`,
    `<font><b/><sz val="12"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF333333"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>`,
    `<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF4F4F4F"/></font>`,
  ];
  const fills = [
    `<fill><patternFill patternType="none"/></fill>`,
    `<fill><patternFill patternType="gray125"/></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FF011E41"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FF002E62"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFE0E0E0"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FF05AB8C"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFE5376B"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFBDBDBD"/></patternFill></fill>`,
    `<fill><patternFill patternType="solid"><fgColor rgb="FFF5A800"/></patternFill></fill>`,
  ];
  const borders = [
    `<border><left/><right/><top/><bottom/><diagonal/></border>`,
    `<border><left style="thin"><color rgb="FFBDBDBD"/></left><right style="thin"><color rgb="FFBDBDBD"/></right><top style="thin"><color rgb="FFBDBDBD"/></top><bottom style="thin"><color rgb="FFBDBDBD"/></bottom><diagonal/></border>`,
  ];
  const cellXfs = [
    // 0 default
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`,
    // 1 body
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`,
    // 2 title (font 1, fill 2)
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>`,
    // 3 sectionBand (font 2, fill 3)
    `<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>`,
    // 4 label (font 3, fill 4, border 1)
    `<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`,
    // 5 tableHeader (font 4, fill 2, border 1)
    `<xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`,
    // 6 tableCell (font 0, fill 0, border 1)
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`,
    // 7 pass (font 4, fill 5, border 1)
    `<xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`,
    // 8 fail (font 4, fill 6, border 1)
    `<xf numFmtId="0" fontId="4" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`,
    // 9 notTested (font 0, fill 7, border 1)
    `<xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`,
    // 10 exception (font 0, fill 8, border 1)
    `<xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`,
    // 11 metaKey (font 5)
    `<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`,
    // 12 metaValue (font 0)
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`,
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${fonts.length}">${fonts.join("")}</fonts>
<fills count="${fills.length}">${fills.join("")}</fills>
<borders count="${borders.length}">${borders.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${cellXfs.length}">${cellXfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function indexToColumnLetters(index: number) {
  let value = index + 1;
  let letters = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildZipArchive(entries: Array<{ path: string; content: Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.path, "utf8");
    const crc = crc32(entry.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(zipSignatures.localFileHeader, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.content.length, 18);
    localHeader.writeUInt32LE(entry.content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileName, entry.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(zipSignatures.centralDirectoryHeader, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.content.length, 20);
    centralHeader.writeUInt32LE(entry.content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, fileName);

    offset += localHeader.length + fileName.length + entry.content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localFiles = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(zipSignatures.endOfCentralDirectory, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localFiles.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localFiles, centralDirectory, end]);
}

function crc32(content: Buffer) {
  let crc = 0xffffffff;

  for (const byte of content) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});
