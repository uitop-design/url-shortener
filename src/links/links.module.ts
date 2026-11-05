import { Module } from '@nestjs/common';
import { LinkCacheService } from './link-cache.service.js';
import { LinksController } from './links.controller.js';
import { LinksService } from './links.service.js';

@Module({
  controllers: [LinksController],
  providers: [LinksService, LinkCacheService],
  exports: [LinkCacheService],
})
export class LinksModule {}
