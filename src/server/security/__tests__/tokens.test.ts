// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCsrfToken,
  createRefreshToken,
  hashOpaqueToken,
  signAccessToken,
  verifyAccessToken,
  verifyCsrfToken,
} from '../tokens';

describe('security tokens', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = Buffer.alloc(32, 3).toString('base64');
    process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 4).toString('base64');
  });

  it('signs and verifies a strictly typed access JWT', async () => {
    const { token } = await signAccessToken({
      subject: 'user-1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      principalType: 'user',
      tokenVersion: 7,
    });

    const verified = await verifyAccessToken(token);
    expect(verified).toMatchObject({
      subject: 'user-1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      principalType: 'user',
      tokenVersion: 7,
    });
    expect(verified?.tokenId).toBeTruthy();
  });

  it('rejects a token signed by another key', async () => {
    const { token } = await signAccessToken({
      subject: 'user-1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      principalType: 'user',
      tokenVersion: 0,
    });
    process.env.JWT_ACCESS_SECRET = Buffer.alloc(32, 8).toString('base64');
    await expect(verifyAccessToken(token)).resolves.toBeNull();
  });

  it('creates high-entropy refresh tokens and stores only keyed hashes', () => {
    const token = createRefreshToken();
    expect(token.length).toBeGreaterThanOrEqual(64);
    expect(hashOpaqueToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOpaqueToken(token)).not.toBe(token);
  });

  it('authenticates CSRF tokens and rejects tampering', () => {
    const token = createCsrfToken('refresh-session-a');
    expect(verifyCsrfToken(token, 'refresh-session-a')).toBe(true);
    expect(verifyCsrfToken(token, 'refresh-session-b')).toBe(false);
    const replacement = token.endsWith('x') ? 'y' : 'x';
    expect(verifyCsrfToken(`${token.slice(0, -1)}${replacement}`, 'refresh-session-a')).toBe(false);
  });
});
