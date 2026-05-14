import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('football_fixture_event_notification_snapshots')
@Index('idx_football_fixture_event_snapshot_dedupe', ['dedupeKey'], {
  unique: true,
})
@Index('idx_football_fixture_event_snapshot_fixture', ['fixtureId'])
export class FootballFixtureEventNotificationSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'fixture_id', type: 'varchar', length: 80 })
  fixtureId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 40 })
  eventType: string;

  @Column({ name: 'event_detail', type: 'varchar', length: 80 })
  eventDetail: string;

  @Column({ name: 'team_id', type: 'varchar', length: 80, nullable: true })
  teamId: string | null;

  @Column({ name: 'player_id', type: 'varchar', length: 80, nullable: true })
  playerId: string | null;

  @Column({ type: 'int', nullable: true })
  elapsed: number | null;

  @Column({ type: 'int', nullable: true })
  extra: number | null;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 250 })
  dedupeKey: string;

  @Column({ name: 'notified_at', type: 'timestamptz' })
  notifiedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
