import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { FollowEntityType } from '../enums/follow-entity-type.enum';

@Entity('follows')
@Index('idx_follows_user_active', ['userId', 'isActive'])
@Index('idx_follows_installation_active', ['installationId', 'isActive'])
@Index('idx_follows_entity', ['entityType', 'entityId', 'isActive'])
@Index('idx_follows_unique_user_entity', ['userId', 'entityType', 'entityId'], {
  unique: true,
  where: '"user_id" IS NOT NULL',
})
@Index(
  'idx_follows_unique_anonymous_entity',
  ['installationId', 'entityType', 'entityId'],
  {
    unique: true,
    where: '"user_id" IS NULL AND "installation_id" IS NOT NULL',
  },
)
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({
    name: 'installation_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  installationId: string | null;

  @Column({
    name: 'entity_type',
    type: 'enum',
    enum: FollowEntityType,
  })
  entityType: FollowEntityType;

  @Column({ name: 'entity_id', type: 'varchar', length: 80 })
  entityId: string;

  @Column({ name: 'entity_name', type: 'varchar', length: 160, nullable: true })
  entityName: string | null;

  @Column({ name: 'entity_logo', type: 'varchar', length: 500, nullable: true })
  entityLogo: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'notification_enabled', type: 'boolean', default: true })
  notificationEnabled: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
