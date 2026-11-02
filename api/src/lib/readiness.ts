type Probes = { database: () => Promise<unknown>; redis: () => Promise<unknown> };

/** A failed/slow service must not make the HTTP healthcheck hang or expose credentials. */
export async function checkReadiness(probes: Probes, timeoutMs = 2000) {
  const check = async (probe: () => Promise<unknown>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(probe).then(() => true, () => false),
        new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const [database, redis] = await Promise.all([check(probes.database), check(probes.redis)]);
  return { database, redis };
}
