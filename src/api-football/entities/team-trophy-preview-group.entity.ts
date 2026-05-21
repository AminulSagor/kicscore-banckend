import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TeamTrophyPreviewSeason } from './team-trophy-preview-season.entity';

@Entity('team_trophy_preview_groups')
@Index('idx_team_trophy_preview_group_unique', ['teamId', 'leagueId'], {
  unique: true,
})
export class TeamTrophyPreviewGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'team_id', type: 'varchar', length: 40 })
  teamId: string;

  @Column({ name: 'league_id', type: 'int' })
  leagueId: number;

  @Column({ name: 'league_name', type: 'varchar', length: 120 })
  leagueName: string;

  @Column({ name: 'league_type', type: 'varchar', length: 30 })
  leagueType: string;

  @Column({ name: 'league_logo', type: 'varchar', length: 255, nullable: true })
  leagueLogo: string | null;

  @Column({ type: 'varchar', length: 80 })
  country: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  flag: string | null;

  @Column({ name: 'winner_count', type: 'int', default: 0 })
  winnerCount: number;

  @Column({ name: 'runner_up_count', type: 'int', default: 0 })
  runnerUpCount: number;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @OneToMany(() => TeamTrophyPreviewSeason, (season) => season.group)
  seasons: TeamTrophyPreviewSeason[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
