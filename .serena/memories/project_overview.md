# Project Overview

## Purpose
Optimex PMM (Portfolio Market Maker) is a NestJS-based trading system that implements a multi-phase trade settlement protocol for cross-chain token swaps. The system handles quote discovery, commitment, settlement agreements, PMM selection, and payment execution across different blockchain networks.

## Tech Stack
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue System**: Bull/Redis for background job processing
- **Validation**: Zod schemas with nestjs-zod
- **Logging**: Pino with nestjs-pino
- **Build System**: NX monorepo with Jest for testing
- **Blockchain**: Solana Web3.js, Ethereum (ethers), Bitcoin (bitcoinjs-lib)
- **Monitoring**: Bull Board for queue monitoring at `/queues`

## Architecture
- **NX Workspace**: Monorepo structure with build orchestration
- **Single Application**: `apps/api-server` - Main NestJS API server
- **Modular Libraries**: Domain-specific modules in `libs/` directory:
  - `blockchain` - Transaction management, nonce handling, blockchain interaction
  - `custom-logger` - Centralized logging with Pino
  - `database` - Prisma database layer
  - `notification` - Event notification system
  - `quote` - Quote generation and management
  - `settlement` - Trade settlement processing with Bull queues
  - `token` - Token management and validation
  - `trade` - Core trade logic and state management
  - `transfer` - Cross-chain transfer operations

## Trade Flow
The system implements a 5-phase trade protocol:
1. **Quote Discovery**: Indicative pricing via `/indicative-quote`
2. **Commitment**: Deposit validation and final pricing via `/commitment-quote`
3. **Settlement Agreement**: Cryptographic settlement signatures via `/settlement-signature`
4. **PMM Selection**: Acknowledgment of selection status via `/ack-settlement`
5. **Payment Execution**: Transaction submission and completion via `/signal-payment`

## Database Schema
Core `Trade` entity tracks trade lifecycle through states:
- PENDING → QUOTE_PROVIDED → COMMITTED → SETTLING → COMPLETED
- Alternative paths: SELECTED, FAILED

## Environment
- PostgreSQL database with Redis for queue processing
- Docker Compose for local development infrastructure
- Environment-based configuration with type-safe access
- Security features: IP whitelist middleware, blockchain transaction security