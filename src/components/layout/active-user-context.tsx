"use client";

import { createContext, useContext } from "react";

import { users } from "@/lib/data/mock-data";
import type { User } from "@/types/audit";

type ActiveUserContextValue = {
  activeUser: User;
  setActiveUserId: (userId: string) => void;
};

export const ActiveUserContext = createContext<ActiveUserContextValue | null>(null);

export function useActiveUser() {
  const context = useContext(ActiveUserContext);

  if (!context) {
    throw new Error("useActiveUser must be used within ActiveUserContext.");
  }

  return context;
}

export function getUserById(userId: string) {
  return users.find((user) => user.id === userId) ?? users[0];
}
