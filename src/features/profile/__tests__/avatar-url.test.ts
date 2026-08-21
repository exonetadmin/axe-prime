import { describe, expect, it } from 'vitest';
import { encodeAvatarUserId, trustedAvatarUrl, validAvatarRouteUserId } from '../avatar-url';

describe('trustedAvatarUrl', () => {
  it('keeps a local migrated avatar URL', () => {
    expect(trustedAvatarUrl('/api/v1/avatars/user-1?v=abcdef0123456789')).toBe(
      '/api/v1/avatars/user-1?v=abcdef0123456789'
    );
  });

  it('rejects external legacy storage URLs', () => {
    expect(trustedAvatarUrl('https://storage.example/avatar.jpg')).toBeNull();
    expect(trustedAvatarUrl('//storage.example/avatar.jpg')).toBeNull();
  });

  it('uses one canonical segment for legacy TEXT ids', () => {
    const userId = 'legacy user@example.com';
    const segment = 'legacy%20user%40example.com';
    expect(encodeAvatarUserId(userId)).toBe(segment);
    expect(validAvatarRouteUserId(userId)).toBe(userId);
    expect(trustedAvatarUrl(`/api/v1/avatars/${segment}?v=abcdef`)).toBe(
      `/api/v1/avatars/${segment}?v=abcdef`
    );
  });

  it('rejects traversal, control characters and non-canonical encodings', () => {
    expect(encodeAvatarUserId('../user')).toBeNull();
    expect(encodeAvatarUserId('..')).toBeNull();
    expect(encodeAvatarUserId('user\\child')).toBeNull();
    expect(encodeAvatarUserId('user\u0000child')).toBeNull();
    expect(trustedAvatarUrl('/api/v1/avatars/%2Fetc%2Fpasswd')).toBeNull();
    expect(trustedAvatarUrl('/api/v1/avatars/%75ser-1')).toBeNull();
    expect(trustedAvatarUrl('/api/v1/avatars/%')).toBeNull();
  });

  it('enforces the encoded segment ceiling for Unicode and ASCII ids', () => {
    expect(encodeAvatarUserId('a'.repeat(300))).toHaveLength(300);
    expect(encodeAvatarUserId('a'.repeat(301))).toBeNull();
    expect(encodeAvatarUserId('😀'.repeat(25))).toHaveLength(300);
    expect(encodeAvatarUserId('😀'.repeat(26))).toBeNull();
  });
});
