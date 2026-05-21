import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('team_trophy_preview_targets')
@Index('idx_team_trophy_preview_targets_team', ['teamId'], { unique: true })
export class TeamTrophyPreviewTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'team_id', type: 'varchar', length: 40 })
  teamId: string;

  @Column({ name: 'initial_sync_completed', type: 'boolean', default: false })
  initialSyncCompleted: boolean;

  @Column({ name: 'sync_in_progress', type: 'boolean', default: false })
  syncInProgress: boolean;

  @Column({ name: 'sync_started_at', type: 'timestamptz', nullable: true })
  syncStartedAt: Date | null;

  @Column({ name: 'last_synced_from_season', type: 'int', nullable: true })
  lastSyncedFromSeason: number | null;

  @Column({ name: 'last_synced_to_season', type: 'int', nullable: true })
  lastSyncedToSeason: number | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
