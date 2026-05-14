import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';

@Entity('football_transfer_notification_snapshots')
@Index('idx_football_transfer_snapshot_dedupe', ['dedupeKey'], {
  unique: true,
})
@Index('idx_football_transfer_snapshot_target', [
  'targetEntityType',
  'targetEntityId',
])
export class FootballTransferNotificationSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'target_entity_type', type: 'varchar', length: 20 })
  targetEntityType: FollowEntityType;

  @Column({ name: 'target_entity_id', type: 'varchar', length: 80 })
  targetEntityId: string;

  @Column({ name: 'player_id', type: 'varchar', length: 80, nullable: true })
  playerId: string | null;

  @Column({
    name: 'transfer_date',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  transferDate: string | null;

  @Column({
    name: 'transfer_type',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  transferType: string | null;

  @Column({ name: 'from_team_id', type: 'varchar', length: 80, nullable: true })
  fromTeamId: string | null;

  @Column({ name: 'to_team_id', type: 'varchar', length: 80, nullable: true })
  toTeamId: string | null;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 250 })
  dedupeKey: string;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
