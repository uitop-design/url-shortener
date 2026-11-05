import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BASE_URL: z.url({ protocol: /^https?$/ }).transform((value) => value.replace(/\/+$/, '')),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  REDIRECT_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(86400),
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
