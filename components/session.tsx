"use client";
/* Client-side access to the signed-in user (mirrors Shell.user from js/shell.js).
   Hydrated from the server in the root layout. */
import { createContext, useContext, type ReactNode } from "react";
import type { Role } from "@/lib/types";

export interface ClientUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  active: boolean;
  createdAt: number;
}

const Ctx = createContext<ClientUser | null>(null);

export function useSession(): ClientUser | null {
  return useContext(Ctx);
}

export function SessionProvider({ user, children }: { user: ClientUser | null; children: ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}
