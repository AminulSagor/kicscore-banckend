import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('news_notification_worker_states')
@Index('idx_news_notification_worker_state_key', ['stateKey'], { unique: true })
export class NewsNotificationWorkerState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'state_key', type: 'varchar', length: 80 })
  stateKey: string;

  @Column({ name: 'initial_scan_completed', type: 'boolean', default: false })
  initialScanCompleted: boolean;

  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
