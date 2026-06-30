/**
 * Redaction helper for logs.
 *
 * The zero-knowledge guarantee requires that ciphertext, password values, the
 * master password, blind-index inputs, and tokens never appear in log output
 * (Requirement 12.4). This module deep-clones a value and replaces any
 * sensitive field with a fixed placeholder before it is logged.
 */

export const REDACTED = '[REDACTED]';

/**
 * Case-insensitive key fragments considered sensitive. A field is redacted if
 * its key contains any of these substrings.
 */
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'ciphertext',
  'blindindex', // matches blindIndex / blindIndexes / titleBlindIndexes / tagBlindIndexes
  'token',
  'secret',
  'authorization',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

/**
 * Returns a deep copy of `value` with every sensitive field replaced by
 * {@link REDACTED}. Non-sensitive primitives are preserved. Arrays and nested
 * objects are traversed recursively. Handles cycles safely.
 */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return '[Circular]';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = redact(val, seen);
    }
  }
  return result;
}
