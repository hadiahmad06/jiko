# syntax=docker/dockerfile:1
# Two stages: build with dev dependencies, ship without them.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# dumb-init reaps zombies and forwards SIGTERM, which is what the shutdown
# handler in src/index.ts is waiting for.
RUN apk add --no-cache dumb-init
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Migrations are applied by `npm run db:migrate` from the release command, so
# the SQL and the runner's sources have to be in the image.
COPY db ./db
COPY scripts ./scripts
COPY src ./src
COPY public ./public
COPY tsconfig.json ./
USER node
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
