-- ============================================================
-- Migration 002: Backfill de códigos de indicação AXE PRIME
-- 
-- Gera código AP-XXXXXXXX para todos os usuários que não têm
-- um código no formato válido (^AP-[A-Z0-9]{8}$).
--
-- Caracteres permitidos (mesmo conjunto do auth.service.ts):
--   ABCDEFGHJKLMNPQRSTUVWXYZ23456789
--   (sem I, O, 0, 1 — evita ambiguidade visual)
--
-- Seguro para rodar múltiplas vezes (idempotente).
-- ============================================================

DO $$
DECLARE
  chars     TEXT    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_user    RECORD;
  v_code    TEXT;
  v_suffix  TEXT;
  v_attempt INT;
  v_exists  BOOL;
BEGIN
  FOR v_user IN
    SELECT id
    FROM users
    WHERE referral_code IS NULL
       OR referral_code !~ '^AP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
  LOOP
    v_attempt := 0;
    v_code    := NULL;

    WHILE v_code IS NULL AND v_attempt < 20 LOOP
      -- Gera 8 caracteres aleatórios do conjunto permitido
      v_suffix := '';
      FOR i IN 1..8 LOOP
        v_suffix := v_suffix || substr(chars, (floor(random() * length(chars))::int + 1), 1);
      END LOOP;

      v_code := 'AP-' || v_suffix;

      -- Garantir unicidade
      SELECT EXISTS(
        SELECT 1 FROM users WHERE referral_code = v_code
      ) INTO v_exists;

      IF v_exists THEN
        v_code := NULL;  -- tenta novamente
      END IF;

      v_attempt := v_attempt + 1;
    END LOOP;

    IF v_code IS NOT NULL THEN
      UPDATE users
      SET    referral_code = v_code
      WHERE  id = v_user.id;

      RAISE NOTICE 'Backfill: user % → %', v_user.id, v_code;
    ELSE
      RAISE WARNING 'Não foi possível gerar código para user %', v_user.id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill de referral_codes concluído.';
END;
$$;
