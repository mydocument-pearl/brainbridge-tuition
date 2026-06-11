import React, { useEffect, useState } from 'react';
import { dbService, formatDateDisplay } from '../database/dbService';
import { Users, BookOpen, CheckCircle, IndianRupee, Bell, Play, FileSpreadsheet, Star, Quote, Plus } from 'lucide-react';

export default function Dashboard({ setActiveTab }) {
  const [stats, setStats] = useState({
    studentsCount: 0,
    batchesCount: 0,
    attendanceRate: 0,
    collectedFees: 0,
    pendingFees: 0
  });
  const [recentPayments, setRecentPayments] = useState([]);
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [dueRecordsList, setDueRecordsList] = useState([]);
  const [activeSimulatedRecord, setActiveSimulatedRecord] = useState(null);
  
  const [testimonials, setTestimonials] = useState([]);
  const [showAddTestimonialModal, setShowAddTestimonialModal] = useState(false);
  const [newTestimonial, setNewTestimonial] = useState({
    parent_name: '',
    student_name: '',
    rating: 5,
    feedback: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [students, setStudents] = useState([]);
  const [enrollmentFilter, setEnrollmentFilter] = useState('Monthly'); // 'Monthly', 'Weekly', 'Date-wise'
  const [attendanceDate, setAttendanceDate] = useState('-');

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [students, batches, fees, tstList, latestAttDate] = await Promise.all([
          dbService.getStudents(),
          dbService.getBatches(),
          dbService.getFees(),
          dbService.getTestimonials(),
          dbService.getLatestAttendanceDate()
        ]);

        setStudents(students);
        setTestimonials(tstList);
        
        // Compute stats
        const studentsCount = students.length;
        const batchesCount = batches.length;
        
        // Fee stats
        let collected = 0;
        let pending = 0;
        fees.forEach(f => {
          if (f.status === 'Paid') collected += f.amount;
          else pending += f.amount;
        });

        // Attendance stats (lookup today first, fallback to latest marked date)
        let attDate = latestAttDate || '2026-06-05';
        let attendanceLogs = await dbService.getAttendance(attDate);
        
        const presentCount = attendanceLogs.filter(a => a.status === 'Present').length;
        const rate = attendanceLogs.length > 0 ? Math.round((presentCount / attendanceLogs.length) * 100) : 0;
        setAttendanceDate(formatDateDisplay(attDate));

        // Recent payments (Paid state)
        const paidFees = fees
          .filter(f => f.status === 'Paid')
          .map(f => {
            const student = students.find(s => s.id === f.student_id);
            return {
              id: f.id,
              studentName: student ? student.name : 'Unknown Student',
              amount: f.amount,
              paymentMode: f.payment_mode,
              date: formatDateDisplay(f.payment_date)
            };
          })
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 4);

        setStats({
          studentsCount,
          batchesCount,
          attendanceRate: attendanceLogs.length > 0 ? rate : 85,
          collectedFees: collected,
          pendingFees: pending
        });
        setRecentPayments(paidFees);

        // Find pending fees
        const pendingList = fees
          .filter(f => f.status === 'Pending')
          .map(f => {
            const student = students.find(s => s.id === f.student_id);
            return {
              ...f,
              studentName: student ? student.name : 'Unknown Student',
              parentMobile: student ? student.parent_mobile : 'N/A'
            };
          });
        setDueRecordsList(pendingList);

        if (pendingList.length > 0 && !sessionStorage.getItem('bb_due_popup_shown')) {
          setActiveSimulatedRecord(pendingList[0]);
          setShowNotificationModal(true);
          sessionStorage.setItem('bb_due_popup_shown', 'true');
        }
      } catch (err) {
        console.error("Failed to load dashboard statistics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const handleAddTestimonialSubmit = async (e) => {
    e.preventDefault();
    if (!newTestimonial.parent_name || !newTestimonial.feedback) return;
    try {
      const added = await dbService.addTestimonial(newTestimonial);
      setTestimonials(prev => [...prev, added]);
      setShowAddTestimonialModal(false);
      setNewTestimonial({
        parent_name: '',
        student_name: '',
        rating: 5,
        feedback: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error("Failed to add testimonial:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard analytics...</p>
      </div>
    );
  }

  // Calculate Enrollment Graph Data
  const getEnrollmentData = () => {
    const counts = {};
    const current = new Date();
    
    // Seed last 4 months if Monthly filter is selected
    if (enrollmentFilter === 'Monthly') {
      for (let i = 3; i >= 0; i--) {
        const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
        const monthName = d.toLocaleString('default', { month: 'long' });
        const year = d.getFullYear();
        const key = `${monthName} ${year}`;
        counts[key] = 0;
      }
    }
    
    students.forEach(s => {
      if (!s.admission_date) return;
      const date = new Date(s.admission_date);
      if (isNaN(date.getTime())) return;
      
      let key = '';
      if (enrollmentFilter === 'Monthly') {
        const monthName = date.toLocaleString('default', { month: 'long' });
        const year = date.getFullYear();
        key = `${monthName} ${year}`;
      } else if (enrollmentFilter === 'Weekly') {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(date.setDate(diff));
        const dd = String(startOfWeek.getDate()).padStart(2, '0');
        const mm = String(startOfWeek.getMonth() + 1).padStart(2, '0');
        const yyyy = startOfWeek.getFullYear();
        key = `Week of ${dd}-${mm}-${yyyy}`;
      } else {
        // Date-wise
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        key = `${dd}-${mm}-${yyyy}`;
      }
      
      if (counts[key] !== undefined) {
        counts[key] += 1;
      } else {
        counts[key] = 1;
      }
    });

    const sorted = Object.entries(counts).map(([label, count]) => ({ label, count }));
    
    sorted.sort((a, b) => {
      let dateA, dateB;
      if (enrollmentFilter === 'Monthly') {
        dateA = new Date(a.label);
        dateB = new Date(b.label);
      } else if (enrollmentFilter === 'Weekly') {
        const parts = a.label.replace('Week of ', '').split('-');
        dateA = new Date(parts[2], parts[1] - 1, parts[0]);
        const partsB = b.label.replace('Week of ', '').split('-');
        dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
      } else {
        const parts = a.label.split('-');
        dateA = new Date(parts[2], parts[1] - 1, parts[0]);
        const partsB = b.label.split('-');
        dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
      }
      return dateA - dateB;
    });

    return sorted;
  };

  const enrollmentData = getEnrollmentData();

  // Find this month enrollment count helper
  const getThisMonthAdmissions = () => {
    let count = 0;
    const current = new Date();
    const currentMonth = current.getMonth();
    const currentYear = current.getFullYear();
    students.forEach(s => {
      if (!s.admission_date) return;
      const date = new Date(s.admission_date);
      if (!isNaN(date.getTime()) && date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        count++;
      }
    });
    return count;
  };
  const thisMonthCount = getThisMonthAdmissions();

  const standardDistribution = {};
  students.forEach(s => {
    if (!s.standard) return;
    const std = s.standard.includes('th') ? s.standard : `${s.standard}th`;
    standardDistribution[std] = (standardDistribution[std] || 0) + 1;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome to BrainBridge Tuition Admin Panel.</p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            if (window.confirm("Are you sure you want to reset all local data to default demo values?")) {
              dbService.resetDemoData();
            }
          }}
          style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', border: '1px solid var(--border-color)' }}
        >
          🔄 Reset Demo Data
        </button>
      </div>

      {/* Parent App Due Date Alert Banner */}
      {dueRecordsList.length > 0 && (
        <div className="simulator-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Bell size={20} style={{ animation: 'swing 2s ease infinite' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1e3a8a', margin: 0, fontFamily: 'var(--font-body)' }}>
                Parent Notification Simulator
              </h4>
              <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>
                There are {dueRecordsList.length} student(s) with pending fees. Tap to test how the parent app notification looks.
              </p>
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setActiveSimulatedRecord(dueRecordsList[0]);
              setShowNotificationModal(true);
            }}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff' }}
          >
            📱 Simulate Parent Alert
          </button>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid-cols-4">
        <div className="card stat-card">
          <div>
            <span className="stat-label">Total Students</span>
            <div className="stat-val">{stats.studentsCount}</div>
          </div>
          <div className="stat-icon-wrapper">
            <Users size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div>
            <span className="stat-label">Active Batches</span>
            <div className="stat-val">{stats.batchesCount}</div>
          </div>
          <div className="stat-icon-wrapper secondary">
            <BookOpen size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div>
            <span className="stat-label">Daily Attendance</span>
            <div className="stat-val">{stats.attendanceRate}%</div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginTop: '0.25rem' }}>
              Date: {attendanceDate}
            </span>
          </div>
          <div className="stat-icon-wrapper success">
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div>
            <span className="stat-label">Fees Collected</span>
            <div className="stat-val">₹{stats.collectedFees}</div>
          </div>
          <div className="stat-icon-wrapper warning">
            <IndianRupee size={24} />
          </div>
        </div>
      </div>

      {/* Layout Split: Quick Actions & Recent Transactions */}
      <div className="dashboard-split-layout">
        
        {/* Quick Actions Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Quick Actions</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Frequently accessed management functions.</p>
          
          <div className="quick-actions-grid">
            <button className="btn btn-primary quick-action-btn" onClick={() => setActiveTab('attendance')}>
              <CheckCircle size={24} />
              <span>Mark Attendance</span>
            </button>
            <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('students')} style={{ border: '1px solid var(--border-color)' }}>
              <Users size={24} />
              <span>Register New Student</span>
            </button>
            <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('fees')} style={{ border: '1px solid var(--border-color)' }}>
              <IndianRupee size={24} />
              <span>Collect Monthly Fees</span>
            </button>
            <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('tests')} style={{ border: '1px solid var(--border-color)' }}>
              <FileSpreadsheet size={24} />
              <span>Enter Test Marks</span>
            </button>
          </div>
        </div>

        {/* Recent Payments Log */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem' }}>Recent Payments</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
            {recentPayments.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>No payments logged yet.</p>
            ) : (
              recentPayments.map(p => {
                const isExpanded = expandedPaymentId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`payment-row-interactive ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => setExpandedPaymentId(isExpanded ? null : p.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div className="payment-dot" />
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.92rem', color: isExpanded ? 'var(--primary)' : 'var(--text-primary)', transition: 'color 0.2s ease' }}>
                          {p.studentName}
                        </div>
                        <div className="payment-details-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            Amount Paid: <strong style={{ color: '#10b981', fontSize: '0.78rem' }}>₹{p.amount}</strong>
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Paid via {p.paymentMode} on {p.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Student Enrollment Analytics */}
      <div className="card" style={{ marginTop: '2.5rem' }}>
        
        {/* Header Block */}
        <div className="enrollment-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', fontFamily: 'var(--font-heading)', marginBottom: '0.4rem' }}>📈 Enrollment Analytics</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              Track joining progress using weekly, monthly, and date-wise interactive pie metrics.
            </p>
          </div>
          
          {/* Segment Toggle */}
          <div className="enrollment-toggle" style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
            {['Monthly', 'Weekly', 'Date-wise'].map(mode => (
              <button
                key={mode}
                type="button"
                className="btn"
                onClick={() => setEnrollmentFilter(mode)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: enrollmentFilter === mode ? '#ffffff' : 'transparent',
                  color: enrollmentFilter === mode ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  boxShadow: enrollmentFilter === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'var(--transition-smooth)',
                  cursor: 'pointer'
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Donut Chart & Legends Grid */}
        <div className="analytics-chart-layout">
          
          {/* Left: Custom SVG Donut Chart */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            {/* Soft background radial glow for luxury depth */}
            <div style={{ 
              position: 'absolute', 
              width: '160px', 
              height: '160px', 
              background: 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)',
              zIndex: 0
            }} />
            
            <svg 
              width="220" 
              height="220" 
              viewBox="0 0 120 120" 
              style={{ transform: 'rotate(-90deg)', zIndex: 1 }}
            >
              {/* Placeholder background track */}
              <circle
                cx="60"
                cy="60"
                r="35"
                fill="transparent"
                stroke="rgba(0, 0, 0, 0.03)"
                strokeWidth="10"
              />
              
              {/* Active Segments rendering */}
              {(() => {
                const total = enrollmentData.reduce((sum, d) => sum + d.count, 0);
                const circ = 2 * Math.PI * 35;
                let accumulated = 0;
                
                if (total === 0) {
                  return (
                    <circle
                      cx="60"
                      cy="60"
                      r="35"
                      fill="transparent"
                      stroke="rgba(0,0,0,0.06)"
                      strokeWidth="10"
                    />
                  );
                }

                const luxuryPalette = [
                  '#2563eb', // Royal Blue
                  '#4f46e5', // Indigo Accent
                  '#06b6d4', // Cyan
                  '#d97706', // Amber Gold
                  '#10b981', // Emerald
                  '#f43f5e', // Rose Red
                  '#8b5cf6', // Purple
                  '#64748b'  // Slate Gray
                ];

                return enrollmentData.map((d, index) => {
                  const percent = d.count / total;
                  const strokeLen = percent * circ;
                  const offset = circ - (accumulated * circ);
                  accumulated += percent;

                  return (
                    <circle
                      key={d.label}
                      cx="60"
                      cy="60"
                      r="35"
                      fill="transparent"
                      stroke={luxuryPalette[index % luxuryPalette.length]}
                      strokeWidth="10"
                      strokeDasharray={`${strokeLen} ${circ - strokeLen}`}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                      className="pie-segment"
                    />
                  );
                });
              })()}
            </svg>

            {/* Central Total Indicator Card */}
            <div style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2
            }}>
              <span style={{ 
                fontFamily: 'var(--font-heading)', 
                fontSize: '2.2rem', 
                fontWeight: '800', 
                color: 'var(--text-primary)',
                lineHeight: 1
              }}>
                {enrollmentData.reduce((sum, d) => sum + d.count, 0)}
              </span>
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: '800', 
                color: 'var(--text-secondary)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginTop: '0.35rem'
              }}>
                Admissions
              </span>
            </div>
          </div>

          {/* Right: Legends Detail Ledger List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '0.75rem' }}>
            {(() => {
              const total = enrollmentData.reduce((sum, d) => sum + d.count, 0) || 1;
              const luxuryPalette = [
                '#2563eb', // Royal Blue
                '#4f46e5', // Indigo
                '#06b6d4', // Cyan
                '#d97706', // Amber Gold
                '#10b981', // Emerald
                '#f43f5e', // Rose Red
                '#8b5cf6', // Purple
                '#64748b'  // Slate Gray
              ];

              if (enrollmentData.length === 0) {
                return <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>No data logged.</div>;
              }

              return enrollmentData.map((d, index) => {
                const pct = Math.round((d.count / total) * 100);
                const color = luxuryPalette[index % luxuryPalette.length];

                return (
                  <div 
                    key={d.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(0,0,0,0.01)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      transition: 'var(--transition-smooth)'
                    }}
                    className="legend-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      {/* Colored marker ring */}
                      <div style={{ 
                        width: '10px', 
                        height: '10px', 
                        borderRadius: '50%', 
                        backgroundColor: color,
                        boxShadow: `0 0 8px ${color}`
                      }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {d.label}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-secondary)' }}>
                        {d.count} {d.count === 1 ? 'student' : 'students'}
                      </span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: '800', 
                        backgroundColor: 'rgba(37,99,235,0.05)',
                        color: 'var(--primary)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px'
                      }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

        </div>

      </div>

      {/* Parent App Notification Simulator Modal */}
      {showNotificationModal && activeSimulatedRecord && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px', background: '#0c0f1d', border: '1px solid #1a1e35' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #1a1e35' }}>
              <h3 className="modal-title" style={{ color: '#fff' }}>📱 Parent Mobile Simulator</h3>
              <button className="modal-close" style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.03)', borderColor: '#1a1e35' }} onClick={() => setShowNotificationModal(false)}>Close</button>
            </div>
            
            <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#090714' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                Simulating lockscreen popup notification on Parent's Mobile Phone ({activeSimulatedRecord.parentMobile || 'N/A'}).
              </p>
              
              {/* Simulated iPhone/Android Notification Banner */}
              <div style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: '1.25rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                marginBottom: '2rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: '800' }}>BB</div>
                    <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#fff', letterSpacing: '0.02em' }}>BRAINBRIDGE APP</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>now</span>
                </div>
                <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.25rem', textAlign: 'left' }}>⚠️ Fee Payment Due Date Alert</h4>
                <p style={{ color: '#e2e8f0', fontSize: '0.85rem', lineHeight: '1.4', textAlign: 'left' }}>
                  Dear Parent, the tuition fee of <strong>₹{activeSimulatedRecord.amount}</strong> for <strong>{activeSimulatedRecord.studentName}</strong> is due on <strong>{formatDateDisplay(activeSimulatedRecord.due_date)}</strong>. Please tap here to pay.
                </p>
              </div>

              {/* Simulation Selector if multiple pending records */}
              {dueRecordsList.length > 1 && (
                <div className="form-group" style={{ width: '100%', marginBottom: '1rem', textAlign: 'left' }}>
                  <label className="form-label" style={{ color: '#94a3b8' }}>Select Another Student to Simulate</label>
                  <select 
                    className="form-control" 
                    style={{ background: '#120e24', borderColor: '#241e45', color: '#fff' }}
                    value={activeSimulatedRecord.id}
                    onChange={(e) => {
                      const rec = dueRecordsList.find(r => r.id === e.target.value);
                      if (rec) setActiveSimulatedRecord(rec);
                    }}
                  >
                    {dueRecordsList.map(r => (
                      <option key={r.id} value={r.id}>{r.studentName} (Due: {formatDateDisplay(r.due_date)})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #1a1e35', background: '#0c0f1d' }}>
              <button className="btn btn-secondary" style={{ color: '#fff', borderColor: '#1e293b' }} onClick={() => setShowNotificationModal(false)}>
                Dismiss
              </button>
              <button className="btn btn-primary" onClick={() => {
                alert(`WhatsApp Reminder Sent to: ${activeSimulatedRecord.parentMobile}`);
                setShowNotificationModal(false);
              }}>
                Trigger WhatsApp Reminder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parent Testimonials Section */}
      <div style={{ marginTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>✨ Parent Testimonials</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
              Feedback and appreciation received from parents regarding their child's academic progress.
            </p>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowAddTestimonialModal(true)}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border-color)' }}
          >
            <Plus size={16} /> Add Testimonial
          </button>
        </div>

        <div className="testimonials-grid">
          {testimonials.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
              No testimonials added yet. Click "Add Testimonial" to write one!
            </div>
          ) : (
            testimonials.map(tst => (
              <div 
                key={tst.id} 
                className="card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  position: 'relative', 
                  padding: '1.75rem',
                  background: 'var(--bg-card)',
                  overflow: 'hidden'
                }}
              >
                {/* Quote Icon overlay */}
                <div style={{ position: 'absolute', top: '1rem', right: '1.25rem', opacity: 0.08, color: 'var(--primary)' }}>
                  <Quote size={56} style={{ transform: 'rotate(180deg)' }} />
                </div>

                <div>
                  {/* Star Ratings */}
                  <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.85rem' }}>
                    {Array.from({ length: tst.rating }).map((_, i) => (
                      <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />
                    ))}
                  </div>

                  {/* Feedback text */}
                  <p style={{ 
                    fontStyle: 'italic', 
                    color: 'var(--text-primary)', 
                    fontSize: '0.92rem', 
                    lineHeight: '1.6',
                    marginBottom: '1.25rem',
                    fontFamily: 'var(--font-body)'
                  }}>
                    "{tst.feedback}"
                  </p>
                </div>

                {/* Parent Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.9rem'
                  }}>
                    {tst.parent_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h5 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                      {tst.parent_name}
                    </h5>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                      Parent of {tst.student_name || 'Student'} • {formatDateDisplay(tst.date)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Testimonial Modal */}
      {showAddTestimonialModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Write Parent Testimonial</h3>
              <button className="modal-close" onClick={() => setShowAddTestimonialModal(false)}>Close</button>
            </div>
            <form onSubmit={handleAddTestimonialSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Parent Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ramesh Patel"
                    value={newTestimonial.parent_name}
                    onChange={(e) => setNewTestimonial(prev => ({ ...prev, parent_name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Student Name (Reference)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Priyanshu Patel"
                    value={newTestimonial.student_name}
                    onChange={(e) => setNewTestimonial(prev => ({ ...prev, student_name: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rating *</label>
                  <select
                    className="form-control"
                    value={newTestimonial.rating}
                    onChange={(e) => setNewTestimonial(prev => ({ ...prev, rating: Number(e.target.value) }))}
                  >
                    <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
                    <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
                    <option value="3">⭐⭐⭐ (3 Stars)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Testimonial Feedback *</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Write parent feedback details here..."
                    value={newTestimonial.feedback}
                    onChange={(e) => setNewTestimonial(prev => ({ ...prev, feedback: e.target.value }))}
                    required
                    style={{ resize: 'none', minHeight: '100px', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTestimonialModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Testimonial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
