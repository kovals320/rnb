import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Brand, ErrorBox, Field, Icon, inputCls } from '../components/ui'

export default function Login() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [forgot, setForgot] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message.includes('Invalid') ? 'אימייל או סיסמה שגויים' : error.message)
  }

  return (
    <div className="max-w-[420px] mx-auto min-h-dvh flex flex-col px-7">
      <div className="flex-1 flex flex-col justify-center items-center text-center gap-2.5 pt-16 pb-10">
        <Icon name="leaf" size={56} stroke={1.4} className="text-rose" />
        <Brand big />
        <div className="text-[15px] text-muted">ניהול צוות הגינון</div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3.5 pb-10">
        <Field label="אימייל">
          <input type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className={inputCls + ' text-right'} />
        </Field>
        <Field label="סיסמה">
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
        <ErrorBox>{error}</ErrorBox>
        <button type="button" onClick={() => setForgot(!forgot)} className="self-start text-rose font-semibold text-[14px] min-h-8">
          שכחתי סיסמה
        </button>
        {forgot && <div className="text-[14px] text-muted -mt-2">פנו למנהל והוא יגדיר לכם סיסמה חדשה מתוך מסך העובדים.</div>}
        <button type="submit" disabled={busy} className="h-[58px] rounded-full bg-rose text-white font-bold text-[17px] mt-1.5 disabled:opacity-60">
          {busy ? 'נכנס…' : 'כניסה'}
        </button>
        <div className="text-center text-[13px] text-muted mt-2">אין לך חשבון? המנהל מוסיף אותך מתוך מסך העובדים</div>
      </form>
    </div>
  )
}
