import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const errorResponseSchema = z
  .object({
    statusCode: z.number().int().meta({ example: 404 }),
    error: z.string().meta({ example: 'Not Found' }),
    message: z.union([z.string(), z.array(z.string())]).meta({ example: 'Link not found' }),
    path: z.string().meta({ example: '/api/links/abc1234' }),
    timestamp: z.iso.datetime().meta({ example: '2026-11-05T12:00:00.000Z' }),
  })
  .meta({ id: 'ErrorResponse' });

export class ErrorResponseDto extends createZodDto(errorResponseSchema) {}

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
