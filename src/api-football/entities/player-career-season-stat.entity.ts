import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PlayerCareerTeamType {
  CLUB = 'CLUB',
  NATIONAL_TEAM = 'NATIONAL_TEAM',
}

@Entity('player_career_season_stats')
@Index(
  'idx_player_career_season_stat_unique',
  ['playerId', 'season', 'teamId'],
  { unique: true },
)
export class PlayerCareerSeasonStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'player_id', type: 'varchar', length: 40 })
  playerId: string;

  @Column({ type: 'int' })
  season: number;

  @Column({ name: 'team_id', type: 'varchar', length: 40 })
  teamId: string;

  @Column({ name: 'team_name', type: 'varchar', length: 120 })
  teamName: string;

  @Column({ name: 'team_logo', type: 'varchar', length: 255, nullable: true })
  teamLogo: string | null;

  @Column({ name: 'team_type', type: 'varchar', length: 20 })
  teamType: PlayerCareerTeamType;

  @Column({ type: 'int', default: 0 })
  appearances: number;

  @Column({ type: 'int', default: 0 })
  goals: number;

  @Column({ name: 'is_current_team', type: 'boolean', default: false })
  isCurrentTeam: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
