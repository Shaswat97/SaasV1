export type CsvParseResult = {
  headers: string[];
  rows: string[][];
};

export function parseCsv(text: string): CsvParseResult {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let current = "";
  let inQuotes = false;

  const pushField = () => {
    currentRow.push(current);
    current = "";
  };

  const pushRow = () => {
    if (currentRow.length === 1 && currentRow[0] === "" && rows.length === 0) {
      currentRow = [];
      return;
    }
    if (currentRow.some((value) => value.trim() !== "")) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        current += "\"";
        i += 1;
        continue;
      }
      if (char === "\"") {
        inQuotes = false;
        continue;
      }
      current += char;
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      pushField();
      continue;
    }

    if (char === "\n") {
      pushField();
      pushRow();
      continue;
    }

    if (char === "\r") {
      continue;
    }

    current += char;
  }

  pushField();
  pushRow();

  const headers = rows.shift()?.map((header) => header.trim()) ?? [];

  return {
    headers,
    rows
  };
}
