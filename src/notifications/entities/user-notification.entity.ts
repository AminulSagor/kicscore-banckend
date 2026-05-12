import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../modules/users/entities/user.entity';
import { NotificationEvent } from './notification-event.entity';
import { UserNotificationContentSnapshot } from './user-notification-content-snapshot.entity';
import { UserNotificationPayloadItem } from './user-notification-payload-item.entity';

@Entity('notifications')
@Index('idx_notifications_user_read', ['userId', 'isRead'])
@Index('idx_notifications_installation_read', ['installationId', 'isRead'])
export class UserNotification {
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

  @Column({ name: 'notification_event_id', type: 'uuid', nullable: true })
  notificationEventId: string | null;

  @ManyToOne(() => NotificationEvent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'notification_event_id' })
  notificationEvent: NotificationEvent | null;

  @OneToOne(
    () => UserNotificationContentSnapshot,
    (snapshot) => snapshot.notification,
  )
  contentSnapshot: UserNotificationContentSnapshot | null;

  @OneToMany(
    () => UserNotificationPayloadItem,
    (payloadItem) => payloadItem.notification,
  )
  payloadItems: UserNotificationPayloadItem[];

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
