import React, { useState } from 'react';
import { GraduationCap, ShieldAlert } from 'lucide-react';

export default function LoginOnboard({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    if (password !== 'admin123') {
      setError('Invalid admin password');
      return;
    }
    setError('');
    onLogin(username.trim());
  };

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 10% 20%, #eff6ff 0%, #dbeafe 90%)',
      padding: '1.5rem',
      position: 'fixed',
      inset: 0,
      zIndex: 9999
    }}>
      {/* Dynamic Background Circle Accent */}
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, transparent 70%)',
        top: '15%',
        left: '20%',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(217, 119, 6, 0.06) 0%, transparent 70%)',
        bottom: '15%',
        right: '15%',
        zIndex: 0
      }} />

      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem 2rem',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 1
      }}>
        {/* Brand Logo Header */}
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 8px 20px rgba(37, 99, 235, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary)',
          marginBottom: '1.25rem',
          border: '1px solid #bfdbfe'
        }}>
          <GraduationCap size={32} />
        </div>

        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.85rem',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #1e3a8a 30%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.4rem',
          textAlign: 'center'
        }}>
          BrainBridge Admin
        </h2>
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          marginBottom: '2rem',
          textAlign: 'center',
          fontWeight: '500'
        }}>
          Enter credentials to manage student registrations.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: '0.8rem',
              fontWeight: '600'
            }}>
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Admin Username</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. admin or your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              padding: '0.85rem',
              fontSize: '0.95rem',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
            }}
          >
            Authenticate Portal
          </button>
        </form>
      </div>
    </div>
  );
}
