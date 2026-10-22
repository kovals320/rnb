import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, errText, type Client, type ClientTask, type Status } from '../lib/supabase'
import { shortDate } from '../lib/dates'
import { BackLink, ErrorBox, Field, H2, Icon, Page, Spinner, StatusPill, Title, Toggle, inputCls, mapsHref, telHref } from '../components/ui'

type Visit = { id: string; date: string; status: Status; workers: { worker_id: string }[] }

export default function ClientDetail() {
  const { id } = useParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [tasks, setTasks] = useState<ClientTask[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [editing, setEditing] = useState(isNew)
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [newTask, setNewTask] = useState('')
  const [editTask, setEditTask] = useState<{ id: string; title: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (isNew) return
    const [{ data: c, error }, { data: t }, { data: v }] = await Promise.all([
      supabase.from('rnb_clients').select('*').eq('id', id!).single(),
      supabase.from('rnb_client_tasks').select('*').eq('client_id', id!).order('position'),
      supabase.from('rnb_assignments').select('id,date,status,workers:rnb_assignment_workers(worker_id)').eq('client_id', id!).order('date', { ascending: false }).limit(8),
    ])
    if (error) return setError(errText(error))
    setClient(c as Client)
    setForm({ name: c.name, phone: c.phone ?? '', address: c.address ?? '' })
    setTasks((t as ClientTask[]) ?? [])
    setVisits((v as unknown as Visit[]) ?? [])
  }, [id, isNew])

  useEffect(() => {
    load()
  }, [load])

  async function saveDetails(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('שם הלקוח חובה')
    setBusy(true)
    setError('')
    const row = { name: form.name.trim(), phone: form.phone.trim() || null, address: form.address.trim() || null, updated_at: new Date().toISOString() }
    if (isNew) {
      const { data, error } = await supabase.from('rnb_clients').insert(row).select('id').single()
      setBusy(false)
      if (error) return setError(errText(error))
      nav(`/clients/${data.id}`, { replace: true })
      setEditing(false)
      return
    }
    const { error } = await supabase.from('rnb_clients').update(row).eq('id', id!)
    setBusy(false)
    if (error) return setError(errText(error))
    setEditing(false)
    load()
  }

  async function setActive(v: boolean) {
    setClient((c) => c && { ...c, active: v })
    const { error } = await supabase.from('rnb_clients').update({ active: v, updated_at: new Date().toISOString() }).eq('id', id!)
    if (error) {
      setError(errText(error))
      load()
    }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault()
    const title = newTask.trim()
    if (!title) return
    const position = tasks.length ? Math.max(...tasks.map((t) => t.position)) + 1 : 0
    const { error } = await supabase.from('rnb_client_tasks').insert({ client_id: id, title, position })
    if (error) return setError(errText(error))
    setNewTask('')
    load()
  }

  async function removeTask(t: ClientTask) {
    if (!confirm(`להסיר את "${t.title}" מהמשימות הקבועות?`)) return
    const { error } = await supabase.from('rnb_client_tasks').delete().eq('id', t.id)
    if (error) return setError(errText(error))
    load()
  }

  async function renameTask(e: FormEvent) {
    e.preventDefault()
    if (!editTask?.title.trim()) return
    const { error } = await supabase.from('rnb_client_tasks').update({ title: editTask.title.trim() }).eq('id', editTask.id)
    if (error) return setError(errText(error))
    setEditTask(null)
    load()
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= tasks.length) return
    const next = [...tasks]
    ;[next[i], next[j]] = [next[j], next[i]]
    setTasks(next)
    const results = await Promise.all(next.map((t, k) => (t.position === k ? null : supabase.from('rnb_client_tasks').update({ position: k }).eq('id', t.id))))
    if (results.some((r) => r?.error)) setError('שינוי הסדר נכשל')
    load()
  }

  if (!isNew && !client)
    return (
      <Page bottom={false}>
        <ErrorBox>{error}</ErrorBox>
        <Spinner />
      </Page>
    )

  return (
    <Page bottom={false}>
      <div className="px-[22px] pt-5 flex items-center justify-between">
        <BackLink to="/clients" label="תיקי לקוח" />
        {!isNew && !editing && (
          <button onClick={() => setEditing(true)} className="h-11 px-4 rounded-full border border-line bg-white text-[14px] font-semibold">
            עריכה
          </button>
        )}
      </div>

      <div className="px-[22px] pt-4">
        {editing ? (
          <form onSubmit={saveDetails} className="flex flex-col gap-3.5">
            <Title>{isNew ? 'לקוח חדש' : 'עריכת לקוח'}</Title>
            <Field label="שם">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="כתובת">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
            </Field>
            <Field label="טלפון">
              <input type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls + ' text-right'} />
            </Field>
            <ErrorBox>{error}</ErrorBox>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="flex-1 h-[52px] rounded-full bg-rose text-white font-bold disabled:opacity-60">
                {busy ? 'שומר…' : isNew ? 'יצירת לקוח' : 'שמירה'}
              </button>
              {!isNew && (
                <button type="button" onClick={() => setEditing(false)} className="h-[52px] px-5 rounded-full border border-line bg-white font-semibold">
                  ביטול
                </button>
              )}
            </div>
            {isNew && <p className="text-[13px] text-muted">אחרי היצירה תוכלו להוסיף משימות קבועות.</p>}
          </form>
        ) : (
          client && (
            <>
              <Title>{client.name}</Title>
              <div className="mt-3.5 border-t border-line">
                {client.address && (
                  <div className="flex items-center gap-3 min-h-[50px] border-b border-line-soft">
                    <Icon name="pin" size={18} className="text-muted" />
                    <span className="flex-1 text-[16px]">{client.address}</span>
                    <a href={mapsHref(client.address)} target="_blank" rel="noreferrer" className="text-rose font-semibold text-[14px] min-h-11 flex items-center">
                      ניווט
                    </a>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-3 min-h-[50px] border-b border-line-soft">
                    <Icon name="phone" size={18} className="text-muted" />
                    <span className="flex-1 text-[16px] text-right" dir="ltr">
                      {client.phone}
                    </span>
                    <a href={telHref(client.phone)} className="text-rose font-semibold text-[14px] min-h-11 flex items-center">
                      חיוג
                    </a>
                  </div>
                )}
                <div className="border-b border-line-soft">
                  <Toggle checked={client.active} onChange={setActive} label="לקוח פעיל" hint={client.active ? 'מופיע בבחירת גינה בשיבוץ' : 'לא יופיע בבחירת גינה בשיבוץ'} />
                </div>
              </div>
            </>
          )
        )}
      </div>

      {!isNew && client && (
        <>
          {error && !editing && (
            <div className="px-[22px] pt-4">
              <ErrorBox>{error}</ErrorBox>
            </div>
          )}
          <section className="px-[22px] pt-7">
            <div className="flex items-baseline justify-between">
              <H2>משימות קבועות</H2>
              <span className="text-[13px] text-muted">{tasks.length} משימות</span>
            </div>
            <p className="text-[13px] text-muted mt-1 mb-1">שינויים כאן יחולו על שיבוצים חדשים.</p>
            {tasks.map((t, i) =>
              editTask?.id === t.id ? (
                <form key={t.id} onSubmit={renameTask} className="flex gap-2 py-1.5 border-b border-line-soft">
                  <label className="flex-1">
                    <span className="sr-only">שם המשימה</span>
                    <input autoFocus value={editTask.title} onChange={(e) => setEditTask({ ...editTask, title: e.target.value })} className={inputCls} />
                  </label>
                  <button type="submit" aria-label="שמירה" className="w-[52px] h-[52px] rounded-[14px] bg-sage text-white flex items-center justify-center">
                    <Icon name="check" stroke={2.6} />
                  </button>
                  <button type="button" aria-label="ביטול" onClick={() => setEditTask(null)} className="w-[52px] h-[52px] rounded-[14px] border border-line bg-white flex items-center justify-center">
                    <Icon name="x" size={18} />
                  </button>
                </form>
              ) : (
                <div key={t.id} className="flex items-center gap-1 min-h-[52px] border-b border-line-soft">
                  <div className="flex flex-col -my-1">
                    <button aria-label="הזזה למעלה" disabled={i === 0} onClick={() => move(i, -1)} className="w-9 h-6 flex items-center justify-center text-stone disabled:opacity-30">
                      <Icon name="up" size={16} />
                    </button>
                    <button aria-label="הזזה למטה" disabled={i === tasks.length - 1} onClick={() => move(i, 1)} className="w-9 h-6 flex items-center justify-center text-stone disabled:opacity-30">
                      <Icon name="down" size={16} />
                    </button>
                  </div>
                  <button onClick={() => setEditTask({ id: t.id, title: t.title })} className="flex-1 text-right text-[16px] py-3">
                    {t.title}
                  </button>
                  <button aria-label={`מחיקת ${t.title}`} onClick={() => removeTask(t)} className="w-11 h-11 flex items-center justify-center text-faint">
                    <Icon name="x" size={17} />
                  </button>
                </div>
              ),
            )}
            <form onSubmit={addTask} className="mt-3 flex gap-2">
              <label className="flex-1 min-w-0">
                <span className="sr-only">משימה קבועה חדשה</span>
                <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="משימה קבועה חדשה" className={inputCls} />
              </label>
              <button type="submit" aria-label="הוספת משימה" className="w-[52px] h-[52px] shrink-0 rounded-[14px] bg-rose-soft text-rose flex items-center justify-center">
                <Icon name="plus" stroke={2.4} />
              </button>
            </form>
          </section>

          <section className="px-[22px] pt-8 pb-10">
            <H2>ביקורים אחרונים</H2>
            {visits.length === 0 ? (
              <p className="text-muted mt-2">עדיין אין ביקורים</p>
            ) : (
              <div className="mt-1.5">
                {visits.map((v) => (
                  <Link key={v.id} to={`/job/${v.id}`} className="flex items-center justify-between min-h-[52px] border-b border-line-soft last:border-b-0 no-underline text-ink">
                    <span className="text-[16px]">
                      {shortDate(v.date)} · {v.workers.length} עובדים
                    </span>
                    <StatusPill status={v.status} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Page>
  )
}
