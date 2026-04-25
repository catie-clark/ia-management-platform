"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { budgetByPhase } from "@/lib/data/mock-data";
import type { BudgetByPhase } from "@/types/audit";

export function HoursBarChart({
  data = budgetByPhase,
  insight = "Fieldwork is the current pressure point, which aligns with the risk alerts on controls and questions.",
  message,
}: {
  data?: BudgetByPhase[];
  insight?: string;
  message?: string;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Hours pacing</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Planned vs actual by audit phase</h2>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-[var(--muted)]">
            <div className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#011E41]" />
              Planned Hours
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#F5A800]" />
              Actual Hours
            </div>
          </div>
        </div>
        <div className="max-w-sm text-right text-sm text-[var(--muted)]">
          <p>{insight}</p>
          {message ? <p className="mt-2 font-medium text-[var(--brand-amber-dark)]">{message}</p> : null}
        </div>
      </div>

      <div className="mt-6 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={10}>
            <CartesianGrid vertical={false} stroke="rgba(1, 30, 65, 0.08)" />
            <XAxis dataKey="phase" tickLine={false} axisLine={false} tick={{ fill: "#4F4F4F", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#4F4F4F", fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "rgba(245,168,0,0.08)" }}
              formatter={(value: number, name: string) => [value, formatSeriesLabel(name)]}
              labelFormatter={(label) => `${label} phase`}
              contentStyle={{
                borderRadius: 18,
                border: "1px solid rgba(1,30,65,0.08)",
                background: "#ffffff",
                boxShadow: "0 18px 44px rgba(1,30,65,0.12)",
              }}
            />
            <Bar dataKey="plannedHours" radius={[10, 10, 0, 0]} fill="#011E41" />
            <Bar dataKey="actualHours" radius={[10, 10, 0, 0]} fill="#F5A800" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function formatSeriesLabel(value: string) {
  switch (value) {
    case "plannedHours":
      return "Planned Hours";
    case "actualHours":
      return "Actual Hours";
    default:
      return value;
  }
}
