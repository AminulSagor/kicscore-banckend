import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('player_career_transfer_snapshots')
@Index('idx_player_career_transfer_unique', ['playerId', 'transferKey'], {
  unique: true,
})
export class PlayerCareerTransferSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'player_id', type: 'varchar', length: 40 })
  playerId: string;

  @Column({ name: 'transfer_key', type: 'varchar', length: 64 })
  transferKey: string;

  @Column({ name: 'transfer_date', type: 'date' })
  transferDate: string;

  @Column({
    name: 'transfer_type',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  transferType: string | null;

  @Column({ name: 'from_team_id', type: 'varchar', length: 40, nullable: true })
  fromTeamId: string | null;

  @Column({
    name: 'from_team_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  fromTeamName: string | null;

  @Column({
    name: 'from_team_logo',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  fromTeamLogo: string | null;

  @Column({ name: 'to_team_id', type: 'varchar', length: 40, nullable: true })
  toTeamId: string | null;

  @Column({
    name: 'to_team_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  toTeamName: string | null;

  @Column({
    name: 'to_team_logo',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  toTeamLogo: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
