import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { NotificationEvent } from './notification-event.entity';

@Entity('notification_event_payload_items')
@Index(
  'idx_notification_event_payload_event_key',
  ['notificationEventId', 'key'],
  { unique: true },
)
export class NotificationEventPayloadItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_event_id', type: 'uuid' })
  notificationEventId: string;

  @ManyToOne(() => NotificationEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_event_id' })
  notificationEvent: NotificationEvent;

  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
