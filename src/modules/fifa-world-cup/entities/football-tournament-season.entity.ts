import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FootballTournamentSeasonSource } from '../enums/football-tournament-season-source.enum';
import { FootballTournamentSeasonStatus } from '../enums/football-tournament-season-status.enum';

@Entity('football_tournament_seasons')
@Index(
  'idx_football_tournament_seasons_league_season',
  ['leagueId', 'season'],
  { unique: true },
)
export class FootballTournamentSeason {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'league_id', type: 'varchar', length: 80 })
  leagueId: string;

  @Column({ name: 'league_name', type: 'varchar', length: 120 })
  leagueName: string;

  @Column({ type: 'integer' })
  season: number;

  @Column({
    name: 'winner_team_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  winnerTeamId: string | null;

  @Column({
    name: 'winner_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  winnerName: string | null;

  @Column({ name: 'winner_logo', type: 'text', nullable: true })
  winnerLogo: string | null;

  @Column({
    name: 'runner_up_team_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  runnerUpTeamId: string | null;

  @Column({
    name: 'runner_up_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  runnerUpName: string | null;

  @Column({ name: 'runner_up_logo', type: 'text', nullable: true })
  runnerUpLogo: string | null;

  @Column({
    name: 'final_fixture_id',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  finalFixtureId: string | null;

  @Column({ type: 'varchar', length: 30 })
  source: FootballTournamentSeasonSource;

  @Column({ type: 'varchar', length: 20 })
  status: FootballTournamentSeasonStatus;

  @Column({ name: 'api_synced_at', type: 'timestamptz', nullable: true })
  apiSyncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
