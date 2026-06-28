import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, from, map, switchMap } from 'rxjs';

import { IosWorldCupRestrictionService } from '../services/ios-world-cup-restriction.service';

@Injectable()
export class IosWorldCupInterceptor<T> implements NestInterceptor<
  T,
  T | null | StreamableFile
> {
  constructor(
    private readonly restrictionService: IosWorldCupRestrictionService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | null | StreamableFile> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!this.restrictionService.isIosRequest(request)) {
      return next.handle();
    }

    return from(
      this.restrictionService.assertDirectRequestAllowed(request),
    ).pipe(
      switchMap(() => next.handle()),
      map((result: T) => {
        if (result instanceof StreamableFile) {
          return result;
        }

        return this.restrictionService.sanitizeResponse(result);
      }),
    );
  }
}
