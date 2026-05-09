import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

const REPS = ['Unassigned', 'Ralph', 'Shane', 'Rob', 'Frank', 'Musa']
const STATUSES = ['New', 'First Call', 'In System', 'Archived']

const EMPTY_FORM = {
  company: '',
  name: '',
  phone: '',
  notes: '',
  assignedTo: 'Unassigned',
  status: 'New',
  opportunity: '',
  reportingGroup: ''
}

function toAppLead(row) {
  return {
    id: row.id,
    company: row.company,
    name: row.name || '',
    phone: row.phone || '',
    assignedTo: row.assigned_to,
    status: row.status,
    opportunity: row.opportunity || '',
    reportingGroup: row.reporting_group || '',
    comments: (row.lead_comments || [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(c => ({
        id: c.id,
        text: c.text,
        author: c.author,
        date: new Date(c.created_at).toLocaleString()
      }))
  }
}

function ArchivePage({ leads, onBack, updateLeadStatus, deleteLead }) {
  const [expandedId, setExpandedId] = useState(null)

  function toggleLead(id) {
    setExpandedId(curr => (curr === id ? null : id))
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans text-slate-900">
      <header className="bg-white px-4 py-8 border-b-2 border-slate-300 sticky top-0 z-30 text-center shadow-md relative">
        <button onClick={onBack} className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors">
          ← Back
        </button>
        <h1 className="text-2xl font-black text-red-600 tracking-tighter uppercase italic">Archived Accounts</h1>
        <p className="text-slate-700 text-sm font-black uppercase tracking-widest mt-2">{leads.length} Archived</p>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {leads.length === 0 ? (
          <p className="text-center text-slate-400 font-black uppercase tracking-widest text-sm py-10">No archived accounts.</p>
        ) : (
          <div className="space-y-4">
            {leads.map(lead => (
              <div key={lead.id} className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-md">

                <div onClick={() => toggleLead(lead.id)} className="w-full cursor-pointer px-6 py-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 text-lg uppercase tracking-tighter mb-1 leading-tight">{lead.company}</p>
                    <p className="text-sm text-slate-600 font-black uppercase tracking-tight">
                      {lead.assignedTo} <span className="mx-2 text-slate-300">|</span> {lead.name || 'No Contact'}
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 border-2 bg-slate-50 text-slate-400 border-slate-200">
                    Archived
                  </div>
                </div>

                {expandedId === lead.id && (
                  <div className="border-t-2 border-slate-100 bg-slate-50 p-6 space-y-8">

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2">Phone</p>
                        {lead.phone
                          ? <a href={`tel:${lead.phone}`} className="text-red-600 font-black text-lg hover:underline">{lead.phone}</a>
                          : <p className="text-slate-400 font-bold">N/A</p>}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2">Assigned To</p>
                        <p className="font-black text-slate-900">{lead.assignedTo}</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Activity History</p>
                      <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                        {lead.comments && lead.comments.length > 0 ? (
                          lead.comments.map(c => (
                            <div key={c.id} className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-black text-red-600 uppercase tracking-tight">{c.author}</span>
                                <span className="text-[10px] text-slate-500 font-black uppercase">{c.date}</span>
                              </div>
                              <p className="text-base font-bold text-slate-700 leading-snug">{c.text}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 font-bold italic text-center py-4">No activity captured yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 flex flex-col gap-4">
                      <button onClick={() => updateLeadStatus(lead.id, 'In System')} className="w-full py-4 bg-white text-slate-600 text-xs font-black uppercase tracking-widest rounded-2xl border-2 border-slate-200 hover:text-red-600 hover:border-red-600 transition-all">
                        Restore Account
                      </button>
                      <button onClick={() => deleteLead(lead.id)} className="text-[10px] text-slate-400 hover:text-red-600 font-black uppercase tracking-widest self-center py-2 transition-colors">
                        Permanently Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [leads, setLeads] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('All')
  const [newComment, setNewComment] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('Unassigned')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('main')

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*, lead_comments(*)')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setLeads(data.map(toAppLead))
    setLoading(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.company.trim()) return

    const { data: newLead, error } = await supabase
      .from('leads')
      .insert({
        company: form.company,
        name: form.name,
        phone: form.phone,
        assigned_to: form.assignedTo,
        status: form.status,
        opportunity: form.opportunity,
        reporting_group: form.reportingGroup
      })
      .select()
      .single()

    if (error) { console.error(error); return }

    if (form.notes.trim()) {
      await supabase.from('lead_comments').insert({
        lead_id: newLead.id,
        text: form.notes,
        author: form.assignedTo
      })
    }

    setForm(EMPTY_FORM)
    setExpandedId(null)
    fetchLeads()
  }

  function toggleLead(id) {
    setExpandedId(currentId => (currentId === id ? null : id))
  }

  async function addComment(e, leadId) {
    e.preventDefault()
    if (!newComment.trim()) return

    const { error } = await supabase.from('lead_comments').insert({
      lead_id: leadId,
      text: newComment,
      author: commentAuthor
    })

    if (error) { console.error(error); return }
    setNewComment('')
    fetchLeads()
  }

  async function updateLeadStatus(id, newStatus) {
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', id)
    if (error) { console.error(error); return }
    fetchLeads()
  }

  async function deleteLead(id) {
    if (!window.confirm('Permanently delete this account?')) return
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) { console.error(error); return }
    fetchLeads()
  }

  const activeLeads = leads.filter(l => l.status !== 'Archived')
  const archivedLeads = leads.filter(l => l.status === 'Archived')
  const filteredLeads = activeLeads.filter(l => {
    if (filter === 'All') return true
    return l.assignedTo === filter
  })

  if (page === 'archive') {
    return (
      <ArchivePage
        leads={archivedLeads}
        onBack={() => setPage('main')}
        updateLeadStatus={updateLeadStatus}
        deleteLead={deleteLead}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans text-slate-900">

      <header className="bg-white px-4 py-8 border-b-2 border-slate-300 sticky top-0 z-30 text-center shadow-md">
        <h1 className="text-2xl font-black text-red-600 tracking-tighter uppercase italic">Colour X Lead Tracker</h1>
        <p className="text-slate-700 text-sm font-black uppercase tracking-widest mt-2">{activeLeads.length} Total Leads Active</p>
        <button onClick={() => setPage('archive')} className="text-xs text-slate-400 font-black uppercase tracking-widest mt-1 hover:text-red-600 transition-colors">
          View Archive ({archivedLeads.length}) →
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-10">

        <section className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-xl relative z-10">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b-2 border-red-100 pb-2">New Lead Intake</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Company Name *</label>
              <input name="company" value={form.company} onChange={handleChange} placeholder="Required" required className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Contact Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Point of Contact" className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase ml-1">Phone</label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="Number" type="tel" className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase ml-1">Assign To</label>
                <select name="assignedTo" value={form.assignedTo} onChange={handleChange} className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none">
                  {REPS.map(rep => <option key={rep} value={rep}>{rep}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Initial Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Brief background..." rows={3} className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none resize-none" />
            </div>
            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-sm tracking-widest transition-transform active:scale-95">
              Create Lead
            </button>
          </form>
        </section>

        <div className="sticky top-[105px] bg-slate-100/95 backdrop-blur-md py-4 z-20">
          <div className="flex flex-wrap gap-3">
            {['All', ...REPS].map(name => (
              <button key={name} onClick={() => setFilter(name)} className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${filter === name ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'}`}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-slate-400 font-black uppercase tracking-widest text-sm py-10">Loading...</p>
        ) : (
          <div className="space-y-4 relative z-0">
            {filteredLeads.length === 0 && (
              <p className="text-center text-slate-400 font-black uppercase tracking-widest text-sm py-10">No leads yet.</p>
            )}
            {filteredLeads.map(lead => (
              <div key={lead.id} className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-md">

                <div onClick={() => toggleLead(lead.id)} className="w-full cursor-pointer px-6 py-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 text-lg uppercase tracking-tighter mb-1 leading-tight">{lead.company}</p>
                    <p className="text-sm text-slate-600 font-black uppercase tracking-tight">
                      {lead.assignedTo} <span className="mx-2 text-slate-300">|</span> {lead.name || 'No Contact'}
                    </p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 border-2 ${lead.status === 'New' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                    {lead.status}
                  </div>
                </div>

                {expandedId === lead.id && (
                  <div className="border-t-2 border-slate-100 bg-slate-50 p-6 space-y-8">

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2">Phone</p>
                        {lead.phone ? <a href={`tel:${lead.phone}`} className="text-red-600 font-black text-lg hover:underline">{lead.phone}</a> : <p className="text-slate-400 font-bold">N/A</p>}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2">Update Status</p>
                        <select value={lead.status} onChange={(e) => updateLeadStatus(lead.id, e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-xl px-3 py-3 text-sm font-bold text-slate-900">
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Activity History</p>
                      <div className="space-y-3 bg-white p-4 rounded-2xl border-2 border-slate-200">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-slate-500 uppercase">Author:</span>
                          <select value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} className="bg-slate-100 border-2 border-slate-200 rounded-lg px-3 py-2 text-xs font-black text-slate-800 outline-none">
                            {REPS.map(rep => <option key={rep} value={rep}>{rep}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Type update here..." className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-red-600" rows={2} />
                          <button onClick={(e) => addComment(e, lead.id)} className="bg-slate-900 hover:bg-black py-4 rounded-xl text-xs font-black uppercase text-white shadow-lg">
                            Add Note to Log
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                        {lead.comments && lead.comments.length > 0 ? (
                          lead.comments.map(c => (
                            <div key={c.id} className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-black text-red-600 uppercase tracking-tight">{c.author}</span>
                                <span className="text-[10px] text-slate-500 font-black uppercase">{c.date}</span>
                              </div>
                              <p className="text-base font-bold text-slate-700 leading-snug">{c.text}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 font-bold italic text-center py-4">No activity captured yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 flex flex-col gap-4">
                      <button onClick={() => updateLeadStatus(lead.id, 'Archived')} className="w-full py-4 bg-white text-slate-600 text-xs font-black uppercase tracking-widest rounded-2xl border-2 border-slate-200 hover:text-red-600 hover:border-red-600 transition-all">
                        Archive Account
                      </button>
                      <button onClick={() => deleteLead(lead.id)} className="text-[10px] text-slate-400 hover:text-red-600 font-black uppercase tracking-widest self-center py-2 transition-colors">
                        Permanently Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
