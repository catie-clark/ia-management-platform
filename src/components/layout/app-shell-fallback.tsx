"use client";

import { ActiveUserContext, getUserById } from "@/components/layout/active-user-context";

export function AppShellFallback({ children }: { children: React.ReactNode }) {
  const activeUser = getUserById("U2");

  return (
    <ActiveUserContext.Provider
      value={{
        activeUser,
        setActiveUserId: () => {},
      }}
    >
      {children}
    </ActiveUserContext.Provider>
  );
}
