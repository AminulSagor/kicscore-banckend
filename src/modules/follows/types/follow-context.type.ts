import { FollowEntityType } from '../enums/follow-entity-type.enum';

export interface FollowContext {
  userId: string | null;
  installationId: string | null;
  entityType: FollowEntityType;
  entityId: string;
}
