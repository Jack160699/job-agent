FROM mcr.microsoft.com/playwright:v1.53.2-jammy

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

COPY browser-worker ./browser-worker/
COPY src/lib ./src/lib/
COPY src/lib/browser ./src/lib/browser/
COPY tsconfig.json ./

ENV BROWSER_HEADLESS=true
ENV BROWSER_WORKER_MODE=all
ENV BROWSER_MCP_PORT=3847

EXPOSE 3847

CMD ["npx", "tsx", "browser-worker/index.ts"]
