
-- ---------------------------------------------------------------------------
-- Índices e garantias de unicidade
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_normalized
  ON public.users (lower(btrim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_referral_code
  ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_users_sponsor_id
  ON public.users (sponsor_id);
CREATE INDEX IF NOT EXISTS ix_users_created_at
  ON public.users (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_users_plan_interest
  ON public.users (plan_interest);
CREATE INDEX IF NOT EXISTS ix_users_active_billing
  ON public.users (adhesion_paid, monthly_status)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS ix_plan_requests_user_status_created
  ON public.plan_requests (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_plan_requests_status_created
  ON public.plan_requests (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_plan_requests_one_pending_per_user
  ON public.plan_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ix_payments_user_period
  ON public.payments (user_id, period DESC);
CREATE INDEX IF NOT EXISTS ix_payments_period
  ON public.payments (period);

CREATE UNIQUE INDEX IF NOT EXISTS ux_commission_entries_business_key
  ON public.commission_entries (
    sponsor_id,
    referred_user_id,
    period,
    level
  );
CREATE INDEX IF NOT EXISTS ix_commission_entries_sponsor_status_created
  ON public.commission_entries (sponsor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_commission_entries_referred_period
  ON public.commission_entries (referred_user_id, period);
CREATE INDEX IF NOT EXISTS ix_commission_entries_period_status
  ON public.commission_entries (period, status);

CREATE INDEX IF NOT EXISTS ix_cashback_payments_user_paid_at
  ON public.cashback_payments (user_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS ix_withdrawal_requests_user_status_created
  ON public.withdrawal_requests (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_withdrawal_requests_status_created
  ON public.withdrawal_requests (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_users_email_normalized
  ON public.admin_users (lower(btrim(email)));
CREATE INDEX IF NOT EXISTS ix_admin_users_active_created
  ON public.admin_users (active, created_at);
CREATE INDEX IF NOT EXISTS ix_admin_users_mfa_enabled
  ON public.admin_users (mfa_enabled, id)
  WHERE mfa_enabled IS TRUE;

CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_active
  ON public.auth_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_sessions_admin_active
  ON public.auth_sessions (admin_user_id, expires_at)
  WHERE revoked_at IS NULL AND admin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_sessions_expiry
  ON public.auth_sessions (expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_auth_sessions_revoked_retention
  ON public.auth_sessions (revoked_at)
  WHERE revoked_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_refresh_tokens_hash
  ON public.auth_refresh_tokens (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_refresh_tokens_one_active_per_session
  ON public.auth_refresh_tokens (session_id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_session
  ON public.auth_refresh_tokens (session_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_expiry
  ON public.auth_refresh_tokens (expires_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_mfa_challenges_token_hash
  ON public.admin_mfa_challenges (token_hash);
CREATE INDEX IF NOT EXISTS ix_admin_mfa_challenges_admin
  ON public.admin_mfa_challenges (admin_user_id, created_at DESC)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_admin_mfa_challenges_expiry
  ON public.admin_mfa_challenges (expires_at)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_consumed_retention
  ON public.auth_refresh_tokens (consumed_at)
  WHERE consumed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_revoked_retention
  ON public.auth_refresh_tokens (revoked_at)
  WHERE revoked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_replaced_by
  ON public.auth_refresh_tokens (replaced_by_token_id)
  WHERE replaced_by_token_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user
  ON public.password_reset_tokens (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_password_reset_tokens_one_active_per_user
  ON public.password_reset_tokens (user_id)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_expiry
  ON public.password_reset_tokens (expires_at)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_consumed_retention
  ON public.password_reset_tokens (consumed_at)
  WHERE consumed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_auth_rate_limits_blocked_until
  ON public.auth_rate_limits (blocked_until)
  WHERE blocked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_rate_limits_updated_at
  ON public.auth_rate_limits (updated_at);
