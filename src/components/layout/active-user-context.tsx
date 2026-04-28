"use client";

import { createContext, useContext } from "react";

import type { User } from "@/types/audit";

type ActiveUserContextValue = {
  activeUser: User;
  setActiveUserId: (userId: string) => void;
};

export const ActiveUserContext = createContext<ActiveUserContextValue | null>(null);

const fallbackUser: User = {
  id: "UNASSIGNED_VIEWER",
  name: "Audit User",
  email: "",
  role: "STAFF",
};

export function useActiveUser() {
  const context = useContext(ActiveUserContext);

  if (!context) {
    throw new Error("useActiveUser must be used within ActiveUserContext.");
  }

  return context;
}

export function getUserById(userId: string) {
  return fallbackUser;
}
