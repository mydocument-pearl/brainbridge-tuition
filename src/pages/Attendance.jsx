import React, { useState, useEffect } from 'react';
import { dbService, formatDateDisplay, sendWhatsAppMessage } from '../database/dbService';
import { Calendar, Save, Check, X, CheckSquare, Square, Eye, MessageCircle } from 'lucide-react';

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

export default function Attendance({ currentUser, verifyAction }) {
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // student_id -> 'Present'/'Absent'
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  // Lock status and Edit logs state
  const [now, setNow] = useState(Date.now());
  const [isLocked, setIsLocked] = useState(false);
  const [creationTime, setCreationTime] = useState(null);
  const [editLogs, setEditLogs] = useState([]);

  // Sub Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState('mark'); // 'mark' or 'history'
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [parentLogs, setParentLogs] = useState([]);
  const [parentLoading, setParentLoading] = useState(true);

  // Keep now updated for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Update lock status dynamically when clock ticks
  useEffect(() => {
    if (creationTime) {
      const elapsed = now - creationTime.getTime();
      setIsLocked(elapsed > 30 * 60 * 1000);
    } else {
      const todayStr = getLocalDateString();
      if (selectedDate && selectedDate < todayStr) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    }
  }, [now, creationTime, selectedDate]);

  useEffect(() => {
    if (currentUser?.role !== 'parent') return;
    async function loadParentAttendance() {
      try {
        setParentLoading(true);
        const allLogs = await dbService.getAllAttendance();
        const logs = allLogs
          .filter(a => a.student_id === currentUser.studentId)
          .sort((a, b) => b.date.localeCompare(a.date));
        setParentLogs(logs);
      } catch (err) {
        console.error("Failed to load parent attendance:", err);
      } finally {
        setParentLoading(false);
      }
    }
    loadParentAttendance();
  }, [currentUser]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const batchList = await dbService.getBatches();
        setBatches(batchList);
        if (batchList.length > 0) {
          setSelectedBatch(batchList[0].id);
        }
      } catch (err) {
        console.error("Failed to load batches:", err);
      }
    }
    loadInitialData();
  }, []);

  const loadBatchAttendance = async () => {
    if (!selectedBatch) return;
    try {
      setLoading(true);
      setSaveSuccess(false);
      
      // Load all students, attendance, and edit logs for the date in parallel
      const [allStudents, dateLogs, editLogsList] = await Promise.all([
        dbService.getStudents(),
        dbService.getAttendance(selectedDate),
        dbService.getAttendanceEditLogs(selectedDate, selectedBatch)
      ]);
      
      // Filter and sort students belonging to this batch alphabetically
      const batchStudents = allStudents
        .filter(s => s.batch_id === selectedBatch)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
      setStudents(batchStudents);

      // Map existing attendance log or default to 'Present'
      const attendanceMap = {};
      batchStudents.forEach(student => {
        const log = dateLogs.find(l => l.student_id === student.id);
        attendanceMap[student.id] = log ? log.status : 'Present'; // default to Present
      });
      setAttendance(attendanceMap);
      setEditLogs(editLogsList || []);

      // Calculate lock status
      const batchRecords = dateLogs.filter(log => batchStudents.some(s => s.id === log.student_id));
      if (batchRecords.length > 0) {
        const createdAtTimes = batchRecords
          .filter(r => r.createdAt)
          .map(r => new Date(r.createdAt).getTime());
        
        if (createdAtTimes.length > 0) {
          const oldestTime = Math.min(...createdAtTimes);
          const cTime = new Date(oldestTime);
          setCreationTime(cTime);
          const elapsed = Date.now() - oldestTime;
          setIsLocked(elapsed > 30 * 60 * 1000);
        } else {
          // Legacy records
          const todayStr = getLocalDateString();
          setCreationTime(null);
          if (selectedDate < todayStr) {
            setIsLocked(true);
          } else {
            setIsLocked(false);
          }
        }
      } else {
        setIsLocked(false);
        setCreationTime(null);
      }
    } catch (err) {
      console.error("Failed to load attendance logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatchAttendance();
  }, [selectedBatch, selectedDate]);

  // Fetch all history records when tab changes to 'history'
  useEffect(() => {
    if (activeSubTab !== 'history') return;

    async function loadHistory() {
      try {
        setHistoryLoading(true);
        const [allLogs, allStudents, allBatches] = await Promise.all([
          dbService.getAllAttendance(),
          dbService.getStudents(),
          dbService.getBatches()
        ]);

        const groups = {};
        allLogs.forEach(log => {
          const student = allStudents.find(s => s.id === log.student_id);
          if (!student) return;
          const batchId = student.batch_id;
          const key = `${log.date}_${batchId}`;
          if (!groups[key]) {
            groups[key] = {
              date: log.date,
              batchId: batchId,
              present: 0,
              absent: 0,
              total: 0
            };
          }
          groups[key].total++;
          if (log.status === 'Present') groups[key].present++;
          else groups[key].absent++;
        });

        const historyList = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
        setHistoryLogs(historyList);
      } catch (err) {
        console.error("Failed to load attendance history logs:", err);
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, [activeSubTab]);

  const toggleAttendance = (studentId) => {
    if (isLocked) return;
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'Present' ? 'Absent' : 'Present'
    }));
  };

  const setAllStatus = (status) => {
    if (isLocked) return;
    const updated = {};
    students.forEach(s => {
      updated[s.id] = status;
    });
    setAttendance(updated);
  };

  const handleSave = async () => {
    if (isLocked) {
      alert("Attendance is locked. Edits are not allowed after 30 minutes.");
      return;
    }
    if (!window.confirm("Are you sure you want to save?")) return;
    const action = async () => {
      try {
        setSaving(true);
        setSaveSuccess(false);
        
        const records = Object.keys(attendance).map(studentId => ({
          student_id: studentId,
          status: attendance[studentId]
        }));

        await dbService.saveAttendance(selectedDate, records, {
          batchId: selectedBatch,
          editedBy: currentUser?.username || currentUser?.email || 'Admin',
          studentsInfo: students
        });

        // Send notifications for each student in parallel
        const notifPromises = records.map(record => {
          const student = students.find(s => s.id === record.student_id);
          if (student) {
            const isPresent = record.status === 'Present';
            const title = isPresent ? '✅ Attendance Marked: Present' : '❌ Attendance Marked: Absent';
            const message = `Your child ${student.name} has been marked ${record.status.toUpperCase()} today (${formatDateDisplay(selectedDate)}).`;
            return dbService.addNotification(student.id, 'attendance', title, message);
          }
          return Promise.resolve();
        });
        await Promise.all(notifPromises);

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        // Reload to update lock status and edit logs
        await loadBatchAttendance();
      } catch (err) {
        console.error("Failed to save attendance:", err);
        alert(err.message || "Error saving attendance records.");
      } finally {
        setSaving(false);
      }
    };

    if (verifyAction) {
      verifyAction(action);
    } else {
      await action();
    }
  };

  const handleViewRegister = (date, batchId) => {
    setSelectedDate(date);
    setSelectedBatch(batchId);
    setActiveSubTab('mark');
  };

  const getBatchName = (batchId) => {
    const batch = batches.find(b => b.id === batchId);
    return batch ? batch.name : 'Unknown Batch';
  };

  if (currentUser?.role === 'parent') {
    return (
      <div className="fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Attendance History</h1>
            <p className="page-subtitle">Track your child's present and absent record timeline.</p>
          </div>
        </div>

        {parentLoading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading attendance logs...</div>
        ) : parentLogs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px dashed var(--border-color)' }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No attendance records found yet.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Overall Attendance Rate:</span>
                <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)', margin: '0.25rem 0 0' }}>
                  {parentLogs.length > 0 ? Math.round((parentLogs.filter(l => l.status === 'Present').length / parentLogs.length) * 100) : 100}%
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: '#059669', fontWeight: '700' }}>Present:</span> {parentLogs.filter(l => l.status === 'Present').length} days
                </div>
                <div>
                  <span style={{ color: '#ef4444', fontWeight: '700' }}>Absent:</span> {parentLogs.filter(l => l.status === 'Absent').length} days
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {parentLogs.map(log => {
                const isPresent = log.status === 'Present';
                return (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatDateDisplay(log.date)}</span>
                    </div>
                    <span className={`badge ${isPresent ? 'success' : 'danger'}`} style={{
                      backgroundColor: isPresent ? '#d1fae5' : '#fee2e2',
                      color: isPresent ? '#065f46' : '#991b1b',
                      padding: '0.3rem 0.75rem',
                      fontWeight: '800',
                      borderRadius: '20px',
                      fontSize: '0.8rem'
                    }}>
                      {log.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const getLockMessage = () => {
    if (isLocked) {
      return {
        type: 'danger',
        text: `Locked - Created more than 30 minutes ago. Attendance records cannot be edited.`,
        icon: <X size={18} />
      };
    }
    if (creationTime) {
      const elapsedMins = Math.floor((now - creationTime.getTime()) / 60000);
      const remainingMins = 30 - elapsedMins;
      if (remainingMins > 0) {
        return {
          type: 'warning',
          text: `Editable for another ${remainingMins} minute${remainingMins !== 1 ? 's' : ''} (Created ${elapsedMins} minute${elapsedMins !== 1 ? 's' : ''} ago).`,
          icon: <Calendar size={18} />
        };
      } else {
        return {
          type: 'danger',
          text: `Locked - Created more than 30 minutes ago. Attendance records cannot be edited.`,
          icon: <X size={18} />
        };
      }
    }
    return {
      type: 'info',
      text: 'Attendance not marked yet. Changes can be made within 30 minutes after saving.',
      icon: <Calendar size={18} />
    };
  };

  const lockMsg = getLockMessage();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Register</h1>
          <p className="page-subtitle">Mark daily student attendance, track absentees and review history logs.</p>
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', gap: '2rem' }}>
        <button 
          onClick={() => setActiveSubTab('mark')} 
          style={{
            padding: '0.85rem 0.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'mark' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'mark' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: '800',
            fontSize: '0.98rem',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            marginBottom: '-2px',
            fontFamily: 'var(--font-body)'
          }}
        >
          Mark Daily Attendance
        </button>
        <button 
          onClick={() => setActiveSubTab('history')} 
          style={{
            padding: '0.85rem 0.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'history' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: '800',
            fontSize: '0.98rem',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            marginBottom: '-2px',
            fontFamily: 'var(--font-body)'
          }}
        >
          Attendance History & Logs
        </button>
      </div>

      {activeSubTab === 'mark' ? (
        /* MARK ATTENDANCE VIEW */
        <>
          {/* Selector Options */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                <label className="form-label">Select Batch</label>
                <select
                  className="form-control"
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.subject})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                <label className="form-label">Attendance Date</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    className="form-control"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{ paddingRight: '2.5rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={() => setAllStatus('Present')} disabled={students.length === 0 || loading || isLocked}>
                  Mark All Present
                </button>
                <button className="btn btn-secondary" onClick={() => setAllStatus('Absent')} disabled={students.length === 0 || loading || isLocked}>
                  Mark All Absent
                </button>
              </div>
            </div>
          </div>

          {/* Warning Banner */}
          {lockMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${
                lockMsg.type === 'danger' ? 'var(--danger-border)' : 
                lockMsg.type === 'warning' ? 'var(--warning-border)' : 'rgba(37, 99, 235, 0.2)'
              }`,
              backgroundColor: `${
                lockMsg.type === 'danger' ? 'var(--danger-bg)' : 
                lockMsg.type === 'warning' ? 'var(--warning-bg)' : 'rgba(37, 99, 235, 0.05)'
              }`,
              color: `${
                lockMsg.type === 'danger' ? 'var(--danger)' : 
                lockMsg.type === 'warning' ? 'var(--warning)' : 'var(--primary)'
              }`,
              fontWeight: '600',
              fontSize: '0.9rem',
              marginBottom: '1.5rem',
              boxShadow: 'var(--shadow-premium)'
            }}>
              {lockMsg.icon}
              <span>{lockMsg.text}</span>
            </div>
          )}

          {/* Attendance Register Board */}
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading student records...</div>
          ) : students.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No students registered in this batch yet. Assign students to this batch in the Students directory.
            </div>
          ) : (
            <div className="table-container">
              <div className="table-header-row">
                <h4 style={{ fontSize: '1.1rem' }}>Roll List: {students.length} Students</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {saveSuccess && (
                    <span style={{ color: 'var(--success)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '600' }}>
                      <Check size={16} /> Saved Successfully
                    </span>
                  )}
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving || isLocked}>
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save Attendance'}</span>
                  </button>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Standard</th>
                    <th style={{ textAlign: 'center', width: '200px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const status = attendance[student.id] || 'Present';
                    const isPresent = status === 'Present';
                    const isExpanded = expandedStudentId === student.id;

                    return (
                      <tr key={student.id}>
                        <td data-label="Student Name">
                          <div 
                            style={{ fontWeight: '600', cursor: 'pointer', color: 'var(--primary)', display: 'inline-block' }}
                            onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                          >
                            {student.name}
                          </div>
                          <div className={`attendance-details-container ${isExpanded ? 'expanded' : ''}`} style={{ 
                            height: isExpanded ? 'auto' : '0', 
                            opacity: isExpanded ? '1' : '0',
                            overflow: 'hidden',
                            transition: 'all 0.25s ease'
                          }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                              <span>📞 Parent Mobile: {student.parent_mobile || 'N/A'}</span>
                              {student.parent_mobile && student.parent_mobile !== 'N/A' && !isPresent && (
                                <button 
                                  onClick={() => {
                                    const batchName = getBatchName(student.batch_id);
                                    const message = `Dear Parent, this is to inform you that your child ${student.name} was ABSENT today (${formatDateDisplay(selectedDate)}) in the ${batchName} class. Please ensure they attend regularly. Thank you, EduBridge – Tuition ERP.`;
                                    sendWhatsAppMessage(student.parent_mobile, message);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#25d366',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    padding: 0
                                  }}
                                  title="Send Absent Alert"
                                >
                                  <MessageCircle size={14} /> Send Absent Alert
                                </button>
                              )}
                            </span>
                          </div>
                        </td>
                        <td data-label="Standard">{student.standard}</td>
                        <td data-label="Status" style={{ textAlign: 'center' }}>
                          <div 
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.5rem', 
                              cursor: isLocked ? 'not-allowed' : 'pointer', 
                              userSelect: 'none',
                              opacity: isLocked ? 0.7 : 1
                            }}
                            onClick={() => toggleAttendance(student.id)}
                          >
                            <button 
                              className={`btn ${isPresent ? 'btn-success' : 'btn-danger'}`}
                              disabled={isLocked}
                              style={{ 
                                padding: '0.35rem 1rem', 
                                fontSize: '0.8rem', 
                                width: '100px',
                                boxShadow: 'none',
                                transform: 'none',
                                cursor: isLocked ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {isPresent ? 'Present' : 'Absent'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Edit Logs Timeline */}
          {editLogs.length > 0 && (
            <div className="card" style={{ marginTop: '2rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} />
                Attendance Edit History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {editLogs.map((log, index) => (
                  <div key={log.id || index} style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.88rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        Edited by: <span style={{ color: 'var(--primary)' }}>{log.edited_by}</span>
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {new Date(log.edited_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.75rem', borderLeft: '2px solid var(--primary)' }}>
                      {log.changes.map((change, cIdx) => (
                        <div key={cIdx} style={{ color: 'var(--text-secondary)' }}>
                          <strong>{change.student_name}</strong>: 
                          <span style={{
                            textDecoration: 'line-through',
                            color: 'var(--text-muted)',
                            marginLeft: '0.25rem',
                            marginRight: '0.25rem'
                          }}>
                            {change.old_status}
                          </span>
                          ➡️ 
                          <span style={{
                            fontWeight: '700',
                            color: change.new_status === 'Present' ? 'var(--success)' : 'var(--danger)',
                            marginLeft: '0.25rem'
                          }}>
                            {change.new_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ATTENDANCE HISTORY VIEW */
        <div>
          {historyLoading ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading history logs...</div>
          ) : historyLogs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
              <p>No past attendance records found in the database.</p>
              <button className="btn btn-primary" onClick={() => setActiveSubTab('mark')} style={{ marginTop: '1rem' }}>
                Go Mark Attendance
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Batch / Class</th>
                    <th style={{ textAlign: 'center' }}>Present</th>
                    <th style={{ textAlign: 'center' }}>Absent</th>
                    <th style={{ textAlign: 'center' }}>Attendance Rate</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map(log => {
                    const rate = Math.round((log.present / log.total) * 100) || 0;
                    return (
                      <tr key={`${log.date}_${log.batchId}`}>
                        <td data-label="Date" style={{ fontWeight: '700' }}>{formatDateDisplay(log.date)}</td>
                        <td data-label="Batch / Class">
                          <span className="badge badge-success" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                            {getBatchName(log.batchId)}
                          </span>
                        </td>
                        <td data-label="Present" style={{ textAlign: 'center', color: 'var(--success)', fontWeight: '700' }}>{log.present}</td>
                        <td data-label="Absent" style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: '700' }}>{log.absent}</td>
                        <td data-label="Attendance Rate" style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '60px', height: '6px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '10px', overflow: 'hidden' }}>
                              <div style={{ width: `${rate}%`, height: '100%', backgroundColor: rate > 75 ? 'var(--success)' : rate > 40 ? 'var(--warning)' : 'var(--danger)' }} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>{rate}%</span>
                          </div>
                        </td>
                        <td data-label="Actions" style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => handleViewRegister(log.date, log.batchId)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '0.35rem' }}
                          >
                            <Eye size={13} /> View / Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
