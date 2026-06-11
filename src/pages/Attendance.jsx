import React, { useState, useEffect } from 'react';
import { dbService, formatDateDisplay, sendWhatsAppMessage } from '../database/dbService';
import { Calendar, Save, Check, X, CheckSquare, Square, Eye, MessageCircle } from 'lucide-react';

export default function Attendance() {
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // student_id -> 'Present'/'Absent'
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState(null);

  // Sub Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState('mark'); // 'mark' or 'history'
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  useEffect(() => {
    if (!selectedBatch) return;

    async function loadBatchAttendance() {
      try {
        setLoading(true);
        setSaveSuccess(false);
        
        // Load all students and attendance for the date in parallel
        const [allStudents, dateLogs] = await Promise.all([
          dbService.getStudents(),
          dbService.getAttendance(selectedDate)
        ]);
        
        // Filter students belonging to this batch
        const batchStudents = allStudents.filter(s => s.batch_id === selectedBatch);
        setStudents(batchStudents);

        // Map existing attendance log or default to 'Present'
        const attendanceMap = {};
        batchStudents.forEach(student => {
          const log = dateLogs.find(l => l.student_id === student.id);
          attendanceMap[student.id] = log ? log.status : 'Present'; // default to Present
        });
        setAttendance(attendanceMap);
      } catch (err) {
        console.error("Failed to load attendance logs:", err);
      } finally {
        setLoading(false);
      }
    }
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
    setAttendance(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'Present' ? 'Absent' : 'Present'
    }));
  };

  const setAllStatus = (status) => {
    const updated = {};
    students.forEach(s => {
      updated[s.id] = status;
    });
    setAttendance(updated);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      
      const records = Object.keys(attendance).map(studentId => ({
        student_id: studentId,
        status: attendance[studentId]
      }));

      await dbService.saveAttendance(selectedDate, records);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save attendance:", err);
      alert("Error saving attendance records.");
    } finally {
      setSaving(false);
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
                <button className="btn btn-secondary" onClick={() => setAllStatus('Present')} disabled={students.length === 0 || loading}>
                  Mark All Present
                </button>
                <button className="btn btn-secondary" onClick={() => setAllStatus('Absent')} disabled={students.length === 0 || loading}>
                  Mark All Absent
                </button>
              </div>
            </div>
          </div>

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
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
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
                                    const message = `Dear Parent, this is to inform you that your child ${student.name} was ABSENT today (${formatDateDisplay(selectedDate)}) in the ${batchName} class. Please ensure they attend regularly. Thank you, BrainBridge Tuition.`;
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
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => toggleAttendance(student.id)}
                          >
                            <button 
                              className={`btn ${isPresent ? 'btn-success' : 'btn-danger'}`}
                              style={{ 
                                padding: '0.35rem 1rem', 
                                fontSize: '0.8rem', 
                                width: '100px',
                                boxShadow: 'none',
                                transform: 'none'
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
