# Imagem única: compila o cliente e corre o servidor (que o serve em /).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npx prisma generate --schema apps/server/prisma/schema.prisma && npm run build
ENV NODE_ENV=production
EXPOSE 3001
# Aplica migrações e seed (idempotente) antes de arrancar.
CMD ["sh", "-c", "npm run db:deploy && npm run db:seed && npm start"]
