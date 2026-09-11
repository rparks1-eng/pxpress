export function csvCell(value: unknown) {
  const text = String(value ?? '');
  const safe = typeof value === 'string' && /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export const csvRows = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(',')).join('\n');
