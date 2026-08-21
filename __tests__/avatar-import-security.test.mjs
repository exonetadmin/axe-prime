// @vitest-environment node

import sharp from 'sharp';
import {
  assertLeastPrivilegeImporter,
  encodeAvatarUserId,
  inspectAvatarData,
} from '../scripts/import-legacy-avatars.mjs';

describe('legacy avatar import security', () => {
  it('uses the same canonical TEXT id policy as the authenticated routes', () => {
    expect(encodeAvatarUserId('legacy.user 1')).toBe('legacy.user%201');
    expect(() => encodeAvatarUserId('../user')).toThrow(/incompatível/);
    expect(() => encodeAvatarUserId('user\\admin')).toThrow(/incompatível/);
    expect(() => encodeAvatarUserId('x'.repeat(301))).toThrow(/excede/);
  });

  it('fully decodes a bounded static image before accepting it', async () => {
    const png = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 20, g: 40, b: 60, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    await expect(inspectAvatarData(png)).resolves.toBe('image/png');
    await expect(inspectAvatarData(png.subarray(0, png.length - 8))).rejects.toThrow(
      /imagem JPEG, PNG, WebP ou GIF estática/
    );
  });

  it('rejects non-raster formats even when the decoder recognizes them', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>'
    );
    await expect(inspectAvatarData(svg)).rejects.toThrow(/imagem JPEG, PNG, WebP ou GIF estática/);
  });

  it('fails closed when the one-time database role has excess or missing privileges', async () => {
    const minimumRole = {
      rolcanlogin: true,
      can_select_user_id: true,
      can_select_user_avatar: true,
      can_update_user_avatar: true,
      can_select_avatar_user_id: true,
      can_select_avatar_hash: true,
      can_insert_avatar: true,
    };
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [minimumRole] }),
    };

    await expect(assertLeastPrivilegeImporter(client)).resolves.toBeUndefined();

    client.query.mockResolvedValueOnce({ rows: [{ ...minimumRole, rolsuper: true }] });
    await expect(assertLeastPrivilegeImporter(client)).rejects.toThrow(/privilégio mínimo/);

    client.query.mockResolvedValueOnce({
      rows: [{ ...minimumRole, can_insert_avatar: false }],
    });
    await expect(assertLeastPrivilegeImporter(client)).rejects.toThrow(/privilégio mínimo/);
  });
});
