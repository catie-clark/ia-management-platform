"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { budgetByPhase } from "@/lib/data/mock-data";
import type { BudgetByPhase } from "@/types/audit";

export function HoursBarChart({
  data = budgetByPhase,
  insight = "Fieldwork is the current pressure point, which aligns with the risk alerts on controls and questions.",
  message,
  variant = "dashboard",
}: {
  data?: BudgetByPhase[];
  insight?: string;
  message?: string;
  variant?: "dashboard" | "workspace";
}) {
  const isWorkspace = variant === "workspace";
  const yAxisMax = getYAxisMax(data);

  return (
    <section
      className={
        isWorkspace
          ? "flex h-full min-h-[34rem] flex-col border border-black/6 bg-white px-5 py-4"
          : "rounded-[20px] border border-black/5 bg-white px-5 py-4 shadow-[0_16px_36px_rgba(1,30,65,0.07)]"
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Hours pacing</p>
          <h2 className={isWorkspace ? "mt-2 text-lg font-semibold text-[var(--foreground)]" : "mt-2 text-xl font-semibold text-[var(--foreground)]"}>
            Planned vs actual by audit phase
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <div className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--chart-planned)" }} />
              Planned
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--chart-actual)" }} />
              Actual
            </div>
          </div>
        </div>
        <div className={isWorkspace ? "max-w-md text-[13px] leading-5 text-[var(--muted)] lg:text-right" : "max-w-sm text-right text-[13px] leading-5 text-[var(--muted)]"}>
          <p>{insight}</p>
          {message ? (
            <div className={isWorkspace ? "mt-3 border-t border-black/5 pt-3 text-[12px] font-medium text-[var(--brand-amber-dark)]" : "mt-2 font-medium text-[var(--brand-amber-dark)]"}>
              {message}
            </div>
          ) : null}
        </div>
      </div>

      <div className={isWorkspace ? "mt-3 min-h-[390px] flex-1" : "mt-4 h-[280px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={10}
            margin={isWorkspace ? { top: 6, right: 8, left: -12, bottom: 0 } : { top: 12, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="phase" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
              domain={[0, yAxisMax]}
              tickCount={isWorkspace ? 6 : 5}
            />
            <Tooltip
              cursor={{ fill: "rgba(245,168,0,0.08)" }}
              formatter={(value: number, name: string) => [value, formatSeriesLabel(name)]}
              labelFormatter={(label) => `${label} phase`}
              contentStyle={{
                borderRadius: isWorkspace ? 10 : 18,
                border: "1px solid var(--chart-tooltip-border)",
                background: "var(--chart-tooltip-bg)",
                boxShadow: "0 18px 44px rgba(1,30,65,0.12)",
              }}
            />
            <Bar dataKey="plannedHours" radius={isWorkspace ? [6, 6, 0, 0] : [10, 10, 0, 0]} fill="var(--chart-planned)" />
            <Bar dataKey="actualHours" radius={isWorkspace ? [6, 6, 0, 0] : [10, 10, 0, 0]} fill="var(--chart-actual)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function getYAxisMax(data: BudgetByPhase[]) {
  const maxHours = data.reduce((max, phase) => Math.max(max, phase.plannedHours, phase.actualHours), 0);

  if (maxHours <= 0) {
    return 100;
  }

  const paddedMax = maxHours * 1.08;
  const step = paddedMax <= 120 ? 20 : paddedMax <= 300 ? 50 : 100;
  return Math.ceil(paddedMax / step) * step;
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
