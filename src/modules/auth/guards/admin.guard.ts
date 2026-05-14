import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { UserRole } from '../../users/enums/user-role.enum';

interface RequestWithUser {
  user?: {
    sub?: string;
    role?: UserRole;
  };
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (request.user?.role === UserRole.ADMIN) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
