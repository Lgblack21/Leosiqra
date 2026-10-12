declare interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta: { changes: number; last_row_id?: number; duration?: number; [key: string]: unknown };
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1Result>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  // Semua statement dijalankan dalam satu transaksi SQL (atomik).
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

declare interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: Record<string, unknown>): Promise<void>;
}

declare interface R2HTTPMetadata {
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
  [key: string]: unknown;
}

declare interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  writeHttpMetadata(headers: Headers): void;
}

declare interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

declare interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata | Headers;
  customMetadata?: Record<string, string>;
  [key: string]: unknown;
}

declare interface R2Bucket {
  get(key: string, options?: Record<string, unknown>): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: Record<string, unknown>): Promise<{ objects: R2Object[]; truncated: boolean; cursor?: string }>;
}

declare interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

// caches.default (Cache API khusus Workers)
declare interface CacheStorage {
  default: Cache;
}

declare module "cloudflare:workers" {
  export class DurableObject {
    constructor(state: unknown, env: unknown);
  }
}

declare interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

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

declare interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

declare interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
