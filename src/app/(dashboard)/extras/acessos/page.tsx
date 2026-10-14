import { redirect } from "next/navigation";
import { getMiseSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { ExtrasAccess } from "@/components/extras-real/extras-access";
export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await getMiseSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/extras");
  const db = createServiceClient();
  const [people, units, grants] = await Promise.all([
    db
      .from("employees")
      .select("id,nome,unit_id")
      .eq("ativo", true)
      .order("nome"),
    db.from("units").select("id,name").eq("active", true).order("name"),
    db.schema("mise").from("extra_access").select("employee_id,unit_id,role"),
  ]);
  if (people.error || units.error || grants.error)
    return (
      <p className="p-8">
        Configuração indisponível. Verifique se o módulo foi instalado.
      </p>
    );
  return (
    <ExtrasAccess
      people={people.data ?? []}
      units={units.data ?? []}
      initial={grants.data ?? []}
    />
  );
}
