import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [view, setView] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleSignIn(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await signIn(email.trim().toLowerCase(), password)
    if (err) setError('Invalid email or password.')
    setLoading(false)
  }

  async function handleForgot(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'https://lead-tracker-murex-two.vercel.app/change-password'
    })
    if (err) {
      setError('Something went wrong. Try again.')
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  function switchView(v) {
    setView(v)
    setError('')
    setResetSent(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-red-600 tracking-tighter uppercase italic">CX Sales Hub</h1>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Colour X</p>
        </div>

        {view === 'login' ? (
          <form onSubmit={handleSignIn} className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-xl space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
              />
            </div>

            {error && <p className="text-xs font-black text-red-500 uppercase tracking-widest text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-sm tracking-widest transition-transform active:scale-95"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => switchView('forgot')}
              className="w-full text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors py-2"
            >
              Forgot Password?
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-xl space-y-4">
            {resetSent ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-white text-2xl font-black">✓</span>
                </div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Check your email</p>
                <p className="text-xs font-bold text-slate-500">A reset link has been sent to {email}</p>
                <button
                  onClick={() => switchView('login')}
                  className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors py-2"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest text-center">Reset Password</p>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase ml-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                    className="w-full border-2 border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 bg-slate-50 outline-none focus:border-red-600 transition-all"
                  />
                </div>

                {error && <p className="text-xs font-black text-red-500 uppercase tracking-widest text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-sm tracking-widest transition-transform active:scale-95"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="w-full text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors py-2"
                >
                  Back to Sign In
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
