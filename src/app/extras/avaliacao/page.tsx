import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { validDate } from "@/lib/extras/alcada";
import { getMiseSession } from "@/lib/session";
import { ExtrasPreview } from "@/components/extras-evaluation/extras-preview";
import "@/components/extras-evaluation/extras.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Extras · avaliação",
  robots: { index: false, follow: false },
};

export default async function ExtrasEvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ unit_id?: string; data?: string }>;
}) {
  const session = await getMiseSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "gerente") redirect("/");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const db = createServiceClient();
  const params = await searchParams;
  let ownUnit: string | null = null;
  if (session.role !== "admin") {
    const employee = await db
      .from("employees")
      .select("unit_id")
      .eq("id", session.employeeId)
      .single();
    if (employee.error || !employee.data?.unit_id)
      return (
        <p className="p-6">
          Seu acesso não tem unidade vinculada. Solicite o vínculo para
          consultar a alçada.
        </p>
      );
    ownUnit = employee.data.unit_id;
  }
  const operational=await db.from("op_extra_alcada").select("unit_id");
  if(operational.error)throw new Error("Unidades operacionais indisponíveis.");
  let query = db
    .from("units")
    .select("id, name")
    .eq("active", true).in("id",[...new Set(operational.data.map(c=>c.unit_id))])
    .order("name");
  if (ownUnit) query = query.eq("id", ownUnit);
  const units = await query;
  if (units.error || !units.data?.length)
    return (
      <p className="p-6">
        Não foi possível carregar as unidades permitidas. Tente novamente.
      </p>
    );
  const initialUnit =
    units.data.find((unit) => unit.id === params.unit_id)?.name ??
    units.data.find((unit) => unit.name === "Meet & Eat")?.name ??
    units.data[0].name;
  const initialDay =
    params.data && validDate(params.data) ? params.data : today;

  // Authenticated evaluation only. Simulated roles never grant database privileges.
  return (
    <ExtrasPreview
      key={session.employeeId}
      today={today}
      mode="review"
      storageScope={session.employeeId}
      units={units.data}
      initialUnit={initialUnit}
      initialDay={initialDay}
    />
  );
}
