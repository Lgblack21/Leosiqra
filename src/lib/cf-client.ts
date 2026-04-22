export type CompatAuth = {
  currentUser:
    | {
        uid: string;
        email: string | null;
        displayName?: string | null;
        photoURL?: string | null;
        role?: "admin" | "user";
      }
    | null;
};

export type CompatDb = {
  __type: "compat-db";
};

export const auth: CompatAuth = {
  currentUser: null,
};

export const db: CompatDb = {
  __type: "compat-db",
};
