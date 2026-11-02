import { test, expect } from 'bun:test';
import axios from '../admin/node_modules/axios';
import { createRestProvider, listQuery } from '../admin/src/providers/rest';

test('native query encoding preserves filters and API pagination/sort dialect', () => {
  const query = new URLSearchParams(
    listQuery({
      resource: 'bundle-assets',
      pagination: { current: 2, pageSize: 25 },
      sorters: [{ field: 'title', order: 'desc' }],
      filters: [{ field: 'title', operator: 'contains', value: 'A & B? / sample' }],
    }),
  );
  expect(query.get('_start')).toBe('25');
  expect(query.get('_end')).toBe('50');
  expect(query.get('_sort')).toBe('title');
  expect(query.get('_order')).toBe('desc');
  expect(query.get('title_like')).toBe('A & B? / sample');
});
test('Refine adapter sends authenticated POST/PATCH/DELETE and safe custom requests without query-string', async () => {
  const requests: Array<{
    method?: string;
    url?: string;
    withCredentials?: boolean;
    headers?: Record<string, unknown>;
  }> = [];
  const http = axios.create({
    withCredentials: true,
    adapter: async (config) => {
      requests.push(config);
      return {
        data: config.url?.includes('?') ? [] : { id: 'sample' },
        headers: { 'x-total-count': '0' },
        status: 200,
        statusText: 'OK',
        config,
      };
    },
  });
  const provider = createRestProvider(http);
  expect((await provider.getList({ resource: 'plans' })).total).toBe(0);
  await provider.create({ resource: 'plans', variables: { name: 'Sample' } });
  await provider.update({ resource: 'plans', id: 'sample', variables: { name: 'Updated' } });
  await provider.deleteOne({ resource: 'plans', id: 'sample' });
  expect(requests.map((r) => r.method)).toEqual(['get', 'post', 'patch', 'delete']);
  expect(requests.every((r) => r.withCredentials)).toBe(true);
  await expect(
    provider.custom!({
      url: 'https://elsewhere.invalid/api/admin/test',
      method: 'post',
      payload: {},
    }),
  ).rejects.toThrow('Invalid admin URL');
  expect(requests).toHaveLength(4);
  await provider.custom!({
    url: '/api/admin/credit-ledger',
    method: 'post',
    payload: {},
    headers: { 'Idempotency-Key': 'same-intent' },
  });
  expect(requests.at(-1)?.headers?.['Idempotency-Key']).toBe('same-intent');
});
test('API failures keep server status/message, never turn into empty mock data', async () => {
  const provider = createRestProvider(
    axios.create({
      adapter: async () => {
        throw { response: { status: 403, data: { error: { message: 'Admin required' } } } };
      },
    }),
  );
  await expect(provider.getList({ resource: 'plans' })).rejects.toMatchObject({
    status: 403,
    statusCode: 403,
    message: 'Admin required',
  });
});
