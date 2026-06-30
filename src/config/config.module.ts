import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from './config.service';
import { validateEnv } from './env.schema';

/**
 * Global configuration module.
 *
 * Loads the `.env` file (via @nestjs/config) into the process environment and
 * validates it with {@link validateEnv}. Validation runs during bootstrap; if
 * a required variable is missing or malformed, the app fails to start with a
 * descriptive error naming the variable (Requirement 13.3).
 *
 * Exposes a single typed {@link AppConfigService} for the rest of the app.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Runs at startup; throwing here aborts bootstrap (Requirement 13.3).
      validate: (raw) => validateEnv(raw),
    }),
  ],
  providers: [
    {
      provide: AppConfigService,
      useFactory: () => new AppConfigService(validateEnv(process.env)),
    },
  ],
  exports: [AppConfigService],
})
export class AppConfigModule {}
