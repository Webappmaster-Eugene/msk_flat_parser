FROM mcr.microsoft.com/playwright:v1.40.1-jammy

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Playwright browsers are already in the base image, but ensure chromium is available
RUN npx playwright install chromium --with-deps

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

CMD ["node", "dist/index.js"]
