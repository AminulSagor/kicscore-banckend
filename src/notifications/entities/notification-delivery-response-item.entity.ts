import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { NotificationDelivery } from './notification-delivery.entity';

@Entity('notification_delivery_response_items')
@Index('idx_notification_delivery_response_key', ['deliveryId', 'key'], {
  unique: true,
})
export class NotificationDeliveryResponseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'delivery_id', type: 'uuid' })
  deliveryId: string;

  @ManyToOne(() => NotificationDelivery, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_id' })
  delivery: NotificationDelivery;

  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
