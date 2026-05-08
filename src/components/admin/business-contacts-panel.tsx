"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, Plus, X } from "lucide-react";

import { useNotification } from "@/components/ui/notification-provider";
import { formatBusinessContactLabel, type BusinessContact } from "@/lib/business-contacts";

type ContactFormState = {
  contactEmail: string;
  contactName: string;
  contactTitle: string;
  functionalArea: string;
  notes: string;
};

const emptyForm: ContactFormState = {
  contactEmail: "",
  contactName: "",
  contactTitle: "",
  functionalArea: "",
  notes: "",
};

export function BusinessContactsPanel({ auditId }: { auditId: string | null }) {
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<BusinessContact[]>([]);
  const [form, setForm] = useState<ContactFormState>(emptyForm);

  useEffect(() => {
    if (!auditId) {
      setContacts([]);
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${auditId}/business-contacts`, { cache: "no-store" });
        const payload = (await response.json()) as { contacts?: BusinessContact[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load business contacts.");
        }

        if (!cancelled) {
          setContacts(payload.contacts ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          showNotification({
            title: "Business contacts unavailable",
            message: error instanceof Error ? error.message : "Unable to load business contacts.",
            tone: "error",
          });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [auditId, showNotification]);

  const sortedContacts = useMemo(
    () =>
      contacts
        .slice()
        .sort(
          (left, right) =>
            left.functionalArea.localeCompare(right.functionalArea) || left.contactName.localeCompare(right.contactName),
        ),
    [contacts],
  );

  if (!auditId) {
    return null;
  }

  return (
    <section className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Business contacts</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Manage stakeholder routing contacts</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Define the business owners and contact points that questions and requests should be directed to for this audit.
          </p>
        </div>
        <div className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-indigo-core)]">
          {contacts.length} contact{contacts.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[20px] border border-black/5 bg-[#fcfbf8] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Add business contact</h3>
            <Building2 size={16} className="text-[var(--brand-indigo-core)]" />
          </div>

          <div className="mt-4 grid gap-3">
            <FormField label="Functional area">
              <input
                value={form.functionalArea}
                onChange={(event) => setForm((current) => ({ ...current, functionalArea: event.target.value }))}
                placeholder="Example: IT Ops"
                className="h-10 rounded-xl border border-black/5 bg-white px-3.5 text-sm outline-none"
              />
            </FormField>

            <FormField label="Contact name">
              <input
                value={form.contactName}
                onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                placeholder="Example: Avery Collins"
                className="h-10 rounded-xl border border-black/5 bg-white px-3.5 text-sm outline-none"
              />
            </FormField>

            <div className="grid gap-3 lg:grid-cols-2">
              <FormField label="Email">
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                  placeholder="Example: a.collins@bank.com"
                  className="h-10 rounded-xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                />
              </FormField>

              <FormField label="Title">
                <input
                  value={form.contactTitle}
                  onChange={(event) => setForm((current) => ({ ...current, contactTitle: event.target.value }))}
                  placeholder="Example: IT Ops Owner"
                  className="h-10 rounded-xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                />
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional routing notes or context"
                className="min-h-[92px] rounded-xl border border-black/5 bg-white px-3.5 py-3 text-sm outline-none"
              />
            </FormField>

            <button
              type="button"
              disabled={isPending || form.functionalArea.trim().length === 0 || form.contactName.trim().length === 0}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const response = await fetch(`/api/audits/${auditId}/business-contacts`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(form),
                    });
                    const payload = (await response.json()) as { contact?: BusinessContact; error?: string };

                    if (!response.ok) {
                      throw new Error(payload.error ?? "Unable to add the business contact.");
                    }

                    if (payload.contact) {
                      setContacts((current) => [...current, payload.contact!]);
                    }
                    setForm(emptyForm);
                    showNotification({
                      title: "Business contact added",
                      message: "This contact can now be used for question and request routing.",
                      tone: "success",
                    });
                    window.dispatchEvent(new CustomEvent("business-contacts-updated", { detail: { auditId } }));
                  } catch (error) {
                    showNotification({
                      title: "Unable to add contact",
                      message: error instanceof Error ? error.message : "Unable to add the business contact.",
                      tone: "error",
                    });
                  }
                })
              }
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={16} />
              {isPending ? "Saving..." : "Add business contact"}
            </button>
          </div>
        </section>

        <section className="rounded-[20px] border border-black/5 bg-[#fcfbf8] p-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Current business contacts</h3>

          {sortedContacts.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              No business contacts are defined yet. Add owners here so questions and requests can be directed to named stakeholders.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {sortedContacts.map((contact) => (
                <article key={contact.id} className="rounded-[18px] border border-black/5 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{formatBusinessContactLabel(contact)}</p>
                      {contact.contactTitle ? <p className="mt-1 text-sm text-[var(--muted)]">{contact.contactTitle}</p> : null}
                      {contact.contactEmail ? <p className="mt-1 text-sm text-[var(--muted)]">{contact.contactEmail}</p> : null}
                      {contact.notes ? <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{contact.notes}</p> : null}
                    </div>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            const response = await fetch(
                              `/api/audits/${auditId}/business-contacts?contactId=${encodeURIComponent(contact.id)}`,
                              { method: "DELETE" },
                            );
                            const payload = (await response.json()) as { error?: string };

                            if (!response.ok) {
                              throw new Error(payload.error ?? "Unable to delete the business contact.");
                            }

                            setContacts((current) => current.filter((entry) => entry.id !== contact.id));
                            showNotification({
                              title: "Business contact removed",
                              message: `${contact.contactName} was removed from the routing list.`,
                              tone: "success",
                            });
                            window.dispatchEvent(new CustomEvent("business-contacts-updated", { detail: { auditId } }));
                          } catch (error) {
                            showNotification({
                              title: "Unable to remove contact",
                              message: error instanceof Error ? error.message : "Unable to delete the business contact.",
                              tone: "error",
                            });
                          }
                        })
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] text-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Remove ${contact.contactName}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
