import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

import {
  TopPlayersQueryDto,
  TopTeamsQueryDto,
} from './dto/featured-football-query.dto';
import { FootballService } from './football.service';
import {
  FeaturedPlayerListItem,
  FeaturedTeamListItem,
  FeaturedTeamSectionResponse,
  FootballApiListResponse,
  FootballPlayerProfileItem,
  FootballTeamProfileItem,
  PaginationMeta,
  TopPlayersResponse,
  TopTeamsResponse,
} from './types/featured-football.type';
import {
  FEATURED_TEAM_PROMOTIONS,
  FeaturedTeamPromotion,
  FeaturedTeamSection,
} from 'src/common/constants/featured-football.constant';
import {
  PLAYER_SEARCH_PROMOTIONS,
  PlayerSearchPromotion,
} from 'src/common/constants/football-search-ranking.constant';

@Injectable()
export class FootballFeaturedService {
  private readonly logger = new Logger(FootballFeaturedService.name);

  constructor(
    private readonly footballService: FootballService,
    private readonly redisService: RedisService,
  ) {}

  //======= Public APIs =======//

  async getTopTeams(query: TopTeamsQueryDto): Promise<TopTeamsResponse> {
    const page = this.toPositiveNumber(query.page, 1);
    const limit = this.getSafeLimit(query.limit);
    const sectionKey = query.section ?? 'all';

    const cacheKey = [
      'football',
      'featured',
      'teams',
      'v1',
      sectionKey,
      String(page),
      String(limit),
    ].join(':');

    return this.getOrSetCachedResponse(cacheKey, async () => {
      const requestedSections: FeaturedTeamSection[] = query.section
        ? [query.section]
        : [FeaturedTeamSection.INTERNATIONAL, FeaturedTeamSection.CLUB];

      const sections = await Promise.all(
        requestedSections.map((section) => {
          return this.buildTeamSection(section, page, limit);
        }),
      );

      return {
        sections,
        cache: {
          ttlSeconds: this.getFeaturedTtlSeconds(),
        },
      };
    });
  }

  async getTopPlayers(query: TopPlayersQueryDto): Promise<TopPlayersResponse> {
    const page = this.toPositiveNumber(query.page, 1);
    const limit = this.getSafeLimit(query.limit);

    const cacheKey = [
      'football',
      'featured',
      'players',
      'v1',
      String(page),
      String(limit),
    ].join(':');

    return this.getOrSetCachedResponse(cacheKey, async () => {
      const sortedPromotions = [...PLAYER_SEARCH_PROMOTIONS].sort(
        (left, right) => right.priority - left.priority,
      );

      const total = sortedPromotions.length;
      const startIndex = (page - 1) * limit;
      const pagePromotions = sortedPromotions.slice(
        startIndex,
        startIndex + limit,
      );

      const items = await this.resolveInBatches(
        pagePromotions,
        async (promotion, pageIndex) => {
          const player = await this.resolvePlayerProfile(promotion);

          if (!player?.player?.id) {
            this.logger.warn(
              `Featured player could not be resolved: ${promotion.canonicalName}`,
            );

            return null;
          }

          return {
            rank: startIndex + pageIndex + 1,
            priority: promotion.priority,
            player: player.player,
          };
        },
      );

      return {
        items,
        meta: this.buildPaginationMeta(page, limit, total, items.length),
        cache: {
          ttlSeconds: this.getFeaturedTtlSeconds(),
        },
      };
    });
  }

  //======= Team Sections =======//

  private async buildTeamSection(
    section: FeaturedTeamSection,
    page: number,
    limit: number,
  ): Promise<FeaturedTeamSectionResponse> {
    const promotions = FEATURED_TEAM_PROMOTIONS.filter((item) => {
      return item.section === section;
    }).sort((left, right) => right.priority - left.priority);

    const total = promotions.length;
    const startIndex = (page - 1) * limit;
    const pagePromotions = promotions.slice(startIndex, startIndex + limit);

    const items = await this.resolveInBatches(
      pagePromotions,
      async (promotion, pageIndex) => {
        const team = await this.resolveTeamProfile(promotion);

        if (!team?.team?.id) {
          this.logger.warn(
            `Featured team could not be resolved: ${promotion.canonicalName}`,
          );

          return null;
        }

        return {
          rank: startIndex + pageIndex + 1,
          priority: promotion.priority,
          team: team.team,
        };
      },
    );

    return {
      key: section,
      title:
        section === FeaturedTeamSection.INTERNATIONAL
          ? 'International'
          : 'Club',
      items,
      meta: this.buildPaginationMeta(page, limit, total, items.length),
    };
  }

  //======= API-Football Resolution =======//

  private async resolveTeamProfile(
    promotion: FeaturedTeamPromotion,
  ): Promise<FootballTeamProfileItem | null> {
    const response = (await this.footballService.getFeaturedTeamProfile(
      promotion.lookupQuery,
    )) as FootballApiListResponse<FootballTeamProfileItem>;

    const candidates = response.response ?? [];

    return this.getBestTeamMatch(candidates, promotion);
  }

  private async resolvePlayerProfile(
    promotion: PlayerSearchPromotion,
  ): Promise<FootballPlayerProfileItem | null> {
    if (promotion.id) {
      const idResponse =
        (await this.footballService.getFeaturedPlayerProfileById(
          promotion.id,
        )) as FootballApiListResponse<FootballPlayerProfileItem>;

      const idMatch = (idResponse.response ?? []).find((item) => {
        return item.player?.id === promotion.id;
      });

      if (idMatch) {
        return idMatch;
      }
    }

    const searchResponse = (await this.footballService.getFeaturedPlayerProfile(
      promotion.lookupQuery,
    )) as FootballApiListResponse<FootballPlayerProfileItem>;

    const candidates = searchResponse.response ?? [];

    return this.getBestPlayerMatch(candidates, promotion);
  }

  private getBestTeamMatch(
    candidates: FootballTeamProfileItem[],
    promotion: FeaturedTeamPromotion,
  ): FootballTeamProfileItem | null {
    const ranked = candidates
      .map((candidate) => ({
        candidate,
        score: this.getNameMatchScore(
          candidate.team?.name ?? '',
          promotion.canonicalName,
          promotion.aliases,
        ),
      }))
      .sort((left, right) => right.score - left.score);

    return ranked[0]?.score > 0 ? ranked[0].candidate : null;
  }

  private getBestPlayerMatch(
    candidates: FootballPlayerProfileItem[],
    promotion: PlayerSearchPromotion,
  ): FootballPlayerProfileItem | null {
    const ranked = candidates
      .map((candidate) => {
        const searchableName = [
          candidate.player?.name,
          candidate.player?.firstname,
          candidate.player?.lastname,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' ');

        return {
          candidate,
          score: this.getNameMatchScore(
            searchableName,
            promotion.canonicalName,
            promotion.aliases,
          ),
        };
      })
      .sort((left, right) => right.score - left.score);

    return ranked[0]?.score > 0 ? ranked[0].candidate : null;
  }

  //======= Response Cache =======//

  private async getOrSetCachedResponse<T>(
    cacheKey: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cachedData = await this.redisService.get<T>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const lockKey = `lock:${cacheKey}`;
    const hasLock = await this.redisService.setLock(lockKey, 60);

    if (hasLock) {
      try {
        const data = await loader();

        await this.redisService.set(
          cacheKey,
          data,
          this.getFeaturedTtlSeconds(),
        );

        return data;
      } finally {
        await this.redisService.del(lockKey);
      }
    }

    for (let attempt = 0; attempt < 60; attempt += 1) {
      await this.delay(500);

      const dataAfterWait = await this.redisService.get<T>(cacheKey);

      if (dataAfterWait) {
        return dataAfterWait;
      }
    }

    throw new ServiceUnavailableException(
      'Featured football list is loading. Please try again shortly.',
    );
  }

  //======= Controlled Requests =======//

  private async resolveInBatches<T, R>(
    items: readonly T[],
    resolver: (item: T, index: number) => Promise<R | null>,
  ): Promise<Array<Awaited<R>>> {
    const resolvedItems: Array<Awaited<R>> = [];

    const concurrency = this.toPositiveNumber(
      process.env.FEATURED_LIST_RESOLVE_CONCURRENCY,
      3,
    );

    for (let index = 0; index < items.length; index += concurrency) {
      const batch = items.slice(index, index + concurrency);

      const batchResult = await Promise.all(
        batch.map((item, batchIndex) => {
          return resolver(item, index + batchIndex);
        }),
      );

      for (const item of batchResult) {
        if (item !== null) {
          resolvedItems.push(item);
        }
      }
    }

    return resolvedItems;
  }

  //======= Ranking Helpers =======//

  private getNameMatchScore(
    candidateName: string,
    canonicalName: string,
    aliases: readonly string[],
  ): number {
    const candidate = this.normalizeText(candidateName);
    const canonical = this.normalizeText(canonicalName);

    if (!candidate) {
      return 0;
    }

    if (candidate === canonical) {
      return 10000;
    }

    if (candidate.includes(canonical)) {
      return 9000;
    }

    const aliasScores = aliases.map((alias) => {
      const normalizedAlias = this.normalizeText(alias);

      if (candidate === normalizedAlias) {
        return 8500;
      }

      if (candidate.includes(normalizedAlias)) {
        return 7000;
      }

      if (normalizedAlias.includes(candidate)) {
        return 5000;
      }

      return 0;
    });

    return Math.max(...aliasScores, 0);
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  //======= General Helpers =======//

  private getFeaturedTtlSeconds(): number {
    return this.toPositiveNumber(
      process.env.CACHE_TTL_FEATURED_LISTS_SECONDS,
      86400,
    );
  }

  private getSafeLimit(value?: string): number {
    const requestedLimit = this.toPositiveNumber(value, 10);
    const maximumLimit = this.toPositiveNumber(
      process.env.FEATURED_LIST_MAX_LIMIT,
      25,
    );

    return Math.min(requestedLimit, maximumLimit);
  }

  private buildPaginationMeta(
    page: number,
    limit: number,
    total: number,
    returned: number,
  ): PaginationMeta {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      returned,
    };
  }

  private toPositiveNumber(value: unknown, fallback: number): number {
    const parsedValue = Number(value);

    if (
      value === undefined ||
      value === null ||
      value === '' ||
      Number.isNaN(parsedValue) ||
      parsedValue < 1
    ) {
      return fallback;
    }

    return Math.floor(parsedValue);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
