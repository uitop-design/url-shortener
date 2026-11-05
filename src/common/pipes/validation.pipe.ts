import { BadRequestException } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';

export function formatValidationError(error: unknown): string[] {
  if (!(error instanceof ZodError)) {
    return ['Validation failed'];
  }

  return error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
  );
}

export const ValidationPipe = createZodValidationPipe({
  createValidationException: (error) => new BadRequestException(formatValidationError(error)),
});
