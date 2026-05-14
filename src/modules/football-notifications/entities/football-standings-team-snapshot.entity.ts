import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('football_standings_team_snapshots')
@Index(
  'idx_football_standings_team_snapshot_unique',
  ['leagueId', 'season', 'teamId'],
  {
    unique: true,
  },
)
export class FootballStandingsTeamSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'league_id', type: 'varchar', length: 80 })
  leagueId: string;

  @Column({ type: 'varchar', length: 20 })
  season: string;

  @Column({ name: 'team_id', type: 'varchar', length: 80 })
  teamId: string;

  @Column({ name: 'team_name', type: 'varchar', length: 160, nullable: true })
  teamName: string | null;

  @Column({ type: 'int' })
  rank: number;

  @Column({ type: 'int' })
  points: number;

  @Column({ name: 'goals_diff', type: 'int', default: 0 })
  goalsDiff: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  form: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  description: string | null;

  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
