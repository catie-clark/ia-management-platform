export type BusinessContact = {
  contactEmail?: string | null;
  contactName: string;
  contactTitle?: string | null;
  functionalArea: string;
  id: string;
  notes?: string | null;
};

export function formatBusinessContactLabel(contact: Pick<BusinessContact, "contactName" | "functionalArea">) {
  return `${contact.functionalArea} - ${contact.contactName}`;
}
