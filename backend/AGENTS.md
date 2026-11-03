# Agent Configuration

## Commands
- Local DBs (needs Docker): `npm run localdb` (starts postgis, creates `jiko` + `jiko_test`, migrates both)
- Migrate only: `npm run db:migrate` (honours `PGDATABASE`)
- Dev server: `npm run dev`
- Typecheck: `npm run typecheck` (also runs before `npm test`)
- Lint: `npm run lint`
- Unit tests: `npm test` / `npm run test:unit` (no DB needed)
- Integration tests: `npm run test:integration` (needs `jiko_test` on localhost:5432)
- Everything: `npm run test:all`
- Single file: `npx vitest run --project unit src/tests/unit/services/condition.test.ts`
- Route list: `npm run routes > docs/routes.md`
- Build: `npm run build` (cleans `dist/`), run: `npm start`

## Layout
- `src/routes/*` Express routers, auto-mounted by `app.ts` (any default export that is a Router). Handlers only validate, call a repository/manager, and shape the response.
- `src/data/*` in-memory per-user caches for the last hour of sync data; they also kick the trigger engine.
- `src/services/repositories/*` one module per table. All SQL lives here.
- `src/services/triggers/*` the engine: `engine.ts` (match -> cooldown -> condition -> execute -> record), `condition.ts`, `execute.ts`, `scheduler.ts`, `presets.ts`.
- `src/services/messaging/*` outbox (budget + quiet hours), delivery adapters, talk-back, optional Claude voice.
- `src/services/integrations/*` connected accounts (Google OAuth, Canvas token) synced into obligations; credentials sealed with `src/lib/secretBox.ts`. Never return `secret_enc`/`access_token_enc`; use `toPublic()`.
- `public/*` the static web setup page served at `/setup`.
- `src/types/*` Zod schemas. Types are inferred from schemas; never hand-write an interface that duplicates a schema.
- `db/migrations/*.sql` applied in order by `src/db/migrate.ts`. Add a new numbered file; never edit an applied one.

## Code style
- ES modules. Relative imports **must** end in `.js` (Node ESM resolution on the compiled output).
- TypeScript strict, `exactOptionalPropertyTypes` on: use `x ?? null` when passing optionals to SQL params.
- Zod v4 (`z.uuid()`, `z.iso.datetime()`); parse at the boundary, trust inside.
- `Result<T>` for repository/manager returns that can fail with a status; throw only for bugs.
- Errors to clients: `{ error: 'PascalCaseCode', message: '...' , details?: [...] }`.
- Tokens carry `{ user_id }` only; issue/verify through `src/lib/jwt.ts`.
- Unknown condition types evaluate to `false`. Nudges go through `sendMessage` and nowhere else.

## Testing
- Unit: `src/tests/unit/**`, mock repositories; pure modules (conditions, schedule, quick-add, templates) have table-driven tests.
- Integration: `src/tests/integration/**`, real Postgres (`jiko_test`), `helpers.ts` has `createUser`, `api`, `usagePayload`, `resetDb`. Tests truncate the DB; the setup file refuses to run against `jiko`.
