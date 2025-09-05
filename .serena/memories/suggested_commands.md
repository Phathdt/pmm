# Essential Development Commands

## Core Development
- `yarn start` - Start development server (serves api-server)
- `yarn build` - Build the application
- `yarn test` - Run all tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Run tests with coverage report
- `yarn test:ci` - Run tests for CI/CD with coverage

## Code Quality
- `yarn format` - Format code with Prettier
- `yarn lint` - Lint code with ESLint
- `yarn lint:fix` - Lint and automatically fix issues

## Database Operations
- `yarn prisma:generate` - Generate Prisma client
- `yarn migrate:dev` - Run database migrations (development)
- `yarn migrate:reset` - Reset database with migrations
- `yarn migrate:deploy` - Deploy migrations to production
- `yarn migrate:status` - Check migration status
- `yarn migrate:resolve` - Resolve migration issues
- `yarn prisma:studio` - Open Prisma Studio for database browsing

## Infrastructure
- `docker-compose up redis-db postgres-db` - Start local Redis and PostgreSQL
- `yarn ctix` - Generate barrel exports for all modules (index.ts files)

## NX Commands
- `nx serve api-server` - Serve the API server
- `nx build api-server` - Build the API server
- `nx test <lib-name>` - Test specific library
- `nx lint <lib-name>` - Lint specific library

## Monitoring
- Visit `http://localhost:3000/queues` - Bull Board queue monitoring dashboard
- Visit `http://localhost:3000/api` - Swagger API documentation