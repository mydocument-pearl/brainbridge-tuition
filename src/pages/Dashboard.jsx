import React, { useEffect, useState } from 'react';
import { dbService, formatDateDisplay, sendWhatsAppMessage } from '../database/dbService';
import { Users, BookOpen, CheckCircle, IndianRupee, Bell, Play, FileSpreadsheet, Star, Quote, Plus, Calendar, ClipboardList, Download, ChevronDown, X, AlertCircle } from 'lucide-react';

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDateDisplay(timestamp.split('T')[0]);
};

export default function Dashboard({ setActiveTab, currentUser, verifyAction, activeTenant }) {
  const isSubAdmin = import.meta.env.VITE_ROLE === 'admin2' || sessionStorage.getItem('bb_current_admin') === 'admin2';
  const [stats, setStats] = useState({
    studentsCount: 0,
    batchesCount: 0,
    attendanceRate: 0,
    collectedFees: 0,
    pendingFees: 0,
    latestTestScore: '-',
    batchName: '-'
  });
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentHomework, setRecentHomework] = useState([]);
  const [recentMaterials, setRecentMaterials] = useState([]);
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
  const [parentAttendanceLogs, setParentAttendanceLogs] = useState([]);
  const [parentNotifications, setParentNotifications] = useState([]);

  useEffect(() => {
    const handleCloseModals = () => {
      setShowNotificationModal(false);
      setShowAddTestimonialModal(false);
    };
    document.addEventListener('close-modals', handleCloseModals);
    return () => document.removeEventListener('close-modals', handleCloseModals);
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        if (currentUser?.role === 'parent') {
          const studentId = currentUser.studentId;
          const batchId = currentUser.batchId;

          const [batches, fees, allAttendance, testMarks, tests, homework, materials, notifications] = await Promise.all([
            dbService.getBatches(),
            dbService.getFees(),
            dbService.getAllAttendance(),
            dbService.getAllTestMarks(),
            dbService.getTests(),
            dbService.getHomework(),
            dbService.getStudyMaterials(),
            dbService.getNotifications()
          ]);

          // Student's specific batch name
          const parentBatch = batches.find(b => b.id === batchId);
          const batchName = parentBatch ? parentBatch.name : 'N/A';

          // Individual Fee Stats
          const studentFees = fees.filter(f => f.student_id === studentId);
          let collected = 0;
          let pending = 0;
          let pendingDueAlert = null;
          
          studentFees.forEach(f => {
            if (f.status === 'Paid') {
              collected += f.amount;
            } else {
              pending += f.amount;
              pendingDueAlert = f;
            }
          });

          // Individual Attendance Stats
          const studentAttendance = allAttendance.filter(a => a.student_id === studentId);
          const presentCount = studentAttendance.filter(a => a.status === 'Present').length;
          const attRate = studentAttendance.length > 0 ? Math.round((presentCount / studentAttendance.length) * 100) : 0;

          // Latest 5 attendance records sorted desc
          const sortedAttendance = [...studentAttendance].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
          setParentAttendanceLogs(sortedAttendance);

          // Notifications filtered and sorted desc
          const studentNotifications = notifications.filter(n => n.student_id === studentId);
          const sortedNotifications = [...studentNotifications].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
          setParentNotifications(sortedNotifications);

          // Individual Test Marks
          const studentMarks = testMarks.filter(tm => tm.student_id === studentId);
          let latestScoreDisplay = '-';
          if (studentMarks.length > 0) {
            // Find latest mark based on test date
            const marksWithTests = studentMarks.map(sm => {
              const test = tests.find(t => t.id === sm.test_id);
              return { ...sm, test };
            }).filter(x => x.test);
            
            if (marksWithTests.length > 0) {
              marksWithTests.sort((a, b) => new Date(b.test.test_date) - new Date(a.test.test_date));
              const latest = marksWithTests[0];
              latestScoreDisplay = `${latest.marks_obtained} / ${latest.test.max_marks} (${latest.test.test_name})`;
            }
          }

          // Homework & Materials for batch
          const batchHomework = homework.filter(h => h.batch_id === batchId);
          const batchMaterials = materials.filter(m => m.batch_id === batchId);

          setStats({
            studentsCount: 0,
            batchesCount: 0,
            attendanceRate: attRate,
            collectedFees: collected,
            pendingFees: pending,
            latestTestScore: latestScoreDisplay,
            batchName: batchName
          });

          setRecentHomework(batchHomework.slice(0, 3));
          setRecentMaterials(batchMaterials.slice(0, 3));
          setDueRecordsList(pendingDueAlert ? [pendingDueAlert] : []);

        } else {
          // Admin Loading
          const [students, batches, fees, tstList, latestAttDate] = await Promise.all([
            dbService.getStudents(),
            dbService.getBatches(),
            dbService.getFees(),
            dbService.getTestimonials(),
            dbService.getLatestAttendanceDate()
          ]);

          setStudents(students);
          setTestimonials(tstList);
          
          const studentsCount = students.length;
          const batchesCount = batches.length;
          
          let collected = 0;
          let pending = 0;
          fees.forEach(f => {
            if (f.status === 'Paid') collected += f.amount;
            else pending += f.amount;
          });

          let attDate = latestAttDate || '2026-06-05';
          let attendanceLogs = await dbService.getAttendance(attDate);
          
          const presentCount = attendanceLogs.filter(a => a.status === 'Present').length;
          const rate = attendanceLogs.length > 0 ? Math.round((presentCount / attendanceLogs.length) * 100) : 0;
          setAttendanceDate(formatDateDisplay(attDate));

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
            pendingFees: pending,
            latestTestScore: '-',
            batchName: '-'
          });
          setRecentPayments(paidFees);

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

    const action = async () => {
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

    if (verifyAction) {
      verifyAction(action);
    } else {
      await action();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard analytics...</p>
      </div>
    );
  }

  const hasCustomLogo = activeTenant && activeTenant.logo_url && activeTenant.logo_url !== '' && activeTenant.logo_url !== '/logo.png';
  const brandName = activeTenant ? activeTenant.name : "EduBridge – Tuition ERP";

  if (currentUser?.role === 'parent') {
    const isFeatureEnabled = (key) => {
      if (!activeTenant || !activeTenant.features) return true;
      return activeTenant.features[key] !== false;
    };

    return (
      <div className="fade-in">
        {/* Parent Header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {hasCustomLogo ? (
              <img 
                src={activeTenant.logo_url} 
                alt="Tuition Logo" 
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  objectFit: 'contain',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
                }}
              />
            ) : (activeTenant && activeTenant.use_black_logo_fallback === false) ? (
              <img 
                src="/logo.png" 
                alt="Tuition Logo" 
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  objectFit: 'contain',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
                }}
              />
            ) : (
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#000000',
                border: '1px solid #bfdbfe',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
              }} />
            )}
            <div>
              <h1 className="page-title">Home</h1>
              <p className="page-subtitle">Welcome Parent of <strong>{currentUser.username}</strong>.</p>
            </div>
          </div>
        </div>

        {/* Due Fee Alert Banner */}
        {isFeatureEnabled('db_fees') && stats.pendingFees > 0 && (
          <div className="simulator-banner" style={{ borderLeft: '4px solid #ef4444', backgroundColor: '#fef2f2', color: '#991b1b', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}>
                <Bell size={20} style={{ animation: 'swing 2s ease infinite' }} />
              </div>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#991b1b', margin: 0 }}>
                  Fee Payment Outstanding
                </h4>
                <p style={{ margin: '0.1rem 0 0', fontSize: '0.88rem', color: '#b91c1c' }}>
                  A fee payment of <strong>₹{stats.pendingFees}</strong> is outstanding. Please make the payment soon.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid-cols-4" style={{ marginBottom: '2.5rem' }}>
          <div className="card stat-card">
            <div>
              <span className="stat-label">Batch Name</span>
              <div className="stat-val" style={{ fontSize: '1.35rem', marginTop: '0.4rem', color: '#1e3a8a', fontWeight: '800' }}>
                {stats.batchName}
              </div>
            </div>
            <div className="stat-icon-wrapper">
              <BookOpen size={24} />
            </div>
          </div>

          {isFeatureEnabled('db_attendance') && (
            <div className="card stat-card">
              <div>
                <span className="stat-label">Attendance Rate</span>
                <div className="stat-val">{stats.attendanceRate}%</div>
              </div>
              <div className="stat-icon-wrapper success">
                <CheckCircle size={24} />
              </div>
            </div>
          )}

          {isFeatureEnabled('db_fees') && (
            <div className="card stat-card">
              <div>
                <span className="stat-label">Fees Paid</span>
                <div className="stat-val" style={{ color: '#059669' }}>₹{stats.collectedFees}</div>
              </div>
              <div className="stat-icon-wrapper success" style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>
                <IndianRupee size={24} />
              </div>
            </div>
          )}

          {isFeatureEnabled('db_tests') && (
            <div className="card stat-card" style={{ gridColumn: 'span 1' }}>
              <div>
                <span className="stat-label">Latest Test Score</span>
                <div className="stat-val" style={{ fontSize: '1.15rem', color: '#d97706', marginTop: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={stats.latestTestScore}>
                  {stats.latestTestScore}
                </div>
              </div>
              <div className="stat-icon-wrapper warning">
                <FileSpreadsheet size={24} />
              </div>
            </div>
          )}
        </div>

        {/* Quick Links Split Grid */}
        <div className="dashboard-split-layout">
          {/* Quick Access */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Quick Access</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Direct links to check academic activities.</p>
            
            <div className="quick-actions-grid">
              {isFeatureEnabled('timetable') && (
                <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('timetable')} style={{ border: '1px solid var(--border-color)' }}>
                  <Calendar size={24} />
                  <span>Class Timetable</span>
                </button>
              )}
              {isFeatureEnabled('attendance') && (
                <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('attendance')} style={{ border: '1px solid var(--border-color)' }}>
                  <CheckCircle size={24} />
                  <span>Attendance History</span>
                </button>
              )}
              {isFeatureEnabled('homework') && (
                <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('homework')} style={{ border: '1px solid var(--border-color)' }}>
                  <ClipboardList size={24} />
                  <span>Homework Assignments</span>
                </button>
              )}
              {isFeatureEnabled('materials') && (
                <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('materials')} style={{ border: '1px solid var(--border-color)' }}>
                  <Download size={24} />
                  <span>Study Materials</span>
                </button>
              )}
              {isFeatureEnabled('fees') && (
                <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('fees')} style={{ border: '1px solid var(--border-color)' }}>
                  <IndianRupee size={24} />
                  <span>Fee Ledger</span>
                </button>
              )}
              {isFeatureEnabled('tests') && (
                <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('tests')} style={{ border: '1px solid var(--border-color)' }}>
                  <FileSpreadsheet size={24} />
                  <span>Test Scores</span>
                </button>
              )}
            </div>
          </div>

          {/* Academic Updates Timeline */}
          {(isFeatureEnabled('db_homework') || isFeatureEnabled('db_materials')) && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Latest Updates</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
                
                {/* Homework */}
                {isFeatureEnabled('db_homework') && (
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <ClipboardList size={16} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#1e3a8a' }}>Active Homework</span>
                    </div>
                    {recentHomework && recentHomework.length > 0 ? (
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span>{recentHomework[0].title}</span>
                          {recentHomework[0].standard && (
                            <span style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: '800', 
                              backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                              color: '#d97706', 
                              padding: '0.15rem 0.4rem', 
                              borderRadius: '4px' 
                            }}>
                              Std: {recentHomework[0].standard}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '0.2rem', fontWeight: '700' }}>
                          Due Date: {formatDateDisplay(recentHomework[0].due_date)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No active homework assigned.</span>
                    )}
                  </div>
                )}

                {/* Study Material */}
                {isFeatureEnabled('db_materials') && (
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Download size={16} style={{ color: '#059669' }} />
                      <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#1e3a8a' }}>Latest Study Resource</span>
                    </div>
                    {recentMaterials && recentMaterials.length > 0 ? (
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {recentMaterials[0].title}
                        </div>
                        <button 
                          onClick={() => window.open(recentMaterials[0].file_url, '_blank')}
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', marginTop: '0.4rem', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Download size={12} /> Download
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No study materials posted.</span>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

        {/* Daily Attendance and Notifications Feed */}
        <div className="dashboard-split-layout" style={{ marginTop: '2rem' }}>
          {/* Daily Attendance Tracker */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Daily Attendance Tracker</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Date-wise present or absent record timeline.
                </p>
              </div>
              <Calendar size={20} style={{ color: 'var(--primary)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
              {parentAttendanceLogs && parentAttendanceLogs.length > 0 ? (
                parentAttendanceLogs.map(log => {
                  const isPresent = log.status === 'Present';
                  return (
                    <div 
                      key={log.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.85rem 1rem', 
                        backgroundColor: '#f8fafc', 
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>📅</span>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {formatDateDisplay(log.date)}
                        </span>
                      </div>
                      <span 
                        style={{
                          backgroundColor: isPresent ? '#d1fae5' : '#fee2e2',
                          color: isPresent ? '#065f46' : '#991b1b',
                          padding: '0.35rem 0.85rem',
                          fontWeight: '800',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          border: isPresent ? '1px solid #a7f3d0' : '1px solid #fecaca'
                        }}
                      >
                        {isPresent ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  No attendance logs found yet.
                </div>
              )}
            </div>
            
            {parentAttendanceLogs && parentAttendanceLogs.length > 0 && (
              <button 
                onClick={() => setActiveTab('attendance')} 
                className="btn btn-secondary" 
                style={{ 
                  width: '100%', 
                  padding: '0.65rem', 
                  fontSize: '0.85rem', 
                  fontWeight: '700', 
                  border: '1px solid var(--border-color)',
                  marginTop: '0.5rem'
                }}
              >
                View Full Attendance Report
              </button>
            )}
          </div>

          {/* Notifications Alerts Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Recent Notifications</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Alerts and broadcast messages.
                </p>
              </div>
              <Bell size={20} style={{ color: '#d97706' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
              {parentNotifications && parentNotifications.length > 0 ? (
                parentNotifications.map(notif => {
                  let IconComponent = Bell;
                  let iconBg = '#fef3c7';
                  let iconColor = '#d97706';
                  
                  if (notif.type === 'attendance') {
                    if (notif.title.includes('Present')) {
                      IconComponent = CheckCircle;
                      iconBg = '#d1fae5';
                      iconColor = '#059669';
                    } else {
                      IconComponent = X;
                      iconBg = '#fee2e2';
                      iconColor = '#dc2626';
                    }
                  } else if (notif.type === 'fee' || notif.title.toLowerCase().includes('fee')) {
                    IconComponent = IndianRupee;
                    iconBg = '#e0f2fe';
                    iconColor = '#0284c7';
                  }

                  return (
                    <div 
                      key={notif.id} 
                      style={{ 
                        display: 'flex', 
                        gap: '0.75rem', 
                        padding: '1rem', 
                        backgroundColor: '#f8fafc', 
                        borderRadius: '12px', 
                        border: '1px solid #e2e8f0',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div 
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: iconBg,
                          color: iconColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <IconComponent size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {notif.title}
                          </h4>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                            {formatRelativeTime(notif.timestamp)}
                          </span>
                        </div>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  No recent notifications.
                </div>
              )}
            </div>
          </div>
        </div>
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

  const isFeatureEnabled = (key) => {
    if (currentUser?.role === 'superadmin') return true;
    if (!activeTenant || !activeTenant.features) return true;
    
    if (key.startsWith('db_') || key === 'fee_reminder') {
      const isStaff = currentUser?.role === 'admin' && !!currentUser.staffId;
      const rolePrefix = isStaff ? 'staff_' : 'owner_';
      const roleKey = rolePrefix + key;
      
      if (activeTenant.features[roleKey] !== undefined) {
        return activeTenant.features[roleKey];
      }
      
      if (isStaff) {
        if (key === 'db_fees' || key === 'fee_reminder' || key === 'db_analytics') return false;
        return activeTenant.features[key] !== false;
      } else {
        return activeTenant.features[key] !== false;
      }
    }
    
    return activeTenant.features[key] !== false;
  };

  const headerTitle = currentUser?.role === 'superadmin'
    ? 'Master admin'
    : (currentUser?.role === 'admin')
      ? (currentUser.staffId ? currentUser.username : (activeTenant?.custom_owner_title || 'Owner admin')) 
      : 'Home';

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {currentUser?.role === 'superadmin' ? (
            <img 
              src="/logo.png" 
              alt="EduBridge Logo" 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                objectFit: 'contain',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
              }}
            />
          ) : hasCustomLogo ? (
            <img 
              src={activeTenant.logo_url} 
              alt="Tuition Logo" 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                objectFit: 'contain',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
              }}
            />
          ) : (activeTenant && activeTenant.use_black_logo_fallback === false) ? (
            <img 
              src="/logo.png" 
              alt="Tuition Logo" 
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                objectFit: 'contain',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
              }}
            />
          ) : (
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#000000',
              border: '1px solid #bfdbfe',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
            }} />
          )}
          <div>
            <h1 className="page-title">{headerTitle}</h1>
            <p className="page-subtitle">
              {currentUser?.role === 'superadmin'
                ? 'Welcome to super admin panel'
                : currentUser?.staffId 
                  ? (activeTenant?.custom_teacher_subtitle || 'Welcome to tuition management system') 
                  : 'Welcome to Admin panel'}
            </p>
          </div>
        </div>
      </div>

      {/* Parent App Due Date Alert Banner */}
      {isFeatureEnabled('fee_reminder') && dueRecordsList.length > 0 && (
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

        {isFeatureEnabled('db_attendance') && (
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
        )}

        {isFeatureEnabled('db_fees') && (
          <div className="card stat-card">
            <div>
              <span className="stat-label">Fees Collected</span>
              <div className="stat-val">₹{stats.collectedFees}</div>
            </div>
            <div className="stat-icon-wrapper warning">
              <IndianRupee size={24} />
            </div>
          </div>
        )}
      </div>

      {/* Layout Split: Quick Actions & Recent Transactions */}
      <div className="dashboard-split-layout">
        
        {/* Quick Actions Panel */}
        {(isFeatureEnabled('attendance') || isFeatureEnabled('students') || isFeatureEnabled('fees') || isFeatureEnabled('tests')) && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Quick Actions</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Frequently accessed management functions.</p>
            
            <div className="quick-actions-grid">
              {isFeatureEnabled('attendance') && (
                <button className="btn btn-primary quick-action-btn" onClick={() => setActiveTab('attendance')}>
                  <CheckCircle size={24} />
                  <span>Mark Attendance</span>
                </button>
              )}
              {isFeatureEnabled('students') && (
                <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('students_register')} style={{ border: '1px solid var(--border-color)' }}>
                  <Users size={24} />
                  <span>Register New Student</span>
                </button>
              )}
              {isFeatureEnabled('fees') && (
                <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('fees')} style={{ border: '1px solid var(--border-color)' }}>
                  <IndianRupee size={24} />
                  <span>Collect Monthly Fees</span>
                </button>
              )}
              {isFeatureEnabled('tests') && (
                <button className="btn btn-secondary quick-action-btn" onClick={() => setActiveTab('tests')} style={{ border: '1px solid var(--border-color)' }}>
                  <FileSpreadsheet size={24} />
                  <span>Enter Test Marks</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Recent Payments Log */}
        {isFeatureEnabled('db_fees') && (
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
                      <ChevronDown
                        size={16}
                        style={{
                          color: 'var(--text-muted)',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                          flexShrink: 0
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

         {/* Student Enrollment Analytics */}
      {isFeatureEnabled('db_analytics') && (
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
      )}

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
                    <div style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: '800' }}>EB</div>
                    <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#fff', letterSpacing: '0.02em' }}>EDUBRIDGE APP</span>
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
                if (activeSimulatedRecord) {
                  const message = `Dear Parent, this is a reminder from EduBridge – Tuition ERP that the fee of ₹${activeSimulatedRecord.amount} for ${activeSimulatedRecord.studentName} is due. Please pay as soon as possible. Thank you.`;
                  sendWhatsAppMessage(activeSimulatedRecord.parentMobile, message);
                }
                setShowNotificationModal(false);
              }}>
                Trigger WhatsApp Reminder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parent Testimonials Section */}
      {isFeatureEnabled('db_testimonials') && (
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
      )}

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
