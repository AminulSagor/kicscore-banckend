import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
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
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T | ControllerResponse<T>>,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((result) => {
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
