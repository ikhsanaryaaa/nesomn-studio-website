import type { DataProvider, GetListParams } from '@refinedev/core';
import type { AxiosInstance, Method, AxiosRequestConfig } from 'axios';

const API = '/api/admin';
function resourcePath(resource: string, id?: string | number) {
  if (!/^[a-z][a-z0-9-]*$/.test(resource)) throw Error('Resource admin tidak valid.');
  return API + '/' + resource + (id === undefined ? '' : '/' + encodeURIComponent(id));
}
export function listQuery({ pagination, sorters, filters }: GetListParams): string {
  const query = new URLSearchParams();
  const size = pagination?.pageSize ?? 10;
  const start = ((pagination?.current ?? 1) - 1) * size;
  query.set('_start', String(start));
  query.set('_end', String(start + size));
  // The API explicitly supports one sort column and one direction.
  if (sorters?.[0]) {
    query.set('_sort', sorters[0].field);
    query.set('_order', sorters[0].order);
  }
  for (const filter of filters ?? []) {
    if (!('field' in filter) || filter.value == null) continue;
    if (filter.operator === 'eq') query.set(filter.field, String(filter.value));
    else if (filter.operator === 'contains')
      query.set(filter.field + '_like', String(filter.value));
    else throw Error('Filter admin belum didukung: ' + filter.operator);
  }
  return query.toString();
}
/** Thin Refine adapter for the API's actual dialect. Uses native URLSearchParams. */
export function createRestProvider(http: AxiosInstance): DataProvider {
  async function request(
    url: string,
    method: Method = 'get',
    data?: unknown,
    headers?: AxiosRequestConfig['headers'],
  ) {
    if (
      !url.startsWith(API + '/') ||
      url.includes('\\') ||
      url
        .split('?')[0]!
        .split('/')
        .some((part) => part === '..' || part === '.')
    )
      throw Error('URL admin tidak valid.');
    try {
      return await http.request({ url, method, data, headers });
    } catch (error) {
      const e = error as {
        response?: { status: number; data?: { error?: { message?: string } } };
        message?: string;
      };
      throw Object.assign(
        new Error(e.response?.data?.error?.message ?? e.message ?? 'Request admin gagal.'),
        { status: e.response?.status, statusCode: e.response?.status },
      );
    }
  }
  return {
    getApiUrl: () => API,
    getList: async (params) => {
      const r = await request(resourcePath(params.resource) + '?' + listQuery(params));
      if (!Array.isArray(r.data)) throw Error('Respons daftar admin tidak valid.');
      const total = Number(r.headers['x-total-count']);
      if (!Number.isFinite(total) || total < 0) throw Error('Total daftar admin tidak valid.');
      return { data: r.data, total };
    },
    getOne: async ({ resource, id }) => ({
      data: (await request(resourcePath(resource, id))).data,
    }),
    getMany: async ({ resource, ids }) => ({
      data: await Promise.all(
        ids.map(async (id) => (await request(resourcePath(resource, id))).data),
      ),
    }),
    create: async ({ resource, variables, meta }) => ({
      data: (await request(resourcePath(resource), 'post', variables, meta?.headers)).data,
    }),
    update: async ({ resource, id, variables, meta }) => ({
      data: (await request(resourcePath(resource, id), 'patch', variables, meta?.headers)).data,
    }),
    deleteOne: async ({ resource, id }) => ({
      data: { ...(await request(resourcePath(resource, id), 'delete')).data, id },
    }),
    custom: async ({ url, method, payload, query, headers }) => {
      const encoded = query
        ? new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
        : '';
      return {
        data: (
          await request(
            url + (encoded ? (url.includes('?') ? '&' : '?') + encoded : ''),
            method,
            payload,
            headers,
          )
        ).data,
      };
    },
  };
}
