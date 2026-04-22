import { cloudflareApi } from "@/lib/cloudflare-api";
import { auth } from "@/lib/cf-client";

export type User = {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role?: "admin" | "user";
};

type CompatUserPayload = {
  id?: string;
  email?: string | null;
  name?: string | null;
  photo_url?: string | null;
  photoURL?: string | null;
  role?: string | null;
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

export const updatePassword = async (_user: User, _newPassword: string) => {
  void _user;
  void _newPassword;
  throw new Error("Ganti password via Firebase sudah dinonaktifkan. Gunakan flow reset password backend.");
};
