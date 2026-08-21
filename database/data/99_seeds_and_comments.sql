
-- ---------------------------------------------------------------------------
-- Seeds não sensíveis
-- ---------------------------------------------------------------------------

INSERT INTO public.plans (id, name, monthly_cents) VALUES
  ('start', 'Start', 9900),
  ('prime', 'Prime', 19900),
  ('elite', 'Elite', 29900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_config (key, value) VALUES
  ('cashback_pct', '40'),
  ('pix_key', ''),
  ('pix_holder', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_config (key, value) VALUES
  ('commission_direct_pct', '10'),
  ('commission_level1_pct', '2'),
  ('commission_level2_pct', '1'),
  ('commission_level3_pct', '0.5'),
  ('commission_level4_pct', '0'),
  ('cashback_standard_pct', '40'),
  ('cashback_premium_pct', '50'),
  ('cashback_premium_threshold_cents', '1000000'),
  ('cashback_duration_months', '12'),
  ('cashback_credit_day', '16')
ON CONFLICT (key) DO NOTHING;

-- O domínio paga N1 direto e quatro uplines (N2 a N5). A chave legada abaixo
-- representava uma sexta faixa que nunca era gerada pelo motor de comissões.
DELETE FROM public.platform_config
WHERE key = 'commission_level5_pct';

-- O domínio e cashback_payments numeram o benefício de 1 a 12. Corrige uma
-- configuração legada fora dessa faixa sem afetar valores válidos.
UPDATE public.platform_config
SET value = '12', updated_at = NOW()
WHERE key = 'cashback_duration_months'
  AND CASE
        WHEN value ~ '^[0-9]+$' THEN value::NUMERIC NOT BETWEEN 1 AND 12
        ELSE TRUE
      END;

-- Administradores devem ser provisionados explicitamente pela aplicação ou
-- por um comando operacional que receba a senha fora do SQL. Não há senha
-- padrão nesta migration.

COMMENT ON COLUMN public.users.career IS
  'Carreira manual definida pelo admin; NULL mantém o cálculo dinâmico.';
COMMENT ON COLUMN public.users.token_version IS
  'Incrementado para invalidar todos os access tokens emitidos anteriormente.';
COMMENT ON COLUMN public.auth_refresh_tokens.token_hash IS
  'HMAC-SHA-256 hexadecimal do refresh token opaco; tokens legados podem usar SHA-256. O segredo bruto nunca é persistido.';
COMMENT ON TABLE public.auth_sessions IS
  'Sessões revogáveis referenciadas pelo claim sid dos access tokens Bearer.';
