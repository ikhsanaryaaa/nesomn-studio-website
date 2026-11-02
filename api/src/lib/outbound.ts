import { BlockList, isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { request, type RequestOptions } from 'node:https';
const blocked = new BlockList();
for (const [ip, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(ip, prefix, 'ipv4');
const global6 = new BlockList();
global6.addSubnet('2000::', 3, 'ipv6');
for (const [ip, prefix] of [
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
] as const)
  blocked.addSubnet(ip, prefix, 'ipv6');
export function publicAddress(ip: string) {
  const family = isIP(ip);
  return family === 4
    ? !blocked.check(ip, 'ipv4')
    : family === 6 && global6.check(ip, 'ipv6') && !blocked.check(ip, 'ipv6');
}
export function providerHosts() {
  return (process.env.AI_PROVIDER_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
export function assertProviderUrl(value: string, hosts = providerHosts(), allowQuery = false) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (!allowQuery && url.search) ||
    url.hash ||
    (url.port && url.port !== '443') ||
    !hosts.includes(url.hostname.toLowerCase()) ||
    isIP(url.hostname) ||
    url.hostname.includes('[')
  )
    throw new Error('Provider URL must use an explicitly allowed HTTPS hostname.');
  return url;
}
/** Resolve all addresses, reject mixed/private DNS, then pin TLS connection to validated IP. */
export async function providerRequest(
  value: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  const url = assertProviderUrl(value);
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => {
      dnsTimer = setTimeout(() => reject(new Error('Provider DNS timeout')), 5000);
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((row) => !publicAddress(row.address)))
    throw new Error('Provider DNS resolves to a forbidden address.');
  const target = addresses.find((row) => row.family === 4) ?? addresses[0]!;
  if (Object.values(options.headers ?? {}).some((value) => /[\r\n]/.test(value)))
    throw new Error('Invalid provider header');
  return new Promise<Response>((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const connectionOptions: RequestOptions & { autoSelectFamily: boolean } = {
      method: options.method ?? 'GET',
      headers: options.headers,
      agent: false,
      autoSelectFamily: false,
      servername: url.hostname,
      signal: controller.signal,
      lookup: (_host, _opts, callback) => callback(null, target.address, target.family),
    };
    const req = request(url, connectionOptions, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) req.destroy(new Error('Provider response too large'));
        else chunks.push(chunk);
      });
      res.once('error', () => {
        clearTimeout(timer);
        reject(new Error('Provider stream unavailable'));
      });
      res.once('end', () => {
        clearTimeout(timer);
        const status = res.statusCode ?? 502;
        if (status >= 300 && status < 400) {
          reject(new Error('Provider redirect refused'));
          return;
        }
        resolve(
          new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
        );
      });
    });
    req.once('error', () => {
      clearTimeout(timer);
      reject(new Error('Provider connection unavailable'));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}
