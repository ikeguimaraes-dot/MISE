import { loadCrivoReport } from "@/lib/crivo/report";
import { CrivoError } from "@/lib/crivo/access";
import { redirect, notFound } from "next/navigation";
import { CrivoReportClient } from "@/components/crivo/report-client";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const { report } = await loadCrivoReport(id);
    return <CrivoReportClient report={report} />;
  } catch (e) {
    if (e instanceof CrivoError) {
      if (e.status === 401) redirect("/login");
      if (e.status === 404) notFound();
      return (
        <main className="p-8">
          <h1>Laudo CRIVO</h1>
          <p>{e.message}</p>
        </main>
      );
    }
    throw e;
  }
}
