import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default function AdminPage() {
  return (
    <PlaceholderPage
      eyebrow="Foundation"
      title="Admin and configuration"
      description="The prototype keeps fixed defaults today, but this page reserves the control plane for future reviewer chains, reminder thresholds, template selectors, and integration settings."
      nextDeliverables={[
        "Default reviewer chain configuration view",
        "Reminder threshold settings and template selectors",
        "Future integration placeholder cards for external systems and OpenAI",
        "User and role overview for audit ownership patterns",
      ]}
    />
  );
}
