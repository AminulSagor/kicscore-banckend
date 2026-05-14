import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { NewsArticle } from './news-article.entity';
import type { NewsEntityType } from '../types/news-entity-mapping.type';

@Entity('news_article_mapped_entities')
@Index(
  'idx_news_article_mapped_entity_unique',
  ['articleId', 'entityType', 'name'],
  {
    unique: true,
  },
)
@Index('idx_news_article_mapped_entity_lookup', ['entityType', 'name'])
export class NewsArticleMappedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'article_id', type: 'uuid' })
  articleId: string;

  @ManyToOne(() => NewsArticle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article: NewsArticle;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType: NewsEntityType;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'double precision', default: 0 })
  confidence: number;

  @Column({ name: 'matched_text', type: 'varchar', length: 220 })
  matchedText: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
