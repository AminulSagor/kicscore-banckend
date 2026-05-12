import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserNotification } from './user-notification.entity';

@Entity('user_notification_payload_items')
@Index('idx_user_notification_payload_key', ['notificationId', 'key'], {
  unique: true,
})
export class UserNotificationPayloadItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId: string;

  @ManyToOne(() => UserNotification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification: UserNotification;

  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
