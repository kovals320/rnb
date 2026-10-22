import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, errText, type Profile } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ActionButton, BottomBar, ErrorBox, Eyebrow, Field, Page, Sheet, Spinner, Title, Toggle, TopBar, initials, inputCls } from '../components/ui'

const tints = ['bg-rose-soft text-rose-dark', 'bg-sage-soft text-sage-dark', 'bg-sand text-[#4A3F38]']

type Form = { id?: string; display_name: string; email: string; phone: string; role: 'admin' | 'worker'; active: boolean; schedulable: boolean; password: string }
const blank: Form = { display_name: '', email: '', phone: '', role: 'worker', active: true, schedulable: true, password: '' }

export default function Workers() {
  const { profile: me, refresh } = useAuth()
  const [people, setPeople] = useState<Profile[] | null>(null)
  const [tab, setTab] = useState<'active' | 'inactive'>('active')
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneSaved, setPhoneSaved] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('rnb_profiles').select('*').order('role').order('display_name')
    if (error) setError(errText(error))
    setPeople((data as Profile[]) ?? [])
  }, [])
  useEffect(() => {
    load()
    supabase.from('rnb_settings').select('value').eq('key', 'report_whatsapp').maybeSingle().then(({ data }) => {
      setPhone(data?.value ?? '')
      setPhoneSaved(data?.value ?? '')
    })
  }, [load])

  const list = (people ?? []).filter((p) => (tab === 'active') === p.active)
  const schedulable = (people ?? []).filter((p) => p.active && p.schedulable).length

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setBusy(true)
    setFormError('')
    try {
      if (form.password && form.password.length < 6) throw new Error('סיסמה חייבת להכיל לפחות 6 תווים')
      if (!form.id) {
        const { data, error } = await supabase.functions.invoke('rnb-admin', {
          body: { action: 'create_user', email: form.email, display_name: form.display_name, phone: form.phone || null, role: form.role, active: form.active, schedulable: form.schedulable, password: form.password || undefined },
        })
        if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error || error.message)
        if (data?.existing_account && form.password) {
          const { error: pe } = await supabase.functions.invoke('rnb-admin', { body: { action: 'set_password', user_id: data.id, password: form.password } })
          if (pe) throw pe
        }
      } else {
        if (form.id === me?.id && (form.role !== 'admin' || !form.active)) throw new Error('אי אפשר להסיר הרשאת מנהל או להשבית את החשבון שלך')
        const { error } = await supabase.from('rnb_profiles').update({ display_name: form.display_name.trim(), phone: form.phone.trim() || null, role: form.role, active: form.active, schedulable: form.schedulable }).eq('id', form.id)
        if (error) throw error
        if (form.password) {
          const { error: pe } = await supabase.functions.invoke('rnb-admin', { body: { action: 'set_password', user_id: form.id, password: form.password } })
          if (pe) throw new Error((await pe.context?.json?.().catch(() => null))?.error || pe.message)
        }
      }
      setForm(null)
      load()
      if (form.id === me?.id) refresh()
    } catch (e) {
      setFormError(errText(e))
    }
    setBusy(false)
  }

  async function savePhone(e: FormEvent) {
    e.preventDefault()
    const v = phone.replace(/\D/g, '').replace(/^0/, '972')
    const { error } = await supabase.from('rnb_settings').upsert({ key: 'report_whatsapp', value: v || null })
    if (error) return setError(errText(error))
    setPhone(v)
    setPhoneSaved(v)
  }

  const tabCls = (t: string) => `h-11 px-0.5 text-[15px] ${tab === t ? 'font-bold text-ink border-b-2 border-rose' : 'font-medium text-muted'}`

  return (
    <Page>
      <TopBar />
      <div className="px-[22px] pt-6">
        <Eyebrow>{people ? `${schedulable} זמינים לשיבוץ` : '…'}</Eyebrow>
        <Title>עובדים</Title>
        <div role="tablist" className="mt-4 flex gap-5 border-b border-line">
          <button role="tab" aria-selected={tab === 'active'} className={tabCls('active')} onClick={() => setTab('active')}>
            פעילים
          </button>
          <button role="tab" aria-selected={tab === 'inactive'} className={tabCls('inactive')} onClick={() => setTab('inactive')}>
            לא פעילים
          </button>
        </div>
      </div>
      <div className="px-[22px]">
        <ErrorBox>{error}</ErrorBox>
        {!people ? (
          <Spinner />
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-muted">אין עובדים ברשימה הזו</p>
        ) : (
          list.map((p, i) => (
            <button key={p.id} onClick={() => (setFormError(''), setForm({ id: p.id, display_name: p.display_name, email: p.email, phone: p.phone ?? '', role: p.role, active: p.active, schedulable: p.schedulable, password: '' }))} className="w-full flex items-center gap-3 py-3 border-b border-line-soft last:border-b-0 text-right">
              <span className={`w-11 h-11 rounded-full flex items-center justify-center font-serif text-[17px] font-bold shrink-0 ${tints[i % 3]}`}>{initials(p.display_name)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[17px] font-bold">{p.display_name}</span>
                <span className="block text-[13px] text-muted truncate text-right" dir="ltr">
                  {p.phone || p.email}
                </span>
              </span>
              {p.active && !p.schedulable && <span className="text-[12px] text-muted">לא בשיבוץ</span>}
              {p.role === 'admin' ? <span className="text-[12px] font-bold text-paper bg-ink rounded-full px-2.5 py-[3px]">מנהל</span> : <span className="text-[12px] font-semibold text-muted border border-line rounded-full px-2.5 py-[2px]">עובד</span>}
            </button>
          ))
        )}

        <form onSubmit={savePhone} className="mt-10 rounded-[18px] border border-line bg-white p-4 flex flex-col gap-2">
          <div className="font-bold">מספר וואטסאפ לקבלת דוחות</div>
          <div className="text-[13px] text-muted">כשאין במכשיר אפשרות לשתף קובץ, הדו״ח יורד והוואטסאפ ייפתח מול המספר הזה.</div>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">מספר וואטסאפ</span>
              <input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="972501234567" className={inputCls + ' text-right'} />
            </label>
            <button type="submit" disabled={phone === phoneSaved} className="h-[52px] px-5 rounded-[14px] bg-ink text-paper font-semibold disabled:opacity-40">
              שמירה
            </button>
          </div>
        </form>
      </div>

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'עריכת עובד' : 'עובד חדש'}>
        {form && (
          <form onSubmit={save} className="flex flex-col gap-3.5">
            <Field label="שם">
              <input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="אימייל (לכניסה)">
              <input type="email" required disabled={!!form.id} dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls + ' text-right disabled:bg-paper disabled:text-muted'} />
            </Field>
            <Field label="טלפון">
              <input type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls + ' text-right'} />
            </Field>
            <Field label={form.id ? 'סיסמה חדשה (השאירו ריק כדי לא לשנות)' : 'סיסמה ראשונית'}>
              <input type="text" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="לפחות 6 תווים" className={inputCls} />
            </Field>
            <fieldset className="flex gap-2 border-0 p-0 m-0">
              <legend className="text-[14px] font-semibold mb-1.5">הרשאה</legend>
              {(['worker', 'admin'] as const).map((r) => (
                <button type="button" key={r} aria-pressed={form.role === r} onClick={() => setForm({ ...form, role: r })} className={`flex-1 h-12 rounded-full border font-semibold ${form.role === r ? 'bg-ink border-ink text-paper' : 'bg-white border-line'}`}>
                  {r === 'admin' ? 'מנהל' : 'עובד'}
                </button>
              ))}
            </fieldset>
            <div className="border-t border-line-soft">
              <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v, schedulable: v ? form.schedulable : false })} label="חשבון פעיל" hint="יכול להיכנס לאפליקציה" />
              <Toggle checked={form.schedulable} onChange={(v) => setForm({ ...form, schedulable: v })} label="זמין לשיבוץ" hint="מופיע ברשימת העובדים בשיבוץ" />
            </div>
            <ErrorBox>{formError}</ErrorBox>
            <button type="submit" disabled={busy} className="h-[56px] rounded-full bg-rose text-white font-bold text-[16px] disabled:opacity-60">
              {busy ? 'שומר…' : form.id ? 'שמירה' : 'הוספת עובד'}
            </button>
            {!form.id && <p className="text-[13px] text-muted -mt-1">שלחו לעובד את האימייל והסיסמה. הוא יוכל להיכנס מיד.</p>}
          </form>
        )}
      </Sheet>

      <BottomBar action={<ActionButton onClick={() => (setFormError(''), setForm({ ...blank }))} label="עובד" />} />
    </Page>
  )
}
