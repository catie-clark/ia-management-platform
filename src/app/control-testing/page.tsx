import { redirect } from "next/navigation";

type ControlTestingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ControlTestingPage({ searchParams }: ControlTestingPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    }
  }

  const query = params.toString();
  redirect(query ? `/fieldwork?${query}` : "/fieldwork");
}
