import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('football_fixture_notification_snapshots')
@Index('idx_football_fixture_snapshot_fixture', ['fixtureId'], { unique: true })
@Index('idx_football_fixture_snapshot_status', ['statusShort'])
export class FootballFixtureNotificationSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'fixture_id', type: 'varchar', length: 80 })
  fixtureId: string;

  @Column({ name: 'league_id', type: 'varchar', length: 80, nullable: true })
  leagueId: string | null;

  @Column({ name: 'home_team_id', type: 'varchar', length: 80 })
  homeTeamId: string;

  @Column({ name: 'away_team_id', type: 'varchar', length: 80 })
  awayTeamId: string;

  @Column({ name: 'home_goals', type: 'int', default: 0 })
  homeGoals: number;

  @Column({ name: 'away_goals', type: 'int', default: 0 })
  awayGoals: number;

  @Column({ name: 'status_short', type: 'varchar', length: 20, nullable: true })
  statusShort: string | null;

  @Column({ type: 'int', nullable: true })
  elapsed: number | null;

  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
