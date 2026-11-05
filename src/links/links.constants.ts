export const GENERATED_CODE_LENGTH = 7;
export const MAX_CODE_GENERATION_ATTEMPTS = 5;
export const CODE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const ALIAS_MIN_LENGTH = 3;
export const ALIAS_MAX_LENGTH = 32;
export const ALIAS_PATTERN = /^[A-Za-z0-9_-]+$/;
export const RESERVED_ALIASES: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'docs',
  'docs-json',
  'docs-yaml',
  'health',
  'links',
  'static',
  'swagger',
]);

export const URL_MAX_LENGTH = 2048;
export const TTL_MIN_SECONDS = 60;
export const TTL_MAX_SECONDS = 365 * 24 * 60 * 60;

export const DEFAULT_PAGE = 1;
export const MAX_PAGE = 1_000_000;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
