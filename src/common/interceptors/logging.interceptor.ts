import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { redact } from '../logging/redact';

/**
 * Logs request/response metadata with a per-request correlation id, redacting
 * any sensitive field (ciphertext, passwords, blind indexes, tokens) from the
 * logged body so secrets never reach the logs (Requirement 12.4).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const requestId =
      (request.headers['x-request-id'] as string) ?? randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);

    const startedAt = Date.now();
    const { method, url } = request;

    // Body is redacted before logging; raw body is never emitted.
    this.logger.log(
      `[${requestId}] --> ${method} ${url} ${JSON.stringify(redact(request.body))}`,
    );

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - startedAt;
        this.logger.log(
          `[${requestId}] <-- ${method} ${url} ${response.statusCode} ${elapsed}ms`,
        );
      }),
    );
  }
}
