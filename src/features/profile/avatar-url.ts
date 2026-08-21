const MAX_ENCODED_USER_ID_LENGTH = 300;
const AVATAR_URL_PATTERN = /^\/api\/v1\/avatars\/([^/?#]+)(?:\?v=[a-f0-9]{1,64})?$/;

/**
 * Encode a TEXT user id as exactly one canonical URL segment. Slash-like path
 * separators, dot segments and control characters are never valid avatar ids.
 */
export function encodeAvatarUserId(userId: string): string | null {
  if (
    !userId ||
    userId === '.' ||
    userId === '..' ||
    /[\\/\u0000-\u001f\u007f-\u009f]/.test(userId)
  ) {
    return null;
  }

  try {
    const encoded = encodeURIComponent(userId);
    return encoded.length <= MAX_ENCODED_USER_ID_LENGTH ? encoded : null;
  } catch {
    // encodeURIComponent rejects malformed UTF-16 (for example lone surrogates).
    return null;
  }
}

/** Dynamic route params are already percent-decoded by Next.js. */
export function validAvatarRouteUserId(userId: string): string | null {
  return encodeAvatarUserId(userId) ? userId : null;
}

/** Only canonical, local authenticated avatar routes may be rendered. */
export function trustedAvatarUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 512) return null;
  const match = AVATAR_URL_PATTERN.exec(value);
  if (!match) return null;

  const encodedUserId = match[1];
  let userId: string;
  try {
    userId = decodeURIComponent(encodedUserId);
  } catch {
    return null;
  }
  return encodeAvatarUserId(userId) === encodedUserId ? value : null;
}
