import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { UniqueViolationError } from 'objection';
import { EnvironmentVariables } from '../config/environment.js';
import { LinkModel } from '../database/models/link.model.js';
import { CreateLinkDto } from './dto/create-link.dto.js';
import { LinkListResponse, LinkResponse } from './dto/link-response.dto.js';
import { ListLinksQueryDto } from './dto/list-links-query.dto.js';
import { LinkCacheService } from './link-cache.service.js';
import { isExpired } from './link-expiration.js';
import {
  CODE_ALPHABET,
  GENERATED_CODE_LENGTH,
  MAX_CODE_GENERATION_ATTEMPTS,
} from './links.constants.js';

@Injectable()
export class LinksService {
  private readonly baseUrl: string;

  constructor(
    private readonly cache: LinkCacheService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.baseUrl = config.get('BASE_URL', { infer: true });
  }

  async create(dto: CreateLinkDto): Promise<LinkResponse> {
    const expiresAt =
      dto.ttlSeconds === undefined ? null : new Date(Date.now() + dto.ttlSeconds * 1000);

    if (dto.alias !== undefined) {
      try {
        return this.toResponse(await this.insert(dto.alias, dto.url, expiresAt));
      } catch (error) {
        if (error instanceof UniqueViolationError) {
          throw new ConflictException(`Alias "${dto.alias}" is already taken`);
        }
        throw error;
      }
    }

    for (let attempt = 1; attempt <= MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        return this.toResponse(await this.insert(this.generateCode(), dto.url, expiresAt));
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) {
          throw error;
        }
      }
    }

    throw new InternalServerErrorException('Failed to generate a unique short code');
  }

  async findAll({ page, limit }: ListLinksQueryDto): Promise<LinkListResponse> {
    const { results, total } = await LinkModel.query()
      .orderBy([
        { column: 'createdAt', order: 'desc' },
        { column: 'id', order: 'desc' },
      ])
      .page(page - 1, limit);

    return { items: results.map((link) => this.toResponse(link)), total, page, limit };
  }

  async findOne(code: string): Promise<LinkResponse> {
    const link = await LinkModel.query().findOne({ code });

    if (!link) {
      throw new NotFoundException(`Link "${code}" not found`);
    }

    return this.toResponse(link);
  }

  async remove(code: string): Promise<void> {
    const deleted = await LinkModel.query().delete().where({ code });
    await this.cache.delete(code);

    if (deleted === 0) {
      throw new NotFoundException(`Link "${code}" not found`);
    }
  }

  private async insert(code: string, url: string, expiresAt: Date | null): Promise<LinkModel> {
    return LinkModel.query().insert({ code, url, expiresAt }).returning('*');
  }

  private generateCode(): string {
    return Array.from(
      { length: GENERATED_CODE_LENGTH },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    ).join('');
  }

  private toResponse(link: LinkModel): LinkResponse {
    return {
      id: link.id,
      code: link.code,
      url: link.url,
      shortUrl: `${this.baseUrl}/${link.code}`,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      isExpired: isExpired(link.expiresAt),
      clicks: link.clicks,
      lastAccessedAt: link.lastAccessedAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    };
  }
}
