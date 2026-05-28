FROM node:26-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx tsc

FROM node:26-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
# SQL files nao sao compilados pelo tsc; copiar a pasta de migrations
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

# Criar diretórios de upload
RUN mkdir -p uploads/avatars uploads/documentos uploads/fotos uploads/qrcodes \
    && chown -R node:node /app

ENV NODE_ENV=production

USER node

EXPOSE 3001

CMD ["node", "dist/index.js"]
