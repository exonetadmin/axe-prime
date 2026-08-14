export type PortalEntrySource = 'login' | 'register';

export type PortalEntryQuality = 'full' | 'reduced' | 'skip';

export type PortalEntryStageId = 'presence' | 'topology' | 'identity' | 'handoff';

export type PortalEntryIntent = {
  source: PortalEntrySource;
  firstName: string;
  createdAt: number;
  consumed: boolean;
};

export type PortalEntryStage = {
  id: PortalEntryStageId;
  label: string;
  startsAtMs: number;
  endsAtMs: number;
};

export type PortalEntryProfile = {
  quality: PortalEntryQuality;
  durationMs: number;
  particleCount: number;
  ambientParticleCount: number;
  enableBloom: boolean;
  allowHoverScrub: boolean;
};

type PortalEntryCapabilityInput = {
  viewportWidth: number;
  prefersReducedMotion?: boolean;
  saveData?: boolean;
  deviceMemory?: number;
  hasWebGL: boolean;
};

const STAGE_RATIOS: Array<{ id: PortalEntryStageId; label: string; start: number; end: number }> = [
  { id: 'presence', label: 'Lendo presença', start: 0, end: 0.2 },
  { id: 'topology', label: 'Resolvendo traço facial', start: 0.2, end: 0.56 },
  { id: 'identity', label: 'Confirmando leitura', start: 0.56, end: 0.84 },
  { id: 'handoff', label: 'Abrindo camada', start: 0.84, end: 1 },
];

const FULL_PROFILE: PortalEntryProfile = {
  quality: 'full',
  durationMs: 5800,
  particleCount: 3800,
  ambientParticleCount: 16,
  enableBloom: false,
  allowHoverScrub: true,
};

const REDUCED_PROFILE: PortalEntryProfile = {
  quality: 'reduced',
  durationMs: 3400,
  particleCount: 1200,
  ambientParticleCount: 6,
  enableBloom: false,
  allowHoverScrub: false,
};

const SKIP_PROFILE: PortalEntryProfile = {
  quality: 'skip',
  durationMs: 180,
  particleCount: 0,
  ambientParticleCount: 0,
  enableBloom: false,
  allowHoverScrub: false,
};

export const PORTAL_ENTRY_INTENT_KEY = 'axe.portal.entry.intent';
export const PORTAL_ENTRY_INTENT_TTL_MS = 10 * 60 * 1000;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

function isPortalEntrySource(value: unknown): value is PortalEntrySource {
  return value === 'login' || value === 'register';
}

function normalizeFirstName(value: string): string {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) {
    return 'Cliente';
  }

  return clean.split(' ')[0] ?? 'Cliente';
}

function isValidIntent(value: unknown): value is PortalEntryIntent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const intent = value as Partial<PortalEntryIntent>;

  return (
    isPortalEntrySource(intent.source) &&
    typeof intent.firstName === 'string' &&
    intent.firstName.trim().length > 0 &&
    typeof intent.createdAt === 'number' &&
    Number.isFinite(intent.createdAt) &&
    typeof intent.consumed === 'boolean'
  );
}

function hasExpired(intent: PortalEntryIntent, now = Date.now()): boolean {
  return now - intent.createdAt > PORTAL_ENTRY_INTENT_TTL_MS;
}

export function getPortalEntryProfile(quality: PortalEntryQuality): PortalEntryProfile {
  if (quality === 'full') {
    return FULL_PROFILE;
  }

  if (quality === 'reduced') {
    return REDUCED_PROFILE;
  }

  return SKIP_PROFILE;
}

export function getPortalEntryStages(durationMs: number): PortalEntryStage[] {
  return STAGE_RATIOS.map(stage => ({
    id: stage.id,
    label: stage.label,
    startsAtMs: Math.round(stage.start * durationMs),
    endsAtMs: Math.round(stage.end * durationMs),
  }));
}

export function getPortalEntryStageAt(
  elapsedMs: number,
  durationMs: number,
): PortalEntryStage {
  const stages = getPortalEntryStages(durationMs);
  const current =
    stages.find(stage => elapsedMs >= stage.startsAtMs && elapsedMs < stage.endsAtMs) ??
    stages[stages.length - 1];

  return current;
}

export function resolvePortalEntryQuality(
  input: PortalEntryCapabilityInput,
): PortalEntryQuality {
  const {
    viewportWidth,
    prefersReducedMotion = false,
    saveData = false,
    deviceMemory,
    hasWebGL,
  } = input;

  if (prefersReducedMotion || !hasWebGL) {
    return 'skip';
  }

  if (saveData || viewportWidth < 1024) {
    return 'reduced';
  }

  if (typeof deviceMemory === 'number' && deviceMemory <= 4) {
    return 'reduced';
  }

  return 'full';
}

export function markPortalEntryIntent(source: PortalEntrySource, firstName: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const payload: PortalEntryIntent = {
    source,
    firstName: normalizeFirstName(firstName),
    createdAt: Date.now(),
    consumed: false,
  };

  storage.setItem(PORTAL_ENTRY_INTENT_KEY, JSON.stringify(payload));
}

export function readPortalEntryIntent(now = Date.now()): PortalEntryIntent | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(PORTAL_ENTRY_INTENT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidIntent(parsed)) {
      storage.removeItem(PORTAL_ENTRY_INTENT_KEY);
      return null;
    }

    if (hasExpired(parsed, now)) {
      storage.removeItem(PORTAL_ENTRY_INTENT_KEY);
      return null;
    }

    return parsed;
  } catch {
    storage.removeItem(PORTAL_ENTRY_INTENT_KEY);
    return null;
  }
}

export function consumePortalEntryIntent(now = Date.now()): PortalEntryIntent | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const intent = readPortalEntryIntent(now);
  if (!intent || intent.consumed) {
    return null;
  }

  const nextIntent: PortalEntryIntent = {
    ...intent,
    consumed: true,
  };

  storage.setItem(PORTAL_ENTRY_INTENT_KEY, JSON.stringify(nextIntent));
  return nextIntent;
}

export function clearPortalEntryIntent(): void {
  const storage = getStorage();
  storage?.removeItem(PORTAL_ENTRY_INTENT_KEY);
}
