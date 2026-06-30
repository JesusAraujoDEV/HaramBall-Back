import { HttpStatus } from '@nestjs/common';

/**
 * Stable, machine-readable error codes returned in the API error envelope.
 * The frontend can branch on these without parsing human-readable messages.
 */
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  NOT_FOUND = 'NOT_FOUND',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/** The consistent JSON error envelope returned by every failed request. */
export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    /** Optional per-field details for validation failures. */
    details?: unknown;
  };
}

/**
 * Domain error carrying an HTTP status, a stable error code, and a safe,
 * human-readable message. Thrown by services and translated to the API
 * envelope by the global exception filter.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: HttpStatus,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static validation(message = 'Validation failed', details?: unknown): AppError {
    return new AppError(
      ErrorCode.VALIDATION_FAILED,
      HttpStatus.BAD_REQUEST,
      message,
      details,
    );
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, message);
  }

  static invalidCredentials(message = 'Invalid credentials'): AppError {
    // Generic message that does not reveal whether the email exists (Req 2.3).
    return new AppError(
      ErrorCode.INVALID_CREDENTIALS,
      HttpStatus.UNAUTHORIZED,
      message,
    );
  }

  static emailExists(message = 'Email already registered'): AppError {
    return new AppError(
      ErrorCode.EMAIL_ALREADY_EXISTS,
      HttpStatus.CONFLICT,
      message,
    );
  }

  static tooManyRequests(message = 'Too many requests'): AppError {
    return new AppError(
      ErrorCode.TOO_MANY_REQUESTS,
      HttpStatus.TOO_MANY_REQUESTS,
      message,
    );
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
  }

  static payloadTooLarge(message = 'Payload too large'): AppError {
    return new AppError(
      ErrorCode.PAYLOAD_TOO_LARGE,
      HttpStatus.PAYLOAD_TOO_LARGE,
      message,
    );
  }
}
