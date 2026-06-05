// ─────────────────────────────────────────────────────────────────────────────
// src/components/Auth/LoginPage.jsx
// Login / Register page shown when the user is not authenticated
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Film } from 'lucide-react';

export default function LoginPage({ onLogin, onRegister, submitting }) {
  const [mode, setMode]         = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm]         = useState({ email: '', password: '', displayName: '' });
  const [errors, setErrors]     = useState({});

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.email)    errs.email    = 'Email is required';
    if (!form.password) errs.password = 'Password is required';
    if (mode === 'register') {
      if (!form.displayName) errs.displayName = 'Display name is required';
      if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
      if (!/[A-Z]/.test(form.password)) errs.password = 'Password must contain an uppercase letter';
      if (!/[0-9]/.test(form.password)) errs.password = 'Password must contain a number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (mode === 'login') {
      await onLogin({ email: form.email, password: form.password });
    } else {
      await onRegister({ email: form.email, password: form.password, displayName: form.displayName });
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Film className="w-8 h-8 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white font-display">
              Edit<span className="text-cyan-400">Frame</span>
            </h1>
          </div>
          <p className="text-white/40 text-sm">Professional video editing</p>
        </div>

        {/* Card */}
        <div className="bg-[#0D1526] border border-white/10 rounded-2xl p-8">
          {/* Tabs */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setErrors({}); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display name (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={update('displayName')}
                    placeholder="Your name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
                {errors.displayName && <p className="text-red-400 text-xs mt-1">{errors.displayName}</p>}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={update('password')}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              {mode === 'register' && !errors.password && (
                <p className="text-white/30 text-xs mt-1">Min 8 chars, 1 uppercase, 1 number</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500/80 to-blue-500/80 hover:from-cyan-400/80 hover:to-blue-400/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all mt-2"
              style={{ boxShadow: '0 4px 24px rgba(45,212,191,0.25)' }}
            >
              {submitting
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign In' : 'Create Account')
              }
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}