"use client";

export const ADMIN_AUTH_KEY = "neuron_admin_auth";

export const DEMO_ADMIN = {
  email: "admin@neuronacademy.in",
  adminId: "ADMIN-001",
  password: "neuron123",
};

export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_AUTH_KEY) === "true";
  } catch {
    return false;
  }
}

export function adminLogin(identifier: string, password: string): boolean {
  const id = identifier.trim().toLowerCase();
  const ok =
    (id === DEMO_ADMIN.email || id === DEMO_ADMIN.adminId.toLowerCase()) &&
    password === DEMO_ADMIN.password;
  if (ok) {
    try {
      window.localStorage.setItem(ADMIN_AUTH_KEY, "true");
    } catch {
      /* ignore */
    }
  }
  return ok;
}

export function adminLogout(): void {
  try {
    window.localStorage.removeItem(ADMIN_AUTH_KEY);
  } catch {
    /* ignore */
  }
}
