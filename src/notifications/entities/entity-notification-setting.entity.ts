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

import { User } from '../../modules/users/entities/user.entity';
import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
@Entity('entity_notification_settings')
@Index(
  'idx_entity_notification_settings_user_entity',
  ['userId', 'entityType', 'entityId'],
  {
    unique: true,
    where: '"user_id" IS NOT NULL',
  },
)
@Index(
  'idx_entity_notification_settings_installation_entity',
  ['installationId', 'entityType', 'entityId'],
  {
    unique: true,
    where: '"installation_id" IS NOT NULL AND "user_id" IS NULL',
  },
)
export class EntityNotificationSetting {
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

  @Column({ name: 'notifications_enabled', type: 'boolean', default: true })
  notificationsEnabled: boolean;

  @Column({ name: 'kickoff_enabled', type: 'boolean', default: true })
  kickoffEnabled: boolean;

  @Column({ name: 'match_started_enabled', type: 'boolean', default: true })
  matchStartedEnabled: boolean;

  @Column({ name: 'goal_enabled', type: 'boolean', default: true })
  goalEnabled: boolean;

  @Column({ name: 'red_card_enabled', type: 'boolean', default: true })
  redCardEnabled: boolean;

  @Column({ name: 'half_time_enabled', type: 'boolean', default: false })
  halfTimeEnabled: boolean;

  @Column({ name: 'full_time_enabled', type: 'boolean', default: true })
  fullTimeEnabled: boolean;

  @Column({ name: 'lineup_enabled', type: 'boolean', default: true })
  lineupEnabled: boolean;

  @Column({ name: 'transfer_enabled', type: 'boolean', default: true })
  transferEnabled: boolean;

  @Column({ name: 'injury_enabled', type: 'boolean', default: false })
  injuryEnabled: boolean;

  @Column({ name: 'news_enabled', type: 'boolean', default: false })
  newsEnabled: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
