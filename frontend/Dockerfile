FROM oven/bun:1.3.4-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:8000/api
ARG VITE_SUPERUSER_EMAIL=oldtv.cf@gmail.com
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPERUSER_EMAIL=$VITE_SUPERUSER_EMAIL
COPY package.json bun.lock ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN bun install --frozen-lockfile
COPY frontend ./frontend
RUN bun run --cwd frontend build

FROM nginx:1.27-alpine
RUN printf 'server {\n  listen 3000;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 3000
