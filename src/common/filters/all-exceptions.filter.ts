import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError, ErrorCode, ErrorEnvelope } from '../errors/app-error';

/**
 * Global exception filter that converts every thrown error into the consistent
 * JSON error envelope `{ error: { code, message, details? } }`.
 *
 * - {@link AppError} maps to its declared status and code.
 * - Nest {@link HttpException}s (incl. validation 400, 404, 413, 429) map to a
 *   sensible code while preserving their status.
 * - Any other error becomes a 500 with no stack trace or internal detail
 *   leaked to the client (Requirement 15.3). Full details are logged server
 *   side only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.resolve(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Log full detail server-side only; never returned to the client.
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    body: ErrorEnvelope;
  } {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            details: exception.details,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
        },
      },
    };
  }

  private fromHttpException(exception: HttpException): {
    status: number;
    body: ErrorEnvelope;
  } {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    // Nest's ValidationPipe returns { message: string[] , ... }.
    let message = exception.message;
    let details: unknown;
    if (typeof payload === 'object' && payload !== null) {
      const obj = payload as Record<string, unknown>;
      if (Array.isArray(obj.message)) {
        details = obj.message;
        message = 'Validation failed';
      } else if (typeof obj.message === 'string') {
        message = obj.message;
      }
    }

    return {
      status,
      body: {
        error: {
          code: this.codeForStatus(status, exception),
          message,
          details,
        },
      },
    };
  }

  private codeForStatus(status: number, exception: HttpException): ErrorCode {
    if (exception instanceof PayloadTooLargeException) {
      return ErrorCode.PAYLOAD_TOO_LARGE;
    }
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.CONFLICT:
        return ErrorCode.EMAIL_ALREADY_EXISTS;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.TOO_MANY_REQUESTS;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return ErrorCode.PAYLOAD_TOO_LARGE;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
