import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import Fees from './pages/Fees';
import TestMarks from './pages/TestMarks';
import Timetable from './pages/Timetable';
import LoginOnboard from './components/LoginOnboard';
import { GraduationCap } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentAdmin, setCurrentAdmin] = useState(() => {
    return sessionStorage.getItem('bb_current_admin') || null;
  });

  const handleLogin = (adminName) => {
    sessionStorage.setItem('bb_current_admin', adminName);
    setCurrentAdmin(adminName);
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out from the Admin Portal?")) {
      sessionStorage.removeItem('bb_current_admin');
      setCurrentAdmin(null);
    }
  };

  if (!currentAdmin) {
    return <LoginOnboard onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'students':
        return <Students />;
      case 'timetable':
        return <Timetable />;
      case 'attendance':
        return <Attendance />;
      case 'fees':
        return <Fees />;
      case 'tests':
        return <TestMarks />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="brand-container-mobile">
          <GraduationCap className="brand-logo-mobile" size={24} />
          <span className="brand-name-mobile">BrainBridge</span>
        </div>
        <div className="admin-profile-mobile">
          <span className="admin-name">{currentAdmin}</span>
          <button onClick={handleLogout} className="btn-logout-mobile">
            Logout
          </button>
        </div>
      </header>

      {/* Sidebar Nav */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentAdmin={currentAdmin} 
        onLogout={handleLogout} 
      />
      
      {/* Main Dynamic Workspace */}
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
