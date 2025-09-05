# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Optimex PMM (Portfolio Market Maker) is a NestJS-based trading system that implements a multi-phase trade settlement protocol for cross-chain token swaps. The system handles quote discovery, commitment, settlement agreements, PMM selection, and payment execution across different blockchain networks.

## Architecture

### Monorepo Structure
- **NX Workspace**: Uses NX for build orchestration, testing, and code organization
- **Single Application**: `apps/api-server` - Main NestJS API server
- **Modular Libraries**: Domain-specific modules in `libs/` directory

### Core Libraries
- `blockchain` - Transaction management, nonce handling, blockchain interaction
- `custom-logger` - Centralized logging with Pino
- `database` - Prisma database layer
- `notification` - Event notification system  
- `quote` - Quote generation and management
- `settlement` - Trade settlement processing with Bull queues
- `token` - Token management and validation
- `trade` - Core trade logic and state management
- `transfer` - Cross-chain transfer operations

### Technology Stack
- **Backend**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue System**: Bull/Redis for background job processing
- **Validation**: Zod schemas with nestjs-zod
- **Logging**: Pino with nestjs-pino
- **Blockchain**: Solana Web3.js, Ethereum (ethers), Bitcoin (bitcoinjs-lib)
- **Monitoring**: Bull Board for queue monitoring at `/queues`

## Development Commands

### Core Operations
```bash
# Start development server
yarn start

# Build the application
yarn build

# Format code with Prettier
yarn format

# Type checking
yarn typecheck

# Lint and fix issues (includes typecheck)
yarn lint

# Run tests
yarn test
yarn test:watch
yarn test:coverage
yarn test:ci
```

### Database Operations
```bash
# Generate Prisma client
yarn prisma:generate

# Generate Prisma client in watch mode
yarn prisma:generate:watch

# Run database migrations (development)
yarn migrate:dev

# Create migration without applying
yarn migrate:dev:create

# Reset database with migrations
yarn migrate:reset

# Deploy migrations to production
yarn migrate:deploy

# Check migration status
yarn migrate:status

# Resolve migration issues
yarn migrate:resolve

# Open Prisma Studio
yarn prisma:studio
```

### Index Generation
```bash
# Generate barrel exports for all modules
yarn ctix
```

### NX Commands
```bash
# Alternative ways to run commands via NX
nx serve api-server    # Same as yarn start
nx build api-server    # Same as yarn build
nx test <lib-name>     # Test specific library
nx lint <lib-name>     # Lint specific library
```

## Key Architectural Patterns

### Domain-Driven Design
Each library represents a bounded context with clear responsibilities. Cross-cutting concerns like logging and database access are provided through shared modules.

### Queue-Based Processing
Settlement operations use Bull queues for reliable background processing:
- `SETTLEMENT_TRANSFER_QUEUE` - Handles transfer operations
- `SETTLEMENT_SUBMIT_QUEUE` - Manages transaction submissions

### Database Schema
The core `Trade` entity tracks the complete trade lifecycle through these states:
- PENDING → QUOTE_PROVIDED → COMMITTED → SETTLING → COMPLETED
- Alternative paths: SELECTED, FAILED

### Configuration Management
Environment-based configuration using NestJS ConfigModule with type-safe access to:
- Database URLs, Redis connections
- Blockchain RPC endpoints  
- Logging levels and monitoring settings

### Security & Middleware
- IP whitelist middleware for quote and settlement endpoints
- Environment-based secrets management
- Blockchain transaction security with nonce management

## Testing Strategy

- **Unit Tests**: Jest with coverage requirements, tests alongside source files with `.spec.ts` suffix
- **Integration Tests**: Database and queue integration testing
- **E2E Tests**: Full API endpoint testing (excluded: `apps/api-server-e2e`)
- **Coverage**: Required for CI/CD pipelines with `yarn test:ci`

## Code Quality & Linting

### ESLint Configuration
- Uses modern flat config format with NX ESLint plugin
- **Strict Rules**: `@typescript-eslint/no-explicit-any` is enforced as error
- **Unused Imports**: Automatically removes unused imports via `eslint-plugin-unused-imports`
- **Module Boundaries**: NX enforces library dependency constraints

### Prettier Configuration
- **Print Width**: 120 characters
- **Quotes**: Single quotes, no semicolons
- **Import Sorting**: Uses `@ianvs/prettier-plugin-sort-imports` with specific order

## Local Development Setup

### Prerequisites
```bash
# Start required services
docker-compose up redis-db postgres-db

# Setup database
yarn migrate:dev
yarn prisma:generate
```

### Monitoring & Debugging
- **Queue Dashboard**: `http://localhost:3000/queues` (Bull Board)
- **API Documentation**: `http://localhost:3000/api` (Swagger)
- **Database GUI**: `yarn prisma:studio`
- **Structured Logging**: JSON format via Pino

## Trade Flow Implementation

The system implements a 5-phase trade protocol:
1. **Quote Discovery**: Indicative pricing via `/indicative-quote`
2. **Commitment**: Deposit validation and final pricing via `/commitment-quote`  
3. **Settlement Agreement**: Cryptographic settlement signatures via `/settlement-signature`
4. **PMM Selection**: Acknowledgment of selection status via `/ack-settlement`
5. **Payment Execution**: Transaction submission and completion via `/signal-payment`