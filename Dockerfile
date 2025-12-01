# =============================================================================
# Stage 1: Builder - Build the application
# =============================================================================
FROM node:24-alpine3.21 AS builder
WORKDIR /app

# Install build dependencies
RUN apk update && apk add --no-cache gcc musl-dev git

# Copy package files for dependency installation
COPY package.json yarn.lock ./
COPY apps/api-server/package.json ./apps/api-server/
COPY libs/blockchain/package.json ./libs/blockchain/
COPY libs/custom-config/package.json ./libs/custom-config/
COPY libs/custom-logger/package.json ./libs/custom-logger/
COPY libs/database/package.json ./libs/database/
COPY libs/notification/package.json ./libs/notification/
COPY libs/queue/package.json ./libs/queue/
COPY libs/quote/package.json ./libs/quote/
COPY libs/req/package.json ./libs/req/
COPY libs/settlement/package.json ./libs/settlement/
COPY libs/shared/package.json ./libs/shared/
COPY libs/token/package.json ./libs/token/
COPY libs/trade/package.json ./libs/trade/

# Install ALL dependencies (including dev) for building
RUN yarn install --frozen-lockfile

# Copy source code and configuration
COPY . .

# Generate Prisma client and build
RUN yarn prisma generate
RUN yarn turbo build:prod --filter=@apps/api-server

# Generate flattened production package.json with all dependencies from app + libs
RUN node scripts/collect-deps.js api-server package > /tmp/prod-package.json

# =============================================================================
# Stage 2: Deps - Install and clean production dependencies
# =============================================================================
FROM node:24-alpine3.21 AS deps
WORKDIR /app

# Copy flattened production package.json
COPY --from=builder /tmp/prod-package.json ./package.json
COPY yarn.lock ./

# Install production dependencies
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Remove unnecessary transitive dependencies that aren't needed at runtime:
# - @angular-devkit, @schematics: NestJS CLI schematics from nestjs-prisma (~47MB)
# - @esbuild: Build tool from prisma CLI (~10MB)
# - typescript, @types: Type definitions (~3MB)
RUN rm -rf node_modules/@angular-devkit \
           node_modules/@schematics \
           node_modules/@esbuild \
           node_modules/@swc \
           node_modules/typescript \
           node_modules/@types

# =============================================================================
# Stage 3: Runtime - Final minimal image
# =============================================================================
FROM node:24-alpine3.21
WORKDIR /app

# Install only essential runtime packages
RUN apk add --no-cache dumb-init curl

# Copy cleaned production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy built libs to node_modules/@optimex-pmm for proper module resolution
RUN mkdir -p /app/node_modules/@optimex-pmm && \
    cp -r /app/dist/libs/* /app/node_modules/@optimex-pmm/

# Copy tsconfig.json for tsconfig-paths to resolve path aliases at runtime
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create symlink for path resolution
RUN ln -s /app/dist /dist

# Copy Prisma schema (required for migrations)
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint script
COPY apps/api-server/run.sh ./run.sh
RUN chmod +x /app/run.sh

ENTRYPOINT ["dumb-init", "sh", "/app/run.sh"]
