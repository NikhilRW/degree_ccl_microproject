import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getRuntimeInfo } from "@/server/runtime.functions";

export function DemoNotice() {
  const { data } = useQuery({
    queryKey: ["runtime"],
    queryFn: () => getRuntimeInfo(),
    staleTime: Infinity,
  });
  if (!data) return null;
  return (
    <aside
      className="border-b border-border bg-amber-50 px-4 py-2 text-center text-xs text-amber-950"
      aria-label="Demo status"
    >
      {data.mode === "demo"
        ? "Lab demo — simulated login, payments and email. Use synthetic data only."
        : "Cloud lab — Razorpay test payments only. No real money is charged."}
      {data.adminAccess && (
        <Link to="/admin" className="ml-2 font-semibold underline">
          Open admin
        </Link>
      )}
    </aside>
  );
}
