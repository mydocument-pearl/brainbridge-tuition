import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar,
  CheckSquare, 
  CreditCard, 
  FileSpreadsheet,
  GraduationCap,
  Database
} from 'lucide-react';
import { dbService } from '../database/dbService';

export default function Sidebar({ activeTab, setActiveTab, currentAdmin, onLogout }) {
  const [dbMode, setDbModeState] = useState(dbService.getDbMode());

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Admissions', icon: Users },
    { id: 'timetable', label: 'Timetable', icon: Calendar },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
    { id: 'fees', label: 'Fees', icon: CreditCard },
    { id: 'tests', label: 'Test Marks', icon: FileSpreadsheet }
  ];

  const handleModeChange = (mode) => {
    if (window.confirm(`Switch to ${mode === 'cloud' ? 'Cloud Mode (Firebase)' : 'Local Test Mode (LocalStorage)'}? The app will reload.`)) {
      dbService.setDbMode(mode);
      setDbModeState(mode);
    }
  };

  return (
    <aside className="sidebar">
      <div className="brand-container">
        <GraduationCap className="brand-logo" size={32} />
        <span className="brand-name">BrainBridge</span>
      </div>
      
      <ul className="nav-links" style={{ flexGrow: 1 }}>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <li key={item.id}>
              <button
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left' }}
              >
                <IconComponent className="nav-icon" />
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Admin Profile Widget */}
      <div className="admin-profile-widget" style={{ borderTop: '1px solid #bfdbfe', paddingTop: '1rem', marginTop: 'auto', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            border: '1px solid #93c5fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            fontWeight: '700',
            fontSize: '1rem',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
          }}>
            {currentAdmin ? currentAdmin.charAt(0).toUpperCase() : 'A'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Admin Mode</span>
            <span style={{ fontSize: '0.92rem', fontWeight: '800', color: '#1e3a8a', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentAdmin}>
              {currentAdmin}
            </span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="btn btn-secondary"
          style={{
            width: '100%',
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            fontWeight: '700',
            color: 'var(--danger)',
            backgroundColor: 'var(--danger-bg)',
            borderColor: 'var(--danger-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            boxShadow: 'none'
          }}
        >
          Logout Portal
        </button>
      </div>

      {/* Database Mode Switcher Widget at Sidebar Bottom */}
      <div className="db-selector-widget" style={{ borderTop: '1px solid #bfdbfe', paddingTop: '1.2rem' }}>
        <span style={{ 
          fontSize: '0.72rem', 
          fontWeight: '800', 
          color: '#1e3a8a', 
          textTransform: 'uppercase', 
          letterSpacing: '0.08em', 
          display: 'flex', 
          alignItems: 'center',
          gap: '0.4rem',
          marginBottom: '0.75rem' 
        }}>
          <Database size={12} /> Data Storage Mode
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            type="button" 
            onClick={() => handleModeChange('cloud')}
            disabled={!dbService.isFirebaseConfigured()}
            className={`btn-mode-toggle ${dbMode === 'cloud' ? 'active' : ''}`}
            title={!dbService.isFirebaseConfigured() ? "Firebase is not configured in .env" : "Connect to Firebase"}
          >
            <div className="status-dot cloud" />
            <div style={{ textAlign: 'left' }}>
              <div className="mode-title">Cloud Mode</div>
              <div className="mode-desc">
                {dbService.isFirebaseConfigured() ? 'Firebase Live' : 'Not Configured'}
              </div>
            </div>
          </button>
          
          <button 
            type="button" 
            onClick={() => handleModeChange('local')}
            className={`btn-mode-toggle ${dbMode === 'local' ? 'active' : ''}`}
            title="Use browser storage"
          >
            <div className="status-dot local" />
            <div style={{ textAlign: 'left' }}>
              <div className="mode-title">Local Test Mode</div>
              <div className="mode-desc">LocalStorage (Offline)</div>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
}
