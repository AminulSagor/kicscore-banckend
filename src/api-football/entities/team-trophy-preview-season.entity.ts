import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TeamTrophyPreviewGroup } from './team-trophy-preview-group.entity';

export enum TeamTrophyHonourType {
  WINNER = 'WINNER',
  RUNNER_UP = 'RUNNER_UP',
}

@Entity('team_trophy_preview_seasons')
@Index(
  'idx_team_trophy_preview_season_unique',
  ['groupId', 'honourType', 'season'],
  {
    unique: true,
  },
)
export class TeamTrophyPreviewSeason {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => TeamTrophyPreviewGroup, (group) => group.seasons, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group: TeamTrophyPreviewGroup;

  @Column({ name: 'honour_type', type: 'varchar', length: 20 })
  honourType: TeamTrophyHonourType;

  @Column({ type: 'int' })
  season: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
