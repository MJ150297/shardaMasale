/**
 * Formats a date to a locale-aware string using 'en-IN' locale.
 * This ensures consistency between server and client rendering,
 * preventing hydration mismatches.
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (date === null || date === undefined) return '-';
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleDateString('en-IN', options);
  } catch {
    return '-';
  }
}