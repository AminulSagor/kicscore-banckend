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

@Entity('news_article_categories')
@Index('idx_news_article_category_unique', ['articleId', 'category'], {
  unique: true,
})
export class NewsArticleCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'article_id', type: 'uuid' })
  articleId: string;

  @ManyToOne(() => NewsArticle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article: NewsArticle;

  @Column({ type: 'varchar', length: 80 })
  category: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
