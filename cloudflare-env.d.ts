declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

declare interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: Record<string, unknown>): Promise<void>;
}

declare type R2Bucket = object;

declare interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

declare type DurableObjectId = object;

declare interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

declare class DurableObject {
  constructor(state: unknown, env: unknown);
}

declare interface Ai {
  run(model: string, options: Record<string, unknown>): Promise<unknown>;
}
