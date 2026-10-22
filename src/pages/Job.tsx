import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, errText, PHOTO_BUCKET, type AssignmentTask, type Photo, type Status } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { dayName, shortDate, today } from '../lib/dates'
import { compressImage, downloadFile } from '../lib/files'
import { BackLink, ErrorBox, Eyebrow, H2, Icon, Page, Spinner, StatusPill, Title, mapsHref } from '../components/ui'

type Job = {
  id: string
  date: string
  status: Status
  notes: string | null
  submitted_at: string | null
  client: { id: string; name: string; address: string | null; phone: string | null } | null
  workers: { worker: { id: string; display_name: string } | null }[]
  tasks: AssignmentTask[]
  photos: Photo[]
  submitter: { display_name: string } | null
}

export default function JobPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { profile, isAdmin } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [noteState, setNoteState] = useState<'' | 'saving' | 'saved'>('')
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'building' | 'ready'>('idle')
  const [pdf, setPdf] = useState<File | null>(null)
  const [reportPhone, setReportPhone] = useState<string | null>(null)
  const noteTimer = useRef<number | undefined>(undefined)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('rnb_assignments')
      .select('id,date,status,notes,submitted_at,client:rnb_clients(id,name,address,phone),workers:rnb_assignment_workers(worker:rnb_profiles(id,display_name)),tasks:rnb_assignment_tasks(*),photos:rnb_assignment_photos(*),submitter:rnb_profiles!rnb_assignments_submitted_by_fkey(display_name)')
      .eq('id', id!)
      .maybeSingle()
    if (error) return setError(errText(error))
    if (!data) return setMissing(true)
    const j = data as unknown as Job
    setJob(j)
    setNotes((n) => (noteTimer.current ? n : j.notes ?? ''))
    const paths = j.photos.map((p) => p.path)
    if (paths.length) {
      const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600)
      const m: Record<string, string> = {}
      signed?.forEach((s) => s.path && s.signedUrl && (m[s.path] = s.signedUrl))
      setUrls(m)
    }
  }, [id])

  useEffect(() => {
    load()
    supabase.from('rnb_settings').select('value').eq('key', 'report_whatsapp').maybeSingle().then(({ data }) => setReportPhone(data?.value ?? null))
  }, [load])

  if (missing)
    return (
      <Page bottom={false}>
        <div className="px-[22px] pt-5">
          <BackLink to="/" label="לו״ז" />
          <p className="mt-10 text-center text-muted">העבודה לא נמצאה, או שאינך משובץ אליה.</p>
        </div>
      </Page>
    )
  if (!job)
    return (
      <Page bottom={false}>
        <ErrorBox>{error}</ErrorBox>
        <Spinner />
      </Page>
    )

  const fixed = job.tasks.filter((t) => t.kind === 'fixed').sort((a, b) => a.position - b.position)
  const extra = job.tasks.filter((t) => t.kind === 'extra').sort((a, b) => a.position - b.position)
  const all = [...fixed, ...extra]
  const done = all.filter((t) => t.done).length
  const workers = job.workers.map((w) => w.worker).filter(Boolean) as { id: string; display_name: string }[]
  const backTo = job.date === today() ? '/' : `/?d=${job.date}`

  async function toggle(t: AssignmentTask) {
    const v = !t.done
    setJob((j) => j && { ...j, status: j.status === 'pending' && v ? 'in_progress' : j.status, tasks: j.tasks.map((x) => (x.id === t.id ? { ...x, done: v } : x)) })
    const { error } = await supabase.rpc('rnb_set_task_done', { p_task: t.id, p_done: v })
    if (error) {
      setError('לא נשמר: ' + errText(error))
      setJob((j) => j && { ...j, tasks: j.tasks.map((x) => (x.id === t.id ? { ...x, done: !v } : x)) })
    }
  }

  function onNotes(v: string) {
    setNotes(v)
    setNoteState('saving')
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => saveNotes(v), 900)
  }
  async function saveNotes(v = notes) {
    window.clearTimeout(noteTimer.current)
    noteTimer.current = undefined
    const { error } = await supabase.rpc('rnb_set_notes', { p_assignment: job!.id, p_notes: v.trim() || null })
    if (error) {
      setError('ההערה לא נשמרה: ' + errText(error))
      setNoteState('')
    } else setNoteState('saved')
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length || !profile) return
    setError('')
    setUploading(files.length)
    for (const f of Array.from(files)) {
      try {
        const blob = await compressImage(f)
        const path = `${job!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        const { error: e1 } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
        if (e1) throw e1
        const { error: e2 } = await supabase.from('rnb_assignment_photos').insert({ assignment_id: job!.id, path, uploaded_by: profile.id })
        if (e2) throw e2
      } catch (e) {
        setError('העלאת תמונה נכשלה: ' + errText(e))
      }
      setUploading((n) => n - 1)
    }
    if (fileInput.current) fileInput.current.value = ''
    load()
  }

  async function removePhoto(p: Photo) {
    if (!confirm('למחוק את התמונה?')) return
    const { error } = await supabase.from('rnb_assignment_photos').delete().eq('id', p.id)
    if (error) return setError(errText(error))
    await supabase.storage.from(PHOTO_BUCKET).remove([p.path])
    load()
  }

  async function finish() {
    setError('')
    setPhase('building')
    try {
      if (noteTimer.current) await saveNotes()
      const { error } = await supabase.rpc('rnb_submit', { p_assignment: job!.id })
      if (error) throw error
      const { buildReportPdf } = await import('../lib/report')
      const file = await buildReportPdf({
        client: job!.client?.name ?? '',
        address: job!.client?.address ?? null,
        date: job!.date,
        workers: workers.map((w) => w.display_name),
        fixed: fixed.map((t) => ({ title: t.title, done: t.done })),
        extra: extra.map((t) => ({ title: t.title, done: t.done })),
        notes: notes.trim() || null,
        photoUrls: job!.photos.map((p) => urls[p.path]).filter(Boolean),
        submittedBy: profile?.display_name ?? '',
      })
      setPdf(file)
      setPhase('ready')
      load()
      await share(file, true)
    } catch (e) {
      setPhase('idle')
      setError('הפקת הדו״ח נכשלה: ' + errText(e))
    }
  }

  async function share(file = pdf, silent = false) {
    if (!file) return
    const text = `דו״ח עבודה – ${job!.client?.name} – ${shortDate(job!.date)}`
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: text, text })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        if (silent) return // gesture expired; the "send" button below lets the user retry
      }
    }
    downloadFile(file)
    const phone = (reportPhone || '').replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text + ' (הקובץ ירד למכשיר, צרפו אותו להודעה)')}`, '_blank')
  }

  async function del() {
    if (!confirm(`למחוק את השיבוץ של ${job!.client?.name} ב-${shortDate(job!.date)}?`)) return
    for (const p of job!.photos) await supabase.storage.from(PHOTO_BUCKET).remove([p.path])
    const { error } = await supabase.from('rnb_assignments').delete().eq('id', job!.id)
    if (error) return setError(errText(error))
    nav(backTo)
  }

  return (
    <Page bottom={false}>
      <div className="px-[22px] pt-5 flex items-center justify-between">
        <BackLink to={backTo} label="לו״ז" />
        <div className="text-[13px] text-muted">
          {shortDate(job.date)} · {dayName(job.date)}
        </div>
      </div>

      <div className="px-[22px] pt-4">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>ביקור</Eyebrow>
          <StatusPill status={job.status} />
        </div>
        <Title className="mt-0.5">{job.client?.name}</Title>
        <div className="text-[15px] text-muted mt-1.5 flex flex-wrap gap-x-1.5">
          {job.client?.address && (
            <a href={mapsHref(job.client.address)} target="_blank" rel="noreferrer" className="text-muted underline decoration-line underline-offset-4">
              {job.client.address}
            </a>
          )}
          {job.client?.address && workers.length > 0 && <span>·</span>}
          <span>{workers.map((w) => w.display_name.split(' ')[0]).join(', ')}</span>
        </div>
        {all.length > 0 && (
          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 flex gap-[3px]" aria-hidden="true">
              {all.map((_, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-[2px] ${done > i ? 'bg-sage' : 'bg-line'}`} />
              ))}
            </div>
            <div className="text-[14px] font-bold">
              {done}/{all.length}
            </div>
          </div>
        )}
        {isAdmin && (
          <div className="flex gap-2 mt-4">
            <Link to={`/assign/${job.id}`} className="h-11 px-4 rounded-full border border-line bg-white text-[14px] font-semibold flex items-center gap-1.5 no-underline text-ink">
              <Icon name="edit" size={16} />
              עריכת שיבוץ
            </Link>
            <button onClick={del} className="h-11 px-4 rounded-full border border-line bg-white text-[14px] font-semibold flex items-center gap-1.5 text-rose">
              <Icon name="trash" size={16} />
              מחיקה
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="px-[22px] pt-4">
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}

      {fixed.length > 0 && (
        <div className="px-[22px] pt-6">
          <div className="mb-1.5">
            <H2>משימות קבועות</H2>
          </div>
          {fixed.map((t, i) => (
            <TaskRow key={t.id} t={t} last={i === fixed.length - 1} onToggle={() => toggle(t)} />
          ))}
        </div>
      )}

      {extra.length > 0 && (
        <div className="mx-[22px] mt-5 bg-rose-soft rounded-[18px] px-4 py-3.5">
          <h2 className="m-0 mb-1 font-serif text-[20px] font-bold text-rose-dark">נוסף לביקור הזה</h2>
          {extra.map((t) => (
            <TaskRow key={t.id} t={t} last tone="rose" onToggle={() => toggle(t)} />
          ))}
        </div>
      )}

      {all.length === 0 && <p className="px-[22px] pt-6 text-muted">אין משימות מוגדרות לגינה הזו.</p>}

      <div className="px-[22px] pt-6 flex flex-col gap-2.5">
        <H2>הערות ותמונות</H2>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted flex justify-between">
            <span>הערה למנהל</span>
            <span aria-live="polite">{noteState === 'saving' ? 'שומר…' : noteState === 'saved' ? 'נשמר' : ''}</span>
          </span>
          <textarea value={notes} onChange={(e) => onNotes(e.target.value)} onBlur={() => noteTimer.current && saveNotes()} placeholder="מה ראיתם היום בגינה?" rows={3} className="min-h-[88px] rounded-[14px] border border-line bg-white p-3 text-[16px] resize-y" />
        </label>
        <div className="grid grid-cols-3 gap-2">
          {job.photos.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-[14px] overflow-hidden bg-sand">
              {urls[p.path] ? (
                <a href={urls[p.path]} target="_blank" rel="noreferrer">
                  <img src={urls[p.path]} alt="תמונה מהביקור" className="w-full h-full object-cover" />
                </a>
              ) : null}
              {(isAdmin || p.uploaded_by === profile?.id) && (
                <button aria-label="מחיקת תמונה" onClick={() => removePhoto(p)} className="absolute top-1 left-1 w-9 h-9 rounded-full bg-ink/60 text-white flex items-center justify-center">
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div key={'u' + i} className="aspect-square rounded-[14px] bg-sand flex items-center justify-center">
              <span className="w-5 h-5 rounded-full border-2 border-line border-t-rose animate-spin" />
            </div>
          ))}
          <label className="aspect-square rounded-[14px] border border-dashed border-stone bg-white text-rose text-[13px] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer">
            <Icon name="camera" size={22} />
            הוספת תמונה
            <input ref={fileInput} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
          </label>
        </div>
      </div>

      <div className="px-[22px] pt-7 pb-safe flex flex-col gap-2">
        {phase === 'ready' && pdf ? (
          <>
            <button onClick={() => share()} className="h-[58px] rounded-full bg-[#1F7A4D] text-white font-bold text-[16px] flex items-center justify-center gap-2.5">
              <Icon name="whatsapp" />
              שליחת הדו״ח בוואטסאפ
            </button>
            <button onClick={() => downloadFile(pdf)} className="h-12 rounded-full border border-line bg-white font-semibold text-[15px] flex items-center justify-center gap-2">
              <Icon name="download" size={18} />
              הורדת ה-PDF
            </button>
            <div className="text-center text-[13px] text-muted">העבודה סומנה כהוגשה</div>
          </>
        ) : (
          <>
            <button onClick={finish} disabled={phase === 'building' || uploading > 0} className="h-[58px] rounded-full bg-ink text-paper font-bold text-[16px] flex items-center justify-center gap-2.5 disabled:opacity-60">
              <Icon name="whatsapp" />
              {phase === 'building' ? 'מכין את הדו״ח…' : job.status === 'submitted' ? 'שליחת דו״ח מעודכן בוואטסאפ' : 'סיום ושליחת דו״ח בוואטסאפ'}
            </button>
            <div className="text-center text-[13px] text-muted">
              {job.status === 'submitted' && job.submitted_at
                ? `הוגש ${job.submitter ? 'על ידי ' + job.submitter.display_name + ' ' : ''}ב-${new Date(job.submitted_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : 'הדו״ח יופק כ-PDF למנהל והעבודה תסומן כהוגשה'}
            </div>
          </>
        )}
      </div>
    </Page>
  )
}

function TaskRow({ t, last, onToggle, tone = 'sage' }: { t: AssignmentTask; last: boolean; onToggle: () => void; tone?: 'sage' | 'rose' }) {
  return (
    <label className={`flex items-center gap-3.5 min-h-[52px] cursor-pointer ${last ? '' : 'border-b border-line-soft'}`}>
      <input type="checkbox" className="sr-only peer" checked={t.done} onChange={onToggle} />
      <span className={`w-6 h-6 rounded-md shrink-0 flex items-center justify-center peer-focus-visible:outline-2 peer-focus-visible:outline-rose ${t.done ? (tone === 'rose' ? 'bg-rose text-white' : 'bg-sage text-white') : 'border-2 border-stone'}`}>
        {t.done && <Icon name="check" size={15} stroke={3} />}
      </span>
      <span className={`text-[16px] ${t.done ? 'line-through ' + (tone === 'rose' ? 'text-[#7E5562]' : 'text-faint') : 'font-medium'}`}>{t.title}</span>
    </label>
  )
}
