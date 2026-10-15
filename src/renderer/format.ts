export function formatDay(
  day: string,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(locale, options);
}

export function formatTimestamp(
  iso: string,
  locale: string | undefined,
): string {
  return new Date(iso).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function cleanError(error: unknown): string {
  return String(error).replace(
    /^Error: Error invoking remote method '[^']+': (Error: )?/,
    '',
  );
}
