'use client'

import { useEffect, useRef, useState } from 'react'

export type EventContract = { key: string; name: string; size?: number }
export default function EventDocument({ eventId, readOnly, onDocumentsChange }: { eventId?: number; readOnly: boolean; onDocumentsChange?: (documents: EventContract[]) => void }) {
  const [documents, setDocuments] = useState<EventContract[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const uploadLock = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { onDocumentsChange?.(documents) }, [documents, onDocumentsChange])

  useEffect(() => {
    if (!eventId) return
    const controller = new AbortController()
    setLoading(true); setError('')
    void (async () => {
      try {
        const response = await fetch(`/api/eventos/documento?id=${eventId}`, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message)
        if (!controller.signal.aborted) setDocuments(data)
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível carregar os contratos.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [eventId, reload])

  async function upload(file?: File) {
    if (!file || !eventId || uploadLock.current) return
    setError(''); setNotice('')
    if (file.size > 3 * 1024 * 1024) { setError('O contrato deve ter até 3 MB.'); return }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setError('Envie o contrato em PDF, JPG ou PNG.'); return }
    uploadLock.current = true; setUploading(true)
    try {
      const form = new FormData(); form.set('file', file)
      const response = await fetch(`/api/eventos/documento?id=${eventId}`, { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setDocuments(current => [data, ...current]); setNotice('Contrato enviado e salvo na O.S.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar o contrato.') }
    finally { uploadLock.current = false; setUploading(false); if (input.current) input.current.value = '' }
  }

  return <section className="events-card events-document" aria-label="Documento">
    <h2>Documento</h2>
    <p className="events-subtitle">Contratos anexados à O.S.</p>
    {!eventId && <p className="events-subtitle">Salve a O.S. primeiro para anexar o contrato.</p>}
    {loading && <p role="status">Carregando contratos…</p>}
    {!loading && eventId && !documents.length && !error && <p className="events-subtitle">Nenhum contrato anexado.</p>}
    {documents.map(document => <div className="events-attachment events-menu-info" key={document.key}>
      <span>{document.name}{document.size ? ` · ${(document.size / 1024).toFixed(0)} KB` : ''}</span>
      <a href={`/api/eventos/documento?id=${eventId}&file=${encodeURIComponent(document.key)}`} target="_blank" rel="noopener noreferrer">Ver contrato</a>
    </div>)}
    {!readOnly && <label className="events-menu-info">Anexar contrato (PDF, JPG ou PNG, até 3 MB)
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" disabled={!eventId || loading || uploading} onChange={e => { void upload(e.target.files?.[0]) }} />
      <small>{uploading ? 'Enviando contrato…' : 'O arquivo é salvo automaticamente ao selecionar.'}</small>
    </label>}
    {notice && <p role="status" className="events-notice events-menu-info">{notice}</p>}
    {error && <div role="alert" className="events-error events-menu-info">{error} <button type="button" disabled={uploading} onClick={() => setReload(value => value + 1)}>Atualizar documentos</button></div>}
  </section>
}
