import { validateEnv, ENV_VARS, RawEnv } from './env.schema';

/** A fully-populated, valid environment used as the baseline for tests. */
function validRawEnv(): RawEnv {
  return {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=haramball',
    DATABASE_SCHEMA: 'haramball',
    JWT_ACCESS_SECRET: 'a-very-long-random-secret-value',
    JWT_ACCESS_TTL: '60m',
    REFRESH_TOKEN_TTL: '30d',
    AUTH_MAX_FAILED_ATTEMPTS: '10',
    AUTH_FAILED_WINDOW: '15m',
    RATE_LIMIT_MAX: '100',
    RATE_LIMIT_WINDOW: '60',
    MAX_ENTRY_BYTES: '65536',
    PORT: '3000',
  };
}

describe('validateEnv', () => {
  it('validates a fully-populated environment and returns typed config', () => {
    const config = validateEnv(validRawEnv());

    expect(config.databaseUrl).toBe(
      'postgresql://user:pass@localhost:5432/db?schema=haramball',
    );
    expect(config.databaseSchema).toBe('haramball');
    expect(config.jwtAccessSecret).toBe('a-very-long-random-secret-value');
    expect(config.jwtAccessTtl).toBe('60m');
    expect(config.refreshTokenTtl).toBe('30d');
    expect(config.authMaxFailedAttempts).toBe(10);
    expect(config.authFailedWindow).toBe('15m');
    expect(config.rateLimitMax).toBe(100);
    expect(config.rateLimitWindow).toBe(60);
    expect(config.maxEntryBytes).toBe(65536);
    expect(config.port).toBe(3000);
  });

  it.each(Object.values(ENV_VARS))(
    'fails startup when required variable %s is missing, naming the variable',
    (variableName) => {
      const env = validRawEnv();
      delete env[variableName];

      expect(() => validateEnv(env)).toThrow(variableName);
    },
  );

  it('fails when a required variable is present but empty', () => {
    const env = validRawEnv();
    env[ENV_VARS.JWT_ACCESS_SECRET] = '   ';

    expect(() => validateEnv(env)).toThrow(ENV_VARS.JWT_ACCESS_SECRET);
  });

  it('rejects a non-integer numeric variable, naming the variable', () => {
    const env = validRawEnv();
    env[ENV_VARS.PORT] = 'not-a-number';

    expect(() => validateEnv(env)).toThrow(ENV_VARS.PORT);
  });

  it('rejects a malformed duration variable, naming the variable', () => {
    const env = validRawEnv();
    env[ENV_VARS.JWT_ACCESS_TTL] = '60minutes';

    expect(() => validateEnv(env)).toThrow(ENV_VARS.JWT_ACCESS_TTL);
  });
});
