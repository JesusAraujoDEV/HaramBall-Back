import * as fc from 'fast-check';
import { redact, REDACTED } from './redact';

/**
 * Property: Zero-Knowledge — for any request/response value containing
 * ciphertext, password, blind-index, or token fields, the redacted output
 * (as it would be logged) never contains those secret values.
 *
 * Validates: Requirement 12.4
 */

const SENTINEL = '\u{1F512}SECRET-VALUE-MUST-NEVER-LEAK\u{1F512}';

const SENSITIVE_KEYS = [
  'password',
  'masterPassword',
  'titleCiphertext',
  'bodyCiphertext',
  'tagsCiphertext',
  'blindIndex',
  'titleBlindIndexes',
  'tagBlindIndexes',
  'refreshToken',
  'accessToken',
  'authorization',
];

// Keys known to be non-sensitive (contain no sensitive fragment).
const SAFE_KEYS = ['id', 'email', 'title', 'name', 'status', 'match', 'count'];

describe('redact (property-based)', () => {
  // A leaf never equal to / containing the sentinel.
  const leafArb = fc.oneof(
    fc.string().filter((s) => !s.includes(SENTINEL)),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
  );

  // Recursive structure where the sentinel only ever appears under a
  // sensitive key. `container` guarantees at least one sensitive field.
  const { node } = fc.letrec<{ node: unknown; container: unknown }>((rec) => ({
    node: fc.oneof(
      { maxDepth: 3, withCrossShrink: true },
      leafArb,
      fc.array(rec('node'), { maxLength: 3 }),
      rec('container'),
    ),
    container: fc
      .tuple(
        fc.subarray(SENSITIVE_KEYS, { minLength: 1 }),
        fc.dictionary(fc.constantFrom(...SAFE_KEYS), rec('node'), {
          maxKeys: 3,
        }),
      )
      .map(([sensitiveKeys, safeObject]) => {
        const obj: Record<string, unknown> = { ...safeObject };
        for (const key of sensitiveKeys) {
          // Sometimes a scalar, sometimes an array — both must be redacted.
          obj[key] = key.endsWith('es') ? [SENTINEL, SENTINEL] : SENTINEL;
        }
        return obj;
      }),
  }));

  it('never emits a secret placed under a sensitive key', () => {
    fc.assert(
      fc.property(node as fc.Arbitrary<unknown>, (input) => {
        const serialized = JSON.stringify(redact(input));
        expect(serialized.includes(SENTINEL)).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it('replaces sensitive fields with the redacted placeholder', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SENSITIVE_KEYS),
        leafArb,
        (sensitiveKey, safeValue) => {
          const result = redact({
            [sensitiveKey]: SENTINEL,
            email: safeValue,
          }) as Record<string, unknown>;

          expect(result[sensitiveKey]).toBe(REDACTED);
          // Non-sensitive value is preserved verbatim.
          expect(result.email).toBe(safeValue);
        },
      ),
    );
  });
});

describe('redact (examples)', () => {
  it('redacts a realistic create-entry payload', () => {
    const payload = {
      titleCiphertext: 'base64-cipher',
      bodyCiphertext: 'base64-cipher',
      tagsCiphertext: ['tag1cipher', 'tag2cipher'],
      titleBlindIndexes: ['hmac1', 'hmac2'],
      tagBlindIndexes: ['hmac3'],
    };

    const result = redact(payload) as Record<string, unknown>;

    expect(result.titleCiphertext).toBe(REDACTED);
    expect(result.bodyCiphertext).toBe(REDACTED);
    expect(result.tagsCiphertext).toBe(REDACTED);
    expect(result.titleBlindIndexes).toBe(REDACTED);
    expect(result.tagBlindIndexes).toBe(REDACTED);
  });

  it('redacts auth credentials but keeps the email', () => {
    const result = redact({
      email: 'user@example.com',
      password: 'super-secret',
      refreshToken: 'abc.def.ghi',
    }) as Record<string, unknown>;

    expect(result.email).toBe('user@example.com');
    expect(result.password).toBe(REDACTED);
    expect(result.refreshToken).toBe(REDACTED);
  });

  it('handles circular references without throwing', () => {
    const obj: Record<string, unknown> = { email: 'a@b.com' };
    obj.self = obj;
    expect(() => redact(obj)).not.toThrow();
  });
});
