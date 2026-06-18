'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Eye, EyeOff, Loader2, Sparkles, Mail, Lock, ArrowRight, User } from 'lucide-react';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  };

  const validate = () => {
    setError(null);
    setSuccess(null);

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (mode !== 'forgotPassword' && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }
    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    let authError: Error | null = null;

    try {
      if (mode === 'signUp') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
        });
        if (err) throw err;
        setSuccess('Check your email to confirm your account!');
      } else if (mode === 'signIn') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
      } else if (mode === 'forgotPassword') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email);
        if (err) throw err;
        setSuccess('Password reset instructions sent to your email.');
      }
    } catch (err: unknown) {
      authError = err as Error;
      setError((err as Error).message || 'Authentication failed. Please try again.');
    } finally {
      if (mode === 'signUp' && !authError) {
        // Keep loading state until redirect or manual state clear, 
        // but since we just show success message, we can stop loading.
        setLoading(false);
      } else if (mode === 'forgotPassword' && !authError) {
        setLoading(false);
      } else if (authError) {
        setLoading(false);
      }
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInAnonymously();
      if (err) throw err;
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to sign in as guest.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen animate-fade-in">
      <div className="auth-card glass">
        
        {/* Header */}
        <div className="auth-header" style={{ animationDelay: '0ms' }}>
          <div className="logo-icon">
            <Sparkles size={24} color="var(--primary-contrast)" />
          </div>
          <h1 className="logo-text">Fooday</h1>
          <p className="tagline">What to eat today</p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="auth-form" style={{ animationDelay: '50ms' }}>
          
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>
          </div>

          {mode !== 'forgotPassword' && (
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {mode === 'signIn' && (
                <button
                  type="button"
                  className="forgot-btn"
                  onClick={() => handleModeChange('forgotPassword')}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {error && <div className="feedback error animate-fade-in">{error}</div>}
          {success && <div className="feedback success animate-fade-in">{success}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? (
              <Loader2 className="spinner" size={20} />
            ) : mode === 'signIn' ? (
              'Sign In'
            ) : mode === 'signUp' ? (
              'Create Account'
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="separator" style={{ animationDelay: '100ms' }}>
          <span>or</span>
        </div>

        {/* Guest Button */}
        <button 
          className="guest-btn" 
          onClick={handleGuest}
          disabled={loading}
          style={{ animationDelay: '150ms' }}
        >
          <User size={18} />
          Continue as guest
          <ArrowRight size={18} />
        </button>

        {/* Toggle Mode */}
        <div className="toggle-mode" style={{ animationDelay: '200ms' }}>
          {mode === 'signIn' ? (
            <p>
              Don&apos;t have an account?{' '}
              <button onClick={() => handleModeChange('signUp')} disabled={loading}>Sign Up</button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button onClick={() => handleModeChange('signIn')} disabled={loading}>Sign In</button>
            </p>
          )}
        </div>

      </div>

      <style jsx>{`
        .auth-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: clamp(16px, 5vw, 24px);
          min-height: 100dvh;
        }

        .auth-card {
          width: 100%;
          max-width: 380px;
          padding: clamp(24px, 6vw, 40px) clamp(16px, 5vw, 24px);
          border-radius: var(--r-xl);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: clamp(20px, 5vw, 24px);
        }

        :root[data-theme="dark"] .auth-card {
          border-color: var(--border-strong);
        }
        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"]) .auth-card {
            border-color: var(--border-strong);
          }
        }

        /* Header */
        .auth-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 8px;
          animation: fadeInUp 0.5s var(--ease-out) both;
        }
        
        .logo-icon {
          width: clamp(44px, 12vw, 52px);
          height: clamp(44px, 12vw, 52px);
          border-radius: var(--r-lg);
          background: var(--grad-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-primary);
          margin-bottom: 8px;
        }

        .logo-text {
          font-family: var(--font-display);
          font-size: clamp(1.75rem, 8vw, 2rem);
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.03em;
          line-height: 1;
        }

        .tagline {
          font-size: 0.9375rem;
          color: var(--text-soft);
          font-weight: 500;
        }

        /* Form */
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: fadeInUp 0.5s var(--ease-out) both;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-group label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-soft);
          padding-left: 4px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          color: var(--text-faint);
          pointer-events: none;
        }

        .input-wrapper input {
          width: 100%;
          height: 48px;
          background: var(--surface-2);
          border: 1px solid var(--border-strong);
          border-radius: var(--r-md);
          padding: 0 44px 0 40px;
          font-size: 0.9375rem;
          color: var(--text);
          outline: none;
          transition: border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
        }

        .input-wrapper input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--ring);
          background: var(--surface);
        }

        .input-wrapper input::placeholder {
          color: var(--text-faint);
        }

        .eye-btn {
          position: absolute;
          right: 2px;
          background: none;
          border: none;
          color: var(--text-faint);
          cursor: pointer;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color var(--dur-fast) var(--ease);
        }

        .eye-btn:hover {
          color: var(--text-soft);
        }

        .forgot-btn {
          align-self: flex-end;
          background: none;
          border: none;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--primary-strong);
          cursor: pointer;
          min-height: 32px;
          min-width: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          margin-top: 4px;
          transition: opacity var(--dur-fast) var(--ease);
        }

        .forgot-btn:hover {
          opacity: 0.8;
        }

        /* Feedback */
        .feedback {
          padding: 10px 14px;
          border-radius: var(--r-md);
          font-size: 0.84375rem;
          font-weight: 500;
          text-align: center;
        }

        .feedback.error {
          background: rgba(255, 90, 126, 0.1);
          color: var(--heart);
          border: 1px solid rgba(255, 90, 126, 0.2);
        }

        .feedback.success {
          background: rgba(34, 197, 94, 0.1);
          color: var(--online);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        /* Submit Button */
        .submit-btn {
          height: 48px;
          border-radius: var(--r-md);
          border: none;
          background: var(--grad-primary);
          color: var(--primary-contrast);
          font-size: 1rem;
          font-weight: 700;
          box-shadow: var(--shadow-primary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform var(--dur-fast) var(--ease), opacity var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
          margin-top: 8px;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 16px 32px -8px rgba(110, 120, 240, 0.6);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Separator */
        .separator {
          display: flex;
          align-items: center;
          text-align: center;
          color: var(--text-faint);
          font-size: 0.8125rem;
          font-weight: 500;
          animation: fadeInUp 0.5s var(--ease-out) both;
        }

        .separator::before,
        .separator::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid var(--border-strong);
        }

        .separator span {
          padding: 0 12px;
        }

        /* Guest Button */
        .guest-btn {
          height: 48px;
          border-radius: var(--r-md);
          border: 1px solid var(--border-strong);
          background: var(--surface);
          color: var(--text);
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease);
          animation: fadeInUp 0.5s var(--ease-out) both;
        }

        .guest-btn:hover:not(:disabled) {
          background: var(--surface-2);
          border-color: var(--text-faint);
        }

        .guest-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Toggle Mode */
        .toggle-mode {
          text-align: center;
          font-size: 0.875rem;
          color: var(--text-soft);
          font-weight: 500;
          animation: fadeInUp 0.5s var(--ease-out) both;
        }

        .toggle-mode button {
          background: none;
          border: none;
          color: var(--primary-strong);
          font-weight: 700;
          font-size: 0.875rem;
          cursor: pointer;
          min-height: 44px;
          min-width: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .toggle-mode button:hover:not(:disabled) {
          text-decoration: underline;
        }
        
        .toggle-mode button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
