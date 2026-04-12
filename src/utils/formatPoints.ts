/**
 * Format point values for display. Shows 2 decimal places for non-integer
 * values (e.g. "1.50 SP"), whole numbers for integers (e.g. "100").
 */
export function formatPoints(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
