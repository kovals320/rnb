const pad = (n: number) => String(n).padStart(2, '0')

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function today(): string {
  return isoDate(new Date())
}
export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(s: string, n: number): string {
  const d = parseIso(s)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
export function dayName(s: string): string {
  return DAYS[parseIso(s).getDay()]
}
export function longDate(s: string): string {
  const d = parseIso(s)
  return `${d.getDate()} ב${MONTHS[d.getMonth()]}`
}
export function fullDate(s: string): string {
  const d = parseIso(s)
  return `${DAYS[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
export function shortDate(s: string): string {
  const d = parseIso(s)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}
export function dayLabel(s: string): string {
  const t = today()
  if (s === t) return 'היום'
  if (s === addDays(t, 1)) return 'מחר'
  if (s === addDays(t, -1)) return 'אתמול'
  return dayName(s)
}
