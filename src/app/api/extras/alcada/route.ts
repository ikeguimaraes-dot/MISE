import { NextRequest, NextResponse } from "next/server";
import { getMiseSession } from "@/lib/session";
import { createServiceClient } from "@/lib/supabase/server";
import { validDate } from "@/lib/extras/alcada";
import { loadWeeklyBudget } from "@/lib/extras/alcada-server";

export async function GET(request: NextRequest) {
  const session = await getMiseSession();
  if (!session)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const unitId = request.nextUrl.searchParams.get("unit_id") ?? "";
  const reference = request.nextUrl.searchParams.get("data") ?? "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      unitId,
    ) ||
    !validDate(reference)
  )
    return NextResponse.json(
      { error: "Unidade ou data inválida." },
      { status: 400 },
    );
  const db = createServiceClient();
  if (session.role !== "admin") {
    const { data, error } = await db
      .from("employees")
      .select("unit_id,ativo")
      .eq("id", session.employeeId)
      .single();
    const { data: grants } = await db
      .schema("mise")
      .from("extra_access")
      .select("unit_id")
      .eq("employee_id", session.employeeId)
      .eq("unit_id", unitId)
      .limit(1);
    if (
      error ||
      !data?.ativo ||
      !(
        grants?.length ||
        (session.role === "gerente" && data.unit_id === unitId)
      )
    )
      return NextResponse.json(
        { error: "Sem acesso a esta unidade." },
        { status: 403 },
      );
  }
  const unit = await db
    .from("units")
    .select("id")
    .eq("id", unitId)
    .eq("active", true)
    .maybeSingle();
  if (unit.error)
    return NextResponse.json(
      { error: "Não foi possível verificar a unidade." },
      { status: 503 },
    );
  if (!unit.data)
    return NextResponse.json(
      { error: "Unidade indisponível." },
      { status: 404 },
    );
  try {
    const budget = await loadWeeklyBudget(db, unitId, reference);
    return NextResponse.json(budget, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Alçada indisponível. Tente novamente; a solicitação pode ser registrada para análise da diretoria.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
