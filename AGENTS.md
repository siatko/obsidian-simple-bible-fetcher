# Agent notes

## Style

- Do not use em dashes (U+2014) in any text: prose, docs, README, commit messages, UI strings or code comments. Use a comma, colon, parenthesis or a normal hyphen instead.

## Project

- Obsidian plugin (TypeScript, esbuild). Source in `src/`, tests in `test/`.
- `npm test` runs Vitest with jsdom against a stubbed Obsidian API (`test/obsidian-stub.ts`).
- Coverage is enforced at 100% for statements, branches, functions and lines. Add tests for any new code.
- Before finishing a change run: `npm run typecheck`, `npm run typecheck:test`, `npm run test:coverage`, `npm run build`.
- Only commit, tag or push when explicitly asked.
