type TurnoEventType =
  | 'turno.period.closed'
  | 'turno.closed'

interface TurnoEventPayload {
  type: TurnoEventType
  unitId: string
  entityId: string
  actorId: string
  occurredAt: string
  payload?: Record<string, unknown>
}

// No-op controlado por OPX_LEDGER_ENABLED — seam para Fase 0 do ledger.
// Não cria nenhuma tabela nem referencia schema opx.
export async function emitTurnoEvent(event: TurnoEventPayload): Promise<void> {
  if (process.env.OPX_LEDGER_ENABLED !== 'true') return
  // Fase 0: dual-write para opx.event virá aqui
  console.log('[TURNO ledger stub]', event.type, event.unitId, event.occurredAt)
}
