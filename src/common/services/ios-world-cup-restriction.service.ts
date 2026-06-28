import { Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { Buffer } from 'node:buffer';

import { FootballService } from '../../api-football/football.service';
import { FollowEntityType } from '../../modules/follows/enums/follow-entity-type.enum';
import {
  IOS_PLATFORM_HEADER,
  IOS_WORLD_CUP_NOT_FOUND_MESSAGE,
  WORLD_CUP_LEAGUE_ID,
  WORLD_CUP_LEAGUE_ID_STRING,
} from '../constants/ios-world-cup.constant';

const OMIT_VALUE = Symbol('IOS_WORLD_CUP_OMIT_VALUE');

type MutableRecord = Record<string, unknown>;

type ApiFootballFixtureLookupResponse = {
  response?: Array<{
    league?: {
      id?: number | string;
    };
  }>;
};

@Injectable()
export class IosWorldCupRestrictionService {
  constructor(private readonly footballService: FootballService) {}

  isIosRequest(request: Request): boolean {
    const headerValue = request.headers[IOS_PLATFORM_HEADER];

    if (Array.isArray(headerValue)) {
      return headerValue.some((value) => this.isTrue(value));
    }

    return this.isTrue(headerValue);
  }

  async assertDirectRequestAllowed(request: Request): Promise<void> {
    if (!this.isIosRequest(request)) {
      return;
    }

    if (this.isDirectWorldCupLeagueRequest(request)) {
      this.throwNotFound();
    }

    const entityReference = this.getEntityReference(request);

    if (
      entityReference &&
      entityReference.entityType === FollowEntityType.LEAGUE &&
      entityReference.entityId === WORLD_CUP_LEAGUE_ID_STRING
    ) {
      this.throwNotFound();
    }

    const fixtureIds = this.getDirectFixtureIds(request, entityReference);

    for (const fixtureId of fixtureIds) {
      const isWorldCupFixture = await this.isWorldCupFixture(fixtureId);

      if (isWorldCupFixture) {
        this.throwNotFound();
      }
    }
  }

  sanitizeResponse<T>(value: T): T | null {
    const sanitizedValue = this.sanitizeNode(value);

    if (sanitizedValue === OMIT_VALUE) {
      return null;
    }

    return sanitizedValue as T;
  }

  private isDirectWorldCupLeagueRequest(request: Request): boolean {
    const path = this.normalizePath(request.path);

    const routeLeagueId = this.readScalar(request.params?.leagueId);

    const queryLeagueId = this.readScalar(request.query?.league);

    if (this.isWorldCupId(routeLeagueId) || this.isWorldCupId(queryLeagueId)) {
      return true;
    }

    if (
      path === '/football/leagues' &&
      this.isWorldCupId(this.readScalar(request.query?.id))
    ) {
      return true;
    }

    if (path === '/football/leagues/by-ids') {
      const leagueIds = this.parseNumberList(
        this.readScalar(request.query?.ids),
      );

      return leagueIds.length === 1 && leagueIds[0] === WORLD_CUP_LEAGUE_ID;
    }

    return false;
  }

  private getDirectFixtureIds(
    request: Request,
    entityReference: {
      entityType: FollowEntityType;
      entityId: string;
    } | null,
  ): string[] {
    const fixtureIds = new Set<string>();
    const path = this.normalizePath(request.path);

    this.addPositiveIntegerString(
      fixtureIds,
      this.readScalar(request.params?.fixtureId),
    );

    this.addPositiveIntegerString(
      fixtureIds,
      this.readScalar(request.query?.fixture),
    );

    if (path === '/football/fixtures') {
      this.addPositiveIntegerString(
        fixtureIds,
        this.readScalar(request.query?.id),
      );

      const ids = this.parseNumberList(this.readScalar(request.query?.ids));

      /*
       * A single-item ids request is treated as a direct fixture
       * request. Mixed fixture requests are filtered in the response.
       */
      if (ids.length === 1) {
        fixtureIds.add(String(ids[0]));
      }
    }

    if (
      entityReference &&
      entityReference.entityType === FollowEntityType.FIXTURE
    ) {
      this.addPositiveIntegerString(fixtureIds, entityReference.entityId);
    }

    return Array.from(fixtureIds);
  }

  private getEntityReference(request: Request): {
    entityType: FollowEntityType;
    entityId: string;
  } | null {
    const body = this.isRecord(request.body) ? request.body : {};

    const query = this.isRecord(request.query) ? request.query : {};

    const params = this.isRecord(request.params) ? request.params : {};

    const entityTypeValue =
      this.readScalar(body.entityType) ??
      this.readScalar(query.entityType) ??
      this.readScalar(params.entityType);

    const entityIdValue =
      this.readScalar(body.entityId) ??
      this.readScalar(query.entityId) ??
      this.readScalar(params.entityId);

    if (!entityTypeValue || !entityIdValue) {
      return null;
    }

    const normalizedEntityType = entityTypeValue.toUpperCase();

    const validEntityTypes = Object.values(FollowEntityType);

    if (!validEntityTypes.includes(normalizedEntityType as FollowEntityType)) {
      return null;
    }

    return {
      entityType: normalizedEntityType as FollowEntityType,
      entityId: entityIdValue,
    };
  }

  private async isWorldCupFixture(fixtureId: string): Promise<boolean> {
    const data = (await this.footballService.getFixtureById(
      fixtureId,
    )) as ApiFootballFixtureLookupResponse;

    return (data.response ?? []).some((fixture) => {
      return this.isWorldCupId(fixture.league?.id);
    });
  }

  private sanitizeNode(
    value: unknown,
    parentKey?: string,
  ): unknown | typeof OMIT_VALUE {
    if (value instanceof Date || Buffer.isBuffer(value)) {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => {
          return this.sanitizeNode(item, parentKey);
        })
        .filter((item) => item !== OMIT_VALUE);
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (!this.isRecord(value)) {
      return value;
    }

    if (this.isWorldCupRecord(value, parentKey)) {
      return OMIT_VALUE;
    }

    const sanitizedRecord: MutableRecord = {};

    for (const [key, childValue] of Object.entries(value)) {
      const sanitizedChild = this.sanitizeNode(childValue, key);

      if (sanitizedChild !== OMIT_VALUE) {
        sanitizedRecord[key] = sanitizedChild;
      }
    }

    this.normalizeCollectionMetadata(value, sanitizedRecord);

    return sanitizedRecord;
  }

  private isWorldCupRecord(record: MutableRecord, parentKey?: string): boolean {
    if (
      this.isWorldCupId(record.leagueId) ||
      this.isWorldCupId(record.league_id)
    ) {
      return true;
    }

    if (parentKey === 'league' && this.isWorldCupId(record.id)) {
      return true;
    }

    const leagueValue = record.league;

    if (this.isRecord(leagueValue)) {
      if (
        this.isWorldCupId(leagueValue.id) ||
        this.isWorldCupName(leagueValue.name)
      ) {
        return true;
      }
    } else if (this.isWorldCupName(leagueValue)) {
      return true;
    }

    if (
      this.isWorldCupName(record.competition) ||
      this.isWorldCupName(record.group)
    ) {
      return true;
    }

    if (
      String(record.entityType ?? '').toUpperCase() ===
        FollowEntityType.LEAGUE &&
      this.isWorldCupId(record.entityId)
    ) {
      return true;
    }

    /*
     * Player recent-match responses contain the complete
     * fixture under an inner "fixture" property.
     */
    const nestedFixture = record.fixture;

    if (
      this.isRecord(nestedFixture) &&
      this.isWorldCupRecord(nestedFixture, 'fixture')
    ) {
      return true;
    }

    /*
     * In-app notification rows contain the league ID inside
     * notificationEvent.
     */
    const notificationEvent = record.notificationEvent;

    if (
      this.isRecord(notificationEvent) &&
      this.isWorldCupRecord(notificationEvent, 'notificationEvent')
    ) {
      return true;
    }

    return false;
  }

  private normalizeCollectionMetadata(
    originalRecord: MutableRecord,
    sanitizedRecord: MutableRecord,
  ): void {
    this.normalizeApiFootballResponseMetadata(originalRecord, sanitizedRecord);

    this.normalizeItemsMetadata(originalRecord, sanitizedRecord);

    this.normalizeFixtureGroupMetadata(sanitizedRecord);
  }

  private normalizeApiFootballResponseMetadata(
    originalRecord: MutableRecord,
    sanitizedRecord: MutableRecord,
  ): void {
    if (!Array.isArray(sanitizedRecord.response)) {
      return;
    }

    const originalResponseLength = Array.isArray(originalRecord.response)
      ? originalRecord.response.length
      : sanitizedRecord.response.length;

    const removedCount = Math.max(
      0,
      originalResponseLength - sanitizedRecord.response.length,
    );

    if ('results' in originalRecord) {
      sanitizedRecord.results = sanitizedRecord.response.length;
    }

    /*
     * Remove League ID 1 from metadata returned by
     * /football/leagues/top and /football/leagues/by-ids.
     */
    if (
      sanitizedRecord.get === 'leagues' &&
      this.isRecord(sanitizedRecord.parameters)
    ) {
      const parameters = {
        ...sanitizedRecord.parameters,
      };

      const ids = this.parseNumberList(this.readScalar(parameters.ids)).filter(
        (id) => {
          return id !== WORLD_CUP_LEAGUE_ID;
        },
      );

      if (ids.length > 0) {
        parameters.ids = ids.join('-');
      } else {
        delete parameters.ids;
      }

      sanitizedRecord.parameters = parameters;
    }

    if (this.isRecord(sanitizedRecord.backendPaging)) {
      const backendPaging = {
        ...sanitizedRecord.backendPaging,
      };

      const oldTotalItems = this.toFiniteNumber(backendPaging.totalItems);

      const limit = this.toPositiveNumber(backendPaging.limit);

      if (oldTotalItems !== null) {
        const totalItems = Math.max(0, oldTotalItems - removedCount);

        backendPaging.totalItems = totalItems;

        if (limit !== null) {
          backendPaging.totalPages = Math.ceil(totalItems / limit);
        }
      }

      sanitizedRecord.backendPaging = backendPaging;
    }
  }

  private normalizeItemsMetadata(
    originalRecord: MutableRecord,
    sanitizedRecord: MutableRecord,
  ): void {
    if (!Array.isArray(sanitizedRecord.items)) {
      return;
    }

    const originalItemsLength = Array.isArray(originalRecord.items)
      ? originalRecord.items.length
      : sanitizedRecord.items.length;

    const removedCount = Math.max(
      0,
      originalItemsLength - sanitizedRecord.items.length,
    );

    if (!this.isRecord(sanitizedRecord.meta)) {
      return;
    }

    const meta = {
      ...sanitizedRecord.meta,
    };

    const limit = this.toPositiveNumber(meta.limit);

    for (const totalKey of ['total', 'totalItems', 'totalFixtures']) {
      const oldTotal = this.toFiniteNumber(meta[totalKey]);

      if (oldTotal !== null) {
        meta[totalKey] = Math.max(0, oldTotal - removedCount);
      }
    }

    if ('returned' in meta) {
      meta.returned = sanitizedRecord.items.length;
    }

    const oldTotalLeagues = this.toFiniteNumber(meta.totalLeagues);

    if (oldTotalLeagues !== null) {
      meta.totalLeagues = Math.max(0, oldTotalLeagues - removedCount);
    }

    const oldTotalMatches = this.toFiniteNumber(meta.totalMatches);

    if (oldTotalMatches !== null) {
      const originalMatches = this.countMatches(originalRecord.items);

      const sanitizedMatches = this.countMatches(sanitizedRecord.items);

      const removedMatches = Math.max(0, originalMatches - sanitizedMatches);

      meta.totalMatches = Math.max(0, oldTotalMatches - removedMatches);
    }

    const totalForPaging =
      this.toFiniteNumber(meta.total) ??
      this.toFiniteNumber(meta.totalItems) ??
      this.toFiniteNumber(meta.totalLeagues) ??
      this.toFiniteNumber(meta.totalFixtures);

    if (limit !== null && totalForPaging !== null && 'totalPages' in meta) {
      meta.totalPages = Math.ceil(totalForPaging / limit);
    }

    sanitizedRecord.meta = meta;
  }

  private countMatches(value: unknown): number {
    if (!Array.isArray(value)) {
      return 0;
    }

    return value.reduce((total, item) => {
      if (!this.isRecord(item)) {
        return total;
      }

      const matchCount = this.toFiniteNumber(item.matchCount);

      if (matchCount !== null) {
        return total + matchCount;
      }

      if (Array.isArray(item.fixtures)) {
        return total + item.fixtures.length;
      }

      return total;
    }, 0);
  }

  private normalizeFixtureGroupMetadata(sanitizedRecord: MutableRecord): void {
    if (Array.isArray(sanitizedRecord.fixtures)) {
      sanitizedRecord.matchCount = sanitizedRecord.fixtures.length;
    }
  }

  private throwNotFound(): never {
    throw new NotFoundException(IOS_WORLD_CUP_NOT_FOUND_MESSAGE);
  }

  private isTrue(value: unknown): boolean {
    return typeof value === 'string' && value.trim().toLowerCase() === 'true';
  }

  private isWorldCupId(value: unknown): boolean {
    if (typeof value === 'number') {
      return value === WORLD_CUP_LEAGUE_ID;
    }

    return (
      typeof value === 'string' && value.trim() === WORLD_CUP_LEAGUE_ID_STRING
    );
  }

  private sanitizeString(value: string): string | typeof OMIT_VALUE {
    if (!this.containsWorldCupText(value)) {
      return value;
    }

    /*
     * This keeps non-World-Cup sentences from composite
     * "about" responses while removing the restricted sentence.
     */
    const sentences = value.match(/[^.!?]+[.!?]?/g) ?? [value];

    const allowedSentences = sentences
      .map((sentence) => sentence.trim())
      .filter((sentence) => {
        return sentence.length > 0 && !this.containsWorldCupText(sentence);
      });

    if (!allowedSentences.length) {
      return OMIT_VALUE;
    }

    return allowedSentences.join(' ');
  }

  private containsWorldCupText(value: string): boolean {
    return /\b(?:fifa[\s-]+)?world[\s-]+cup\b/i.test(value);
  }

  private isWorldCupName(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const normalizedValue = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return (
      normalizedValue === 'world cup' || normalizedValue === 'fifa world cup'
    );
  }

  private normalizePath(path: string): string {
    if (!path) {
      return '/';
    }

    if (path.length > 1 && path.endsWith('/')) {
      return path.slice(0, -1);
    }

    return path;
  }

  private readScalar(value: unknown): string | undefined {
    if (Array.isArray(value)) {
      return value.length > 0 ? this.readScalar(value[0]) : undefined;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  private parseNumberList(value: string | undefined): number[] {
    if (!value) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .replace(/,/g, '-')
          .split('-')
          .map((item) => Number(item.trim()))
          .filter((item) => {
            return Number.isInteger(item) && item > 0;
          }),
      ),
    );
  }

  private addPositiveIntegerString(
    target: Set<string>,
    value: string | undefined,
  ): void {
    if (!value) {
      return;
    }

    const numericValue = Number(value);

    if (Number.isInteger(numericValue) && numericValue > 0) {
      target.add(String(numericValue));
    }
  }

  private toFiniteNumber(value: unknown): number | null {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private toPositiveNumber(value: unknown): number | null {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : null;
  }

  private isRecord(value: unknown): value is MutableRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
