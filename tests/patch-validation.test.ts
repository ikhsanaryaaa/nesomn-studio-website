import { test, expect } from 'bun:test';
import { z } from '../api/node_modules/zod';
import { parsePatch } from '../api/src/lib/validation';
test('PATCH preserves omitted defaulted fields and still validates supplied values', () => {
  const schema = z.object({
    title: z.string().min(1),
    enabled: z.boolean().default(true),
    cost: z.number().int().min(0).default(0),
  });
  expect(parsePatch(schema, { title: 'Edited' })).toEqual({ title: 'Edited' });
  expect(parsePatch(schema, { enabled: false })).toEqual({ enabled: false });
  expect(() => parsePatch(schema, { cost: -1 })).toThrow();
  expect(() => parsePatch(schema, null)).toThrow();
  expect(parsePatch(schema, { title: 'Edited', unknown: 'stripped' })).toEqual({ title: 'Edited' });
});
