import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase, errText, type Client, type Profile } from '../lib/supabase'
import { fullDate, today } from '../lib/dates'
import { ErrorBox, Icon, Page, Spinner, inputCls } from '../components/ui'

type Existing = {
  id: string
  date: string
  client_id: string
  workers: { worker_id: string }[]
  tasks: { id: string; kind: 'fixed' | 'extra'; title: string }[]
}

export default function AssignmentForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [clients, setClients] = useState<(Client & { taskCount: number })[] | null>(null)
  const [people, setPeople] = useState<Profile[]>([])
  const [existing, setExisting] = useState<Existing | null>(null)
  const [date, setDate] = useState(params.get('d') || today())
  const [clientId, setClientId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [workers, setWorkers] = useState<string[]>([])
  const [extras, setExtras] = useState<string[]>([])
  const [newExtra, setNewExtra] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const [{ data: c }, { data: t }, { data: p }] = await Promise.all([
        supabase.from('rnb_clients').select('*').order('name'),
        supabase.from('rnb_client_tasks').select('client_id'),
        supabase.from('rnb_profiles').select('*').eq('active', true).order('display_name'),
      ])
      const counts: Record<string, number> = {}
      t?.forEach((x) => (counts[x.client_id] = (counts[x.client_id] || 0) + 1))
      setClients(((c as Client[]) ?? []).map((x) => ({ ...x, taskCount: counts[x.id] || 0 })))
      setPeople((p as Profile[]) ?? [])
      if (id) {
        const { data, error } = await supabase.from('rnb_assignments').select('id,date,client_id,workers:rnb_assignment_workers(worker_id),tasks:rnb_assignment_tasks(id,kind,title,position)').eq('id', id).single()
        if (error) return setError(errText(error))
        const e = data as unknown as Existing
        setExisting(e)
        setDate(e.date)
        setClientId(e.client_id)
        setWorkers(e.workers.map((w) => w.worker_id))
        setExtras(e.tasks.filter((t) => t.kind === 'extra').map((t) => t.title))
      }
    })()
  }, [id])

  const selected = clients?.find((c) => c.id === clientId)
  const list = useMemo(() => {
    if (!clients) return []
    const s = q.trim()
    return clients.filter((c) => (c.active || c.id === clientId) && (!s || c.name.includes(s) || (c.address ?? '').includes(s)))
  }, [clients, q, clientId])
  const pickable = people.filter((p) => p.schedulable || workers.includes(p.id))

  function addExtra() {
    const t = newExtra.trim()
    if (t && !extras.includes(t)) setExtras([...extras, t])
    setNewExtra('')
  }

  async function save() {
    if (!clientId) return setError('בחרו גינה')
    setBusy(true)
    setError('')
    const pending = newExtra.trim() && !extras.includes(newExtra.trim()) ? [...extras, newExtra.trim()] : extras
    try {
      if (!existing) {
        const { data, error } = await supabase.rpc('rnb_create_assignment', { p_date: date, p_client: clientId, p_workers: workers, p_extra: pending })
        if (error) throw error
        nav(`/job/${data}`, { replace: true })
        return
      }
      const aid = existing.id
      const { error: e1 } = await supabase.from('rnb_assignments').update({ date, client_id: clientId, updated_at: new Date().toISOString() }).eq('id', aid)
      if (e1) throw e1
      if (clientId !== existing.client_id) {
        await supabase.from('rnb_assignment_tasks').delete().eq('assignment_id', aid).eq('kind', 'fixed')
        const { data: ct } = await supabase.from('rnb_client_tasks').select('title,position').eq('client_id', clientId)
        if (ct?.length) {
          const { error } = await supabase.from('rnb_assignment_tasks').insert(ct.map((t) => ({ assignment_id: aid, kind: 'fixed', title: t.title, position: t.position })))
          if (error) throw error
        }
      }
      const oldExtras = existing.tasks.filter((t) => t.kind === 'extra')
      const removed = oldExtras.filter((t) => !pending.includes(t.title)).map((t) => t.id)
      if (removed.length) await supabase.from('rnb_assignment_tasks').delete().in('id', removed)
      const added = pending.filter((t) => !oldExtras.some((o) => o.title === t))
      if (added.length) {
        const { error } = await supabase.from('rnb_assignment_tasks').insert(added.map((t) => ({ assignment_id: aid, kind: 'extra', title: t, position: pending.indexOf(t) })))
        if (error) throw error
      }
      const oldW = existing.workers.map((w) => w.worker_id)
      const rmW = oldW.filter((w) => !workers.includes(w))
      if (rmW.length) await supabase.from('rnb_assignment_workers').delete().eq('assignment_id', aid).in('worker_id', rmW)
      const addW = workers.filter((w) => !oldW.includes(w))
      if (addW.length) {
        const { error } = await supabase.from('rnb_assignment_workers').insert(addW.map((w) => ({ assignment_id: aid, worker_id: w })))
        if (error) throw error
      }
      nav(`/job/${aid}`, { replace: true })
    } catch (e) {
      setError(errText(e))
      setBusy(false)
    }
  }

  if (!clients) return <Spinner />

  return (
    <Page bottom={false}>
      <div className="sticky top-0 z-10 bg-paper px-[22px] pt-4 pb-3.5 flex items-center justify-between border-b border-line">
        <h1 className="m-0 font-serif text-[28px] font-black">{existing ? 'עריכת שיבוץ' : 'שיבוץ חדש'}</h1>
        <button aria-label="סגירה" onClick={() => nav(-1)} className="w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center">
          <Icon name="x" size={18} />
        </button>
      </div>

      <section className="px-[22px] pt-5">
        <label className="block">
          <span className="text-[13px] font-semibold tracking-[1.5px] text-rose">תאריך</span>
          <div className="relative mt-2">
            <div className={inputCls + ' flex items-center justify-between font-semibold'}>
              {fullDate(date)}
              <Icon name="calendar" className="text-muted" />
            </div>
            <input type="date" value={date} required onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0 w-full" aria-label="תאריך" />
          </div>
        </label>
      </section>

      <section className="px-[22px] pt-6">
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] font-semibold tracking-[1.5px] text-rose">גינה</span>
          <span className="text-[12px] text-muted">לקוחות פעילים בלבד</span>
        </div>
        {selected && !q ? (
          <div className="mt-2 rounded-[14px] border border-rose bg-rose-soft px-3.5 py-2.5 flex items-center justify-between gap-2">
            <div>
              <div className="text-[16px] font-bold">{selected.name}</div>
              <div className="text-[13px] text-muted">
                {[selected.address, `${selected.taskCount} משימות קבועות`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button onClick={() => setClientId(null)} className="h-11 px-3 text-[14px] font-semibold text-rose">
              החלפה
            </button>
          </div>
        ) : (
          <>
            <label className="mt-2 flex items-center gap-2.5 h-[50px] rounded-[14px] border border-line bg-white px-3.5">
              <Icon name="search" size={18} className="text-muted" />
              <span className="sr-only">חיפוש גינה</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם או כתובת" className="flex-1 bg-transparent outline-none min-w-0" autoFocus={!id} />
            </label>
            <div className="mt-2 max-h-[300px] overflow-y-auto rounded-[14px] border border-line bg-white">
              {list.length === 0 && <div className="p-4 text-muted text-[14px]">לא נמצאו גינות</div>}
              {list.map((c) => (
                <button key={c.id} onClick={() => (setClientId(c.id), setQ(''))} className={`w-full min-h-[56px] text-right px-3.5 py-2 border-b border-line-soft last:border-b-0 flex items-center justify-between ${c.id === clientId ? 'bg-rose-soft' : ''}`}>
                  <span>
                    <span className="block text-[16px] font-semibold">{c.name}</span>
                    {c.address && <span className="block text-[13px] text-muted">{c.address}</span>}
                  </span>
                  {c.id === clientId && <Icon name="check" className="text-rose" stroke={2.6} />}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="px-[22px] pt-6">
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] font-semibold tracking-[1.5px] text-rose">עובדים</span>
          <span className="text-[13px] font-semibold">{workers.length} נבחרו</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {pickable.map((p) => {
            const on = workers.includes(p.id)
            return (
              <button key={p.id} aria-pressed={on} onClick={() => setWorkers(on ? workers.filter((w) => w !== p.id) : [...workers, p.id])} className={`h-11 px-4 rounded-full border text-[15px] flex items-center gap-1.5 ${on ? 'bg-ink border-ink text-paper font-semibold' : 'bg-white border-line font-medium'}`}>
                {on && <Icon name="check" size={14} stroke={3} />}
                {p.display_name}
              </button>
            )
          })}
        </div>
      </section>

      <section className="px-[22px] pt-6">
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] font-semibold tracking-[1.5px] text-rose">משימות נוספות</span>
          <span className="text-[12px] text-muted">לא חובה · רק לביקור הזה</span>
        </div>
        <form onSubmit={(e) => (e.preventDefault(), addExtra())} className="mt-2 flex gap-2">
          <label className="flex-1 min-w-0">
            <span className="sr-only">משימה נוספת</span>
            <input value={newExtra} onChange={(e) => setNewExtra(e.target.value)} placeholder="למשל: שתילת עונתיים בכניסה" className={inputCls} />
          </label>
          <button type="submit" aria-label="הוספת משימה" className="w-[52px] h-[52px] shrink-0 rounded-[14px] bg-rose-soft text-rose flex items-center justify-center">
            <Icon name="plus" stroke={2.4} />
          </button>
        </form>
        {extras.map((t) => (
          <div key={t} className="mt-1 flex items-center justify-between min-h-[50px] border-b border-line-soft">
            <span className="text-[16px]">{t}</span>
            <button aria-label={`הסרת ${t}`} onClick={() => setExtras(extras.filter((x) => x !== t))} className="w-11 h-11 flex items-center justify-center text-muted">
              <Icon name="x" size={18} />
            </button>
          </div>
        ))}
      </section>

      {selected && (
        <div className="mx-[22px] mt-5 rounded-[14px] border border-line bg-white px-4 py-3.5">
          <div className="text-[15px] font-bold">{selected.taskCount} משימות קבועות ייכללו</div>
          <div className="text-[13px] text-muted">
            מתוך תיק הלקוח של {selected.name}
            {existing && clientId === existing.client_id ? ' (כפי שהועתקו בזמן השיבוץ)' : ''}
          </div>
        </div>
      )}

      <div className="px-[22px] pt-6 pb-safe flex flex-col gap-3">
        <ErrorBox>{error}</ErrorBox>
        <button onClick={save} disabled={busy || !clientId} className="h-[58px] rounded-full bg-rose text-white font-bold text-[17px] disabled:opacity-50">
          {busy ? 'שומר…' : 'שמירת שיבוץ'}
        </button>
      </div>
    </Page>
  )
}
