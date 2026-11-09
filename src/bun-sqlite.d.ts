declare module 'bun:sqlite' {
  export class Database {
    constructor(filename?: string, options?: { create?: boolean; readwrite?: boolean; readonly?: boolean; strict?: boolean });
    exec(source: string): void;
    query<T = unknown>(sql: string): {
      all(...params: unknown[]): T[];
      get(...params: unknown[]): T | null;
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
      values(...params: unknown[]): unknown[][];
    };
    transaction<F extends (...args: any[]) => any>(fn: F): F & { deferred: F; immediate: F; exclusive: F };
    close(throwOnError?: boolean): void;
  }
}
