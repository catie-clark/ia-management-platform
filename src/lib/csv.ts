export type ParsedCsvDocument = {
  headers: string[];
  rows: string[][];
};

export function parseCsvDocument(input: string): ParsedCsvDocument {
  const content = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let isInsideQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === "\"") {
      if (isInsideQuotes && nextCharacter === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        isInsideQuotes = !isInsideQuotes;
      }

      continue;
    }

    if (!isInsideQuotes && character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!isInsideQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  if (isInsideQuotes) {
    throw new Error("CSV parsing failed because a quoted field was not closed.");
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  const nonEmptyRows = rows.filter((row) => row.some((value) => value.trim().length > 0));

  if (nonEmptyRows.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const [rawHeaders, ...dataRows] = nonEmptyRows;
  const headers = normalizeHeaders(rawHeaders);
  const paddedRows = dataRows.map((row) => alignRowToHeaders(row, headers.length));

  return {
    headers,
    rows: paddedRows,
  };
}

function normalizeHeaders(rawHeaders: string[]) {
  const counts = new Map<string, number>();

  return rawHeaders.map((header, index) => {
    const baseHeader = header.trim() || `column_${index + 1}`;
    const seenCount = counts.get(baseHeader) ?? 0;
    counts.set(baseHeader, seenCount + 1);
    return seenCount === 0 ? baseHeader : `${baseHeader}_${seenCount + 1}`;
  });
}

function alignRowToHeaders(row: string[], headerCount: number) {
  if (row.length === headerCount) {
    return row;
  }

  if (row.length > headerCount) {
    return row.slice(0, headerCount);
  }

  return [...row, ...new Array<string>(headerCount - row.length).fill("")];
}
