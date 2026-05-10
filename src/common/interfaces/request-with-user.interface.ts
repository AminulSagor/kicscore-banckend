import { Request } from 'express';

import type { JwtPayload } from '../../modules/auth/types/jwt-payload.type';

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
