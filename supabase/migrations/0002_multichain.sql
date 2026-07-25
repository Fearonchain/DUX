-- Multi-chain support: bind auth nonces and the audit trail to a chain.
--
-- token_profiles already carries chain_id (see 0001_init.sql), including its
-- unique (chain_id, token_address) index, so only auth_nonces and audit_log
-- need the new column. Existing rows default to 'solana' to preserve behavior.

ALTER TABLE auth_nonces
  ADD COLUMN IF NOT EXISTS chain_id text NOT NULL DEFAULT 'solana';

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS chain_id text NOT NULL DEFAULT 'solana';

CREATE INDEX IF NOT EXISTS audit_log_chain_token_idx ON audit_log (chain_id, token_address);
