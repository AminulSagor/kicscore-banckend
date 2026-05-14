export type NewsEntityType = 'team' | 'player' | 'league';

export interface NewsMappedEntity {
  type: NewsEntityType;
  name: string;
  confidence: number;
  matchedText: string;
}
