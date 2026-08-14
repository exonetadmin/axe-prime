import {
  PORTAL_ENTRY_INTENT_KEY,
  clearPortalEntryIntent,
  consumePortalEntryIntent,
  getPortalEntryProfile,
  getPortalEntryStageAt,
  getPortalEntryStages,
  markPortalEntryIntent,
  readPortalEntryIntent,
  resolvePortalEntryQuality,
} from '@/lib/portal-entry';

describe('portal-entry', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    clearPortalEntryIntent();
  });

  it('grava a intenção com primeiro nome normalizado', () => {
    markPortalEntryIntent('login', 'Wanderson Mota');

    const intent = readPortalEntryIntent();

    expect(intent).toMatchObject({
      source: 'login',
      firstName: 'Wanderson',
      consumed: false,
    });
  });

  it('consome a intenção apenas uma vez', () => {
    markPortalEntryIntent('register', 'Maria Silva');

    const firstRead = consumePortalEntryIntent();
    const secondRead = consumePortalEntryIntent();

    expect(firstRead?.firstName).toBe('Maria');
    expect(secondRead).toBeNull();
  });

  it('descarta payload inválido do sessionStorage', () => {
    window.sessionStorage.setItem(PORTAL_ENTRY_INTENT_KEY, '{"broken":true}');

    expect(readPortalEntryIntent()).toBeNull();
    expect(window.sessionStorage.getItem(PORTAL_ENTRY_INTENT_KEY)).toBeNull();
  });

  it('expira a intenção após 10 minutos', () => {
    markPortalEntryIntent('login', 'Cliente');
    const intent = readPortalEntryIntent();

    expect(intent).not.toBeNull();

    const expiredRead = readPortalEntryIntent((intent?.createdAt ?? 0) + 10 * 60 * 1000 + 1);
    expect(expiredRead).toBeNull();
  });

  it('resolve quality full para desktop compatível', () => {
    expect(
      resolvePortalEntryQuality({
        viewportWidth: 1440,
        hasWebGL: true,
        prefersReducedMotion: false,
        saveData: false,
        deviceMemory: 8,
      }),
    ).toBe('full');
  });

  it('resolve quality reduced para mobile ou save-data', () => {
    expect(
      resolvePortalEntryQuality({
        viewportWidth: 430,
        hasWebGL: true,
      }),
    ).toBe('reduced');

    expect(
      resolvePortalEntryQuality({
        viewportWidth: 1280,
        hasWebGL: true,
        saveData: true,
      }),
    ).toBe('reduced');
  });

  it('resolve quality skip para reduced-motion ou ausência de WebGL', () => {
    expect(
      resolvePortalEntryQuality({
        viewportWidth: 1440,
        hasWebGL: false,
      }),
    ).toBe('skip');

    expect(
      resolvePortalEntryQuality({
        viewportWidth: 1440,
        hasWebGL: true,
        prefersReducedMotion: true,
      }),
    ).toBe('skip');
  });

  it('gera stages e encontra o stage correto para a timeline', () => {
    const profile = getPortalEntryProfile('full');
    const stages = getPortalEntryStages(profile.durationMs);

    expect(stages).toHaveLength(4);
    expect(stages[0]?.label).toBe('Lendo presença');
    expect(getPortalEntryStageAt(0, profile.durationMs).id).toBe('presence');
    expect(getPortalEntryStageAt(profile.durationMs - 1, profile.durationMs).id).toBe('handoff');
  });
});
