# Implementation Plan: HaramBall Password Manager Backend

## Overview

This plan converts the HaramBall backend design into incremental coding tasks for a NestJS (TypeScript) + Prisma + PostgreSQL implementation. Tasks build bottom-up: project scaffolding and configuration first, then persistence (Prisma schema), then the cross-cutting common layer (errors, validation, redacted logging), then auth (hashing, tokens, guards, rate limiting), then entries CRUD, then blind-index search, and finally wiring and end-to-end integration. Each step ends by integrating into the running application so no code is left orphaned.

Property-based tests are included for the four core correctness properties the system depends on: the zero-knowledge guarantee (ciphertext stored verbatim, secrets never persisted/logged), per-owner data isolation, blind-index equality search, and refresh-token lifecycle. Property and unit/integration test sub-tasks are marked optional with `*` and can be skipped for a faster MVP.

## Tasks

- [x] 1. Scaffold NestJS project, tooling, and configuration
  - [x] 1.1 Initialize NestJS project and base tooling
    - Create the NestJS app skeleton (`src/main.ts`, `src/app.module.ts`), `package.json`, `tsconfig.json`, and lint/format config
    - Add dependencies: `@nestjs/*`, `prisma`/`@prisma/client`, `argon2`, `@nestjs/jwt`, `passport-jwt`, `@nestjs/throttler`, `helmet`, `class-validator`, `class-transformer`, and `fast-check` (dev)
    - Create `.gitignore` listing `.env`, and create `.env.example` documenting every variable from the design (`DATABASE_URL`, `DATABASE_SCHEMA`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `REFRESH_TOKEN_TTL`, `AUTH_MAX_FAILED_ATTEMPTS`, `AUTH_FAILED_WINDOW`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`, `MAX_ENTRY_BYTES`, `PORT`) without real secrets
    - _Requirements: 13.4, 13.5_

  - [x] 1.2 Implement ConfigModule with startup env validation
    - Create `src/config/env.schema.ts`, `config.service.ts`, `config.module.ts` exposing typed config
    - Validate all required environment variables at startup; throw a descriptive error naming the missing variable and abort bootstrap if any are absent
    - Load PostgreSQL connection details and JWT signing secret from the environment with no hardcoded defaults for secrets
    - _Requirements: 13.1, 13.2, 13.3_

  - [x]* 1.3 Write unit tests for env validation
    - Test that missing required variables fail startup with a message naming the variable
    - Test that a fully-populated environment validates successfully
    - _Requirements: 13.3_

- [-] 2. Define persistence layer (Prisma schema and client)
  - [-] 2.1 Author Prisma schema for the `haramball` schema
    - Create `prisma/schema.prisma` with `multiSchema` enabled and schema `haramball`
    - Define models `Account`, `Entry`, `EntryTitleIndex`, `EntryTagIndex`, `RefreshToken` with UUID primary keys, the columns/types from the design (`text`, `text[]`, `bytea`/`Bytes`, `timestamptz`), unique `email`, and timestamps
    - Define FKs with `onDelete: Cascade` for entry→account, title/tag index→entry, and refresh token→account; add indexes on `entries.account_id`, `entry_title_index.blind_index`, and `entry_tag_index.blind_index`
    - Generate the initial migration
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 9.5, 10.5_

  - [ ] 2.2 Implement PrismaModule and PrismaService
    - Create `src/prisma/prisma.module.ts` and `prisma.service.ts` managing connect/disconnect lifecycle
    - Export the Prisma client for injection into services
    - _Requirements: 14.1_

- [ ] 3. Implement common cross-cutting layer
  - [ ] 3.1 Implement error envelope, AppError, and global exception filter
    - Create `src/common/errors/app-error.ts` with error codes and an `AppError` class
    - Create `src/common/filters/all-exceptions.filter.ts` producing the consistent JSON error envelope `{ code, message }`, mapping known errors to status codes, returning 500 without stack traces/internal details for unexpected errors, and 404 for undefined routes
    - Register the filter globally in `main.ts`
    - _Requirements: 15.3, 15.4, 15.5_

  - [ ] 3.2 Implement redaction-aware logging interceptor
    - Create `src/common/interceptors/logging.interceptor.ts` that assigns/propagates a request id and logs request/response metadata
    - Redact ciphertext fields, account password values, master password, and blind-index inputs from all log output
    - Register the interceptor globally
    - _Requirements: 12.4_

  - [ ]* 3.3 Write property test for log redaction (zero-knowledge guarantee)
    - **Property: Zero-Knowledge — for any request/response containing ciphertext, password, or blind-index fields, the emitted log output never contains those values**
    - **Validates: Requirements 12.4**

  - [ ] 3.4 Implement shared DTO/validator helpers and global ValidationPipe
    - Create `src/common/validators/blind-index.validator.ts` constraining blind-index values to a bounded hex/base64 charset and length
    - Create `src/common/dto/pagination.dto.ts`
    - Configure the global `ValidationPipe` (`whitelist: true`) in `main.ts` so schema failures yield 400 listing invalid fields
    - _Requirements: 15.2_

  - [ ] 3.5 Configure global middleware in bootstrap
    - In `main.ts` apply Helmet security headers, a JSON body-size limit driven by `MAX_ENTRY_BYTES`, and the `/api/v1` global route prefix
    - Ensure oversize request bodies are rejected with HTTP 413
    - _Requirements: 5.5, 15.1_

- [ ] 4. Checkpoint - Ensure foundation builds and tests pass
  - Ensure the project compiles, migrations apply, and all tests pass. Ask the user if questions arise.

- [ ] 5. Implement authentication primitives
  - [ ] 5.1 Implement PasswordService (Argon2id)
    - Create `src/auth/password.service.ts` with `hash` and constant-time `verify` using Argon2id
    - _Requirements: 1.2, 2.2_

  - [ ]* 5.2 Write unit tests for PasswordService
    - Test that hashing produces a verifiable hash and that wrong passwords fail verification
    - Test that the plaintext password never appears in the produced hash output
    - _Requirements: 1.2, 2.2_

  - [ ] 5.3 Implement TokenService (JWT access + hashed refresh tokens)
    - Create `src/auth/token.service.ts` to sign access JWTs (HS256) with `JWT_ACCESS_SECRET`, including `sub` (accountId) and `exp` ≤ 60 minutes
    - Generate high-entropy refresh tokens, persist only their hash with `expires_at` ≤ 30 days and a nullable `revoked_at`; implement verify (reject expired/revoked/unknown) and revoke
    - _Requirements: 2.5, 2.6, 3.1, 3.2, 3.3, 3.6_

  - [ ]* 5.4 Write property test for refresh-token lifecycle
    - **Property: Token Lifecycle — for any issued refresh token, verification succeeds only while unexpired and not revoked; once revoked or expired, verification always fails; and the raw token value is never stored (only its hash)**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.6**

  - [ ] 5.5 Implement FailedAttemptsService and rate limiting
    - Create `src/auth/failed-attempts.service.ts` tracking failures per client identifier (email and/or source IP) over a rolling window; lock with 429 when failures exceed the threshold
    - Load threshold and window from `AUTH_MAX_FAILED_ATTEMPTS` / `AUTH_FAILED_WINDOW`
    - Configure `@nestjs/throttler` request-rate limiting (from `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW`) returning 429 with a `Retry-After` header
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 5.6 Write unit tests for failed-attempt lockout
    - Test that the (N+1)th failure within the window is rejected with 429 and that the counter resets after the window
    - _Requirements: 4.1_

- [ ] 6. Implement Auth module endpoints and guard
  - [ ] 6.1 Implement JwtAuthGuard and JWT strategy
    - Create `src/auth/strategies/jwt.strategy.ts` and `src/auth/guards/jwt-auth.guard.ts` validating the access token signature and expiration and attaching `accountId` to the request
    - Reject requests missing or with expired/invalid access tokens with 401
    - _Requirements: 3.4, 3.5, 15.1_

  - [ ] 6.2 Implement auth DTOs
    - Create `src/auth/dto/{register,login,refresh,logout}.dto.ts` with `class-validator` rules: valid email format and password min length 12 for register
    - _Requirements: 1.5, 1.6, 15.2_

  - [ ] 6.3 Implement AuthService and AuthController (register)
    - Wire `auth.module.ts`, `auth.service.ts`, `auth.controller.ts`
    - Implement registration: enforce unique email (409 on conflict), hash password with Argon2id, persist only the hash, exclude plaintext from storage and responses, return 201 `{ id, email }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 6.4 Implement login, refresh, and logout flows
    - Login: verify email+password (constant-time), return generic 401 that does not reveal whether the email exists, issue access + refresh tokens with `expiresIn` on success; integrate failed-attempt lockout (429)
    - Refresh: issue a new access token for a valid unexpired refresh token (200), reject expired/invalid with 401
    - Logout: revoke the supplied refresh token, return 200
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

  - [ ]* 6.5 Write integration tests for auth endpoints
    - Test register conflict/validation paths, login success/failure (generic message), refresh success/expiry, and logout revocation behavior
    - _Requirements: 1.1, 1.4, 2.1, 2.3, 2.4, 3.1, 3.2, 3.3_

- [ ] 7. Checkpoint - Ensure auth flows pass
  - Ensure all tests pass and the auth flow works end-to-end. Ask the user if questions arise.

- [ ] 8. Implement Entries module (CRUD)
  - [ ] 8.1 Implement entry DTOs
    - Create `src/entries/dto/{create-entry,update-entry}.dto.ts` with required `titleCiphertext`, optional `bodyCiphertext`, `tagsCiphertext[]`, and `titleBlindIndexes[]` / `tagBlindIndexes[]` validated via the blind-index validator and bounded in count
    - Reject create requests missing `titleCiphertext` with 400
    - _Requirements: 5.4, 15.2_

  - [ ] 8.2 Implement EntriesService create with blind-index persistence
    - Create `src/entries/entries.service.ts` and `entries.module.ts`
    - Persist a new entry owned by the requesting account, storing title/body/tags ciphertext verbatim (no decrypt/parse/transform), set created/updated timestamps, and persist the supplied title and tag blind indexes into `entry_title_index` / `entry_tag_index`
    - Return the created entry id with 201
    - _Requirements: 5.1, 5.2, 5.3, 9.5, 10.5, 11.1, 14.3_

  - [ ]* 8.3 Write property test for verbatim ciphertext storage (zero-knowledge guarantee)
    - **Property: Zero-Knowledge — for any ciphertext payload, the value persisted and later returned is byte-for-byte identical to what was received, with no decryption, parsing, or transformation**
    - **Validates: Requirements 5.2, 6.5, 7.3, 12.1**

  - [ ] 8.4 Implement entry retrieval (list and get-by-id)
    - List entries scoped to the requesting owner; get-by-id returns ciphertext fields, id, and timestamps with 200 when owned
    - Return 404 for non-existent ids and for entries owned by a different account (do not reveal existence); do not return blind indexes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 11.2, 11.3_

  - [ ] 8.5 Implement entry update
    - Replace supplied ciphertext fields and rebuild associated title/tag blind-index rows, set update timestamp, store ciphertext verbatim, return updated entry with 200
    - Return 404 for non-existent ids and for entries owned by a different account
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.5, 10.5, 11.2, 11.3_

  - [ ] 8.6 Implement entry deletion
    - Delete an owned entry and its associated blind-index rows, return 204; ensure the entry no longer appears in subsequent retrieval/search
    - Return 404 for non-existent ids and for entries owned by a different account
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.2, 11.3_

  - [ ] 8.7 Implement EntriesController and register routes
    - Wire `entries.controller.ts` for `POST/GET/GET:id/PUT:id/DELETE:id` under `/entries`, all behind `JwtAuthGuard`
    - _Requirements: 5.1, 6.1, 6.2, 7.1, 8.1, 15.1_

  - [ ]* 8.8 Write property test for owner isolation
    - **Property: Owner Isolation — for any two distinct accounts and any entry created by one, every read/update/delete/search operation by the other account responds as 404, and listing/search never returns another owner's entries**
    - **Validates: Requirements 6.4, 7.5, 8.3, 11.1, 11.2, 11.3**

  - [ ]* 8.9 Write integration tests for entries CRUD
    - Test create (missing title → 400, oversize → 413), get/list scoping, update timestamp change, and delete-then-absent behavior
    - _Requirements: 5.1, 5.4, 5.5, 6.1, 6.3, 7.2, 8.4_

- [ ] 9. Checkpoint - Ensure entries CRUD passes
  - Ensure all tests pass and entries CRUD works end-to-end. Ask the user if questions arise.

- [ ] 10. Implement Search module (blind-index search)
  - [ ] 10.1 Implement search DTOs
    - Create `src/search/dto/{title-search,tag-search}.dto.ts`: title search `{ titleBlindIndex }`, tag search `{ tagBlindIndexes[], match: "any" | "all" }`, validated with the blind-index validator
    - _Requirements: 15.2_

  - [ ] 10.2 Implement SearchService title search
    - Create `src/search/search.service.ts` and `search.module.ts`
    - Match entries by equality on the stored title blind index, joined through `entries.account_id` to scope to the owner; return an empty set with 200 when nothing matches; never access plaintext
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 11.2_

  - [ ] 10.3 Implement SearchService tag search
    - Match entries by equality on tag blind indexes scoped to the owner, supporting `match=any` and `match=all`; return empty set with 200 when nothing matches; never access plaintext
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.2_

  - [ ] 10.4 Implement SearchController and register routes
    - Wire `search.controller.ts` for `POST /search/title` and `POST /search/tags` behind `JwtAuthGuard` (POST so blind indexes travel in the body, not URLs/logs)
    - _Requirements: 9.1, 10.1, 12.4, 15.1_

  - [ ]* 10.5 Write property test for blind-index equality search
    - **Property: Blind-Index Equality Search — for any set of entries, a title/tag search returns exactly those owner-scoped entries whose stored blind index equals the queried value (no false positives, no false negatives), independent of plaintext**
    - **Validates: Requirements 9.1, 9.2, 10.1, 10.2**

  - [ ]* 10.6 Write integration tests for search endpoints
    - Test title match/no-match (200 empty), tag `any` vs `all` semantics, and owner scoping of results
    - _Requirements: 9.1, 9.3, 10.1, 10.3, 11.2_

- [ ] 11. Final integration and wiring
  - [ ] 11.1 Wire all modules into AppModule and verify bootstrap
    - Register Config, Prisma, Common, Auth, Entries, and Search modules in `app.module.ts`; confirm global guards/pipes/filters/interceptors and `/api/v1` prefix are active and the app boots with validated env
    - _Requirements: 13.3, 15.1, 15.5_

  - [ ]* 11.2 Write end-to-end test for the full user journey
    - Test register → login → create entry → list/get → title/tag search → update → delete using automated requests, asserting owner isolation throughout
    - _Requirements: 2.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.3_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass and the full API works end-to-end. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements (granular sub-requirement clauses) for traceability.
- Checkpoints ensure incremental validation at natural boundaries.
- Property-based tests (`fast-check`) validate the four universal correctness properties called out in the design narrative: zero-knowledge guarantee, owner isolation, blind-index equality search, and refresh-token lifecycle.
- Unit and integration tests validate specific examples, edge cases, and error/status-code behavior.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "3.1", "3.2", "3.4"] },
    { "id": 3, "tasks": ["3.3", "3.5", "5.1", "5.3", "5.5"] },
    { "id": 4, "tasks": ["5.2", "5.4", "5.6", "6.1", "6.2"] },
    { "id": 5, "tasks": ["6.3", "8.1", "10.1"] },
    { "id": 6, "tasks": ["6.4", "8.2"] },
    { "id": 7, "tasks": ["6.5", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 8, "tasks": ["8.7", "10.2", "10.3"] },
    { "id": 9, "tasks": ["8.8", "8.9", "10.4"] },
    { "id": 10, "tasks": ["10.5", "10.6", "11.1"] },
    { "id": 11, "tasks": ["11.2"] }
  ]
}
```
