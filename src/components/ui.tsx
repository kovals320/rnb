import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { Status } from '../lib/supabase'

const paths: Record<string, ReactNode> = {
  leaf: (
    <>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  back: <path d="M5 12h14M12 5l7 7-7 7" />,
  next: <path d="m15 18-6-6 6-6" />,
  prev: <path d="m9 18 6-6-6-6" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  whatsapp: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />,
  up: <path d="m18 15-6-6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
}

export function Icon({ name, size = 20, stroke = 2, className = '' }: { name: keyof typeof paths | string; size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {paths[name]}
    </svg>
  )
}

export function Brand({ big = false }: { big?: boolean }) {
  return (
    <span dir="ltr" className={`font-serif font-bold italic ${big ? 'text-[38px]' : 'text-[20px]'}`}>
      Rose <span className="text-rose">&amp;</span> Bloom
    </span>
  )
}

export function TopBar() {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <header className="flex items-center justify-between px-[22px] pt-5">
      <Link to="/" className="text-ink no-underline">
        <Brand />
      </Link>
      <div className="relative" ref={ref}>
        <button aria-label="תפריט" aria-expanded={open} onClick={() => setOpen(!open)} className="w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center">
          <Icon name="menu" />
        </button>
        {open && (
          <div className="absolute left-0 top-12 z-30 w-60 rounded-2xl border border-line bg-white shadow-lg p-2">
            <div className="px-3 py-2">
              <div className="font-bold">{profile?.display_name}</div>
              <div className="text-[13px] text-muted" dir="ltr" style={{ textAlign: 'right' }}>
                {profile?.email}
              </div>
            </div>
            <button onClick={() => signOut()} className="w-full h-11 rounded-xl px-3 flex items-center gap-2 hover:bg-paper text-right">
              <Icon name="logout" size={18} />
              יציאה
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export function BottomBar({ action }: { action?: ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin && !action) return null
  const cls = ({ isActive }: { isActive: boolean }) =>
    `text-[15px] no-underline py-3 px-1 ${isActive ? 'font-bold text-ink border-b-2 border-rose' : 'font-medium text-muted'}`
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-line">
      <div className="max-w-[560px] mx-auto px-[22px] pt-3 pb-safe flex items-center gap-3">
        {isAdmin ? (
          <nav className="flex-1 flex justify-between">
            <NavLink to="/" end className={cls}>
              לו״ז
            </NavLink>
            <NavLink to="/clients" className={cls}>
              לקוחות
            </NavLink>
            <NavLink to="/workers" className={cls}>
              עובדים
            </NavLink>
          </nav>
        ) : (
          <div className="flex-1" />
        )}
        {action}
      </div>
    </div>
  )
}

export function ActionButton({ to, onClick, label, icon = 'plus' }: { to?: string; onClick?: () => void; label: string; icon?: string }) {
  const cls = 'h-[50px] px-5 rounded-full bg-rose text-white font-bold text-[15px] flex items-center gap-1.5 no-underline'
  if (to)
    return (
      <Link to={to} className={cls}>
        <Icon name={icon} size={18} stroke={2.4} />
        {label}
      </Link>
    )
  return (
    <button onClick={onClick} className={cls}>
      <Icon name={icon} size={18} stroke={2.4} />
      {label}
    </button>
  )
}

export function Page({ children, bottom = true }: { children: ReactNode; bottom?: boolean }) {
  return <div className={`max-w-[560px] mx-auto min-h-dvh ${bottom ? 'pb-28' : 'pb-8'}`}>{children}</div>
}

export function BackLink({ to, label }: { to?: string; label: string }) {
  const nav = useNavigate()
  return (
    <button onClick={() => (to ? nav(to) : history.length > 1 ? nav(-1) : nav('/'))} className="flex items-center gap-1.5 text-[15px] font-semibold min-h-11">
      <Icon name="back" size={18} />
      {label}
    </button>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[13px] font-semibold tracking-[1.5px] text-rose">{children}</div>
}

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h1 className={`m-0 font-serif text-[40px] sm:text-[44px] font-black leading-[1.05] ${className}`}>{children}</h1>
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="m-0 font-serif text-[22px] font-bold">{children}</h2>
}

export function StatusPill({ status, progress }: { status: Status; progress?: string }) {
  if (status === 'submitted') return <span className="text-[12px] font-bold text-sage-dark bg-sage-soft rounded-full px-2.5 py-[3px] whitespace-nowrap">הוגש</span>
  if (status === 'in_progress') return <span className="text-[12px] font-bold text-rose-dark bg-rose-soft rounded-full px-2.5 py-[3px] whitespace-nowrap">בעבודה{progress ? ` ${progress}` : ''}</span>
  return <span className="text-[12px] font-semibold text-muted border border-line rounded-full px-2.5 py-[2px] whitespace-nowrap">ממתין</span>
}

export function Spinner({ label = 'טוען…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <span className="w-5 h-5 rounded-full border-2 border-line border-t-rose animate-spin" />
      {label}
    </div>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div role="alert" className="rounded-2xl bg-rose-soft text-rose-dark px-4 py-3 text-[15px]">
      {children}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-center gap-3 min-h-14 cursor-pointer">
      <span className="flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        {hint && <span className="block text-[13px] text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`w-[50px] h-[30px] rounded-full relative transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-rose ${checked ? 'bg-sage' : 'bg-stone'}`}>
        <span className={`absolute top-[3px] w-6 h-6 rounded-full bg-white transition-all ${checked ? 'left-[3px]' : 'left-[23px]'}`} />
      </span>
    </label>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[14px] font-semibold">{label}</span>
      {children}
    </label>
  )
}

export const inputCls = 'h-[52px] w-full rounded-[14px] border border-line bg-white px-4 text-[16px] text-ink box-border placeholder:text-stone'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    const o = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', h)
      document.body.style.overflow = o
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[560px] max-h-[92dvh] overflow-y-auto bg-paper rounded-t-[28px] sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-paper z-10 px-[22px] pt-4 pb-3 flex items-center justify-between border-b border-line">
          <h2 className="m-0 font-serif text-[26px] font-black">{title}</h2>
          <button aria-label="סגירה" onClick={onClose} className="w-11 h-11 rounded-full border border-line bg-white flex items-center justify-center">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="px-[22px] py-5 pb-safe">{children}</div>
      </div>
    </div>
  )
}

export function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length > 1 ? p[0][0] + p[1][0] : p[0]?.[0] ?? '?'
}

export function telHref(p: string) {
  return 'tel:' + p.replace(/[^\d+]/g, '')
}
export function mapsHref(a: string) {
  return 'https://waze.com/ul?q=' + encodeURIComponent(a) + '&navigate=yes'
}
