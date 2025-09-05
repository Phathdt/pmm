# Code Style and Conventions

## Formatting (Prettier)
- **Print Width**: 120 characters
- **Quotes**: Single quotes for JS/TS, JSX single quotes
- **Semicolons**: Disabled (semi: false)
- **Trailing Commas**: ES5 style
- **Tab Width**: 2 spaces
- **Bracket Spacing**: Enabled
- **End of Line**: Auto

## Import Organization
Uses `@ianvs/prettier-plugin-sort-imports` with specific order:
1. External packages (e.g., `@nestjs/common`)
2. Internal packages with `@` prefix
3. Local relative imports
4. Parent directory imports

## Linting (ESLint)
- Uses NX ESLint configuration
- TypeScript-first approach with decorator support
- **Disabled Rules**: `@typescript-eslint/no-explicit-any` (allowed in codebase)
- **Module Boundaries**: Enforced by NX for library dependencies
- Test files have relaxed rules for Jest globals

## TypeScript Configuration
- **Target**: ES2015 with ESNext modules
- **Decorators**: Experimental decorators enabled for NestJS
- **Strict Mode**: Enabled with skipLibCheck
- **Module Resolution**: Node.js style
- **Path Mapping**: Uses `@optimex-pmm/*` aliases for library imports

## NestJS Conventions
- **Modules**: Feature-based organization in `libs/` directory
- **Dependency Injection**: Constructor-based injection
- **Validation**: Zod schemas with nestjs-zod integration
- **Error Handling**: Global filters with custom exception types
- **Logging**: Pino logger with structured JSON logging
- **Configuration**: Environment-based with ConfigService

## Database Conventions
- **Prisma**: Schema-first approach with migrations
- **Naming**: Snake_case for database columns, camelCase in TypeScript
- **Indexing**: Strategic indexes on frequently queried fields
- **Enums**: Database enums for status fields

## Testing Conventions
- **Framework**: Jest with NX integration
- **Structure**: Tests alongside source files with `.spec.ts` suffix
- **Coverage**: Required for CI/CD pipelines
- **Mocking**: Jest mocking for external dependencies