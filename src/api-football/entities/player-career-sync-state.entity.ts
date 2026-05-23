import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('player_career_sync_states')
@Index('idx_player_career_sync_state_player', ['playerId'], { unique: true })
export class PlayerCareerSyncState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'player_id', type: 'varchar', length: 40 })
  playerId: string;

  @Column({ name: 'current_season', type: 'int' })
  currentSeason: number;

  @Column({ name: 'initial_sync_completed', type: 'boolean', default: false })
  initialSyncCompleted: boolean;

  @Column({ name: 'full_sync_from_season', type: 'int', nullable: true })
  fullSyncFromSeason: number | null;

  @Column({ name: 'full_sync_to_season', type: 'int', nullable: true })
  fullSyncToSeason: number | null;

  @Column({
    name: 'current_stats_fresh_until',
    type: 'timestamptz',
    nullable: true,
  })
  currentStatsFreshUntil: Date | null;

  @Column({
    name: 'transfers_last_synced_at',
    type: 'timestamptz',
    nullable: true,
  })
  transfersLastSyncedAt: Date | null;

  @Column({ name: 'sync_in_progress', type: 'boolean', default: false })
  syncInProgress: boolean;

  @Column({ name: 'sync_started_at', type: 'timestamptz', nullable: true })
  syncStartedAt: Date | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
