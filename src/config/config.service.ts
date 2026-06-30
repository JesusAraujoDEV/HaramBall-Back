import { Injectable } from '@nestjs/common';
import { AppConfig } from './env.schema';

/**
 * Typed accessor for validated application configuration.
 *
 * The config is validated once at startup and injected here as an immutable
 * object, so consumers get type-safe values without re-reading process.env.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: AppConfig) {}

  get databaseUrl(): string {
    return this.config.databaseUrl;
  }

  get databaseSchema(): string {
    return this.config.databaseSchema;
  }

  get jwtAccessSecret(): string {
    return this.config.jwtAccessSecret;
  }

  get jwtAccessTtl(): string {
    return this.config.jwtAccessTtl;
  }

  get refreshTokenTtl(): string {
    return this.config.refreshTokenTtl;
  }

  get authMaxFailedAttempts(): number {
    return this.config.authMaxFailedAttempts;
  }

  get authFailedWindow(): string {
    return this.config.authFailedWindow;
  }

  get rateLimitMax(): number {
    return this.config.rateLimitMax;
  }

  get rateLimitWindow(): number {
    return this.config.rateLimitWindow;
  }

  get maxEntryBytes(): number {
    return this.config.maxEntryBytes;
  }

  get port(): number {
    return this.config.port;
  }

  /** Returns the whole validated config object (read-only use). */
  get all(): AppConfig {
    return this.config;
  }
}
