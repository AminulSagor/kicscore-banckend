import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('football_standings_target_scans')
@Index('idx_football_standings_scan_target', ['leagueId', 'season'], {
  unique: true,
})
export class FootballStandingsTargetScan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'league_id', type: 'varchar', length: 80 })
  leagueId: string;

  @Column({ type: 'varchar', length: 20 })
  season: string;

  @Column({ name: 'initial_scan_completed', type: 'boolean', default: false })
  initialScanCompleted: boolean;

  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
