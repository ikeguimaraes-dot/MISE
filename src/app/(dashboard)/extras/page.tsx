import Link from "next/link";
import { validDate } from "@/lib/extras/alcada";
import { redirect } from "next/navigation";
import { extrasContext, ExtraError } from "@/lib/extras/access";
import { ExtrasReal } from "@/components/extras-real/extras-real";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Controle de Extras",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ unit_id?: string; extra_id?: string; data?: string }>;
}) {
  let context;
  try {
    context = await extrasContext();
  } catch (error) {
    if (error instanceof ExtraError && error.status === 401) redirect("/login");
    return (
      <div className="p-6 space-y-4">
        <h1>Controle de Extras</h1>
        <p>
          O fluxo real está aguardando configuração. A avaliação permanece
          disponível.
        </p>
        <Link href="/extras/avaliacao">Abrir avaliação</Link>
      </div>
    );
  }
  const { db, session, grants } = context;
  if (!grants.length)
    return (
      <div className="p-6 space-y-4">
        <h1>Controle de Extras</h1>
        <p>
          Seu usuário ainda não tem papel operacional atribuído neste módulo.
        </p>
        {session.role === "admin" && (
          <Link href="/extras/acessos">Configurar acessos de Extras</Link>
        )}
        <br />
        <Link href="/extras/avaliacao">Abrir avaliação</Link>
      </div>
    );
  const units = await db
    .from("units")
    .select("id,name")
    .in("id", [...new Set(grants.map((g) => g.unit_id))])
    .eq("active", true)
    .order("name");
  if (units.error || !units.data?.length)
    return (
      <p className="p-8">
        Não foi possível consultar suas unidades. Tente novamente.
      </p>
    );
  const params = await searchParams;
  return (
    <ExtrasReal
      units={units.data}
      grants={grants}
      employeeId={session.employeeId}
      admin={session.role === "admin"}
      notificationsPending={session.role === "admin" && !process.env.EXTRAS_NOTIFICATION_WEBHOOK}
      initialUnit={
        units.data.some((u) => u.id === params.unit_id)
          ? params.unit_id
          : undefined
      }
      initialExtra={params.extra_id}
      initialDay={
        params.data && validDate(params.data) ? params.data : undefined
      }
    />
  );
}
