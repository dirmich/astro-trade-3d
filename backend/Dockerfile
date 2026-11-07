FROM oven/bun:1.3.4-alpine AS install
WORKDIR /app
COPY package.json bun.lock ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.4-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV BACKEND_HOST=0.0.0.0
ENV BACKEND_PORT=8000
COPY --from=install /app/node_modules ./node_modules
COPY package.json ./
COPY backend ./backend
RUN mkdir -p /app/backend/data
EXPOSE 8000
CMD ["bun", "backend/src/index.ts"]
