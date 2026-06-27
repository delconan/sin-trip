"use client";

import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const PlannerApp = dynamic(
  () => import("@/components/planner-app").then((module) => module.PlannerApp),
  {
    ssr: false,
    loading: () => <main className="planner-loading"><span>SG</span><p>正在展开旅行手账…</p></main>,
  },
);

export function PlannerLoader() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={queryClient}><PlannerApp /></QueryClientProvider>;
}
