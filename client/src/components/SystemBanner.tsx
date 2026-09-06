import { AlertTriangle, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function SystemBanner() {
  const { data } = trpc.admin.publicBanner.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  if (!data?.active || !data.message) return null;
  const Icon = data.level === "attention" ? AlertTriangle : Info;
  return (
    <aside
      className={`system-banner ${data.level === "attention" ? "is-attention" : ""}`}
      role="status"
    >
      <Icon size={15} />
      <span>{data.message}</span>
    </aside>
  );
}
