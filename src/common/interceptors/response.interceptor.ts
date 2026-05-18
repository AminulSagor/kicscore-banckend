import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

import {
  ApiResponse,
  ControllerResponse,
} from '../interfaces/api-response.interface';

function isControllerResponse<T>(
  value: unknown,
): value is ControllerResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'data' in value
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T | ControllerResponse<T>,
  ApiResponse<T> | StreamableFile
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T | ControllerResponse<T>>,
  ): Observable<ApiResponse<T> | StreamableFile> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((result) => {
        if (result instanceof StreamableFile) {
          return result;
        }

        const message = isControllerResponse<T>(result)
          ? result.message
          : 'Request successful';

        const data = isControllerResponse<T>(result)
          ? result.data
          : (result as T);

        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data: data ?? null,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }),
    );
  }
}
