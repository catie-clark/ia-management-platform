import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShellFallback } from "@/components/layout/app-shell-fallback";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationProvider } from "@/components/ui/notification-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Crowe Internal Audit Management Platform",
  description: "Crowe-styled internal audit management platform for planning, execution, and reporting.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>
          <Suspense fallback={<AppShellFallback>{children}</AppShellFallback>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </NotificationProvider>
      </body>
    </html>
  );
}
