import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, errText, type Client } from '../lib/supabase'
import { ActionButton, BottomBar, ErrorBox, Eyebrow, Icon, Page, Spinner, Title, TopBar } from '../components/ui'

type Tab = 'active' | 'inactive' | 'all'

export default function Clients() {
  const [clients, setClients] = useState<(Client & { n: number })[] | null>(null)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const tab = (params.get('t') as Tab) || 'active'
  const [q, setQ] = useState('')

  useEffect(() => {
    ;(async () => {
      const [{ data, error }, { data: t }] = await Promise.all([supabase.from('rnb_clients').select('*').order('name'), supabase.from('rnb_client_tasks').select('client_id')])
      if (error) setError(errText(error))
      const n: Record<string, number> = {}
      t?.forEach((x) => (n[x.client_id] = (n[x.client_id] || 0) + 1))
      setClients(((data as Client[]) ?? []).map((c) => ({ ...c, n: n[c.id] || 0 })))
    })()
  }, [])

  const list = useMemo(() => {
    const s = q.trim()
    return (clients ?? []).filter((c) => (tab === 'all' || (tab === 'active') === c.active) && (!s || c.name.includes(s) || (c.address ?? '').includes(s) || (c.phone ?? '').includes(s)))
  }, [clients, tab, q])
  const activeCount = clients?.filter((c) => c.active).length ?? 0

  const tabCls = (t: Tab) => `h-11 px-0.5 text-[15px] ${tab === t ? 'font-bold text-ink border-b-2 border-rose' : 'font-medium text-muted'}`

  return (
    <Page>
      <TopBar />
      <div className="px-[22px] pt-6">
        <Eyebrow>{clients ? `${activeCount} גינות פעילות` : '…'}</Eyebrow>
        <Title>תיקי לקוח</Title>
        <label className="mt-4 flex items-center gap-2.5 h-[50px] rounded-[14px] border border-line bg-white px-3.5">
          <Icon name="search" size={18} className="text-muted" />
          <span className="sr-only">חיפוש לקוח</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם, כתובת או טלפון" className="flex-1 bg-transparent outline-none min-w-0" />
        </label>
        <div role="tablist" className="mt-3 flex gap-5 border-b border-line">
          <button role="tab" aria-selected={tab === 'active'} className={tabCls('active')} onClick={() => setParams({}, { replace: true })}>
            פעילים
          </button>
          <button role="tab" aria-selected={tab === 'inactive'} className={tabCls('inactive')} onClick={() => setParams({ t: 'inactive' }, { replace: true })}>
            לא פעילים
          </button>
          <button role="tab" aria-selected={tab === 'all'} className={tabCls('all')} onClick={() => setParams({ t: 'all' }, { replace: true })}>
            הכל
          </button>
        </div>
      </div>
      <div className="px-[22px]">
        <ErrorBox>{error}</ErrorBox>
        {!clients ? (
          <Spinner />
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-muted">לא נמצאו לקוחות</p>
        ) : (
          list.map((c) => (
            <Link key={c.id} to={`/clients/${c.id}`} className="flex items-center gap-3 py-3.5 border-b border-line-soft last:border-b-0 no-underline text-ink">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-[20px] font-bold truncate">{c.name}</span>
                  {!c.active && <span className="text-[12px] text-muted border border-line rounded-full px-2">לא פעיל</span>}
                </div>
                <div className="text-[14px] text-muted">{[c.address, `${c.n} משימות`].filter(Boolean).join(' · ')}</div>
              </div>
              <Icon name="next" size={18} className="text-stone" />
            </Link>
          ))
        )}
      </div>
      <BottomBar action={<ActionButton to="/clients/new" label="לקוח" />} />
    </Page>
  )
}
