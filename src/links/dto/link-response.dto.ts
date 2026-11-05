import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const linkResponseSchema = z.object({
  id: z.uuid(),
  code: z.string().meta({ example: 'aZ3kQ9x' }),
  url: z.url().meta({ example: 'https://docs.nestjs.com/techniques/caching' }),
  shortUrl: z.url().meta({ example: 'http://localhost:3000/aZ3kQ9x' }),
  expiresAt: z.iso.datetime().nullable(),
  isExpired: z.boolean(),
  clicks: z.number().int().meta({ example: 0 }),
  lastAccessedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const linkListResponseSchema = z.object({
  items: z.array(linkResponseSchema),
  total: z.number().int().meta({ example: 42 }),
  page: z.number().int().meta({ example: 1 }),
  limit: z.number().int().meta({ example: 20 }),
});

export class LinkResponseDto extends createZodDto(linkResponseSchema) {}

export class LinkListResponseDto extends createZodDto(linkListResponseSchema) {}

export type LinkResponse = z.infer<typeof linkResponseSchema>;
export type LinkListResponse = z.infer<typeof linkListResponseSchema>;
