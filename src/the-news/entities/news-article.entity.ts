import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NewsArticleContent } from './news-article-content.entity';
import { NewsArticleSource } from './news-article-source.entity';
import { NewsArticleCategory } from './news-article-category.entity';
import { NewsArticleMappedEntity } from './news-article-mapped-entity.entity';
import { NewsArticlePayloadItem } from './news-article-payload-item.entity';

@Entity('news_articles')
@Index('idx_news_articles_external_uuid', ['externalUuid'], { unique: true })
@Index('idx_news_articles_published_at', ['publishedAt'])
export class NewsArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_uuid', type: 'varchar', length: 100 })
  externalUuid: string;

  @Column({ type: 'varchar', length: 700 })
  title: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  language: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  locale: string | null;

  @Column({
    name: 'relevance_score',
    type: 'double precision',
    nullable: true,
  })
  relevanceScore: number | null;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt: Date;

  @Column({ name: 'last_fetched_at', type: 'timestamptz' })
  lastFetchedAt: Date;

  @OneToOne(() => NewsArticleContent, (content) => content.article)
  content: NewsArticleContent | null;

  @OneToOne(() => NewsArticleSource, (source) => source.article)
  source: NewsArticleSource | null;

  @OneToMany(() => NewsArticleCategory, (category) => category.article)
  categories: NewsArticleCategory[];

  @OneToMany(
    () => NewsArticleMappedEntity,
    (mappedEntity) => mappedEntity.article,
  )
  mappedEntities: NewsArticleMappedEntity[];

  @OneToMany(() => NewsArticlePayloadItem, (payloadItem) => payloadItem.article)
  payloadItems: NewsArticlePayloadItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
