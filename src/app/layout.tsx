import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";

import { AppShellFallback } from "@/components/layout/app-shell-fallback";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationProvider } from "@/components/ui/notification-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "AuditDESK",
  description: "AuditDESK - A hub for internal audit management.",
};

const themeInitScript = `
(() => {
  const storageKey = "theme-preference";
  const root = document.documentElement;
  const storedTheme = window.localStorage.getItem(storageKey);
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : systemTheme;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <NotificationProvider>
          <Suspense fallback={<AppShellFallback>{children}</AppShellFallback>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </NotificationProvider>
      </body>
    </html>
  );
}
