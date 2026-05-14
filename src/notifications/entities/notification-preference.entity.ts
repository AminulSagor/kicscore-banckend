import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../modules/users/entities/user.entity';

@Entity('notification_preferences')
@Index('idx_notification_preferences_user', ['userId'], {
  unique: true,
  where: '"user_id" IS NOT NULL',
})
@Index('idx_notification_preferences_installation', ['installationId'], {
  unique: true,
  where: '"installation_id" IS NOT NULL AND "user_id" IS NULL',
})
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({
    name: 'installation_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  installationId: string | null;

  @Column({ name: 'push_enabled', type: 'boolean', default: true })
  pushEnabled: boolean;

  @Column({ name: 'in_app_enabled', type: 'boolean', default: true })
  inAppEnabled: boolean;

  @Column({ name: 'match_alerts_enabled', type: 'boolean', default: true })
  matchAlertsEnabled: boolean;

  @Column({ name: 'team_alerts_enabled', type: 'boolean', default: true })
  teamAlertsEnabled: boolean;

  @Column({ name: 'league_alerts_enabled', type: 'boolean', default: true })
  leagueAlertsEnabled: boolean;

  @Column({ name: 'player_alerts_enabled', type: 'boolean', default: true })
  playerAlertsEnabled: boolean;

  @Column({ name: 'news_enabled', type: 'boolean', default: false })
  newsEnabled: boolean;

  @Column({ name: 'daily_digest_enabled', type: 'boolean', default: false })
  dailyDigestEnabled: boolean;

  @Column({ name: 'weekly_digest_enabled', type: 'boolean', default: false })
  weeklyDigestEnabled: boolean;

  @Column({ name: 'quiet_hours_enabled', type: 'boolean', default: false })
  quietHoursEnabled: boolean;

  @Column({
    name: 'quiet_hours_start',
    type: 'varchar',
    length: 5,
    nullable: true,
  })
  quietHoursStart: string | null;

  @Column({
    name: 'quiet_hours_end',
    type: 'varchar',
    length: 5,
    nullable: true,
  })
  quietHoursEnd: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  timezone: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
