"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
    <section className="relative border border-black/6 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Business contacts</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Manage stakeholder routing contacts</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Define the business owners and contact points that questions and requests should be directed to for this audit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-indigo-core)]">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"}
          </div>
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Add contact
          </button>
        </div>
      </div>

      {sortedContacts.length === 0 ? (
        <div className="mt-4 border border-dashed border-black/10 p-5">
          <p className="text-sm leading-6 text-[var(--muted)]">
            No business contacts are defined yet. Use the add flow to link an existing user or create a new routing contact.
          </p>
        </div>
      ) : (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-black/5 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Name</th>
              <th className="border-b border-black/5 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Area</th>
              <th className="border-b border-black/5 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Email</th>
              <th className="border-b border-black/5 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sortedContacts.map((contact) => (
              <tr key={contact.id} className="border-b border-black/5 transition-colors hover:bg-[var(--surface-soft)]">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-[var(--foreground)]">{formatBusinessContactLabel(contact)}</p>
                  {contact.contactTitle ? <p className="text-xs text-[var(--muted)]">{contact.contactTitle}</p> : null}
                </td>
                <td className="px-3 py-2.5 text-[var(--muted)]">{contact.functionalArea}</td>
                <td className="px-3 py-2.5 text-[var(--muted)]">{contact.contactEmail || "—"}</td>
                <td className="px-3 py-2.5 text-right">
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
                    className="inline-flex h-7 w-7 items-center justify-center border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] text-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Remove ${contact.contactName}`}
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ContainedAdminModal
        open={isAddModalOpen}
        title="Add business contact"
        subtitle="Create a routing contact for questions and requests. Contacts shown here come from the business contacts list only."
        onClose={() => setIsAddModalOpen(false)}
      >
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
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

                const nextContact = payload.contact;
                if (nextContact) {
                  setContacts((current) => [...current, nextContact]);
                }
                setForm(emptyForm);
                setIsAddModalOpen(false);
                showNotification({
                  title: "Business contact added",
                  message: "This contact was saved to the business contacts list and can now be used for routing.",
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
            });
          }}
        >
          <FormField label="Functional area">
            <input
              value={form.functionalArea}
              onChange={(event) => setForm((current) => ({ ...current, functionalArea: event.target.value }))}
              placeholder="Example: IT Ops"
              className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
            />
          </FormField>

          <FormField label="Contact name">
            <input
              value={form.contactName}
              onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
              placeholder="Example: Avery Collins"
              className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Email">
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                placeholder="Example: a.collins@bank.com"
                className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
              />
            </FormField>

            <FormField label="Title">
              <input
                value={form.contactTitle}
                onChange={(event) => setForm((current) => ({ ...current, contactTitle: event.target.value }))}
                placeholder="Example: IT Ops Owner"
                className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Optional routing notes or context"
              className="min-h-[92px] rounded-2xl border border-black/5 bg-white px-3.5 py-3 text-sm outline-none"
            />
          </FormField>

          <ModalActions
            isPending={isPending}
            submitDisabled={isPending || form.functionalArea.trim().length === 0 || form.contactName.trim().length === 0}
            submitLabel="Add contact"
            onCancel={() => setIsAddModalOpen(false)}
          />
        </form>
      </ContainedAdminModal>
    </section>
  );
}

function ContainedAdminModal({
  children,
  onClose,
  open,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  subtitle: string;
  title: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close add business contact panel"
        onClick={onClose}
        className="absolute inset-0 z-20 rounded-[24px] bg-[rgba(1,30,65,0.18)] backdrop-blur-[1px]"
      />
      <aside className="absolute inset-y-0 right-0 z-30 flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-r-[24px] border-l border-black/5 bg-[#fbfaf7] p-6 shadow-[-24px_0_60px_rgba(1,30,65,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Manage directory</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
          </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)]"
            >
              <X size={18} />
            </button>
          </div>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </aside>
    </>
  );
}

function ModalActions({
  isPending,
  onCancel,
  submitDisabled = false,
  submitLabel,
}: {
  isPending: boolean;
  onCancel: () => void;
  submitDisabled?: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitDisabled}
        className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
