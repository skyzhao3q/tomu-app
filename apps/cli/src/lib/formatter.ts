export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export function formatTable(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string; width?: number }[],
): string {
  if (rows.length === 0) return "No results.";

  const widths = columns.map((col) => {
    const headerLen = col.label.length;
    const maxDataLen = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? "");
      return Math.max(max, val.length);
    }, 0);
    return col.width ?? Math.max(headerLen, Math.min(maxDataLen, 40));
  });

  const header = columns
    .map((col, i) => col.label.padEnd(widths[i]))
    .join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");
  const body = rows.map((row) =>
    columns
      .map((col, i) => {
        const val = String(row[col.key] ?? "");
        return truncate(val, widths[i]).padEnd(widths[i]);
      })
      .join("  "),
  );

  return [header, separator, ...body].join("\n");
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
