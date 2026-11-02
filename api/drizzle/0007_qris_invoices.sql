CREATE TABLE qris_invoices (
 order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 merchant_id text NOT NULL,store_id text NOT NULL,request_key text NOT NULL,request_hash text NOT NULL,
 base_idr integer NOT NULL CHECK(base_idr>0),code integer NOT NULL CHECK(code BETWEEN 1 AND 999),
 payable_idr integer NOT NULL CHECK(payable_idr=base_idr+code),quote jsonb NOT NULL,qr_payload text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','review_required')),
 created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL CHECK(expires_at>created_at)
);
CREATE UNIQUE INDEX qris_amount_never_reuse ON qris_invoices(merchant_id,store_id,payable_idr);
CREATE UNIQUE INDEX qris_checkout_request ON qris_invoices(user_id,request_key);
CREATE TABLE qris_receipts (
 merchant_id text NOT NULL,store_id text NOT NULL,reference text NOT NULL,fingerprint text NOT NULL,
 amount_idr integer NOT NULL CHECK(amount_idr>0),paid_at timestamptz NOT NULL,outcome text NOT NULL DEFAULT 'received',
 order_id uuid REFERENCES orders(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(merchant_id,store_id,reference)
);

-- Non-PII amount tombstones deliberately have no cascading FK.
CREATE TABLE qris_reservations(merchant_id text NOT NULL,store_id text NOT NULL,amount_idr integer NOT NULL CHECK(amount_idr>0),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(merchant_id,store_id,amount_idr));
