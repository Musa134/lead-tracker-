import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import emailjs from '@emailjs/browser'
import { supabase } from '../../lib/supabase'
import { REP_COLORS, CRM_REPS } from '../../lib/constants'

const EMAILJS_SERVICE = 'service_0y3zdv8'
const EMAILJS_WEEKLY_TEMPLATE = 'template_8r7xnpb'
const EMAILJS_KEY = 'b7RJCqZ6O0LTsIFvb'
const FRANK_EMAIL = 'frank@colourx.ca'

function getWeekDays(offset) {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatWeekLabel(days) {
  return `Week of ${days[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
}

export default function CRMFeed() {
  const navigate = useNavigate()
  const [weekOffset, setWeekOffset] = useState(0)
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCall, setSelectedCall] = useState(null)
  const [callsWithAttachments, setCallsWithAttachments] = useState(new Set())
  const [attachments, setAttachments] = useState({})
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [followUps, setFollowUps] = useState([])
  const [showFollowUps, setShowFollowUps] = useState(false)
  const [filterRep, setFilterRep] = useState(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [collapsedDays, setCollapsedDays] = useState(new Set())
  const photoInputRef = useRef(null)

  const weekDays = getWeekDays(weekOffset)

  useEffect(() => {
    const t = new Date()
    const collapsed = new Set()
    weekDays.forEach((day, i) => {
      if (!isSameDay(day, t)) collapsed.add(i)
    })
    setCollapsedDays(collapsed)
  }, [weekOffset])

  useEffect(() => {
    fetchCalls()
  }, [weekOffset])

  useEffect(() => {
    fetchFollowUps()
  }, [])

  useEffect(() => {
    if (!selectedCall) return
    if (attachments[selectedCall.id] !== undefined) return
    fetchAttachments(selectedCall.id)
  }, [selectedCall])

  async function fetchFollowUps() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('crm_calls')
      .select('*')
      .not('follow_up_date', 'is', null)
      .lte('follow_up_date', today)
      .order('follow_up_date', { ascending: true })
    setFollowUps(data || [])
  }

  async function markFollowUpDone(callId) {
    await supabase
      .from('crm_calls')
      .update({ follow_up_date: null })
      .eq('id', callId)
    setFollowUps(prev => prev.filter(f => f.id !== callId))
  }

  async function fetchAttachments(callId) {
    const { data } = await supabase
      .from('call_attachments')
      .select('*')
      .eq('call_id', callId)
      .order('created_at')
    setAttachments(a => ({ ...a, [callId]: data || [] }))
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file || !selectedCall) return
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `${selectedCall.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('call-attachments')
      .upload(path, file)
    if (uploadError) { console.error(uploadError); setUploadingPhoto(false); return }
    const { data: { publicUrl } } = supabase.storage.from('call-attachments').getPublicUrl(path)
    await supabase.from('call_attachments').insert({
      call_id: selectedCall.id,
      url: publicUrl,
      file_name: file.name,
    })
    e.target.value = ''
    setUploadingPhoto(false)
    setCallsWithAttachments(prev => new Set([...prev, selectedCall.id]))
    fetchAttachments(selectedCall.id)
  }

  async function fetchCalls() {
    setLoading(true)
    const start = new Date(weekDays[0])
    start.setHours(0, 0, 0, 0)
    const end = new Date(weekDays[6])
    end.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('crm_calls')
      .select('*')
      .gte('logged_at', start.toISOString())
      .lte('logged_at', end.toISOString())
      .order('logged_at', { ascending: true })

    if (error) { console.error(error) }
    const callData = data || []
    setCalls(callData)

    if (callData.length > 0) {
      const { data: attData } = await supabase
        .from('call_attachments')
        .select('call_id')
        .in('call_id', callData.map(c => c.id))
      setCallsWithAttachments(new Set((attData || []).map(a => a.call_id)))
    } else {
      setCallsWithAttachments(new Set())
    }

    setLoading(false)
  }

  async function sendWeeklySummary() {
    setSendingEmail(true)
    const start = weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const end = weekDays[4].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    const templateParams = {
      to_email: FRANK_EMAIL,
      subject: `CX Weekly Summary — ${start}–${end}`,
      week_label: `${start}–${end}`,
      total: calls.length,
    }

    CRM_REPS.forEach(rep => {
      const repCalls = [...calls]
        .filter(c => c.rep_name === rep)
        .sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at))

      let section = `<em style="color:#64748b;">${repCalls.length} ${repCalls.length === 1 ? 'call' : 'calls'}</em><br><br>`
      if (repCalls.length === 0) {
        section += 'No calls logged'
      } else {
        section += repCalls.map(call => {
          const date = new Date(call.logged_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          const time = formatTime(call.logged_at)
          let html = `<b>${date} ${time} — ${call.company_name}</b>`
          if (call.contact_name) html += `<br>&nbsp;&nbsp;Contact: ${call.contact_name}`
          if (call.call_type) html += `<br>&nbsp;&nbsp;Type: ${call.call_type}`
          if (call.whats_next) html += `<br>&nbsp;&nbsp;Next: ${call.whats_next}`
          return html
        }).join('<br><br>')
      }
      templateParams[`${rep.toLowerCase()}_section`] = section
    })

    try {
      await emailjs.send(
        EMAILJS_SERVICE,
        EMAILJS_WEEKLY_TEMPLATE,
        templateParams,
        EMAILJS_KEY
      )
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch (err) {
      console.error('Weekly summary email failed:', err)
      alert('Failed to send. Please try again.')
    }
    setSendingEmail(false)
  }

  const today = new Date()

  function toggleDay(i) {
    setCollapsedDays(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28 font-sans text-slate-900">
      <header className="bg-white px-4 py-6 border-b-2 border-slate-300 sticky top-0 z-30 shadow-md">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate('/')} className="text-xs font-black text-slate-700 uppercase tracking-widest hover:text-red-600 transition-colors">
              ← Hub
            </button>
            <h1 className="text-xl font-black text-red-600 tracking-tighter uppercase italic">CX-Call CRM</h1>
            <button onClick={() => navigate('/crm/accounts')} className="text-xs font-black text-slate-700 uppercase tracking-widest hover:text-red-600 transition-colors">
              Accounts →
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="text-xs font-black text-slate-400 hover:text-slate-700 transition-colors px-3 py-2"
            >
              ← Prev
            </button>
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest">{formatWeekLabel(weekDays)}</p>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset === 0}
              className="text-xs font-black text-slate-400 hover:text-slate-700 disabled:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-3 py-2"
            >
              Next →
            </button>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={sendWeeklySummary}
              disabled={sendingEmail || loading}
              className="text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600"
            >
              {emailSent ? '✓ Sent to Frank' : sendingEmail ? 'Sending...' : '✉ Send to Frank'}
            </button>
          </div>
        </div>
      </header>

      <button
        onClick={() => navigate('/crm/log')}
        className="fixed bottom-6 right-6 z-40 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl shadow-xl transition-all active:scale-95"
      >
        + Log a Call
      </button>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {followUps.length > 0 && (
          <div className="rounded-2xl border-2 border-red-200 overflow-hidden shadow-sm">
            <button
              onClick={() => setShowFollowUps(s => !s)}
              className="w-full bg-red-50 px-5 py-3 flex items-center justify-between hover:bg-red-100 transition-colors"
            >
              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                Follow-Ups Due — {followUps.length}
              </p>
              <span className={`text-red-400 text-sm transition-transform ${showFollowUps ? 'rotate-90' : ''}`}>›</span>
            </button>

            {showFollowUps && (
              <div className="bg-white divide-y-2 divide-slate-100">
                {followUps.map(call => {
                  const colors = REP_COLORS[call.rep_name] || { badge: 'bg-slate-100 text-slate-400 border-slate-200' }
                  const due = new Date(call.follow_up_date + 'T00:00:00')
                  const isToday = due.toDateString() === new Date().toDateString()
                  return (
                    <div key={call.id} className="px-5 py-3 flex items-center gap-3">
                      <button
                        onClick={() => setSelectedCall(call)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 flex-shrink-0 ${colors.badge}`}>
                          {call.rep_name}
                        </span>
                        <span className="font-black text-slate-900 text-sm uppercase tracking-tight truncate flex-1">
                          {call.company_name}
                        </span>
                        {call.whats_next && (
                          <span className="text-xs text-slate-400 font-bold truncate hidden sm:block max-w-[140px]">
                            {call.whats_next}
                          </span>
                        )}
                        <span className={`text-[10px] font-black uppercase whitespace-nowrap flex-shrink-0 ${isToday ? 'text-red-500' : 'text-slate-400'}`}>
                          {isToday ? 'Today' : due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </button>
                      <button
                        onClick={() => markFollowUpDone(call.id)}
                        className="w-7 h-7 rounded-full border-2 border-slate-200 hover:border-green-400 hover:bg-green-50 flex items-center justify-center flex-shrink-0 transition-colors"
                        title="Mark done"
                      >
                        <span className="text-slate-300 hover:text-green-500 text-xs font-black">✓</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!loading && calls.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 px-5 py-4 shadow-sm flex flex-wrap gap-4">
            {CRM_REPS.map(rep => {
              const count = calls.filter(c => c.rep_name === rep).length
              const colors = REP_COLORS[rep]
              const active = filterRep === rep
              return (
                <button
                  key={rep}
                  onClick={() => setFilterRep(active ? null : rep)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border-2 transition-all active:scale-95 ${active ? 'border-slate-900 bg-slate-900' : 'border-transparent hover:border-slate-200'}`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border-2 ${colors.badge}`}>{rep}</span>
                  <span className={`text-sm font-black ${active ? 'text-white' : 'text-slate-900'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-400 font-black uppercase tracking-widest text-sm py-10">Loading...</p>
        ) : (
          weekDays.map((day, i) => {
            const dayCalls = calls.filter(c => isSameDay(new Date(c.logged_at), day) && (!filterRep || c.rep_name === filterRep))
            const isToday = isSameDay(day, today)
            const isWeekend = i >= 5
            if (isWeekend && dayCalls.length === 0) return null

            const isCollapsed = collapsedDays.has(i)
            return (
              <div key={i}>
                <button
                  onClick={() => toggleDay(i)}
                  className="w-full flex items-center gap-3 mb-3 text-left"
                >
                  <p className={`text-xs font-black uppercase tracking-widest whitespace-nowrap ${isToday ? 'text-red-600' : 'text-slate-700'}`}>
                    {formatDayLabel(day)}
                    {isToday && (
                      <span className="ml-2 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Today</span>
                    )}
                  </p>
                  <div className="flex-1 h-px bg-slate-200" />
                  <p className="text-[10px] font-black text-slate-300 uppercase whitespace-nowrap">
                    {dayCalls.length} {dayCalls.length === 1 ? 'call' : 'calls'}
                  </p>
                  <span className={`text-slate-400 text-base transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>›</span>
                </button>

                {!isCollapsed && dayCalls.length === 0 ? (
                  <p className="text-xs text-slate-300 font-black uppercase tracking-widest px-1">No calls logged</p>
                ) : !isCollapsed ? (
                  <div className="space-y-2">
                    {dayCalls.map(call => {
                      const colors = REP_COLORS[call.rep_name] || { badge: 'bg-slate-100 text-slate-400 border-slate-200' }
                      return (
                        <button
                          key={call.id}
                          onClick={() => setSelectedCall(call)}
                          className="w-full bg-white rounded-2xl border-2 border-slate-200 px-5 py-4 flex items-center gap-3 hover:border-slate-300 hover:shadow-md transition-all text-left active:scale-[0.99]"
                        >
                          <span className="text-xs font-black text-slate-400 uppercase whitespace-nowrap w-20 flex-shrink-0">
                            {formatTime(call.logged_at)}
                          </span>
                          <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 flex-shrink-0 ${colors.badge}`}>
                            {call.rep_name}
                          </span>
                          <span className="font-black text-slate-900 text-sm uppercase tracking-tight truncate flex-1">
                            {call.company_name}
                          </span>
                          {callsWithAttachments.has(call.id) && (
                            <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          )}
                          <span className="text-slate-300 flex-shrink-0">›</span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </main>

      {selectedCall && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          onClick={() => setSelectedCall(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border-2 inline-block mb-3 ${(REP_COLORS[selectedCall.rep_name] || { badge: 'bg-slate-100 text-slate-400 border-slate-200' }).badge}`}>
                  {selectedCall.rep_name}
                </span>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight">
                  {selectedCall.company_name}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {formatDayLabel(new Date(selectedCall.logged_at))} · {formatTime(selectedCall.logged_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="text-slate-400 hover:text-slate-700 font-black text-xl flex-shrink-0 mt-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {selectedCall.contact_name && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact</p>
                  <p className="font-black text-slate-900 text-sm">{selectedCall.contact_name}</p>
                </div>
              )}
              {selectedCall.phone_number && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                  <a href={`tel:${selectedCall.phone_number}`} className="font-black text-red-600 text-sm hover:underline">
                    {selectedCall.phone_number}
                  </a>
                </div>
              )}
              {selectedCall.call_type && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Call Type</p>
                  <p className="font-black text-slate-900 text-sm">{selectedCall.call_type}</p>
                </div>
              )}
            </div>

            {selectedCall.objectives && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Objectives</p>
                <p className="text-sm font-bold text-slate-700 bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 leading-relaxed">
                  {selectedCall.objectives}
                </p>
              </div>
            )}

            {selectedCall.call_notes && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Call Notes</p>
                <p className="text-sm font-bold text-slate-700 bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 leading-relaxed">
                  {selectedCall.call_notes}
                </p>
              </div>
            )}

            {selectedCall.whats_next && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">What's Next & When</p>
                <p className="text-sm font-bold text-slate-700 bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 leading-relaxed">
                  {selectedCall.whats_next}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Photos</p>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:text-red-800 disabled:opacity-50 transition-colors"
                >
                  {uploadingPhoto ? 'Uploading...' : '+ Add Photo'}
                </button>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              {attachments[selectedCall.id]?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {attachments[selectedCall.id].map(att => {
                    const isImage = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(att.file_name)
                    return (
                    <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer">
                      {isImage ? (
                        <img
                          src={att.url}
                          alt={att.file_name}
                          className="w-20 h-20 object-cover rounded-xl border-2 border-slate-200 hover:border-red-400 transition-colors"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-slate-50 border-2 border-slate-200 rounded-xl hover:border-red-400 transition-colors flex flex-col items-center justify-center gap-1 p-2">
                          <span className="text-xs font-black text-red-500 uppercase">.{att.file_name.split('.').pop()}</span>
                          <span className="text-[8px] font-black text-slate-400 text-center break-all leading-tight line-clamp-2">{att.file_name.replace(/\.[^/.]+$/, '')}</span>
                        </div>
                      )}
                    </a>
                    )
                  })}
                </div>
              ) : (
                !uploadingPhoto && (
                  <p className="text-xs font-bold text-slate-300 italic">No photos yet.</p>
                )
              )}
            </div>

            <div className="pt-2 pb-2" />
          </div>
        </div>
      )}
    </div>
  )
}
