import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { EnvironmentVariables } from '../config/environment.js';
import { REDIS } from '../redis/redis.constants.js';

const cachedLinkSchema = z.object({
  url: z.string(),
  expiresAt: z.iso.datetime().nullable(),
});

export interface CachedLink {
  url: string;
  expiresAt: Date | null;
}

@Injectable()
export class LinkCacheService {
  private readonly logger = new Logger(LinkCacheService.name);
  private readonly maxTtlMs: number;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxTtlMs = config.get('REDIRECT_CACHE_TTL_SECONDS', { infer: true }) * 1000;
  }

  async get(code: string): Promise<CachedLink | null> {
    try {
      const raw = await this.redis.get(this.key(code));
      if (raw === null) {
        return null;
      }

      const parsed = cachedLinkSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        await this.delete(code);
        return null;
      }

      return {
        url: parsed.data.url,
        expiresAt: parsed.data.expiresAt === null ? null : new Date(parsed.data.expiresAt),
      };
    } catch (error) {
      this.warn('read', code, error);
      return null;
    }
  }

  async set(code: string, link: CachedLink): Promise<void> {
    const ttlMs =
      link.expiresAt === null
        ? this.maxTtlMs
        : Math.min(link.expiresAt.getTime() - Date.now(), this.maxTtlMs);

    if (ttlMs <= 0) {
      return;
    }

    const value = JSON.stringify({
      url: link.url,
      expiresAt: link.expiresAt?.toISOString() ?? null,
    });

    try {
      await this.redis.set(this.key(code), value, 'PX', ttlMs);
    } catch (error) {
      this.warn('write', code, error);
    }
  }

  async delete(code: string): Promise<void> {
    try {
      await this.redis.del(this.key(code));
    } catch (error) {
      this.warn('delete', code, error);
    }
  }

  private key(code: string): string {
    return `link:${code}`;
  }

  private warn(operation: string, code: string, error: unknown): void {
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Failed to ${operation} cached link "${code}": ${reason}`);
  }
}
