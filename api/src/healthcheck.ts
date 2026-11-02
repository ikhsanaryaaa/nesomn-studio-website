try {
  if (process.argv[2] === 'worker') {
    const state = await Bun.file('/tmp/nesomn-worker-health.json').json();
    if (state.ready !== true || Date.now() - state.updatedAt > 30000) process.exit(1);
  } else {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/health/ready`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) process.exit(1);
  }
} catch {
  process.exit(1);
}

export {};
