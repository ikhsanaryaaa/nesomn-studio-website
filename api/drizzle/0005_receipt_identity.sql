-- A verified physical receipt may belong to one order only, across event IDs/users.
-- Historical receipts remain untouched and require explicit reconciliation.
CREATE TABLE payment_receipts (
 provider text NOT NULL,
 gateway_ref text NOT NULL,
 order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
 PRIMARY KEY(provider,gateway_ref)
);
