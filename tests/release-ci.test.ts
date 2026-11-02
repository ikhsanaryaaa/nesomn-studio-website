import { test, expect } from 'bun:test';

test('CI runs isolated release suites, browser job without conflicting services, and bounded artifacts', async () => {
  const ci = Bun.YAML.parse(await Bun.file('.github/workflows/ci.yml').text()) as {
    jobs: Record<
      string,
      {
        services?: unknown;
        steps: Array<{ run?: string; uses?: string; with?: Record<string, unknown> }>;
      }
    >;
  };
  const checks = ci.jobs.checks!;
  expect(checks.steps.some((step) => step.run === 'node scripts/release-check.mjs unit')).toBe(
    true,
  );
  expect(
    checks.steps.some((step) => step.run === 'node scripts/release-check.mjs integration'),
  ).toBe(true);
  const browser = ci.jobs['production-browser']!;
  expect(browser.services).toBeUndefined();
  expect(browser.steps.some((step) => step.run === 'node scripts/release-lab.mjs run')).toBe(true);
  expect(browser.steps.some((step) => step.run === 'node scripts/release-lab.mjs cleanup')).toBe(
    true,
  );
  for (const job of [checks, browser]) {
    const artifacts = job.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
    expect(artifacts?.with?.['retention-days']).toBe(7);
    expect(String(artifacts?.with?.path)).not.toContain('deployment.env');
    expect(String(artifacts?.with?.path)).not.toContain('browser-profile');
  }
});
