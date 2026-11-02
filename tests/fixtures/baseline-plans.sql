-- Data sintetis minimum untuk integration tests existing, bukan seed katalog/admin.
-- Hanya jalankan melalui test-db milik project nesomn-revision-test setelah migration.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'nesomn_revision_test' OR current_user <> 'nesomn_test' THEN
    RAISE EXCEPTION 'Fixture hanya untuk database disposable nesomn_revision_test/nesomn_test';
  END IF;
END $$;

INSERT INTO plans (code, name, segment, cycle, price_idr, price_usd, credit_quota, max_concurrent_sessions, editor_access)
VALUES ('scene_individual_monthly', 'Synthetic test plan', 'individual', 'monthly', 100000, 10, 500, 1,
  '{"scene2d":true,"editor3d":false,"proTemplates":true,"aiVideo":true}'::jsonb)
ON CONFLICT (code) DO NOTHING;
COMMIT;
