import { sql } from './client.ts';
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL required; preflight never uses a default DB.');
try {
  const [summary] = await sql`SELECT
  (SELECT count(*) FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*)>1) t)::int duplicate_emails,
  (SELECT count(*) FROM (SELECT user_id,asset_id FROM licenses GROUP BY user_id,asset_id HAVING count(*)>1) t)::int duplicate_licenses,
  (SELECT count(*) FROM (SELECT user_id FROM ai_jobs WHERE status IN ('pending','processing') GROUP BY user_id HAVING count(*)>1) t)::int parallel_active_jobs,
  (SELECT count(*) FROM orders)::int legacy_order_inventory,
  (SELECT count(*) FROM ai_jobs WHERE status IN ('pending','processing'))::int active_jobs_to_drain`;
  console.log(JSON.stringify(summary, null, 2));
  if (summary?.duplicate_emails || summary?.duplicate_licenses || summary?.parallel_active_jobs)
    process.exitCode = 1;
} catch {
  console.error(
    'Preflight failed. Verify target/schema with your DB operator; no data was changed.',
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
