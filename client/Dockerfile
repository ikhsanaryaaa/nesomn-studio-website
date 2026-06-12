# ── Build stage ──
FROM oven/bun:1.3.14-alpine AS build

WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY client/package.json ./client/

RUN bun install --frozen-lockfile || bun install

COPY packages/shared ./packages/shared
COPY client ./client
COPY tsconfig.base.json ./

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN cd client && bun run build

# ── Serve stage ──
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
