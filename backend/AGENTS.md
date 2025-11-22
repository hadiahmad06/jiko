# Agent Configuration

## Commands
- Build: `npm run build`
- Dev server: `npm run dev`
- Test all: `npm test`
- Test single file: `npx vitest run <file-path>`
- Test watch mode: `npm run test:watch`
- Lint/format: Use TypeScript and Zod for validation
- Start local DBs: `npm run localdb`

## Code Style
- Use ES modules with `"type": "module"` in package.json
- TypeScript strict mode enabled
- Import paths: Use `@/*` alias for src directory
- Naming: camelCase for variables/functions, PascalCase for classes/types, snake_case for schemas/json
- Types: Prefer Zod schemas for validation
- Error handling: Try/catch with proper logging
- Tests: Vitest with globals enabled
- No explicit file extensions in imports
- Use isolatedModules compilation

## Testing
- Unit tests: `src/tests/unit/**/*.test.ts`
- Integration tests: `src/tests/integration/**/*.test.ts`
- Run specific test: `npx vitest run src/tests/unit/auth/login.test.ts`