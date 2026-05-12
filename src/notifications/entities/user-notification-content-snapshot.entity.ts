import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserNotification } from './user-notification.entity';

@Entity('user_notification_content_snapshots')
export class UserNotificationContentSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id', type: 'uuid', unique: true })
  notificationId: string;

  @OneToOne(() => UserNotification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification: UserNotification;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'deep_link', type: 'varchar', length: 500, nullable: true })
  deepLink: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
