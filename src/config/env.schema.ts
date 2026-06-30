/**
 * Environment variable schema and startup validation.
 *
 * Defines every environment variable the application requires, validates the
 * raw process environment at startup, and produces a typed, immutable config
 * object. If any required variable is missing or malformed, validation throws
 * an error that names the offending variable so bootstrap can abort cleanly
 * (Requirement 13.3). No secret values are given defaults.
 */

/** Canonical names of all environment variables consumed by the app. */
export const ENV_VARS = {
  DATABASE_URL: 'DATABASE_URL',
  DATABASE_SCHEMA: 'DATABASE_SCHEMA',
  JWT_ACCESS_SECRET: 'JWT_ACCESS_SECRET',
  JWT_ACCESS_TTL: 'JWT_ACCESS_TTL',
  REFRESH_TOKEN_TTL: 'REFRESH_TOKEN_TTL',
  AUTH_MAX_FAILED_ATTEMPTS: 'AUTH_MAX_FAILED_ATTEMPTS',
  AUTH_FAILED_WINDOW: 'AUTH_FAILED_WINDOW',
  RATE_LIMIT_MAX: 'RATE_LIMIT_MAX',
  RATE_LIMIT_WINDOW: 'RATE_LIMIT_WINDOW',
  MAX_ENTRY_BYTES: 'MAX_ENTRY_BYTES',
  PORT: 'PORT',
} as const;

/** Fully validated, typed application configuration. */
export interface AppConfig {
  databaseUrl: string;
  databaseSchema: string;
  jwtAccessSecret: string;
  jwtAccessTtl: string;
  refreshTokenTtl: string;
  authMaxFailedAttempts: number;
  authFailedWindow: string;
  rateLimitMax: number;
  rateLimitWindow: number;
  maxEntryBytes: number;
  port: number;
}

/** Raw environment shape accepted by the validator. */
export type RawEnv = Record<string, string | undefined>;

/** A duration string like `15m`, `30d`, `60s`, `2h`. */
const DURATION_PATTERN = /^\d+(ms|s|m|h|d)$/;

function requireString(env: RawEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function requireInt(env: RawEnv, name: string, min = 1): number {
  const raw = requireString(env, name);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(
      `Environment variable ${name} must be an integer >= ${min}, received "${raw}"`,
    );
  }
  return parsed;
}

function requireDuration(env: RawEnv, name: string): string {
  const value = requireString(env, name);
  if (!DURATION_PATTERN.test(value)) {
    throw new Error(
      `Environment variable ${name} must be a duration like "15m" or "30d", received "${value}"`,
    );
  }
  return value;
}

/**
 * Validates the raw environment and returns a typed config object.
 * Throws on the first invalid/missing variable, naming it explicitly.
 */
export function validateEnv(env: RawEnv): AppConfig {
  return {
    databaseUrl: requireString(env, ENV_VARS.DATABASE_URL),
    databaseSchema: requireString(env, ENV_VARS.DATABASE_SCHEMA),
    jwtAccessSecret: requireString(env, ENV_VARS.JWT_ACCESS_SECRET),
    jwtAccessTtl: requireDuration(env, ENV_VARS.JWT_ACCESS_TTL),
    refreshTokenTtl: requireDuration(env, ENV_VARS.REFRESH_TOKEN_TTL),
    authMaxFailedAttempts: requireInt(env, ENV_VARS.AUTH_MAX_FAILED_ATTEMPTS),
    authFailedWindow: requireDuration(env, ENV_VARS.AUTH_FAILED_WINDOW),
    rateLimitMax: requireInt(env, ENV_VARS.RATE_LIMIT_MAX),
    rateLimitWindow: requireInt(env, ENV_VARS.RATE_LIMIT_WINDOW),
    maxEntryBytes: requireInt(env, ENV_VARS.MAX_ENTRY_BYTES),
    port: requireInt(env, ENV_VARS.PORT),
  };
}
