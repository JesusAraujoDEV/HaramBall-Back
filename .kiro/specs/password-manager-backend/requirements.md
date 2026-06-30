# Requirements Document

## Introduction

This document defines the requirements for the backend service of HaramBall, a personal password manager. The backend (repository `HaramBall-Back`) provides a REST API for user account management, authentication, and storage of credential entries. Each entry is stored as free-form text: the first line is the title (used as the chat-style search key) and the remaining lines form the body.

The system uses a zero-knowledge security model. All entry content (title, body, and tags) is encrypted on the client before it reaches the server, and the master password used to derive encryption keys never leaves the client. The server stores and returns ciphertext only and never holds the plaintext of entry content or the means to decrypt it.

Because titles and tags are encrypted, the server cannot read them in plaintext to perform searches. The requirements therefore include a searchable-encryption mechanism (blind index) so that the user can search entries by title and by tags without the server learning the plaintext. The specific algorithm and trade-offs are to be resolved during design.

The backend is built with Node.js and PostgreSQL (database schema named `haramball`). Database connection details and all secrets are supplied through environment variables and are never hardcoded.

The frontend (React Native + Expo) is explicitly out of scope for this specification.

## Glossary

- **System**: The HaramBall backend service, including its API, business logic, and persistence layers.
- **API**: The HTTP/REST interface exposed by the System.
- **Auth_Service**: The component of the System responsible for user registration, authentication, and token issuance.
- **Entry_Service**: The component of the System responsible for create, read, update, and delete operations on entries.
- **Search_Service**: The component of the System responsible for resolving search queries against blind indexes.
- **Account**: A registered user record containing identity credentials (email and hashed password) and metadata.
- **Owner**: The authenticated Account that created a given Entry and is authorized to access it.
- **Entry**: A stored credential record belonging to one Account, containing an encrypted title, encrypted body, and encrypted tags.
- **Title**: The first line of an Entry's content, used as the primary search key. Stored encrypted.
- **Body**: The content of an Entry after the first line. Stored encrypted.
- **Tag**: A label associated with an Entry for grouping and search. Stored encrypted.
- **Ciphertext**: Encrypted data produced by the client. The System stores Ciphertext without the ability to decrypt it.
- **Master_Password**: The secret known only to the user, used on the client to derive encryption keys. The Master_Password is never transmitted to or stored by the System.
- **Account_Password**: The credential used to authenticate an Account to the API. Distinct from the Master_Password.
- **Blind_Index**: A deterministic, keyed hash (e.g., HMAC-based) of a normalized plaintext value, computed on the client and stored by the System to enable equality or prefix matching without revealing plaintext.
- **Access_Token**: A short-lived JWT issued upon successful authentication and used to authorize API requests.
- **Refresh_Token**: A longer-lived token used to obtain a new Access_Token without re-authentication.
- **Environment_Variable**: A configuration value loaded from the runtime environment or a `.env` file at startup.

## Requirements

### Requirement 1: Account Registration

**User Story:** As a new user, I want to register an account with an email and password, so that I can store and retrieve my credential entries securely.

#### Acceptance Criteria

1. WHEN a registration request is received with a unique email and a password that meets the password policy, THE Auth_Service SHALL create a new Account and return a success response with HTTP status 201.
2. THE Auth_Service SHALL hash the Account_Password using a memory-hard or adaptive hashing algorithm (Argon2 or bcrypt) before persisting the Account.
3. THE Auth_Service SHALL persist only the hash of the Account_Password and SHALL exclude the plaintext Account_Password from storage and from all responses.
4. IF a registration request contains an email that is already associated with an existing Account, THEN THE Auth_Service SHALL reject the request with HTTP status 409 and a descriptive error message.
5. IF a registration request contains an email that does not conform to a valid email format, THEN THE Auth_Service SHALL reject the request with HTTP status 400 and a descriptive error message.
6. IF a registration request contains an Account_Password shorter than 12 characters, THEN THE Auth_Service SHALL reject the request with HTTP status 400 and a descriptive error message.

### Requirement 2: Account Authentication

**User Story:** As a registered user, I want to log in with my email and password, so that I receive a session token to access my entries.

#### Acceptance Criteria

1. WHEN an authentication request is received with an email and Account_Password that match an existing Account, THE Auth_Service SHALL issue an Access_Token and a Refresh_Token and return them with HTTP status 200.
2. THE Auth_Service SHALL verify the supplied Account_Password against the stored hash using a constant-time comparison.
3. IF an authentication request contains an email with no matching Account, THEN THE Auth_Service SHALL reject the request with HTTP status 401 and a generic authentication-failure message that does not reveal whether the email exists.
4. IF an authentication request contains an Account_Password that does not match the stored hash, THEN THE Auth_Service SHALL reject the request with HTTP status 401 and a generic authentication-failure message.
5. THE Access_Token SHALL be a JWT signed with a secret loaded from an Environment_Variable.
6. THE Access_Token SHALL include the Account identifier and an expiration claim no greater than 60 minutes from issuance.

### Requirement 3: Session Token Management

**User Story:** As an authenticated user, I want my session to be refreshable and revocable, so that I can stay logged in safely and end my session when needed.

#### Acceptance Criteria

1. WHEN a refresh request is received with a valid, unexpired Refresh_Token, THE Auth_Service SHALL issue a new Access_Token and return it with HTTP status 200.
2. IF a refresh request is received with an expired or invalid Refresh_Token, THEN THE Auth_Service SHALL reject the request with HTTP status 401 and a descriptive error message.
3. WHEN a logout request is received with a valid Refresh_Token, THE Auth_Service SHALL invalidate that Refresh_Token and return a success response with HTTP status 200.
4. IF an API request to a protected endpoint omits the Access_Token, THEN THE API SHALL reject the request with HTTP status 401.
5. IF an API request to a protected endpoint includes an expired or invalid Access_Token, THEN THE API SHALL reject the request with HTTP status 401.
6. THE Refresh_Token SHALL have an expiration no greater than 30 days from issuance.

### Requirement 4: Authentication Rate Limiting

**User Story:** As the system owner, I want authentication endpoints protected against brute-force attempts, so that account credentials are not guessed through repeated requests.

#### Acceptance Criteria

1. WHILE the number of failed authentication attempts from a single client identifier exceeds 10 within a 15-minute window, THE Auth_Service SHALL reject further authentication requests from that client identifier with HTTP status 429.
2. WHEN an authentication or registration request exceeds the configured request-rate threshold, THE API SHALL reject the request with HTTP status 429 and a `Retry-After` header.
3. THE Auth_Service SHALL load rate-limit thresholds and window durations from Environment_Variables.

### Requirement 5: Encrypted Entry Creation

**User Story:** As an authenticated user, I want to create an entry containing an encrypted title, body, and tags, so that my credentials are stored without the server being able to read them.

#### Acceptance Criteria

1. WHEN an authenticated create-entry request is received with an encrypted Title, an encrypted Body, and zero or more encrypted Tags, THE Entry_Service SHALL persist a new Entry associated with the requesting Account and return the created Entry identifier with HTTP status 201.
2. THE Entry_Service SHALL store the Title, Body, and Tags as Ciphertext exactly as received and SHALL NOT attempt to decrypt, parse, or transform the Ciphertext.
3. THE Entry_Service SHALL record a creation timestamp and an update timestamp for each Entry.
4. IF a create-entry request omits the encrypted Title, THEN THE Entry_Service SHALL reject the request with HTTP status 400 and a descriptive error message.
5. IF a create-entry request body exceeds the configured maximum entry size, THEN THE Entry_Service SHALL reject the request with HTTP status 413 and a descriptive error message.

### Requirement 6: Entry Retrieval

**User Story:** As an authenticated user, I want to retrieve my entries, so that I can decrypt and view my stored credentials on the client.

#### Acceptance Criteria

1. WHEN an authenticated request to list entries is received, THE Entry_Service SHALL return the set of Entries whose Owner is the requesting Account.
2. WHEN an authenticated request to retrieve a single Entry by identifier is received and the Entry's Owner is the requesting Account, THE Entry_Service SHALL return the Entry's Ciphertext fields, identifier, and timestamps with HTTP status 200.
3. IF an authenticated request references an Entry identifier that does not exist, THEN THE Entry_Service SHALL respond with HTTP status 404.
4. IF an authenticated request references an Entry whose Owner is a different Account, THEN THE Entry_Service SHALL respond with HTTP status 404.
5. THE Entry_Service SHALL return Title, Body, and Tags as the stored Ciphertext without modification.

### Requirement 7: Entry Update

**User Story:** As an authenticated user, I want to update an existing entry, so that I can change a stored credential when it changes.

#### Acceptance Criteria

1. WHEN an authenticated update request is received for an Entry whose Owner is the requesting Account, THE Entry_Service SHALL replace the supplied encrypted fields and the associated Blind_Index values and return the updated Entry with HTTP status 200.
2. WHEN an Entry is updated, THE Entry_Service SHALL set the update timestamp to the time of the update.
3. THE Entry_Service SHALL store updated Title, Body, and Tags as Ciphertext exactly as received without decryption or transformation.
4. IF an update request references an Entry identifier that does not exist, THEN THE Entry_Service SHALL respond with HTTP status 404.
5. IF an update request references an Entry whose Owner is a different Account, THEN THE Entry_Service SHALL respond with HTTP status 404.

### Requirement 8: Entry Deletion

**User Story:** As an authenticated user, I want to delete an entry, so that credentials I no longer need are removed.

#### Acceptance Criteria

1. WHEN an authenticated delete request is received for an Entry whose Owner is the requesting Account, THE Entry_Service SHALL remove the Entry and its associated Blind_Index values and respond with HTTP status 204.
2. IF a delete request references an Entry identifier that does not exist, THEN THE Entry_Service SHALL respond with HTTP status 404.
3. IF a delete request references an Entry whose Owner is a different Account, THEN THE Entry_Service SHALL respond with HTTP status 404.
4. WHEN an Entry is deleted, THE Entry_Service SHALL ensure the deleted Entry no longer appears in subsequent retrieval or search results for the Owner.

### Requirement 9: Search by Title

**User Story:** As an authenticated user, I want to search my entries by title, so that I can quickly find a stored credential by typing its name chat-style.

#### Acceptance Criteria

1. WHEN an authenticated search request is received with a Title Blind_Index, THE Search_Service SHALL return the set of Entries whose stored Title Blind_Index matches the supplied value and whose Owner is the requesting Account.
2. THE Search_Service SHALL match Entries using the Blind_Index without access to the plaintext Title.
3. IF a Title search yields no matching Entries, THEN THE Search_Service SHALL return an empty result set with HTTP status 200.
4. THE Search_Service SHALL restrict all search results to Entries whose Owner is the requesting Account.
5. THE System SHALL persist a Title Blind_Index for each Entry at creation and update time to enable Title search.

### Requirement 10: Search by Tags

**User Story:** As an authenticated user, I want to search my entries by tag, so that I can find all credentials grouped under a label.

#### Acceptance Criteria

1. WHEN an authenticated search request is received with one or more Tag Blind_Index values, THE Search_Service SHALL return the set of Entries whose stored Tag Blind_Index values match and whose Owner is the requesting Account.
2. THE Search_Service SHALL match Tags using the Blind_Index without access to the plaintext Tag.
3. IF a Tag search yields no matching Entries, THEN THE Search_Service SHALL return an empty result set with HTTP status 200.
4. THE Search_Service SHALL restrict all Tag search results to Entries whose Owner is the requesting Account.
5. THE System SHALL persist a Tag Blind_Index for each Tag of an Entry at creation and update time to enable Tag search.

### Requirement 11: User Data Isolation

**User Story:** As a user of a multi-user system, I want my entries to be accessible only to me, so that no other account can read or modify my credentials.

#### Acceptance Criteria

1. THE System SHALL associate every Entry with exactly one Owner.
2. WHEN any read, update, delete, or search operation on Entries is performed, THE System SHALL scope the operation to Entries whose Owner is the requesting Account.
3. IF an authenticated Account attempts any operation on an Entry owned by a different Account, THEN THE System SHALL respond as though the Entry does not exist with HTTP status 404.

### Requirement 12: Zero-Knowledge Guarantee

**User Story:** As a privacy-conscious user, I want the server to never have access to my plaintext content or master password, so that a server compromise does not expose my credentials.

#### Acceptance Criteria

1. THE System SHALL store Title, Body, and Tags exclusively as Ciphertext.
2. THE System SHALL NOT accept, log, or persist the Master_Password.
3. THE System SHALL NOT accept, log, or persist any encryption key capable of decrypting Entry Ciphertext.
4. WHERE the System emits application logs, THE System SHALL exclude Ciphertext, Account_Password values, Master_Password values, and Blind_Index inputs from the log output.

### Requirement 13: Secret and Configuration Management

**User Story:** As the system owner, I want all secrets and connection details loaded from the environment, so that no credential is committed to source control.

#### Acceptance Criteria

1. THE System SHALL load the PostgreSQL connection details from Environment_Variables at startup.
2. THE System SHALL load the JWT signing secret from an Environment_Variable at startup.
3. IF a required Environment_Variable is absent at startup, THEN THE System SHALL fail to start and emit a descriptive error identifying the missing variable by name.
4. THE System SHALL exclude the `.env` file from version control by listing it in `.gitignore`.
5. THE System SHALL provide a `.env.example` file that documents required Environment_Variable names without containing real secret values.

### Requirement 14: Persistence and Schema

**User Story:** As the system owner, I want data stored in a defined PostgreSQL schema, so that the database structure is consistent and isolated.

#### Acceptance Criteria

1. THE System SHALL persist Accounts and Entries in the PostgreSQL schema named `haramball`.
2. THE System SHALL identify each Account and each Entry with a unique identifier.
3. THE System SHALL enforce referential integrity between an Entry and its Owner Account.
4. WHEN an Account is deleted, THE System SHALL delete all Entries whose Owner is that Account.

### Requirement 15: API Design, Validation, and Error Handling

**User Story:** As a frontend developer, I want a consistent and well-validated API, so that I can integrate the client reliably.

#### Acceptance Criteria

1. THE API SHALL expose entry and search operations only on routes that require a valid Access_Token.
2. WHEN a request body fails schema validation, THE API SHALL reject the request with HTTP status 400 and a response identifying the invalid fields.
3. WHEN an unexpected internal error occurs, THE API SHALL respond with HTTP status 500 and a response that excludes stack traces and internal implementation details.
4. THE API SHALL return responses in JSON format with a consistent error structure containing an error code and a human-readable message.
5. WHEN a request targets an undefined route, THE API SHALL respond with HTTP status 404.
