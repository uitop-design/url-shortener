import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { STATUS_CODES } from 'node:http';
import { NotFoundError, UniqueViolationError } from 'objection';
import { ErrorResponse } from '../dto/error-response.dto.js';

const SERVER_ERROR_THRESHOLD = 500;

interface ResolvedError {
  statusCode: number;
  message: string | string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const { statusCode, message } = this.resolve(exception);

    if (statusCode >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const body: ErrorResponse = {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      path: String(httpAdapter.getRequestUrl(context.getRequest())),
      timestamp: new Date().toISOString(),
    };

    httpAdapter.reply(context.getResponse(), body, statusCode);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      return { statusCode: exception.getStatus(), message: this.extractMessage(exception) };
    }

    if (exception instanceof UniqueViolationError) {
      const target = exception.columns.length > 0 ? exception.columns.join(', ') : 'unique field';
      return {
        statusCode: HttpStatus.CONFLICT,
        message: `A record with the same ${target} already exists`,
      };
    }

    if (exception instanceof NotFoundError) {
      return { statusCode: HttpStatus.NOT_FOUND, message: 'Requested record was not found' };
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  private extractMessage(exception: HttpException): string | string[] {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    const message: unknown = Reflect.get(response, 'message');

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.map(String);
    }

    return exception.message;
  }
}
