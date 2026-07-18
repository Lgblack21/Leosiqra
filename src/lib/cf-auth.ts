import { cloudflareApi } from "@/lib/cloudflare-api";
import { auth } from "@/lib/cf-client";

export type User = {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role?: "admin" | "user";
  // false untuk akun Google (tidak punya password lokal) — dipakai untuk
  // menyesuaikan alur Ganti Password / Reset Data, yang keduanya butuh
  // verifikasi "password saat ini" yang tidak pernah ada untuk akun ini.
  hasPassword?: boolean;
};

type CompatUserPayload = {
  id?: string;
  email?: string | null;
  name?: string | null;
  photo_url?: string | null;
  photoURL?: string | null;
  role?: string | null;
  hasPassword?: boolean;
};

const toCompatUser = (payload: CompatUserPayload | null | undefined): User | null => {
  if (!payload || !payload.id) {
    return null;
  }

  return {
    uid: payload.id,
    email: payload.email ?? null,
    displayName: payload.name ?? null,
    photoURL: payload.photo_url ?? payload.photoURL ?? null,
    role: payload.role === "admin" ? "admin" : "user",
    hasPassword: payload.hasPassword ?? true,
  };
};

export const onAuthStateChanged = (
  _auth: typeof auth,
  callback: (user: User | null) => void
) => {
  let active = true;
  cloudflareApi<{ user?: CompatUserPayload | null }>("/api/auth/me")
    .then((result) => {
      if (!active) return;
      const nextUser = toCompatUser(result.user ?? null);
      _auth.currentUser = nextUser;
      callback(nextUser);
    })
    .catch(() => {
      if (!active) return;
      _auth.currentUser = null;
      callback(null);
    });

  return () => {
    active = false;
  };
};

export const updateProfile = async (user: User, data: { displayName?: string; photoURL?: string }) => {
  auth.currentUser = {
    ...user,
    displayName: data.displayName ?? user.displayName ?? null,
    photoURL: data.photoURL ?? user.photoURL ?? null,
  };
};
