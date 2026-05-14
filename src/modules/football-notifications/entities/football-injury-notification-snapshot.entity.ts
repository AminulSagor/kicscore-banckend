import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';

@Entity('football_injury_notification_snapshots')
@Index('idx_football_injury_snapshot_dedupe', ['dedupeKey'], {
  unique: true,
})
@Index('idx_football_injury_snapshot_target', [
  'targetEntityType',
  'targetEntityId',
])
export class FootballInjuryNotificationSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'target_entity_type', type: 'varchar', length: 20 })
  targetEntityType: FollowEntityType;

  @Column({ name: 'target_entity_id', type: 'varchar', length: 80 })
  targetEntityId: string;

  @Column({ name: 'player_id', type: 'varchar', length: 80, nullable: true })
  playerId: string | null;

  @Column({ name: 'team_id', type: 'varchar', length: 80, nullable: true })
  teamId: string | null;

  @Column({ name: 'fixture_id', type: 'varchar', length: 80, nullable: true })
  fixtureId: string | null;

  @Column({ name: 'league_id', type: 'varchar', length: 80, nullable: true })
  leagueId: string | null;

  @Column({ name: 'season', type: 'varchar', length: 20, nullable: true })
  season: string | null;

  @Column({ name: 'injury_type', type: 'varchar', length: 120, nullable: true })
  injuryType: string | null;

  @Column({
    name: 'injury_reason',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  injuryReason: string | null;

  @Column({ name: 'fixture_date', type: 'varchar', length: 80, nullable: true })
  fixtureDate: string | null;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 250 })
  dedupeKey: string;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
