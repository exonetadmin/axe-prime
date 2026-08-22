import 'server-only';

import { createHash } from 'node:crypto';
import { execute, queryOne, withTransaction } from '@/src/server/db/postgres';
import { hashPassword, verifyPassword } from '@/src/server/security/password';
import { encodeAvatarUserId } from './avatar-url';
import { validatePasswordPolicy } from '@/lib/password-policy';

export type AvatarContentType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export type StoredAvatar = {
  content_type: AvatarContentType;
  data: Buffer;
  sha256: string;
  updated_at: Date | string;
};

export class CurrentPasswordInvalidError extends Error {
  constructor() {
    super('Senha atual incorreta.');
    this.name = 'CurrentPasswordInvalidError';
  }
}

export class InvalidNewPasswordError extends Error {
  constructor() {
    super('A nova senha deve ter entre 8 e 128 caracteres e incluir letra, número e caractere especial.');
    this.name = 'InvalidNewPasswordError';
  }
}

export class ProfileRepository {
  async updateName(userId: string, name: string): Promise<boolean> {
    return (await execute('UPDATE users SET name = $2 WHERE id = $1', [userId, name])) === 1;
  }

  async updatePhone(userId: string, phone: string): Promise<boolean> {
    return (await execute('UPDATE users SET phone = $2 WHERE id = $1', [userId, phone])) === 1;
  }

  async updateCpf(userId: string, cpf: string): Promise<boolean> {
    return (await execute('UPDATE users SET cpf = $2 WHERE id = $1', [userId, cpf])) === 1;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const normalizedNewPassword = newPassword.normalize('NFC');
    const newPasswordLength = Array.from(normalizedNewPassword).length;
    if (newPasswordLength > 128) {
      throw new InvalidNewPasswordError();
    }
    const current = await queryOne<{ password_hash: string; name: string; email: string }>(
      'SELECT password_hash, name, email FROM users WHERE id = $1 AND is_active = TRUE',
      [userId]
    );
    const normalizedCurrentPassword = currentPassword.normalize('NFC');
    if (!current) throw new CurrentPasswordInvalidError();
    const passwordPolicyError = validatePasswordPolicy(normalizedNewPassword, [current.name, current.email]);
    let currentPasswordValid = current
      ? await verifyPassword(normalizedCurrentPassword, current.password_hash)
      : false;
    if (!currentPasswordValid && normalizedCurrentPassword !== currentPassword) {
      currentPasswordValid = await verifyPassword(currentPassword, current.password_hash);
    }
    if (!currentPasswordValid) {
      throw new CurrentPasswordInvalidError();
    }
    if (passwordPolicyError) {
      throw new InvalidNewPasswordError();
    }

    const newHash = await hashPassword(normalizedNewPassword);
    await withTransaction(async client => {
      const updated = await client.query(
        `UPDATE users
            SET password_hash = $3,
                password_changed_at = NOW(),
                token_version = token_version + 1
          WHERE id = $1 AND password_hash = $2`,
        [userId, current.password_hash, newHash]
      );
      if (updated.rowCount !== 1) {
        throw new CurrentPasswordInvalidError();
      }
      await client.query(
        `UPDATE auth_sessions
            SET revoked_at = COALESCE(revoked_at, NOW()),
                revoke_reason = COALESCE(revoke_reason, 'password_changed')
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
      );
    });
  }

  async saveAvatar(userId: string, contentType: AvatarContentType, data: Buffer): Promise<string> {
    const digest = createHash('sha256').update(data).digest('hex');
    const encodedUserId = encodeAvatarUserId(userId);
    if (!encodedUserId) throw new Error('Identificador de usuário inválido para avatar.');
    const avatarUrl = `/api/v1/avatars/${encodedUserId}?v=${digest.slice(0, 16)}`;
    await withTransaction(async client => {
      await client.query(
        `INSERT INTO user_avatars (
           user_id, content_type, data, size_bytes, sha256, updated_at
         ) VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           content_type = EXCLUDED.content_type,
           data = EXCLUDED.data,
           size_bytes = EXCLUDED.size_bytes,
           sha256 = EXCLUDED.sha256,
           updated_at = NOW()`,
        [userId, contentType, data, data.byteLength, digest]
      );
      const updated = await client.query('UPDATE users SET avatar_url = $2 WHERE id = $1', [
        userId,
        avatarUrl,
      ]);
      if (updated.rowCount !== 1) throw new Error('Usuário não encontrado.');
    });
    return avatarUrl;
  }

  async getAvatar(userId: string): Promise<StoredAvatar | null> {
    return queryOne<StoredAvatar>(
      `SELECT content_type, data, sha256, updated_at
         FROM user_avatars
        WHERE user_id = $1`,
      [userId]
    );
  }

  async deleteAvatar(userId: string): Promise<void> {
    await withTransaction(async client => {
      await client.query('DELETE FROM user_avatars WHERE user_id = $1', [userId]);
      await client.query('UPDATE users SET avatar_url = NULL WHERE id = $1', [userId]);
    });
  }
}

export const profileRepository = new ProfileRepository();
