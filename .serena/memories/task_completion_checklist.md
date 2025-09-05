# Task Completion Checklist

## Pre-Commit Requirements
1. **Code Quality**
   - Run `yarn lint:fix` to fix linting issues
   - Run `yarn format` to format code consistently
   - Ensure no TypeScript compilation errors

2. **Testing**
   - Run `yarn test` to ensure all tests pass
   - Run `yarn test:coverage` to verify coverage requirements
   - Add tests for new functionality

3. **Database Changes**
   - If database schema changed, run `yarn prisma:generate`
   - Create and test migrations with `yarn migrate:dev`
   - Verify migration rollback works if needed

## Development Workflow
1. **Local Environment Setup**
   - Start dependencies: `docker-compose up redis-db postgres-db`
   - Run migrations: `yarn migrate:dev`
   - Generate Prisma client: `yarn prisma:generate`
   - Start development server: `yarn start`

2. **Code Organization**
   - Update barrel exports with `yarn ctix` after adding new files
   - Follow library structure in `libs/` for domain logic
   - Keep controllers, services, and modules in appropriate directories

3. **Monitoring and Debugging**
   - Check queue status at `http://localhost:3000/queues`
   - Use Prisma Studio (`yarn prisma:studio`) for database inspection
   - Monitor logs for structured JSON output with Pino

## Production Deployment
1. **Database Migrations**
   - Test migrations in staging: `yarn migrate:deploy`
   - Verify data integrity after migration

2. **Build Process**
   - Ensure clean build: `yarn build`
   - Verify Docker build process if containerized

3. **Environment Configuration**
   - Validate all environment variables from `.env.example`
   - Ensure proper Redis and PostgreSQL connections
   - Configure blockchain RPC endpoints correctly

## Quality Assurance
- **Code Review**: Ensure adherence to NestJS and TypeScript best practices
- **Security**: Validate IP whitelist configuration for production
- **Performance**: Monitor queue processing and database query performance
- **Error Handling**: Ensure proper error logging and user-friendly error responses