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
import { DevicePlatform } from '../enums/device-platform.enum';

@Entity('device_tokens')
@Index(['userId', 'isActive'])
@Index(['installationId', 'isActive'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  token: string;

  @Column({
    type: 'enum',
    enum: DevicePlatform,
  })
  platform: DevicePlatform;

  @Column({ name: 'installation_id', type: 'varchar', length: 120 })
  installationId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'app_version', type: 'varchar', length: 50, nullable: true })
  appVersion: string | null;

  @Column({
    name: 'device_model',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  deviceModel: string | null;

  @Column({ name: 'os_version', type: 'varchar', length: 80, nullable: true })
  osVersion: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  locale: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  timezone: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
