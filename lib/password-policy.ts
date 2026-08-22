const COMMON_PASSWORD_ROOTS = [
  'admin',
  'administrador',
  'axeprime',
  'changeme',
  'letmein',
  'password',
  'qwerty',
  'senha',
  'welcome',
] as const;

const COMMON_FULL_PASSWORDS = new Set([
  '123456789012345',
  'adminadminadmin',
  'administrador123',
  'axeprimeaxeprime',
  'changemechangeme',
  'passwordpassword',
  'qwertyqwerty123',
  'senhasenhasenha',
  'welcome123456789',
]);

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]/g, '');
}

/** Fast local baseline; deployments should additionally load a breached-password corpus. */
export function isCommonOrContextualPassword(
  password: string,
  contextualValues: readonly string[] = []
): boolean {
  const normalized = password.normalize('NFC').toLocaleLowerCase('pt-BR');
  const compact = fold(password);
  if (!compact) return /^(.{1,8})\1{2,}$/u.test(normalized);
  if (COMMON_FULL_PASSWORDS.has(compact)) return true;
  if (/^(.)\1{14,}$/.test(compact)) return true;
  if (/^(.{1,8})\1{2,}$/.test(compact)) return true;
  if (/^(?:0123456789|1234567890|9876543210){2,}$/.test(compact)) return true;

  for (const root of COMMON_PASSWORD_ROOTS) {
    if (compact === root || new RegExp(`^(?:${root}){2,}[0-9]*$`).test(compact)) return true;
    if (compact.startsWith(root) && /^\d{1,8}$/.test(compact.slice(root.length))) return true;
  }

  for (const rawContext of ['axe prime', ...contextualValues]) {
    const context = fold(rawContext.includes('@') ? (rawContext.split('@')[0] ?? '') : rawContext);
    if (context.length < 4) continue;
    if (compact === context) return true;
    const remainder = compact.replace(context, '');
    if (remainder !== compact && /^\d{0,8}$/.test(remainder)) return true;
  }
  return false;
}

export function validatePasswordPolicy(
  password: string,
  contextualValues: readonly string[] = []
): string | null {
  const normalized = password.normalize('NFC');
  const length = Array.from(normalized).length;
  if (length < MIN_PASSWORD_LENGTH) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }
  if (length > MAX_PASSWORD_LENGTH) {
    return 'A senha excede o limite permitido.';
  }
  if (!/\p{L}/u.test(normalized) || !/\p{N}/u.test(normalized) || !/[^\p{L}\p{N}\s]/u.test(normalized)) {
    return 'A senha deve conter pelo menos uma letra, um número e um caractere especial.';
  }
  if (isCommonOrContextualPassword(normalized, contextualValues)) {
    return 'Escolha uma senha menos comum e sem dados pessoais ou da empresa.';
  }
  return null;
}
