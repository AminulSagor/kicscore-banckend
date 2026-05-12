import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Follow } from './follow.entity';

@Entity('follow_entity_snapshots')
export class FollowEntitySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'follow_id', type: 'uuid', unique: true })
  followId: string;

  @OneToOne(() => Follow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follow_id' })
  follow: Follow;

  @Column({ name: 'entity_name', type: 'varchar', length: 160, nullable: true })
  entityName: string | null;

  @Column({ name: 'entity_logo', type: 'varchar', length: 500, nullable: true })
  entityLogo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
