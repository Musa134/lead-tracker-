import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { REP_COLORS } from '../../lib/constants'

function formatCallDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCallTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

const EMPTY_FORM = { company_name: '', contact_name: '', position: '', phone_number: '' }
const EMPTY_CONTACT = { contact_name: '', position: '', phone_number: '' }

export default function AllAccounts() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ company_name: '' })
  const [updating, setUpdating] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [addingContactTo, setAddingContactTo] = useState(null)
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT)
  const [savingContact, setSavingContact] = useState(false)
  const [editingContactId, setEditingContactId] = useState(null)
  const [editContactForm, setEditContactForm] = useState(EMPTY_CONTACT)
  const [callHistory, setCallHistory] = useState({})
  const [loadingHistory, setLoadingHistory] = useState({})
  const [selectedCall, setSelectedCall] = useState(null)
  const [attachments, setAttachments] = useState({})
  const [callsWithAttachments, setCallsWithAttachments] = useState(new Set())
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef(null)

  useEffect(() => { fetchAccounts() }, [])

  useEffect(() => {
    if (!expandedId) return
    if (callHistory[expandedId] !== undefined) return
    const account = accounts.find(a => a.id === expandedId)
    if (account) fetchCallHistory(expandedId, account.company_name)
  }, [expandedId, accounts])

  useEffect(() => {
    if (!selectedCall) return
    if (attachments[selectedCall.id] !== undefined) return
    fetchAttachments(selectedCall.id)
  }, [selectedCall])

  async function fetchAccounts() {
    const { data } = await supabase
      .from('crm_accounts')
      .select('*, crm_contacts(*)')
      .order('company_name')
    setAccounts((data || []).map(a => ({
      ...a,
      crm_contacts: (a.crm_contacts || []).sort((x, y) => new Date(x.created_at) - new Date(y.created_at))
    })))
    setLoading(false)
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

  async function fetchCallHistory(accountId, companyName) {
    setLoadingHistory(h => ({ ...h, [accountId]: true }))
    const { data } = await supabase
      .from('crm_calls')
      .select('*')
      .eq('company_name', companyName)
      .order('logged_at', { ascending: false })
    const callData = data || []
    setCallHistory(h => ({ ...h, [accountId]: callData }))

    if (callData.length > 0) {
      const { data: attData } = await supabase
        .from('call_attachments')
        .select('call_id')
        .in('call_id', callData.map(c => c.id))
      if (attData?.length > 0) {
        setCallsWithAttachments(prev => new Set([...prev, ...attData.map(a => a.call_id)]))
      }
    }

    setLoadingHistory(h => ({ ...h, [accountId]: false }))
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.company_name.trim()) return
    setSaving(true)
    const { data: newAccount, error } = await supabase
      .from('crm_accounts')
      .insert({ company_name: form.company_name.trim() })
      .select()
      .single()
    if (error) { console.error(error); setSaving(false); return }

    if (form.contact_name.trim()) {
      await supabase.from('crm_contacts').insert({
        account_id: newAccount.id,
        contact_name: form.contact_name.trim(),
        position: form.position.trim() || null,
        phone_number: form.phone_number.trim() || null,
      })
    }

    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
    fetchAccounts()
  }

  async function handleUpdateAccount(e, id) {
    e.preventDefault()
    if (!editForm.company_name.trim()) return
    setUpdating(true)
    const { error } = await supabase
      .from('crm_accounts')
      .update({ company_name: editForm.company_name.trim() })
      .eq('id', id)
    if (error) { console.error(error); setUpdating(false); return }
    setEditingId(null)
    setUpdating(false)
    fetchAccounts()
  }

  async function handleAddContact(e, accountId) {
    e.preventDefault()
    if (!contactForm.contact_name.trim()) return
    setSavingContact(true)
    const { error } = await supabase.from('crm_contacts').insert({
      account_id: accountId,
      contact_name: contactForm.contact_name.trim(),
      position: contactForm.position.trim() || null,
      phone_number: contactForm.phone_number.trim() || null,
    })
    if (error) { console.error(error); setSavingContact(false); return }
    setAddingContactTo(null)
    setContactForm(EMPTY_CONTACT)
    setSavingContact(false)
    fetchAccounts()
  }

  async function handleUpdateContact(e, contactId) {
    e.preventDefault()
    if (!editContactForm.contact_name.trim()) return
    setUpdating(true)
    const { error } = await supabase.from('crm_contacts').update({
      contact_name: editContactForm.contact_name.trim(),
      position: editContactForm.position.trim() || null,
      phone_number: editContactForm.phone_number.trim() || null,
    }).eq('id', contactId)
    if (error) { console.error(error); setUpdating(false); return }
    setEditingContactId(null)
    setUpdating(false)
    fetchAccounts()
  }

  const filtered = accounts.filter(a =>
    a.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.crm_contacts || []).some(c =>
      c.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.position || '').toLowerCase().includes(search.toLowerCase())
    )
  )

  const grouped = filtered.reduce((acc, a) => {
    const letter = a.company_name[0].toUpperCase()
    if (!acc[letter]) acc[letter] = []
    acc[letter].push(a)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans text-slate-900">
      <header className="bg-white px-4 py-6 border-b-2 border-slate-300 sticky top-0 z-30 shadow-md">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate('/crm')} className="text-xs font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors">
              ← Back
            </button>
            <h1 className="text-xl font-black text-red-600 tracking-tighter uppercase italic">All Accounts</h1>
            <button onClick={() => setShowForm(f => !f)} className="text-xs font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors">
              {showForm ? 'Cancel' : '+ Add'}
            </button>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts or contacts..."
            className="w-full border-2 border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
          />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {showForm && (
          <form onSubmit={handleAdd} className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest border-b-2 border-red-100 pb-3">New Account</h2>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Company Name *</label>
              <input
                name="company_name"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                required
                placeholder="Required"
                className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600"
              />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">First Contact (optional)</p>
            <div className="space-y-3 bg-slate-50 rounded-2xl p-4 border-2 border-slate-100">
              <input
                name="contact_name"
                value={form.contact_name}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Contact Name"
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 bg-white outline-none focus:border-red-600"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="position"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  placeholder="Position / Role"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 bg-white outline-none focus:border-red-600"
                />
                <input
                  name="phone_number"
                  value={form.phone_number}
                  onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                  placeholder="Phone"
                  type="tel"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 bg-white outline-none focus:border-red-600"
                />
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs tracking-widest transition-transform active:scale-95">
              {saving ? 'Saving...' : 'Add Account'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-center text-slate-400 font-black uppercase tracking-widest text-sm py-10">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 font-black uppercase tracking-widest text-sm py-10">
            {search ? 'No matches found.' : 'No accounts yet.'}
          </p>
        ) : (
          Object.keys(grouped).sort().map(letter => (
            <div key={letter}>
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 px-1">{letter}</p>
              <div className="space-y-2">
                {grouped[letter].map(a => (
                  <div key={a.id} className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">

                    {/* Account header */}
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      {editingId === a.id ? (
                        <form onSubmit={e => handleUpdateAccount(e, a.id)} className="flex-1 flex items-center gap-3">
                          <input
                            value={editForm.company_name}
                            onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                            required
                            className="flex-1 border-2 border-red-300 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600"
                          />
                          <button type="submit" disabled={updating} className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:text-red-800 transition-colors">
                            {updating ? '...' : 'Save'}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-400 transition-colors">
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                            className="font-black text-slate-900 uppercase tracking-tight text-left flex-1 flex items-center gap-2"
                          >
                            <span>{a.company_name}</span>
                            <span className="text-[10px] text-slate-400 font-black normal-case tracking-widest">
                              {a.crm_contacts.length} {a.crm_contacts.length === 1 ? 'contact' : 'contacts'}
                            </span>
                            <span className={`ml-auto text-slate-400 text-xs transition-transform ${expandedId === a.id ? 'rotate-90' : ''}`}>›</span>
                          </button>
                          <button
                            onClick={() => { setEditingId(a.id); setEditForm({ company_name: a.company_name }) }}
                            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors flex-shrink-0"
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>

                    {/* Contacts list */}
                    {expandedId === a.id && (
                      <div className="border-t-2 border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                        {a.crm_contacts.length === 0 && (
                          <p className="text-xs text-slate-400 font-black uppercase tracking-widest">No contacts yet.</p>
                        )}

                        {a.crm_contacts.map(c => (
                          <div key={c.id} className="bg-white rounded-xl border-2 border-slate-100 px-4 py-3">
                            {editingContactId === c.id ? (
                              <form onSubmit={e => handleUpdateContact(e, c.id)} className="space-y-2">
                                <input
                                  value={editContactForm.contact_name}
                                  onChange={e => setEditContactForm(f => ({ ...f, contact_name: e.target.value }))}
                                  required
                                  placeholder="Contact Name"
                                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    value={editContactForm.position}
                                    onChange={e => setEditContactForm(f => ({ ...f, position: e.target.value }))}
                                    placeholder="Position"
                                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600"
                                  />
                                  <input
                                    value={editContactForm.phone_number}
                                    onChange={e => setEditContactForm(f => ({ ...f, phone_number: e.target.value }))}
                                    placeholder="Phone"
                                    type="tel"
                                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600"
                                  />
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button type="submit" disabled={updating} className="flex-1 bg-red-600 text-white font-black py-2 rounded-xl uppercase text-xs tracking-widest active:scale-95">
                                    {updating ? '...' : 'Save'}
                                  </button>
                                  <button type="button" onClick={() => setEditingContactId(null)} className="flex-1 bg-white border-2 border-slate-200 text-slate-500 font-black py-2 rounded-xl uppercase text-xs tracking-widest">
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-black text-slate-900 text-sm">{c.contact_name}</p>
                                  {c.position && (
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{c.position}</p>
                                  )}
                                  {c.phone_number && (
                                    <a href={`tel:${c.phone_number}`} className="text-xs font-black text-red-600 hover:underline mt-0.5 block">
                                      {c.phone_number}
                                    </a>
                                  )}
                                </div>
                                <button
                                  onClick={() => { setEditingContactId(c.id); setEditContactForm({ contact_name: c.contact_name, position: c.position || '', phone_number: c.phone_number || '' }) }}
                                  className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors flex-shrink-0"
                                >
                                  Edit
                                </button>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add contact inline */}
                        {addingContactTo === a.id ? (
                          <form onSubmit={e => handleAddContact(e, a.id)} className="space-y-2 pt-1">
                            <input
                              value={contactForm.contact_name}
                              onChange={e => setContactForm(f => ({ ...f, contact_name: e.target.value }))}
                              required
                              placeholder="Contact Name *"
                              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 bg-white outline-none focus:border-red-600"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                value={contactForm.position}
                                onChange={e => setContactForm(f => ({ ...f, position: e.target.value }))}
                                placeholder="Position / Role"
                                className="w-full border-2 border-slate-200 rounded-xl px-3 py-3 text-sm font-bold text-slate-900 bg-white outline-none focus:border-red-600"
                              />
                              <input
                                value={contactForm.phone_number}
                                onChange={e => setContactForm(f => ({ ...f, phone_number: e.target.value }))}
                                placeholder="Phone"
                                type="tel"
                                className="w-full border-2 border-slate-200 rounded-xl px-3 py-3 text-sm font-bold text-slate-900 bg-white outline-none focus:border-red-600"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button type="submit" disabled={savingContact} className="flex-1 bg-red-600 text-white font-black py-3 rounded-xl uppercase text-xs tracking-widest active:scale-95">
                                {savingContact ? '...' : 'Add Contact'}
                              </button>
                              <button type="button" onClick={() => { setAddingContactTo(null); setContactForm(EMPTY_CONTACT) }} className="flex-1 bg-white border-2 border-slate-200 text-slate-500 font-black py-3 rounded-xl uppercase text-xs tracking-widest">
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            onClick={() => setAddingContactTo(a.id)}
                            className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors pt-1"
                          >
                            + Add Contact
                          </button>
                        )}

                        {/* Call History */}
                        <div className="mt-4 pt-4 border-t-2 border-slate-200">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                            Call History
                            {callHistory[a.id] && callHistory[a.id].length > 0 && (
                              <span className="ml-2 text-slate-400">({callHistory[a.id].length})</span>
                            )}
                          </p>
                          {loadingHistory[a.id] ? (
                            <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Loading...</p>
                          ) : !callHistory[a.id] || callHistory[a.id].length === 0 ? (
                            <p className="text-xs text-slate-400 font-black uppercase tracking-widest">No calls logged yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {callHistory[a.id].map(call => {
                                const colors = REP_COLORS[call.rep_name] || { badge: 'bg-slate-100 text-slate-500 border-slate-200' }
                                return (
                                  <button
                                    key={call.id}
                                    onClick={() => setSelectedCall(call)}
                                    className="w-full bg-white rounded-xl border-2 border-slate-100 px-4 py-3 flex items-center gap-3 hover:border-slate-300 transition-all text-left active:scale-[0.99]"
                                  >
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 flex-shrink-0 ${colors.badge}`}>
                                      {call.rep_name}
                                    </span>
                                    <span className="text-xs font-black text-slate-700 truncate flex-1">
                                      {call.contact_name || call.call_type || '—'}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap flex-shrink-0">
                                      {formatCallDate(call.logged_at)}
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
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {!loading && accounts.length > 0 && (
          <p className="text-center text-[10px] text-slate-500 font-black uppercase tracking-widest pt-4">
            {accounts.length} total {accounts.length === 1 ? 'account' : 'accounts'}
          </p>
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
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border-2 inline-block mb-3 ${(REP_COLORS[selectedCall.rep_name] || { badge: 'bg-slate-100 text-slate-500 border-slate-200' }).badge}`}>
                  {selectedCall.rep_name}
                </span>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight">
                  {selectedCall.company_name}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  {formatDayLabel(new Date(selectedCall.logged_at))} · {formatCallTime(selectedCall.logged_at)}
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
                <p className="text-sm font-bold text-slate-700 bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 leading-relaxed whitespace-pre-wrap">
                  {selectedCall.objectives}
                </p>
              </div>
            )}

            {selectedCall.call_notes && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Call Notes</p>
                <p className="text-sm font-bold text-slate-700 bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 leading-relaxed whitespace-pre-wrap">
                  {selectedCall.call_notes}
                </p>
              </div>
            )}

            {selectedCall.whats_next && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">What's Next & When</p>
                <p className="text-sm font-bold text-slate-700 bg-slate-50 rounded-2xl p-4 border-2 border-slate-100 leading-relaxed whitespace-pre-wrap">
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
