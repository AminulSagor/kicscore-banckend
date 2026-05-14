import { IsIn } from 'class-validator';

import { UserStatus } from '../../users/enums/user-status.enum';

export class UpdateUserStatusDto {
  @IsIn([UserStatus.ACTIVE, UserStatus.SUSPENDED])
  status: UserStatus.ACTIVE | UserStatus.SUSPENDED;
}
