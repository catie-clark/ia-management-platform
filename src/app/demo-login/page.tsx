"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BriefcaseBusiness, ChevronRight, UserRound } from "lucide-react";

const roles = [
  {
    id: "manager",
    label: "Launch as Manager",
    sublabel: "Audit in Charge / Manager",
    description:
      "Review engagement status, approve planning outputs, track budget versus actual hours, and oversee fieldwork progress across the team.",
    icon: BriefcaseBusiness,
    accent: "amber" as const,
  },
  {
    id: "staff",
    label: "Launch as Staff",
    sublabel: "Audit Staff / Senior",
    description:
      "Work through testing matrices and workpapers, respond to review notes, log questions and evidence requests, and update task statuses.",
    icon: UserRound,
    accent: "teal" as const,
  },
];

export default function DemoLoginPage() {
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 20 },
    visible: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.45,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    }),
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(245,168,0,0.12),transparent_50%),linear-gradient(180deg,#f8f4ea_0%,#f6f4ef_60%,#f2eee5_100%)]">
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[var(--brand-indigo-dark)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/">
            <Image src="/crowe_logo_2c_w.png" alt="Crowe" width={128} height={36} className="h-6 w-auto" priority />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
            AuditDESK Demo
          </span>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-61px)] max-w-3xl flex-col items-center justify-center px-4 py-12 sm:px-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          className="text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-indigo-core)]">
            Demo environment
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--brand-indigo-dark)] sm:text-4xl">
            Choose your role
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Select a role to explore AuditDESK from that perspective. Both routes load the same workspace.
          </p>
        </motion.div>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
          {roles.map((role, index) => {
            const Icon = role.icon;
            const isAmber = role.accent === "amber";
            return (
              <motion.div
                key={role.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0.08 + index * 0.08}
              >
                <Link
                  href={`/audit-intake?role=${role.id}`}
                  className={`group flex h-full flex-col rounded-[28px] border p-7 shadow-[0_20px_44px_rgba(1,30,65,0.07)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_28px_56px_rgba(1,30,65,0.12)] ${
                    isAmber
                      ? "border-[rgba(245,168,0,0.22)] bg-gradient-to-br from-white to-[rgba(245,168,0,0.04)]"
                      : "border-[rgba(5,171,140,0.18)] bg-gradient-to-br from-white to-[rgba(5,171,140,0.04)]"
                  }`}
                >
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                      isAmber
                        ? "border border-[rgba(245,168,0,0.24)] bg-[rgba(245,168,0,0.1)] text-[var(--brand-amber-dark)]"
                        : "border border-[rgba(5,171,140,0.22)] bg-[rgba(5,171,140,0.1)] text-[var(--brand-teal-core)]"
                    }`}
                  >
                    <Icon size={22} />
                  </div>
                  <p
                    className={`mt-4 text-xs font-semibold uppercase tracking-[0.2em] ${
                      isAmber ? "text-[var(--brand-amber-dark)]" : "text-[var(--brand-teal-core)]"
                    }`}
                  >
                    {role.sublabel}
                  </p>
                  <h2 className="mt-1.5 text-xl font-semibold text-[var(--brand-indigo-dark)]">{role.label}</h2>
                  <p className="mt-3 flex-1 text-sm leading-7 text-[var(--muted)]">{role.description}</p>
                  <div
                    className={`mt-5 inline-flex items-center gap-2 text-sm font-semibold ${
                      isAmber ? "text-[var(--brand-amber-dark)]" : "text-[var(--brand-teal-core)]"
                    }`}
                  >
                    Enter workspace
                    <ChevronRight
                      size={16}
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.28}
          className="mt-8 text-center text-xs text-[var(--muted)] opacity-60"
        >
          Role-based access control is deferred for this demo. Both roles load the same workspace.
        </motion.p>
      </div>
    </div>
  );
}
