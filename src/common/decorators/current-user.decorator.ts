import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { RequestWithUser } from '../interfaces/request-with-user.interface';
import type { JwtPayload } from '../../modules/auth/types/jwt-payload.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
