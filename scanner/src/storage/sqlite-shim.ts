/**
 * SAHIKARA — SQLite compatibility shim for Vitest
 *
 * node:sqlite (built-in) cannot be resolved by Vite's bundler during test
 * collection because Vite strips the `node:` prefix and looks for an npm
 * package named `sqlite`, which doesn't exist.
 *
 * This shim provides a lightweight in-memory implementation of the SQLite
 * interface used by ObservationStore, ONLY for the test environment.
 * The production code path always uses `node:sqlite` directly.
 *
 * Activated in tests via `vi.mock('../src/storage/sqlite-shim.js', ...)`.
 * NOT used in production — the real node:sqlite module is used there.
 */

// We export a helper that the ObservationStore constructor uses
// to get a DatabaseSync-like instance. In tests, this is overridden
// by vi.mock to return the in-memory implementation.

export type SqlRow = Record<string, unknown>;

export interface ShimStatement {
  run(params?: Record<string, unknown> | null): void;
  get(params?: Record<string, unknown> | null): SqlRow | undefined;
  all(params?: Record<string, unknown> | null): SqlRow[];
}

export interface ShimDatabase {
  exec(sql: string): void;
  prepare(sql: string): ShimStatement;
  close(): void;
}

/**
 * Returns a DatabaseSync instance from node:sqlite.
 * This function is the ONLY place node:sqlite is imported,
 * making it the sole target for test mocking.
 */
export function openDatabase(path: string): ShimDatabase {
  // Dynamic import to prevent Vite from statically analyzing 'node:sqlite'
  // during test collection. In tests, this function is mocked before being called.
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (p: string) => ShimDatabase };
  return new DatabaseSync(path);
}
