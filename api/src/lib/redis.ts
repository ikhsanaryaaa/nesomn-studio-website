/** One URL contract for the API producer and external BullMQ consumer. */
export function redisConnection(value: string, role: 'producer' | 'worker') {
  try {
    const url = new URL(value);
    const index = url.pathname.slice(1);
    if (!['redis:', 'rediss:'].includes(url.protocol) || !url.hostname || url.port === '0' ||
      (index && !/^\d+$/.test(index)) || !Number.isSafeInteger(Number(index || 0)) ||
      url.search || url.hash) throw new Error();
    const host = url.hostname.replace(/^\[|\]$/g, '');
    return {
      host,
      port: Number(url.port) || 6379,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: Number(index || 0),
      tls: url.protocol === 'rediss:' ? { servername: host } : undefined,
      connectTimeout: 3000,
      ...(role === 'producer'
        ? { maxRetriesPerRequest: 1, enableOfflineQueue: false, commandTimeout: 3000 }
        : { maxRetriesPerRequest: null, enableOfflineQueue: true }),
    };
  } catch {
    // Do not echo a URL containing a password in startup/worker logs.
    throw new Error('REDIS_URL tidak valid; gunakan redis[s]://[user:password@]host:port/db tanpa query.');
  }
}
