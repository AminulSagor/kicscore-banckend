import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { NewsMappedEntity } from '../types/news-entity-mapping.type';

@Entity('news_articles')
export class NewsArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'external_uuid', type: 'varchar', length: 100 })
  externalUuid: string;

  @Column({ type: 'varchar', length: 700 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  keywords: string | null;

  @Column({ type: 'text', nullable: true })
  snippet: string | null;

  @Column({ type: 'text' })
  url: string;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  language: string | null;

  @Index()
  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source: string | null;

  @Column({
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  categories: string[];

  @Column({ type: 'varchar', length: 20, nullable: true })
  locale: string | null;

  @Column({
    name: 'relevance_score',
    type: 'double precision',
    nullable: true,
  })
  relevanceScore: number | null;

  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload: Record<string, any>;

  @Column({ name: 'mapped_entities', type: 'jsonb', default: () => "'[]'" })
  mappedEntities: NewsMappedEntity[];

  @Column({ name: 'last_fetched_at', type: 'timestamptz' })
  lastFetchedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
