FROM oven/bun:1.3.14-alpine

WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY worker/package.json ./worker/

RUN bun install --frozen-lockfile || bun install

COPY packages/shared ./packages/shared
COPY worker ./worker
COPY tsconfig.base.json ./

CMD ["bun", "run", "worker/src/index.ts"]
