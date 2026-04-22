import { cloudflareApi } from "@/lib/cloudflare-api";
import { auth } from "@/lib/cf-client";

type AnyObj = Record<string, any>;

type Constraint =
  | { kind: "where"; field: string; op: string; value: any }
  | { kind: "orderBy"; field: string; direction: "asc" | "desc" }
  | { kind: "limit"; value: number };

type CollectionRef = {
  kind: "collection";
  name: string;
};

type DocRef = {
  kind: "doc";
  collection: string;
  id: string;
};

type QueryRef = {
  kind: "query";
  collection: string;
  constraints: Constraint[];
};

export type QueryConstraint = Constraint;
export type DocumentData = Record<string, any>;
export type QueryDocumentSnapshot<T = DocumentData> = {
  id: string;
  data: () => T;
};
export type QuerySnapshot<T = DocumentData> = {
  docs: Array<QueryDocumentSnapshot<T>>;
  empty: boolean;
  size: number;
};
export type DocumentSnapshot<T = DocumentData> = {
  id: string;
  exists: () => boolean;
  data: () => T;
};

type IncrementSentinel = {
  __op: "increment";
  value: number;
};

const API_COLLECTIONS = new Set([
  "users",
  "payments",
  "admin_logs",
  "admin_settings",
  "transactions",
  "accounts",
  "budgets",
  "investments",
  "categories",
  "currencies",
  "recurring",
  "savings",
  "ai_chats",
]);

const isDateKey = (key: string) =>
  [
    "created_at",
    "updated_at",
    "expired_at",
    "next_date",
    "date",
    "timestamp",
    "createdAt",
    "updatedAt",
    "expiredAt",
    "nextDate",
  ].includes(key);

const normalize = (input: any): any => {
  if (Array.isArray(input)) {
    return input.map(normalize);
  }
  if (input instanceof Timestamp) {
    return input;
  }
  if (input instanceof Date) {
    return Timestamp.fromDate(input);
  }
  if (!input || typeof input !== "object") {
    return input;
  }

  const result: AnyObj = {};
  for (const [key, value] of Object.entries(input)) {
    const normalized =
      typeof value === "string" && isDateKey(key) && !Number.isNaN(Date.parse(value))
        ? Timestamp.fromDate(new Date(value))
        : normalize(value);
    result[key] = normalized;
    if (key.includes("_")) {
      const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      result[camel] = normalized;
    }
  }
  return result;
};

const isIncrement = (value: any): value is IncrementSentinel =>
  value && typeof value === "object" && value.__op === "increment";

const toApiValue = (value: any): any => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toApiValue);
  }
  if (isIncrement(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output: AnyObj = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = toApiValue(child);
  }
  return output;
};

const applyIncrementFields = (target: AnyObj, patch: AnyObj) => {
  const next = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (isIncrement(value)) {
      const base = typeof next[key] === "number" ? next[key] : 0;
      next[key] = base + value.value;
    } else {
      next[key] = value;
    }
  }
  return next;
};

const getLocalDb = (): Record<string, AnyObj[]> => {
  const globalKey = "__LEOSIQRA_CF_FIRESTORE__";
  const root = globalThis as any;
  if (!root[globalKey]) {
    root[globalKey] = {};
  }
  return root[globalKey];
};

const readLocalCollection = (name: string) => {
  const db = getLocalDb();
  if (!db[name]) {
    db[name] = [];
  }
  return db[name];
};

const writeLocalCollection = (name: string, items: AnyObj[]) => {
  const db = getLocalDb();
  db[name] = items;
};

const makeSnapshotDoc = (row: AnyObj): QueryDocumentSnapshot => ({
  id: row.id,
  data: () => row,
});

const applyConstraints = (items: AnyObj[], constraints: Constraint[]) => {
  let output = [...items];

  type Comparable = string | number | boolean | null | undefined;
  const toComparable = (value: unknown) => {
    if (value instanceof Timestamp) return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return parsed;
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) return numeric;
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") return value;
    return value as Comparable;
  };

  for (const constraint of constraints) {
    if (constraint.kind === "where") {
      output = output.filter((row) => {
        const left = toComparable(row[constraint.field]);
        const right = toComparable(constraint.value);
        switch (constraint.op) {
          case "==":
          case "=":
            return left === right;
          case "!=":
            return left !== right;
          case ">":
            return left != null && right != null ? left > right : false;
          case ">=":
            return left != null && right != null ? left >= right : false;
          case "<":
            return left != null && right != null ? left < right : false;
          case "<=":
            return left != null && right != null ? left <= right : false;
          case "in":
            return Array.isArray(constraint.value) ? (constraint.value as unknown[]).includes(row[constraint.field]) : false;
          case "array-contains":
            return Array.isArray(row[constraint.field]) ? row[constraint.field].includes(constraint.value) : false;
          default:
            return true;
        }
      });
    }
  }

  for (const constraint of constraints) {
    if (constraint.kind === "orderBy") {
      output.sort((a, b) => {
        const av = a[constraint.field];
        const bv = b[constraint.field];
        if (av === bv) return 0;
        if (constraint.direction === "desc") {
          return av > bv ? -1 : 1;
        }
        return av > bv ? 1 : -1;
      });
    }
  }

  for (const constraint of constraints) {
    if (constraint.kind === "limit") {
      output = output.slice(0, constraint.value);
    }
  }

  return output;
};

const readApiCollection = async (name: string): Promise<AnyObj[]> => {
  if (name === "users") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/admin/users");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "payments") {
    if (auth.currentUser?.role === "admin") {
      const data = await cloudflareApi<{ items: AnyObj[] }>("/api/admin/payments");
      return (data.items ?? []).map((row) => normalize(row));
    }
    return [];
  }
  if (name === "categories") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/member/categories");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "currencies") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/member/currencies");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "recurring") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/member/recurring");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "savings") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/member/savings");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "admin_logs") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/admin/logs?limit=100");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "admin_settings") {
    const data = await cloudflareApi<{ item?: AnyObj | null }>("/api/admin/settings");
    if (!data.item) return [];
    return [normalize({ id: "global_config", ...data.item })];
  }
  if (name === "transactions") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/member/transactions");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "accounts") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/member/accounts");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "budgets") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/member/budgets");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "investments") {
    const data = await cloudflareApi<{ items: AnyObj[] }>("/api/member/investments");
    return (data.items ?? []).map((row) => normalize(row));
  }
  if (name === "ai_chats") {
    const data = await cloudflareApi<{ item?: AnyObj | null }>("/api/member/ai/chat/history");
    return data.item ? [normalize(data.item)] : [];
  }
  return [];
};

const readCollection = async (name: string) => {
  if (API_COLLECTIONS.has(name)) {
    try {
      return await readApiCollection(name);
    } catch {
      return [];
    }
  }
  return readLocalCollection(name);
};

const writeDocViaApi = async (ref: DocRef, data: AnyObj) => {
  const payload = toApiValue(normalize(data));

  if (ref.collection === "users") {
    if (auth.currentUser?.role === "admin" && auth.currentUser?.uid !== ref.id) {
      await cloudflareApi(`/api/admin/users/${ref.id}`, {
        method: "PATCH",
        json: payload,
      });
      return;
    }
    await cloudflareApi("/api/member/profile", {
      method: "PATCH",
      json: payload,
    });
    return;
  }
  if (ref.collection === "payments") {
    await cloudflareApi(`/api/admin/payments/${ref.id}`, {
      method: "PATCH",
      json: payload,
    });
    return;
  }
  if (ref.collection === "admin_settings") {
    await cloudflareApi("/api/admin/settings", {
      method: "PUT",
      json: payload,
    });
    return;
  }
  if (ref.collection === "transactions") {
    await cloudflareApi(`/api/member/transactions/${ref.id}`, {
      method: "PUT",
      json: payload,
    });
    return;
  }
  if (ref.collection === "accounts") {
    await cloudflareApi(`/api/member/accounts/${ref.id}`, {
      method: "PUT",
      json: payload,
    });
    return;
  }
  if (ref.collection === "budgets") {
    await cloudflareApi(`/api/member/budgets/${ref.id}`, {
      method: "PUT",
      json: payload,
    });
    return;
  }
  if (ref.collection === "investments") {
    await cloudflareApi(`/api/member/investments/${ref.id}`, {
      method: "PUT",
      json: payload,
    });
    return;
  }
  if (ref.collection === "categories") {
    await cloudflareApi(`/api/member/categories/${ref.id}`, {
      method: "PUT",
      json: payload,
    });
    return;
  }
  if (ref.collection === "recurring") {
    await cloudflareApi(`/api/member/recurring/${ref.id}`, {
      method: "PUT",
      json: payload,
    });
    return;
  }
  if (ref.collection === "ai_chats") {
    await cloudflareApi("/api/member/ai/chat/history", {
      method: "PUT",
      json: {
        messages: payload.messages ?? [],
      },
    });
    return;
  }
};

const deleteDocViaApi = async (ref: DocRef) => {
  if (ref.collection === "users") {
    if (auth.currentUser?.role === "admin" && auth.currentUser?.uid !== ref.id) {
      await cloudflareApi(`/api/admin/users/${ref.id}`, {
        method: "DELETE",
      });
      return;
    }
    throw new Error("Menghapus profil sendiri via member API tidak diizinkan.");
    return;
  }
  if (ref.collection === "transactions") {
    await cloudflareApi(`/api/member/transactions/${ref.id}`, {
      method: "DELETE",
    });
    return;
  }
  if (ref.collection === "accounts") {
    await cloudflareApi(`/api/member/accounts/${ref.id}`, {
      method: "DELETE",
    });
    return;
  }
  if (ref.collection === "budgets") {
    await cloudflareApi(`/api/member/budgets/${ref.id}`, {
      method: "DELETE",
    });
    return;
  }
  if (ref.collection === "investments") {
    await cloudflareApi(`/api/member/investments/${ref.id}`, {
      method: "DELETE",
    });
    return;
  }
  if (ref.collection === "categories") {
    await cloudflareApi(`/api/member/categories/${ref.id}`, {
      method: "DELETE",
    });
    return;
  }
  if (ref.collection === "currencies") {
    await cloudflareApi(`/api/member/currencies/${ref.id}`, {
      method: "DELETE",
    });
    return;
  }
  if (ref.collection === "recurring") {
    await cloudflareApi(`/api/member/recurring/${ref.id}`, {
      method: "DELETE",
    });
    return;
  }
  if (ref.collection === "savings") {
    await cloudflareApi(`/api/member/savings/${ref.id}`, {
      method: "DELETE",
    });
    return;
  }
  if (ref.collection === "ai_chats") {
    await cloudflareApi("/api/member/ai/chat/history", {
      method: "DELETE",
    });
  }
};

const addDocViaApi = async (collection: string, data: AnyObj) => {
  const payload = toApiValue(normalize(data));
  if (collection === "transactions") {
    const result = await cloudflareApi<{ item?: AnyObj }>("/api/member/transactions", {
      method: "POST",
      json: payload,
    });
    return result.item?.id ?? crypto.randomUUID();
  }
  if (collection === "accounts") {
    const result = await cloudflareApi<{ item?: AnyObj }>("/api/member/accounts", {
      method: "POST",
      json: payload,
    });
    return result.item?.id ?? crypto.randomUUID();
  }
  if (collection === "budgets") {
    const result = await cloudflareApi<{ item?: AnyObj }>("/api/member/budgets", {
      method: "POST",
      json: payload,
    });
    return result.item?.id ?? crypto.randomUUID();
  }
  if (collection === "investments") {
    const result = await cloudflareApi<{ item?: AnyObj }>("/api/member/investments", {
      method: "POST",
      json: payload,
    });
    return result.item?.id ?? crypto.randomUUID();
  }
  if (collection === "categories") {
    const result = await cloudflareApi<{ id?: string }>("/api/member/categories", {
      method: "POST",
      json: payload,
    });
    return result.id ?? crypto.randomUUID();
  }
  if (collection === "currencies") {
    const result = await cloudflareApi<{ id?: string }>("/api/member/currencies", {
      method: "POST",
      json: payload,
    });
    return result.id ?? crypto.randomUUID();
  }
  if (collection === "recurring") {
    const result = await cloudflareApi<{ id?: string }>("/api/member/recurring", {
      method: "POST",
      json: payload,
    });
    return result.id ?? crypto.randomUUID();
  }
  if (collection === "savings") {
    const result = await cloudflareApi<{ id?: string }>("/api/member/savings", {
      method: "POST",
      json: payload,
    });
    return result.id ?? crypto.randomUUID();
  }
  if (collection === "payments") {
    const result = await cloudflareApi<{ id?: string }>("/api/member/payments", {
      method: "POST",
      json: payload,
    });
    return result.id ?? crypto.randomUUID();
  }
  if (collection === "admin_logs") {
    await cloudflareApi("/api/admin/logs", {
      method: "POST",
      json: payload,
    });
    return crypto.randomUUID();
  }
  return crypto.randomUUID();
};

export class Timestamp {
  private value: Date;

  constructor(date: Date) {
    this.value = date;
  }

  toDate() {
    return this.value;
  }

  static now() {
    return new Timestamp(new Date());
  }

  static fromDate(date: Date) {
    return new Timestamp(date);
  }
}

export const serverTimestamp = () => Timestamp.now();

export const collection = (_db: unknown, name: string): CollectionRef => ({
  kind: "collection",
  name,
});

export const doc = (
  parent: any,
  collectionOrId: string,
  maybeId?: string
): DocRef => {
  if (typeof maybeId === "string") {
    return {
      kind: "doc",
      collection: collectionOrId,
      id: maybeId,
    };
  }

  if (parent?.kind === "collection") {
    return {
      kind: "doc",
      collection: parent.name,
      id: collectionOrId,
    };
  }

  return {
    kind: "doc",
    collection: "unknown",
    id: collectionOrId,
  };
};

export const where = (field: string, op: string, value: any): Constraint => ({
  kind: "where",
  field,
  op,
  value,
});

export const orderBy = (
  field: string,
  direction: "asc" | "desc" = "asc"
): Constraint => ({
  kind: "orderBy",
  field,
  direction,
});

export const limit = (value: number): Constraint => ({
  kind: "limit",
  value,
});

export const query = (
  ref: CollectionRef,
  ...constraints: Constraint[]
): QueryRef => ({
  kind: "query",
  collection: ref.name,
  constraints,
});

export const getDoc = async (ref: DocRef): Promise<DocumentSnapshot> => {
  if (API_COLLECTIONS.has(ref.collection)) {
    if (ref.collection === "users") {
      try {
        if (auth.currentUser?.role === "admin" && auth.currentUser?.uid !== ref.id) {
          const data = await cloudflareApi<{ item?: AnyObj | null }>(`/api/admin/users/${ref.id}`);
          const normalized = normalize(data.item ?? null);
          return {
            id: ref.id,
            exists: () => Boolean(normalized),
            data: () => normalized,
          };
        }
        const data = await cloudflareApi<{ item?: AnyObj | null }>("/api/member/profile");
        const normalized = normalize(data.item ?? null);
        return {
          id: ref.id,
          exists: () => Boolean(normalized),
          data: () => normalized,
        };
      } catch {
        return {
          id: ref.id,
          exists: () => false,
          data: () => null as any,
        };
      }
    }
    if (ref.collection === "admin_settings") {
      const data = await cloudflareApi<{ item?: AnyObj | null }>("/api/admin/settings");
      const normalized = normalize(data.item ?? null);
      return {
        id: ref.id,
        exists: () => Boolean(normalized),
        data: () => normalized,
      };
    }
    if (ref.collection === "ai_chats") {
      const data = await cloudflareApi<{ item?: AnyObj | null }>("/api/member/ai/chat/history");
      const normalized = normalize(data.item ?? null);
      return {
        id: ref.id,
        exists: () => Boolean(normalized),
        data: () => normalized,
      };
    }
  }

  const rows = await readCollection(ref.collection);
  const row = rows.find((item) => item.id === ref.id);
  const normalized = normalize(row ?? null);

  return {
    id: ref.id,
    exists: () => Boolean(normalized),
    data: () => normalized,
  };
};

export const getDocs = async (ref: QueryRef | CollectionRef): Promise<QuerySnapshot> => {
  const collectionName = ref.kind === "query" ? ref.collection : ref.name;
  const rows = await readCollection(collectionName);
  const filtered =
    ref.kind === "query" ? applyConstraints(rows, ref.constraints) : rows;

  return {
    docs: filtered.map((row) => makeSnapshotDoc(normalize(row))),
    empty: filtered.length === 0,
    size: filtered.length,
  };
};

export function onSnapshot(
  ref: DocRef,
  onNext: (snapshot: DocumentSnapshot) => void,
  onError?: (error: Error & { code?: string }) => void
): () => void;
export function onSnapshot(
  ref: QueryRef | CollectionRef,
  onNext: (snapshot: QuerySnapshot) => void,
  onError?: (error: Error & { code?: string }) => void
): () => void;
export function onSnapshot(
  ref: QueryRef | DocRef | CollectionRef,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
) {
  let active = true;
  const run = async () => {
    try {
      if (!active) return;
      if (ref.kind === "doc") {
        const snap = await getDoc(ref);
        onNext(snap);
        return;
      }
      const snap = await getDocs(ref);
      onNext(snap);
    } catch (error) {
      if (onError) {
        const e = error as Error & { code?: string };
        if (!e.code) {
          (e as any).code = "compat-error";
        }
        onError(e);
      }
    }
  };

  void run();
  return () => {
    active = false;
  };
};

export const setDoc = async (
  ref: DocRef,
  data: AnyObj,
  options?: { merge?: boolean }
) => {
  if (API_COLLECTIONS.has(ref.collection)) {
    await writeDocViaApi(ref, data);
    return;
  }

  const rows = readLocalCollection(ref.collection);
  const index = rows.findIndex((item) => item.id === ref.id);
  const incoming = normalize(data);
  const merged = options?.merge && index >= 0
    ? applyIncrementFields(rows[index], incoming)
    : applyIncrementFields({ id: ref.id }, incoming);
  const next = {
    id: ref.id,
    ...(options?.merge && index >= 0 ? rows[index] : {}),
    ...merged,
  };

  if (index >= 0) {
    rows[index] = next;
  } else {
    rows.push(next);
  }
  writeLocalCollection(ref.collection, rows);
};

export const updateDoc = async (ref: DocRef, data: AnyObj) => {
  await setDoc(ref, data, { merge: true });
};

export const increment = (value: number): IncrementSentinel => ({
  __op: "increment",
  value,
});

export const deleteDoc = async (ref: DocRef) => {
  if (API_COLLECTIONS.has(ref.collection)) {
    await deleteDocViaApi(ref);
    return;
  }

  const rows = readLocalCollection(ref.collection).filter((row) => row.id !== ref.id);
  writeLocalCollection(ref.collection, rows);
};

export const addDoc = async (ref: CollectionRef, data: AnyObj) => {
  let id = crypto.randomUUID();
  if (API_COLLECTIONS.has(ref.name)) {
    id = await addDocViaApi(ref.name, data);
    return { id };
  }

  const rows = readLocalCollection(ref.name);
  rows.push({
    id,
    ...normalize(data),
    userId: data.userId ?? auth.currentUser?.uid ?? null,
  });
  writeLocalCollection(ref.name, rows);
  return { id };
};
