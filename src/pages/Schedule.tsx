import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, errText, type Status } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { addDays, dayLabel, dayName, longDate, today } from '../lib/dates'
import { ActionButton, BottomBar, ErrorBox, Eyebrow, Icon, Page, Spinner, StatusPill, Title, TopBar } from '../components/ui'

type Row = {
  id: string
  status: Status
  created_at: string
  client: { id: string; name: string; address: string | null } | null
  workers: { worker: { id: string; display_name: string } | null }[]
  tasks: { kind: 'fixed' | 'extra'; done: boolean }[]
}

export default function Schedule() {
  const { isAdmin, profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const date = params.get('d') || today()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const dateInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setError('')
    const { data, error } = await supabase
      .from('rnb_assignments')
      .select('id,status,created_at,client:rnb_clients(id,name,address),workers:rnb_assignment_workers(worker:rnb_profiles(id,display_name)),tasks:rnb_assignment_tasks(kind,done)')
      .eq('date', date)
      .order('created_at')
    if (error) setError(errText(error))
    setRows((data as unknown as Row[]) ?? [])
  }, [date])

  useEffect(() => {
    setRows(null)
    load()
    const f = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [load])

  const go = (d: string) => setParams(d === today() ? {} : { d }, { replace: true })
  const submitted = rows?.filter((r) => r.status === 'submitted').length ?? 0

  return (
    <Page>
      <TopBar />
      <div className="px-[22px] pt-6">
        <Eyebrow>{dayLabel(date) !== dayName(date) ? `${dayLabel(date)} · ${dayName(date)}` : dayName(date)}</Eyebrow>
        <button className="block text-right" onClick={() => dateInput.current?.showPicker?.() ?? dateInput.current?.click()} aria-label="בחירת תאריך">
          <Title>{longDate(date)}</Title>
        </button>
        <input ref={dateInput} type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} className="sr-only" tabIndex={-1} aria-hidden="true" />
        <div className="flex items-center justify-between mt-3.5 pb-3.5 border-b border-line gap-2">
          <div className="text-[15px] text-muted">
            {rows === null ? '…' : rows.length === 0 ? 'אין שיבוצים' : isAdmin ? `${rows.length} גינות · ${submitted} דוחות הוגשו` : `${rows.length} עבודות שלך`}
          </div>
          <div className="flex gap-1.5 items-center">
            {date !== today() && (
              <button onClick={() => go(today())} className="h-11 px-3.5 rounded-full border border-line bg-white text-[14px] font-semibold">
                היום
              </button>
            )}
            <button aria-label="יום קודם" onClick={() => go(addDays(date, -1))} className="w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center">
              <Icon name="prev" size={18} />
            </button>
            <button aria-label="יום הבא" onClick={() => go(addDays(date, 1))} className="w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center">
              <Icon name="next" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-[22px] pt-1.5">
        <ErrorBox>{error}</ErrorBox>
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-muted flex flex-col items-center gap-3">
            <Icon name="leaf" size={36} stroke={1.4} className="text-stone" />
            {isAdmin ? 'אין עדיין שיבוצים ליום הזה' : `אין לך עבודות ביום הזה, ${profile?.display_name.split(' ')[0]}`}
          </div>
        ) : (
          rows.map((r, i) => {
            const fixed = r.tasks.filter((t) => t.kind === 'fixed')
            const extra = r.tasks.filter((t) => t.kind === 'extra')
            const done = r.tasks.filter((t) => t.done).length
            const names = r.workers.map((w) => w.worker?.display_name.split(' ')[0]).filter(Boolean)
            return (
              <Link key={r.id} to={`/job/${r.id}`} className={`flex gap-3.5 py-4 no-underline text-ink ${i < rows.length - 1 ? 'border-b border-line-soft' : ''}`}>
                <div className={`font-serif text-[26px] font-medium w-[34px] shrink-0 ${r.status === 'in_progress' ? 'text-rose' : 'text-stone'}`}>{String(i + 1).padStart(2, '0')}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-serif text-[21px] font-bold truncate">{r.client?.name}</div>
                    <StatusPill status={r.status} progress={`${done}/${r.tasks.length}`} />
                  </div>
                  {r.client?.address && <div className="text-[14px] text-muted mt-0.5">{r.client.address}</div>}
                  <div className="text-[13px] mt-2">
                    {names.join(' · ') || <span className="text-muted">לא שובצו עובדים</span>}
                    {extra.length > 0 && <span className="text-rose font-semibold"> · +{extra.length} {extra.length === 1 ? 'משימה נוספת' : 'משימות נוספות'}</span>}
                    {fixed.length === 0 && extra.length === 0 && <span className="text-muted"> · אין משימות</span>}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
      <BottomBar action={isAdmin ? <ActionButton to={`/assign/new?d=${date}`} label="שיבוץ" /> : undefined} />
    </Page>
  )
}
