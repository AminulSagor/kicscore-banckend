import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Follow } from './follow.entity';

@Entity('follow_metadata_items')
@Index('idx_follow_metadata_follow_key', ['followId', 'key'], { unique: true })
export class FollowMetadataItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'follow_id', type: 'uuid' })
  followId: string;

  @ManyToOne(() => Follow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follow_id' })
  follow: Follow;

  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
