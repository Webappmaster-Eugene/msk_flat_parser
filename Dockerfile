FROM mcr.microsoft.com/playwright:v1.40.1-jammy

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies (playwright needs to be installed)
RUN npm ci

# Playwright browsers are already in the base image, but ensure chromium is available
RUN npx playwright install chromium --with-deps

COPY dist ./dist

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

CMD ["node", "dist/index.js"]
