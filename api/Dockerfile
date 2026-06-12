FROM oven/bun:1.3.14-alpine

WORKDIR /app

# Copy workspace manifests untuk install
COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY api/package.json ./api/

RUN bun install --frozen-lockfile || bun install

# Copy source
COPY packages/shared ./packages/shared
COPY api ./api
COPY tsconfig.base.json ./

EXPOSE 3000

CMD ["bun", "run", "api/src/index.ts"]
