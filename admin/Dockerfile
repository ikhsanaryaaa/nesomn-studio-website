# ── Build stage ──
FROM oven/bun:1.3.14-alpine AS build

WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY admin/package.json ./admin/

RUN bun install --frozen-lockfile || bun install

COPY packages/shared ./packages/shared
COPY admin ./admin
COPY tsconfig.base.json ./

RUN cd admin && bun run build

# ── Serve stage ──
FROM nginx:alpine

COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
# Vite base '/admin/' -> salin hasil build ke subfolder /admin.
COPY --from=build /app/admin/dist /usr/share/nginx/html/admin

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
