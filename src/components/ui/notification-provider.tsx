"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

type NotificationTone = "success" | "error";

type NotificationItem = {
  id: string;
  message: string;
  title: string;
  tone: NotificationTone;
};

type NotificationContextValue = {
  showNotification: (notification: Omit<NotificationItem, "id">) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const showNotification = useCallback(
    (notification: Omit<NotificationItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setNotifications((current) => [...current, { ...notification, id }]);
      window.setTimeout(() => {
        dismissNotification(id);
      }, 3600);
    },
    [dismissNotification],
  );

  const value = useMemo(
    () => ({
      showNotification,
    }),
    [showNotification],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3">
        {notifications.map((notification) => {
          const Icon = notification.tone === "success" ? CheckCircle2 : CircleAlert;

          return (
            <div
              key={notification.id}
              className={cn(
                "pointer-events-auto animate-[slide-in_240ms_ease-out] rounded-[22px] border bg-[var(--surface)] px-4 py-4 shadow-[0_18px_50px_rgba(1,30,65,0.18)]",
                notification.tone === "success"
                  ? "border-[rgba(5,171,140,0.18)]"
                  : "border-[rgba(229,55,107,0.18)]",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    notification.tone === "success"
                      ? "bg-[rgba(5,171,140,0.1)] text-[var(--brand-teal-core)]"
                      : "bg-[rgba(229,55,107,0.1)] text-[var(--brand-coral)]",
                  )}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{notification.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{notification.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissNotification(notification.id)}
                  className="rounded-full p-1 text-[var(--muted)]"
                  aria-label="Dismiss notification"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider.");
  }

  return context;
}
