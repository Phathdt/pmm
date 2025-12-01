# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Optimex PMM (Private Market Maker) is a NestJS-based trading settlement system that handles multi-chain cryptocurrency trades. It processes quotes, manages settlements, and executes transfers across EVM chains, Bitcoin, and Solana.

## Common Commands

```bash
# Development
yarn dev                    # Start api-server in development mode (uses nodemon)
yarn build                  # Build all packages via Turbo
yarn lint                   # Lint all packages
yarn typecheck              # TypeScript type checking
yarn format                 # Format code with Prettier

# Testing
yarn test                   # Run all tests
yarn test:ci                # Run lib tests with coverage (CI mode)
yarn turbo run test --filter=@optimex-pmm/trade  # Run tests for a specific lib

# Database
yarn db:generate            # Generate Prisma client
yarn db:push                # Push schema changes to database
yarn db:migrate             # Run migrations in development
yarn db:migrate:deploy      # Deploy migrations to production
yarn db:studio              # Open Prisma Studio

# Docker
docker compose up -d redis-db postgres-db  # Start local databases
docker compose up api-server               # Run full stack
```

## Architecture

### Turbo Monorepo Structure

```
apps/
  api-server/        # Main NestJS API application
libs/
  blockchain/        # EVM nonce management and transaction services
  custom-config/     # YAML-based configuration with env override support
  custom-logger/     # Pino-based logging
  database/          # Prisma database module
  notification/      # Telegram notifications
  queue/             # Bull queue abstractions
  quote/             # Quote generation and session management
  req/               # HTTP request utilities
  settlement/        # Multi-chain settlement strategies (EVM, BTC, Solana)
  shared/            # Common utilities and types
  token/             # Token configuration and management
  trade/             # Trade entity with DDD structure (domain/application/infras)
```

### Key Patterns

**Library Imports**: Use `@optimex-pmm/` prefix for library imports:
```typescript
import { CustomConfigService } from '@optimex-pmm/custom-config'
import { TradeModule, TRADE_SERVICE } from '@optimex-pmm/trade'
```

**Workspace Dependencies**: When adding internal package dependencies in `package.json`, use `"*"` (not `workspace:*`):
```json
{
  "dependencies": {
    "@optimex-pmm/custom-config": "*",
    "@optimex-pmm/shared": "*"
  }
}
```

**DDD in Trade Module**: The `trade` lib follows Domain-Driven Design:
- `domain/entities/` - Trade entity and value objects
- `domain/interfaces/` - Repository and service interfaces
- `domain/schemas/` - Zod validation schemas
- `application/services/` - Business logic implementation
- `infras/repositories/` - Prisma repository implementation
- `infras/di/` - Dependency injection tokens

**Configuration**: YAML files in `/config` (local.yaml, staging.yaml, production.yaml) with environment variable override support using `__` delimiter:
```bash
DATABASE__URL=postgresql://...   # Overrides config.database.url
```
Set `APP_ENV` to switch configs (local, staging, production).

**Settlement Strategy Pattern**: Multi-chain transfers use strategy pattern:
- `TransferFactory` selects the appropriate strategy based on network
- `EVMTransferStrategy`, `BTCTransferStrategy`, `SolanaTransferStrategy`
- Strategies implement `ITransferStrategy` interface

**Queue Processing**: Bull queues with dedicated processors:
- `evm_transfer_settlement_queue` - EVM chain transfers
- `btc_transfer_settlement_queue` - Bitcoin transfers
- `solana_transfer_settlement_queue` - Solana transfers
- `submit_settlement_queue` - Settlement submission

### API Flow

The PMM handles a 5-phase trade lifecycle:
1. **Quote Discovery** - `GET /indicative-quote` returns initial pricing
2. **Commitment** - `GET /commitment-quote` validates deposit, calculates final quote
3. **Settlement Agreement** - `GET /settlement-signature` signs settlement terms
4. **PMM Selection** - `POST /ack-settlement` acknowledges selection
5. **Payment Execution** - `POST /signal-payment` triggers blockchain transfer

### Blockchain Monitors

Background services that poll for chain-specific events:
- `EvmMonitorService` - Monitors EVM chain transactions
- `BtcMonitorService` - Monitors Bitcoin transactions
- `SolanaMonitorService` - Monitors Solana transactions

## Testing

Tests use Jest with ts-jest. Each lib has its own `jest.config.ts`.

```bash
# Run single test file
yarn turbo run test --filter=@optimex-pmm/trade -- path/to/test.spec.ts

# Run with watch mode (in lib directory)
cd libs/trade && npx jest --watch
```

## Database

PostgreSQL with Prisma ORM. Schema at `/prisma/schema.prisma`.

The main entity is `Trade` which tracks the full trade lifecycle with status progression and multi-chain metadata.
