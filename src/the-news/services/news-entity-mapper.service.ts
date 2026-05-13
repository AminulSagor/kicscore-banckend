import { Injectable } from '@nestjs/common';

import { TheNewsApiArticle } from '../types/the-news-api.type';
import { NewsMappedEntity } from '../types/news-entity-mapping.type';

const LEAGUE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Premier League', pattern: /premier league/i },
  { name: 'La Liga', pattern: /la liga/i },
  { name: 'Serie A', pattern: /serie a/i },
  { name: 'Bundesliga', pattern: /bundesliga/i },
  { name: 'Ligue 1', pattern: /ligue 1/i },
  { name: 'Champions League', pattern: /champions league/i },
  { name: 'Europa League', pattern: /europa league/i },
  { name: 'MLS', pattern: /\bmls\b/i },
  { name: 'NBA', pattern: /\bnba\b/i },
  { name: 'NFL', pattern: /\bnfl\b/i },
  { name: 'MLB', pattern: /\bmlb\b/i },
  { name: 'NHL', pattern: /\bnhl\b/i },
];

const TEAM_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'FC Barcelona', pattern: /\bbarcelona\b/i },
  { name: 'Real Madrid', pattern: /\breal madrid\b/i },
  { name: 'Manchester United', pattern: /\bmanchester united\b/i },
  { name: 'Manchester City', pattern: /\bmanchester city\b/i },
  { name: 'Liverpool', pattern: /\bliverpool\b/i },
  { name: 'Arsenal', pattern: /\barsenal\b/i },
  { name: 'Chelsea', pattern: /\bchelsea\b/i },
  { name: 'Bayern Munich', pattern: /\bbayern munich\b/i },
  { name: 'Inter Milan', pattern: /\binter milan\b/i },
  { name: 'AC Milan', pattern: /\bac milan\b/i },
  { name: 'Juventus', pattern: /\bjuventus\b/i },
  { name: 'Paris Saint-Germain', pattern: /\bparis saint-germain\b/i },
  { name: 'PSG', pattern: /\bpsg\b/i },
  { name: 'FC', pattern: /\b[a-z0-9 .'-]+\sfc\b/i },
  { name: 'United', pattern: /\b[a-z0-9 .'-]+\sunited\b/i },
  { name: 'City', pattern: /\b[a-z0-9 .'-]+\scity\b/i },
];

@Injectable()
export class NewsEntityMapperService {
  mapArticle(article: TheNewsApiArticle): NewsMappedEntity[] {
    const sourceText = this.buildSourceText(article);
    const mappedEntities: NewsMappedEntity[] = [];

    for (const leaguePattern of LEAGUE_PATTERNS) {
      if (leaguePattern.pattern.test(sourceText)) {
        mappedEntities.push({
          type: 'league',
          name: leaguePattern.name,
          confidence: 0.9,
          matchedText: leaguePattern.name,
        });
      }
    }

    for (const teamPattern of TEAM_PATTERNS) {
      const match = sourceText.match(teamPattern.pattern);

      if (match) {
        mappedEntities.push({
          type: 'team',
          name: teamPattern.name,
          confidence: teamPattern.name === 'FC' || teamPattern.name === 'United' || teamPattern.name === 'City' ? 0.45 : 0.8,
          matchedText: match[0],
        });
      }
    }

    const playerMatches = this.extractPlayerCandidates(sourceText);

    for (const playerName of playerMatches) {
      mappedEntities.push({
        type: 'player',
        name: playerName,
        confidence: 0.55,
        matchedText: playerName,
      });
    }

    return this.dedupe(mappedEntities);
  }

  private buildSourceText(article: TheNewsApiArticle): string {
    return [article.title, article.description, article.keywords, article.snippet]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ');
  }

  private extractPlayerCandidates(text: string): string[] {
    const phraseMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g) ?? [];

    return phraseMatches.filter((candidate) => {
      const lowerCandidate = candidate.toLowerCase();

      return candidate.length >= 5
        && !LEAGUE_PATTERNS.some((pattern) => pattern.pattern.test(candidate))
        && !TEAM_PATTERNS.some((pattern) => pattern.pattern.test(candidate))
        && !['the', 'news', 'sports', 'league', 'club'].some((word) => lowerCandidate.includes(word));
    });
  }

  private dedupe(entities: NewsMappedEntity[]): NewsMappedEntity[] {
    const seen = new Set<string>();

    return entities.filter((entity) => {
      const key = `${entity.type}:${entity.name.toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }
}
