import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FollowEntityType } from 'src/modules/follows/enums/follow-entity-type.enum';

@Entity('football_injury_target_scans')
@Index('idx_football_injury_scan_target', ['entityType', 'entityId'], {
  unique: true,
})
export class FootballInjuryTargetScan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType: FollowEntityType;

  @Column({ name: 'entity_id', type: 'varchar', length: 80 })
  entityId: string;

  @Column({ name: 'initial_scan_completed', type: 'boolean', default: false })
  initialScanCompleted: boolean;

  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
