import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('owner portal security headers', () => {
  it('allows foreground geolocation only from the same origin and keeps unrelated sensors blocked', () => {
    const headers = readFileSync(join(process.cwd(), 'public/_headers'), 'utf8');
    expect(headers).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()');
    expect(headers).not.toMatch(/geolocation=\(\*\)|geolocation=\("https?:/);
  });
});
