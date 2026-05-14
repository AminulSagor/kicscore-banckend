import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DeviceToken } from './device-token.entity';
import { NotificationDeliveryStatus } from '../enums/notification-delivery-status.enum';
import { UserNotification } from './user-notification.entity';
import { NotificationDeliveryResponseItem } from './notification-delivery-response-item.entity';

@Entity('notification_deliveries')
@Index('idx_notification_deliveries_status', ['status'])
@Index('idx_notification_deliveries_notification', ['notificationId'])
@Index('idx_notification_deliveries_device_token', ['deviceTokenId'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId: string;

  @ManyToOne(() => UserNotification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification: UserNotification;

  @Column({ name: 'device_token_id', type: 'uuid', nullable: true })
  deviceTokenId: string | null;

  @ManyToOne(() => DeviceToken, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'device_token_id' })
  deviceToken: DeviceToken | null;

  @Column({
    type: 'enum',
    enum: NotificationDeliveryStatus,
    default: NotificationDeliveryStatus.PENDING,
  })
  status: NotificationDeliveryStatus;

  @Column({
    name: 'provider_message_id',
    type: 'varchar',
    length: 250,
    nullable: true,
  })
  providerMessageId: string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 120, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @OneToMany(
    () => NotificationDeliveryResponseItem,
    (responseItem) => responseItem.delivery,
  )
  responseItems: NotificationDeliveryResponseItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
