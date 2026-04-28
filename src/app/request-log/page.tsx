import { redirect } from "next/navigation";

export default async function RequestLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const next = new URLSearchParams();
  next.set("tab", "requests");

  const mode = getSingleValue(params.mode);
  const auditId = getSingleValue(params.auditId);
  const auditLabel = getSingleValue(params.auditLabel);
  const requestId = getSingleValue(params.requestId);
  const phase = getSingleValue(params.phase);
  const sync = getSingleValue(params.sync);

  if (mode === "live" && auditId) {
    next.set("mode", "live");
    next.set("auditId", auditId);
  } else {
    next.set("mode", "prototype");
  }

  if (auditLabel) {
    next.set("auditLabel", auditLabel);
  }

  if (sync) {
    next.set("sync", sync);
  }

  if (phase) {
    next.set("phase", phase);
  }

  if (requestId) {
    next.set("requestId", requestId);
  }

  redirect(`/question-log?${next.toString()}`);
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
