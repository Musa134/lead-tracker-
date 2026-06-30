import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function getWeekStart() {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

export default function Hub() {
  const navigate = useNavigate()
  const { repName, signOut } = useAuth()
  const [stats, setStats] = useState({ activeLeads: 0, callsThisWeek: 0 })

  useEffect(() => {
    async function fetchStats() {
      const [leadsRes, callsRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).neq('status', 'Archived'),
        supabase.from('crm_calls').select('id', { count: 'exact', head: true }).gte('logged_at', getWeekStart()),
      ])
      setStats({
        activeLeads: leadsRes.count ?? 0,
        callsThisWeek: callsRes.count ?? 0,
      })
    }
    fetchStats()
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <header className="bg-white px-4 py-12 border-b-2 border-slate-300 text-center shadow-md relative">
        <h1 className="text-4xl font-black text-red-600 tracking-tighter uppercase italic">Colour X</h1>
        <p className="text-slate-900 text-2xl font-black uppercase tracking-widest mt-3">Sales Hub</p>
        <div className="absolute bottom-3 right-4 flex items-center gap-3">
          {repName && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{repName}</p>}
          <button
            onClick={() => navigate('/change-password')}
            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors"
          >
            Change Password
          </button>
          <button
            onClick={signOut}
            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/leads')}
            className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-md text-left hover:border-red-200 hover:shadow-xl transition-all active:scale-[0.97]"
          >
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic leading-tight mb-1">Leads Tracker</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-6">Manage & assign leads</p>
            <p className="text-3xl font-black text-red-600 leading-none">{stats.activeLeads}</p>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Active Leads</p>
          </button>

          <button
            onClick={() => navigate('/crm')}
            className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-md text-left hover:border-red-200 hover:shadow-xl transition-all active:scale-[0.97]"
          >
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic leading-tight mb-1">CX-Call CRM</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-6">Daily call log & feed</p>
            <p className="text-3xl font-black text-red-600 leading-none">{stats.callsThisWeek}</p>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Calls This Week</p>
          </button>
        </div>
      </main>
    </div>
  )
}
