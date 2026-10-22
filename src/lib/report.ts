import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { fullDate } from './dates'

export type ReportData = {
  client: string
  address: string | null
  date: string
  workers: string[]
  fixed: { title: string; done: boolean }[]
  extra: { title: string; done: boolean }[]
  notes: string | null
  photoUrls: string[]
  submittedBy: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function taskRows(list: { title: string; done: boolean }[]) {
  return list
    .map(
      (t) => `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #EFE8DF">
  <span style="width:22px;height:22px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;${t.done ? 'background:#4E6B4F;color:#fff' : 'border:2px solid #B8ACA2;box-sizing:border-box'}">${t.done ? '✓' : ''}</span>
  <span style="font-size:17px;${t.done ? '' : 'color:#6B5F57'}">${esc(t.title)}</span>
  <span style="margin-right:auto;font-size:13px;color:${t.done ? '#3E5A40' : '#9E2F4E'};font-weight:700">${t.done ? 'בוצע' : 'לא בוצע'}</span>
</div>`,
    )
    .join('')
}

function buildHtml(d: ReportData) {
  const done = [...d.fixed, ...d.extra].filter((t) => t.done).length
  const total = d.fixed.length + d.extra.length
  const now = new Date()
  const stamp = `${now.toLocaleDateString('he-IL')} ${now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
  return `
<div dir="rtl" style="width:794px;box-sizing:border-box;padding:56px 60px;background:#FBF8F4;color:#2A2320;font-family:Assistant,Arial,sans-serif">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #2A2320;padding-bottom:14px">
    <div dir="ltr" style="font-family:'Frank Ruhl Libre',Georgia,serif;font-style:italic;font-weight:700;font-size:28px">Rose <span style="color:#9E2F4E">&amp;</span> Bloom</div>
    <div style="font-size:15px;color:#6B5F57">דו״ח עבודה</div>
  </div>
  <div style="margin-top:26px;font-size:14px;font-weight:600;letter-spacing:1.5px;color:#9E2F4E">${esc(fullDate(d.date))}</div>
  <div style="font-family:'Frank Ruhl Libre',Georgia,serif;font-weight:900;font-size:44px;line-height:1.1">${esc(d.client)}</div>
  ${d.address ? `<div style="font-size:17px;color:#6B5F57;margin-top:4px">${esc(d.address)}</div>` : ''}
  <div style="display:flex;gap:28px;margin-top:18px;font-size:15px">
    <div><span style="color:#6B5F57">צוות: </span><b>${esc(d.workers.join(', ') || '—')}</b></div>
    <div><span style="color:#6B5F57">בוצעו: </span><b>${done} מתוך ${total}</b></div>
  </div>
  ${d.fixed.length ? `<div style="margin-top:28px;font-family:'Frank Ruhl Libre',Georgia,serif;font-weight:700;font-size:23px">משימות קבועות</div>${taskRows(d.fixed)}` : ''}
  ${d.extra.length ? `<div style="margin-top:28px;font-family:'Frank Ruhl Libre',Georgia,serif;font-weight:700;font-size:23px;color:#7A2039">משימות נוספות לביקור</div>${taskRows(d.extra)}` : ''}
  ${d.notes ? `<div style="margin-top:28px;font-family:'Frank Ruhl Libre',Georgia,serif;font-weight:700;font-size:23px">הערות</div><div style="margin-top:8px;font-size:17px;line-height:1.55;white-space:pre-wrap;background:#fff;border:1px solid #E5DDD3;border-radius:14px;padding:14px 16px">${esc(d.notes)}</div>` : ''}
  ${d.photoUrls.length ? `<div style="margin-top:28px;font-family:'Frank Ruhl Libre',Georgia,serif;font-weight:700;font-size:23px">תמונות</div><div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">${d.photoUrls.map((u) => `<img src="${esc(u)}" crossorigin="anonymous" style="width:100%;height:250px;object-fit:cover;border-radius:12px;display:block" />`).join('')}</div>` : ''}
  <div style="margin-top:36px;padding-top:12px;border-top:1px solid #E5DDD3;font-size:13px;color:#6B5F57">הופק על ידי ${esc(d.submittedBy)} · ${esc(stamp)}</div>
</div>`
}

export async function buildReportPdf(d: ReportData): Promise<File> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1'
  host.innerHTML = buildHtml(d)
  document.body.appendChild(host)
  try {
    await document.fonts.ready
    await Promise.all(
      Array.from(host.querySelectorAll('img')).map(
        (img) => new Promise<void>((res) => (img.complete ? res() : ((img.onload = () => res()), (img.onerror = () => res())))),
      ),
    )
    const el = host.firstElementChild as HTMLElement
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#FBF8F4', logging: false })
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const pw = pdf.internal.pageSize.getWidth()
    const ph = pdf.internal.pageSize.getHeight()
    const pxPerPage = Math.floor((canvas.width * ph) / pw)
    for (let y = 0, page = 0; y < canvas.height; y += pxPerPage, page++) {
      const h = Math.min(pxPerPage, canvas.height - y)
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = h
      const ctx = slice.getContext('2d')!
      ctx.fillStyle = '#FBF8F4'
      ctx.fillRect(0, 0, slice.width, h)
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
      if (page > 0) pdf.addPage()
      pdf.addImage(slice.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, pw, (h * pw) / canvas.width)
    }
    const blob = pdf.output('blob')
    const safe = d.client.replace(/[\\/:*?"<>|]/g, '').trim() || 'report'
    return new File([blob], `דוח ${safe} ${d.date}.pdf`, { type: 'application/pdf' })
  } finally {
    host.remove()
  }
}

