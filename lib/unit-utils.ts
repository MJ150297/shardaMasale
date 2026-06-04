/**
 * Unit classification utility.
 * Defines which units of measure are "integer-only" (discrete/countable)
 * vs "decimal-allowed" (continuous/measurable).
 */

/** Units that can only be whole numbers (e.g. pcs, pair, dozen) */
const INTEGER_UNITS = new Set([
  'pcs',
  'pair',
  'dozen',
  'box',
  'pack',
  'roll',
  'sheet',
  'tube',
  'set',
  'session',
  'project',
  'visit',
]);

/** Units that can have decimal values (e.g. kg, liter, meter, hour) */
const DECIMAL_UNITS = new Set([
  'kg',
  'liter',
  'litre',
  'meter',
  'metre',
  'hour',
  'day',
  'week',
  'month',
  'unit',
]);

/**
 * Returns true if the given unit of measure should only allow whole numbers.
 * Falls back to `false` (decimal-allowed) for unknown units.
 */
export function isIntegerUnit(unit: string): boolean {
  return INTEGER_UNITS.has(unit.toLowerCase().trim());
}

/**
 * Returns the HTML `step` value for a quantity input field.
 * - `"1"` for integer-only units (whole numbers)
 * - `"0.01"` for decimal-allowed units
 */
export function getQuantityStep(unit: string): string {
  return isIntegerUnit(unit) ? '1' : '0.01';
}

/**
 * Returns the minimum value for a quantity input field.
 * - `1` for integer-only units (can't have zero or partial)
 * - `0` for decimal-allowed units
 */
export function getQuantityMin(unit: string): number {
  return isIntegerUnit(unit) ? 1 : 0;
}

/**
 * Rounds a quantity value appropriately for the given unit.
 * Integer-only units are rounded to the nearest whole number.
 */
export function roundQuantityForUnit(quantity: number, unit: string): number {
  if (isIntegerUnit(unit)) {
    return Math.round(quantity);
  }
  return Math.round(quantity * 100) / 100;
}

/**
 * Validates that a quantity is valid for the given unit.
 * For integer-only units, rejects decimal values.
 * Returns an error message string or null if valid.
 */
export function validateQuantityForUnit(
  quantity: number,
  unit: string,
  itemName?: string,
): string | null {
  const label = itemName ? `"${itemName}"` : 'Item';

  if (quantity <= 0) {
    return `${label} quantity must be greater than zero`;
  }

  if (isIntegerUnit(unit) && !Number.isInteger(quantity)) {
    return `${label} quantity cannot be a decimal value (unit: ${unit})`;
  }

  return null;
}