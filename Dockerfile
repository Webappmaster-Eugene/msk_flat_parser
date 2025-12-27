FROM mcr.microsoft.com/playwright:v1.40.1-jammy

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

RUN npx playwright install chromium

COPY dist ./dist

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV HEADLESS=true

CMD ["node", "dist/index.js"]
