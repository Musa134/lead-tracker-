import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError('Something went wrong. Try again.')
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 font-sans">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-black">✓</span>
          </div>
          <p className="text-xl font-black text-slate-900 uppercase tracking-tight">Password Updated</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-8 bg-red-600 hover:bg-red-700 text-white font-black py-4 px-8 rounded-2xl uppercase text-sm tracking-widest transition-all active:scale-95"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Change Password</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-xl space-y-4"
        >
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
            />
          </div>

          {error && (
            <p className="text-xs font-black text-red-500 uppercase tracking-widest text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-sm tracking-widest transition-transform active:scale-95"
          >
            {loading ? 'Saving...' : 'Update Password'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors py-2"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}
