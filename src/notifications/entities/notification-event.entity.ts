import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationEventPayloadItem } from './notification-event-payload-item.entity';

@Entity('notification_events')
@Index('idx_notification_events_type', ['eventType'])
@Index('idx_notification_events_entity', ['entityType', 'entityId'])
@Index('idx_notification_events_dedupe_key', ['dedupeKey'], { unique: true })
export class NotificationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: NotificationType,
  })
  eventType: NotificationType;

  @Column({
    name: 'entity_type',
    type: 'enum',
    enum: FollowEntityType,
    nullable: true,
  })
  entityType: FollowEntityType | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 80, nullable: true })
  entityId: string | null;

  @Column({ name: 'fixture_id', type: 'varchar', length: 80, nullable: true })
  fixtureId: string | null;

  @Column({ name: 'team_id', type: 'varchar', length: 80, nullable: true })
  teamId: string | null;

  @Column({ name: 'player_id', type: 'varchar', length: 80, nullable: true })
  playerId: string | null;

  @Column({ name: 'league_id', type: 'varchar', length: 80, nullable: true })
  leagueId: string | null;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'deep_link', type: 'varchar', length: 500, nullable: true })
  deepLink: string | null;

  @Column({
    type: 'enum',
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 250 })
  dedupeKey: string;

  @OneToMany(
    () => NotificationEventPayloadItem,
    (payloadItem) => payloadItem.notificationEvent,
  )
  payloadItems: NotificationEventPayloadItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
