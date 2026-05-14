import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('football_lineup_notification_snapshots')
@Index('idx_football_lineup_snapshot_fixture', ['fixtureId'], { unique: true })
export class FootballLineupNotificationSnapshot {
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

  @Column({ name: 'lineup_available', type: 'boolean', default: false })
  lineupAvailable: boolean;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
