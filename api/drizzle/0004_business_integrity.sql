-- Preflight: do not silently merge legacy identities, licenses or active work.
DO $$ BEGIN
 IF EXISTS (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Reconcile case-insensitive duplicate emails before migration'; END IF;
 IF EXISTS (SELECT user_id, asset_id FROM licenses GROUP BY user_id, asset_id HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Reconcile duplicate licenses before migration'; END IF;
 IF EXISTS (SELECT user_id FROM ai_jobs WHERE status IN ('pending','processing') GROUP BY user_id HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Reconcile multiple active AI jobs before migration'; END IF;
END $$;
--> statement-breakpoint
ALTER TYPE credit_reason ADD VALUE IF NOT EXISTS 'expiry';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN disabled_at timestamptz;
CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
ALTER TABLE credit_ledger ADD COLUMN operation_key text UNIQUE;
ALTER TABLE subscriptions ADD COLUMN benefits jsonb;
ALTER TABLE order_items ADD COLUMN benefit_snapshot jsonb;
ALTER TABLE ai_jobs ADD COLUMN request_key text, ADD COLUMN request_hash text,
 ADD COLUMN lease_token uuid, ADD COLUMN lease_until timestamptz, ADD COLUMN needs_review boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX ai_jobs_active_user_unique ON ai_jobs(user_id) WHERE status IN ('pending','processing');
CREATE UNIQUE INDEX ai_jobs_request_unique ON ai_jobs(user_id, request_key) WHERE request_key IS NOT NULL;
CREATE UNIQUE INDEX licenses_user_asset_unique ON licenses(user_id,asset_id);
--> statement-breakpoint
CREATE TABLE credit_accounts (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, balance integer NOT NULL DEFAULT 0 CHECK(balance >= 0));
CREATE TABLE credit_lots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source_key text NOT NULL UNIQUE, initial integer NOT NULL CHECK(initial >= 0), remaining integer NOT NULL CHECK(remaining >= 0 AND remaining <= initial), expires_at timestamptz);
CREATE INDEX credit_lots_user_idx ON credit_lots(user_id);
CREATE TABLE credit_allocations (operation_key text NOT NULL, lot_id uuid NOT NULL REFERENCES credit_lots(id) ON DELETE CASCADE, amount integer NOT NULL CHECK(amount > 0), PRIMARY KEY(operation_key,lot_id));
CREATE TABLE order_fulfillments (order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE, state text NOT NULL CHECK(state IN ('legacy_review','fulfilled')), created_at timestamptz NOT NULL DEFAULT now());
-- Historical orders are never automatically fulfilled again, regardless of status.
INSERT INTO order_fulfillments(order_id,state) SELECT id,'legacy_review' FROM orders;
CREATE TABLE payment_events(provider text NOT NULL,event_id text NOT NULL,receipt jsonb NOT NULL,fingerprint text NOT NULL,outcome text NOT NULL DEFAULT 'received',created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(provider,event_id));
CREATE TABLE ai_outbox(job_id uuid PRIMARY KEY REFERENCES ai_jobs(id) ON DELETE CASCADE,delivered_at timestamptz,attempts integer NOT NULL DEFAULT 0,error text);
-- Legacy jobs have no reliable reservation metadata: operator reconciliation is explicit.
CREATE TABLE oauth_states(state_hash text PRIMARY KEY,cookie_hash text NOT NULL,verifier_encrypted text NOT NULL,nonce text NOT NULL,return_path text NOT NULL,expires_at timestamptz NOT NULL);
