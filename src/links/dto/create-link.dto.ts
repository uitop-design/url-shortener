import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  ALIAS_MAX_LENGTH,
  ALIAS_MIN_LENGTH,
  ALIAS_PATTERN,
  RESERVED_ALIASES,
  TTL_MAX_SECONDS,
  TTL_MIN_SECONDS,
  URL_MAX_LENGTH,
} from '../links.constants.js';

export const createLinkSchema = z.strictObject({
  url: z
    .string()
    .max(URL_MAX_LENGTH)
    .pipe(z.url({ protocol: /^https?$/, message: 'Must be a valid http or https URL' }))
    .meta({ example: 'https://docs.nestjs.com/techniques/caching' }),
  alias: z
    .string()
    .min(ALIAS_MIN_LENGTH)
    .max(ALIAS_MAX_LENGTH)
    .regex(ALIAS_PATTERN, 'Must contain only letters, digits, "_" and "-"')
    .refine((alias) => !RESERVED_ALIASES.has(alias.toLowerCase()), 'This alias is reserved')
    .optional()
    .meta({ example: 'nest-caching' }),
  ttlSeconds: z
    .number()
    .int()
    .min(TTL_MIN_SECONDS)
    .max(TTL_MAX_SECONDS)
    .optional()
    .meta({ description: 'Link lifetime in seconds; omit for a permanent link', example: 3600 }),
});

export class CreateLinkDto extends createZodDto(createLinkSchema) {}
