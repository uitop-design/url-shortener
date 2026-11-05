import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { raw } from 'objection';
import { LinkModel } from '../database/models/link.model.js';
import { LinkCacheService } from '../links/link-cache.service.js';
import { isExpired } from '../links/link-expiration.js';

@Injectable()
export class RedirectService {
  constructor(private readonly cache: LinkCacheService) {}

  async resolve(code: string): Promise<string> {
    const cached = await this.cache.get(code);

    if (cached) {
      if (isExpired(cached.expiresAt)) {
        await this.cache.delete(code);
        throw this.expired(code);
      }

      if (await this.registerVisit(code)) {
        return cached.url;
      }

      await this.cache.delete(code);
    }

    const link = await LinkModel.query().findOne({ code });

    if (!link) {
      throw this.notFound(code);
    }

    if (isExpired(link.expiresAt)) {
      throw this.expired(code);
    }

    if (!(await this.registerVisit(code))) {
      throw this.notFound(code);
    }

    await this.cache.set(code, { url: link.url, expiresAt: link.expiresAt });

    return link.url;
  }

  private async registerVisit(code: string): Promise<boolean> {
    const updated = await LinkModel.query()
      .patch({ clicks: raw('?? + 1', ['clicks']), lastAccessedAt: new Date() })
      .where({ code });

    return updated > 0;
  }

  private notFound(code: string): NotFoundException {
    return new NotFoundException(`Link "${code}" not found`);
  }

  private expired(code: string): GoneException {
    return new GoneException(`Link "${code}" has expired`);
  }
}
