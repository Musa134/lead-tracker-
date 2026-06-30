import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { CALL_TYPES } from '../../lib/constants'
import { useAuth } from '../../contexts/AuthContext'

function todayDate() {
  return new Date().toISOString().split('T')[0]
}

function currentTime() {
  const now = new Date()
  const rounded = Math.round(now.getMinutes() / 15) * 15
  const h = now.getHours()
  const m = rounded === 60 ? 0 : rounded
  const hAdj = rounded === 60 ? (h + 1) % 24 : h
  return `${String(hAdj).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function freshForm() {
  return {
    company_name: '',
    contact_name: '',
    contact_position: '',
    phone_number: '',
    call_date: todayDate(),
    call_time: currentTime(),
    call_type: '',
    objectives: '',
    call_notes: '',
    whats_next: '',
    follow_up_date: '',
  }
}

export default function LogCall() {
  const navigate = useNavigate()
  const { repName } = useAuth()
  const [form, setForm] = useState(freshForm)
  const [accounts, setAccounts] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedAccountContacts, setSelectedAccountContacts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState({})
  const [photos, setPhotos] = useState([])
  const companyRef = useRef(null)
  const photoPreviews = useMemo(() => photos.map(f => URL.createObjectURL(f)), [photos])

  useEffect(() => {
    supabase
      .from('crm_accounts')
      .select('*, crm_contacts(*)')
      .order('company_name')
      .then(({ data }) => setAccounts(data || []))
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))

    if (name === 'company_name') {
      if (value.length >= 2) {
        const matches = accounts.filter(a =>
          a.company_name.toLowerCase().includes(value.toLowerCase())
        )
        setSuggestions(matches)
        setShowSuggestions(matches.length > 0)
      } else {
        setShowSuggestions(false)
        setSelectedAccountContacts([])
      }
    }
  }

  function selectAccount(account) {
    const contacts = account.crm_contacts || []
    const single = contacts.length === 1 ? contacts[0] : null
    setForm(f => ({
      ...f,
      company_name: account.company_name,
      contact_name: single ? single.contact_name : '',
      contact_position: single ? (single.position || '') : '',
      phone_number: single ? (single.phone_number || '') : '',
    }))
    setSelectedAccountContacts(contacts.length > 1 ? contacts : [])
    setShowSuggestions(false)
  }

  function selectContact(contact) {
    setForm(f => ({
      ...f,
      contact_name: contact.contact_name,
      contact_position: contact.position || '',
      phone_number: contact.phone_number || '',
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const newErrors = {}
    if (!form.company_name.trim()) newErrors.company_name = 'Company name is required'
    if (!form.call_type) newErrors.call_type = 'Select a call type'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})
    setSubmitting(true)

    const existing = accounts.find(
      a => a.company_name.toLowerCase() === form.company_name.toLowerCase()
    )
    if (!existing) {
      const { data: newAccount } = await supabase
        .from('crm_accounts')
        .insert({ company_name: form.company_name.trim() })
        .select()
        .single()

      if (newAccount && form.contact_name.trim()) {
        await supabase.from('crm_contacts').insert({
          account_id: newAccount.id,
          contact_name: form.contact_name.trim(),
          phone_number: form.phone_number.trim() || null,
        })
      }
    }

    const [y, m, d] = form.call_date.split('-').map(Number)
    const [h, min] = form.call_time.split(':').map(Number)
    const loggedAt = new Date(y, m - 1, d, h, min, 0, 0)

    const { data: callData, error } = await supabase.from('crm_calls').insert({
      rep_name: repName,
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim() || null,
      phone_number: form.phone_number.trim() || null,
      call_type: form.call_type,
      objectives: form.objectives.trim() || null,
      call_notes: form.call_notes.trim() || null,
      whats_next: form.whats_next.trim() || null,
      follow_up_date: form.follow_up_date || null,
      logged_at: loggedAt.toISOString(),
    }).select('id').single()

    if (error) { console.error(error); setSubmitting(false); return }

    if (callData && photos.length > 0) {
      for (const file of photos) {
        const ext = file.name.split('.').pop()
        const path = `${callData.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('call-attachments')
          .upload(path, file)
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('call-attachments').getPublicUrl(path)
          await supabase.from('call_attachments').insert({
            call_id: callData.id,
            url: publicUrl,
            file_name: file.name,
          })
        }
      }
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-black">✓</span>
          </div>
          <p className="text-xl font-black text-slate-900 uppercase tracking-tight">Call Logged</p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => { setSubmitted(false); setForm(freshForm()); setPhotos([]) }}
              className="bg-red-600 hover:bg-red-700 text-white font-black py-4 px-8 rounded-2xl uppercase text-sm tracking-widest transition-all active:scale-95"
            >
              Log Another
            </button>
            <button
              onClick={() => navigate('/crm')}
              className="bg-white border-2 border-slate-200 text-slate-700 font-black py-4 px-8 rounded-2xl uppercase text-sm tracking-widest hover:border-slate-400 transition-all"
            >
              Back to Feed
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isNewAccount = form.company_name.length >= 2 &&
    !showSuggestions &&
    !accounts.find(a => a.company_name.toLowerCase() === form.company_name.toLowerCase())

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans text-slate-900">
      <header className="bg-white px-4 py-8 border-b-2 border-slate-300 sticky top-0 z-30 text-center shadow-md relative">
        <button
          onClick={() => navigate('/crm')}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-red-600 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-black text-red-600 tracking-tighter uppercase italic">Log a Call</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-xl space-y-5">

          <div className="flex items-center gap-3 px-1 pb-1">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Logging as</p>
            <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{repName}</p>
          </div>

          {/* Company autocomplete */}
          <div className="space-y-2 relative">
            <div className="flex items-center justify-between ml-1">
              <label className="text-xs font-black text-slate-500 uppercase">Company Name *</label>
              {errors.company_name && <span className="text-xs font-black text-red-500 uppercase tracking-widest">{errors.company_name}</span>}
            </div>
            <input
              ref={companyRef}
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Type to search or add new..."
              required
              autoComplete="off"
              className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
            />
            {showSuggestions && (
              <div className="absolute left-0 right-0 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl z-20 overflow-hidden mt-1">
                {suggestions.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onMouseDown={() => selectAccount(a)}
                    className="w-full text-left px-5 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                  >
                    <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{a.company_name}</p>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                      {a.crm_contacts?.length || 0} {a.crm_contacts?.length === 1 ? 'contact' : 'contacts'}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {isNewAccount && (
              <p className="text-xs font-black text-green-600 uppercase tracking-widest mt-2 ml-1">
                "{form.company_name}" not found — will be added as a new account
              </p>
            )}
          </div>

          {/* Contact picker — shown when an existing account is selected and has contacts */}
          {selectedAccountContacts.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Who Did You Speak To?</label>
              <div className="space-y-2">
                {selectedAccountContacts.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectContact(c)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all ${
                      form.contact_name === c.contact_name
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <p className={`font-black text-sm uppercase tracking-tight ${form.contact_name === c.contact_name ? 'text-white' : 'text-slate-900'}`}>
                      {c.contact_name}
                    </p>
                    {c.position && (
                      <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${form.contact_name === c.contact_name ? 'text-red-100' : 'text-slate-400'}`}>
                        {c.position}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual contact fields — shown when no account selected or new account */}
          {selectedAccountContacts.length === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase ml-1">Contact Name</label>
                <input
                  name="contact_name"
                  value={form.contact_name}
                  onChange={handleChange}
                  placeholder="Name"
                  className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase ml-1">Phone</label>
                <input
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  placeholder="Number"
                  type="tel"
                  className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Call Date</label>
              <input
                type="date"
                name="call_date"
                value={form.call_date}
                onChange={handleChange}
                max={todayDate()}
                className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Call Time *</label>
              <input
                type="time"
                name="call_time"
                value={form.call_time}
                onChange={handleChange}
                step="900"
                required
                className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="text-xs font-black text-slate-500 uppercase">Call Type *</label>
              {errors.call_type && <span className="text-xs font-black text-red-500 uppercase tracking-widest">{errors.call_type}</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CALL_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, call_type: type }))}
                  className={`py-4 rounded-2xl text-xs font-black uppercase tracking-widest border-2 transition-all ${
                    form.call_type === type
                      ? 'bg-red-600 border-red-600 text-white shadow-lg'
                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Objectives</label>
            <textarea
              name="objectives"
              value={form.objectives}
              onChange={handleChange}
              placeholder="What was the goal of this call?"
              rows={2}
              className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none resize-none focus:border-red-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Call Notes</label>
            <textarea
              name="call_notes"
              value={form.call_notes}
              onChange={handleChange}
              placeholder="What happened on this call?"
              rows={3}
              className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none resize-none focus:border-red-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">What's Next & When</label>
            <textarea
              name="whats_next"
              value={form.whats_next}
              onChange={handleChange}
              placeholder="e.g. Call back Thursday re: quote"
              rows={2}
              className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none resize-none focus:border-red-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Follow-Up Date <span className="text-slate-400 normal-case font-bold">(optional)</span></label>
            <input
              type="date"
              name="follow_up_date"
              value={form.follow_up_date}
              onChange={handleChange}
              min={todayDate()}
              className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Photos <span className="text-slate-400 normal-case font-bold">(optional)</span></label>
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt=""
                    className="w-20 h-20 object-cover rounded-xl border-2 border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full text-white text-[10px] font-black flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-red-400 transition-colors text-slate-400">
                <span className="text-2xl leading-none">+</span>
                <span className="text-[9px] font-black uppercase tracking-widest mt-0.5">Photo</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files[0]
                    if (file) setPhotos(p => [...p, file])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-sm tracking-widest transition-transform active:scale-95"
          >
            {submitting ? 'Logging...' : 'Log Call'}
          </button>
        </form>
      </main>
    </div>
  )
}
