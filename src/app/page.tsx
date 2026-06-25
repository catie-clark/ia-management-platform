"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, BookOpen, ClipboardList, Clock, FileStack } from "lucide-react";

import { AuroraText } from "@/components/ui/aurora-text";

const features = [
  {
    id: "dashboard",
    icon: BarChart3,
    eyebrow: "Executive Visibility",
    title: "Audit status at a glance",
    description:
      "Real-time KPI cards, risk-flagged controls, and milestone timelines give every stakeholder a single view of audit health—no status meeting required.",
    colSpan: "lg:col-span-7",
    dark: true,
  },
  {
    id: "planning",
    icon: BookOpen,
    eyebrow: "Planning & Scoping",
    title: "Scope rationale and tollgate prep",
    description:
      "Define audit objectives, document scope rationale, and build planning narratives and tollgate packages in a structured workflow.",
    colSpan: "lg:col-span-5",
    dark: false,
  },
  {
    id: "questions",
    icon: ClipboardList,
    eyebrow: "Question & Request Log",
    title: "Track inquiries and PBC requests",
    description:
      "Log auditor questions, assign response deadlines, and track evidence requests with automated reminders and fulfillment status.",
    colSpan: "lg:col-span-5",
    dark: false,
  },
  {
    id: "fieldwork",
    icon: FileStack,
    eyebrow: "Fieldwork & Workpapers",
    title: "Evidence-linked testing workpapers",
    description:
      "Auto-generated testing matrices, reviewer sign-off workflows, and evidence dependency tracking from controls import to conclusion.",
    colSpan: "lg:col-span-7",
    dark: true,
  },
  {
    id: "budget",
    icon: Clock,
    eyebrow: "Hours, Budget & Reporting",
    title: "Monitor spend and close cleanly",
    description:
      "Phase-level budget tracking, burn-rate visibility, and a reporting handoff workflow so the engagement closes on time and on budget.",
    colSpan: "lg:col-span-12",
    dark: false,
  },
];

export default function LandingPage() {
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 28 },
    visible: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.52,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    }),
  };

  return (
    <div>
      {/* Hero */}
      <div className="relative min-h-screen overflow-hidden bg-[var(--brand-indigo-dark)]">
        <div className="dot-pattern-bg absolute inset-0" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(245,168,0,0.22) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 15% 105%, rgba(5,171,140,0.12) 0%, transparent 55%)",
          }}
        />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Image src="/crowe_logo_2c_w.png" alt="Crowe" width={128} height={36} className="h-6 w-auto" priority />
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-amber-bright)]">
            Internal Audit Platform
          </p>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-76px)] max-w-5xl flex-col items-center justify-center px-4 pb-20 pt-8 text-center sm:px-6 lg:px-8">
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--brand-amber-bright)]"
          >
            Crowe Internal Audit
          </motion.p>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.07}
            className="mt-5 text-[4.5rem] font-semibold leading-none tracking-[-0.04em] sm:text-[6rem] lg:text-[8.5rem]"
          >
            <AuroraText>AuditDESK</AuroraText>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.2}
            className="mt-5 max-w-xl text-base leading-8 text-[rgba(255,255,255,0.68)] sm:text-[1.05rem]"
          >
            A unified workspace for internal audit teams. Planning to reporting—scope, fieldwork, evidence, and handoff managed in one connected platform.
          </motion.p>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.28} className="mt-10">
            <Link
              href="/demo-login"
              className="shimmer-btn inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-indigo-dark)] shadow-[0_0_36px_rgba(245,168,0,0.36)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              Launch Demo
              <ArrowRight size={15} />
            </Link>
          </motion.div>
        </div>

        <motion.div
          aria-hidden="true"
          className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center"
          animate={prefersReducedMotion ? {} : { opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="h-10 w-px bg-gradient-to-b from-transparent via-[rgba(255,255,255,0.4)] to-transparent" />
        </motion.div>
      </div>

      {/* Feature Bento Grid */}
      <div className="bg-[#f6f4ef]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
            className="mb-12 max-w-3xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand-indigo-core)]">
              Platform capabilities
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--brand-indigo-dark)] sm:text-4xl">
              Built for the full audit lifecycle
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--muted)]">
              Every phase of an internal audit engagement—planning, fieldwork, evidence, and reporting—managed in one connected workspace.
            </p>
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-12">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.id}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={index * 0.07}
                  className={`${feature.colSpan} rounded-[28px] border p-7 ${
                    feature.dark
                      ? "border-[rgba(255,255,255,0.06)] bg-gradient-to-br from-[var(--brand-indigo-dark)] to-[#0d2b55] shadow-[0_24px_56px_rgba(1,30,65,0.22)]"
                      : "border-[rgba(1,30,65,0.06)] bg-gradient-to-br from-white to-[#f2ede3] shadow-[0_20px_44px_rgba(1,30,65,0.07)]"
                  }`}
                >
                  <div
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                      feature.dark
                        ? "border border-white/10 bg-white/5"
                        : "border border-[rgba(1,30,65,0.08)] bg-white/80"
                    }`}
                  >
                    <Icon
                      size={20}
                      className={
                        feature.dark ? "text-[var(--brand-amber-bright)]" : "text-[var(--brand-indigo-core)]"
                      }
                    />
                  </div>
                  <p
                    className={`mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                      feature.dark ? "text-[var(--brand-amber-bright)]" : "text-[var(--brand-indigo-core)]"
                    }`}
                  >
                    {feature.eyebrow}
                  </p>
                  <h3
                    className={`mt-2 text-[1.25rem] font-semibold leading-snug ${
                      feature.dark ? "text-white" : "text-[var(--brand-indigo-dark)]"
                    }`}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className={`mt-3 text-sm leading-7 ${
                      feature.dark ? "text-[rgba(255,255,255,0.62)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="relative overflow-hidden bg-[var(--brand-indigo-dark)]">
        <div className="dot-pattern-bg pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(245,168,0,0.14) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand-amber-bright)]">
              Demo environment ready
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Explore AuditDESK now</h2>
            <p className="mt-4 text-base leading-7 text-[rgba(255,255,255,0.62)]">
              Choose a role and jump directly into a live workspace. No login required for the demo environment.
            </p>
            <div className="mt-8">
              <Link
                href="/demo-login"
                className="shimmer-btn inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-indigo-dark)] shadow-[0_0_36px_rgba(245,168,0,0.32)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                Launch Demo
                <ArrowRight size={15} />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
