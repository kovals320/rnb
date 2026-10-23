import { useEffect, useState } from 'react'
import { Icon } from './ui'

// Suggests installing the site as an app on phones.
// Android/Chrome: uses the native install prompt. iPhone/iPad: shows the "Share → Add to Home Screen" steps.
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const KEY = 'rnb-install-dismissed'
const SNOOZE_DAYS = 14

function snoozed() {
  try {
    const t = Number(localStorage.getItem(KEY) || 0)
    return Date.now() - t < SNOOZE_DAYS * 864e5
  } catch {
    return false
  }
}
function snooze() {
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* storage unavailable */
  }
}

const ua = navigator.userAgent
const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isMobile = isIOS || /Android|Mobile/i.test(ua)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
// In-app browsers (WhatsApp, Instagram, Facebook) can't install; on iOS only Safari can add to home screen.
const isInApp = /FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua)
const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA/.test(ua)

let deferred: BIPEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BIPEvent
})

export default function InstallPrompt() {
  const [mode, setMode] = useState<'none' | 'android' | 'ios' | 'ios-other'>('none')
  const [steps, setSteps] = useState(false)

  useEffect(() => {
    if (!isMobile || isStandalone() || isInApp || snoozed()) return
    if (isIOS) {
      const t = setTimeout(() => setMode(isIOSSafari ? 'ios' : 'ios-other'), 1500)
      return () => clearTimeout(t)
    }
    const show = () => deferred && setMode('android')
    show()
    window.addEventListener('beforeinstallprompt', show)
    const done = () => setMode('none')
    window.addEventListener('appinstalled', done)
    return () => {
      window.removeEventListener('beforeinstallprompt', show)
      window.removeEventListener('appinstalled', done)
    }
  }, [])

  if (mode === 'none') return null

  const close = () => {
    snooze()
    setMode('none')
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    if (outcome === 'dismissed') snooze()
    setMode('none')
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-safe pointer-events-none">
      <div role="dialog" aria-label="התקנת האפליקציה" className="pointer-events-auto max-w-[540px] mx-auto mb-2 rounded-[22px] bg-ink text-paper shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-[12px] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[16px]">התקינו את Rose&amp;Bloom בטלפון</div>
            <div className="text-[14px] text-[#D9D0C7] mt-0.5">פתיחה מהירה ממסך הבית, במסך מלא כמו אפליקציה רגילה.</div>
          </div>
          <button aria-label="סגירה" onClick={close} className="w-10 h-10 -mt-1 -ml-1 rounded-full flex items-center justify-center text-[#D9D0C7] shrink-0">
            <Icon name="x" size={18} />
          </button>
        </div>

        {mode === 'android' && (
          <div className="flex gap-2 mt-3.5">
            <button onClick={install} className="flex-1 h-12 rounded-full bg-rose text-white font-bold">
              התקנה
            </button>
            <button onClick={close} className="h-12 px-4 rounded-full border border-[#5A4F49] font-semibold">
              לא עכשיו
            </button>
          </div>
        )}

        {mode === 'ios' &&
          (steps ? (
            <ol className="mt-3.5 flex flex-col gap-2.5 text-[15px] list-none p-0 m-0">
              <li className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-rose text-white text-[13px] font-bold flex items-center justify-center shrink-0">1</span>
                <span className="flex-1">
                  לחצו על כפתור השיתוף
                  <ShareGlyph />
                  בסרגל של Safari
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-rose text-white text-[13px] font-bold flex items-center justify-center shrink-0">2</span>
                <span className="flex-1">
                  גללו ובחרו <b>״הוספה למסך הבית״</b>
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-rose text-white text-[13px] font-bold flex items-center justify-center shrink-0">3</span>
                <span className="flex-1">
                  לחצו <b>״הוספה״</b> בפינה העליונה
                </span>
              </li>
              <button onClick={close} className="mt-1 h-11 rounded-full border border-[#5A4F49] font-semibold">
                הבנתי
              </button>
            </ol>
          ) : (
            <div className="flex gap-2 mt-3.5">
              <button onClick={() => setSteps(true)} className="flex-1 h-12 rounded-full bg-rose text-white font-bold">
                איך מתקינים?
              </button>
              <button onClick={close} className="h-12 px-4 rounded-full border border-[#5A4F49] font-semibold">
                לא עכשיו
              </button>
            </div>
          ))}

        {mode === 'ios-other' && (
          <div className="mt-3 text-[14px] text-[#D9D0C7]">
            כדי להתקין, פתחו את <b className="text-paper">rnb.dorh.fyi</b> בדפדפן Safari ובחרו שם ״הוספה למסך הבית״.
            <button onClick={close} className="mt-3 w-full h-11 rounded-full border border-[#5A4F49] font-semibold text-paper">
              הבנתי
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ShareGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="שיתוף" className="inline-block mx-1 -mt-1 align-middle">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  )
}
