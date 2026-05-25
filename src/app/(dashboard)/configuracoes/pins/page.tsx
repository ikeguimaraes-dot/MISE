'use client'

import { useState, useEffect } from 'react'
import { SetPinModal } from './_components/set-pin-modal'

type Employee = { id: string; nome: string; departamento: string | null }
type PinData = { employee_id: string; role: string }

export default function PinsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [pins, setPins] = useState<PinData[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEmp, setModalEmp] = useState<Employee | null>(null)

  async function load() {
    setLoading(true)
    const [empRes, pinRes] = await Promise.all([
      fetch('/api/employees/mise-ativos'),
      fetch('/api/auth/pins-list'),
    ])
    if (empRes.ok) setEmployees(await empRes.json())
    if (pinRes.ok) setPins(await pinRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const pinsMap = Object.fromEntries(pins.map(p => [p.employee_id, p.role]))
  const comPin = employees.filter(e => pinsMap[e.id])
  const semPin = employees.filter(e => !pinsMap[e.id])

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">PINs de Acesso</h1>
        <p className="text-sm text-neutral-400">Gerencie os PINs dos funcionários</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: employees.length, color: 'text-white' },
          { label: 'Com PIN', value: comPin.length, color: 'text-emerald-400' },
          { label: 'Sem PIN', value: semPin.length, color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs font-medium text-neutral-400">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-4">
          <p className="text-sm font-semibold text-white">Funcionários MISE ativos</p>
        </div>
        <div className="divide-y divide-neutral-800">
          {employees.map(e => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-white">{e.nome}</p>
                <p className="text-xs text-neutral-500">
                  {e.departamento ?? '—'} ·{' '}
                  {pinsMap[e.id]
                    ? <span className="text-emerald-400">PIN definido · {pinsMap[e.id]}</span>
                    : <span className="text-amber-400">Sem PIN</span>
                  }
                </p>
              </div>
              <button
                onClick={() => setModalEmp(e)}
                className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                {pinsMap[e.id] ? 'Alterar PIN' : 'Definir PIN'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {modalEmp && (
        <SetPinModal
          employee={modalEmp}
          onClose={() => setModalEmp(null)}
          onSuccess={() => { setModalEmp(null); load() }}
        />
      )}
    </div>
  )
}
