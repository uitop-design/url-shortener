export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}
