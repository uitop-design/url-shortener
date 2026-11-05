import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT, MAX_PAGE } from '../links.constants.js';

export const listLinksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export class ListLinksQueryDto extends createZodDto(listLinksQuerySchema) {}
