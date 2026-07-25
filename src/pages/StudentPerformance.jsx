import React, { useState, useEffect } from 'react';
import { dbService, formatDateDisplay } from '../database/dbService';
import { TrendingUp, Award, Calendar, ClipboardList, CheckSquare, FileText, Download, Brain, Sparkles, Check, X, Clock, Eye } from 'lucide-react';

export default function StudentPerformance({ currentUser, verifyAction, activeTenant }) {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [tests, setTests] = useState([]);
  const [testMarks, setTestMarks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selector States
  const [selectedBatchId, setSelectedBatchId] = useState('All');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'details'
  
  // AI State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);

  // Printing state
  const [isPrinting, setIsPrinting] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'admin' && !!currentUser.staffId;
  const isOwner = currentUser?.role === 'admin' && !currentUser.staffId;

  // Permissions helpers
  const getFeature = (key, defaultVal) => {
    if (!activeTenant || !activeTenant.features) return defaultVal;
    if (activeTenant.features[key] !== undefined) return activeTenant.features[key];
    return defaultVal;
  };

  const hasReportAccess = isStaff 
    ? getFeature('staff_perf_report', false) 
    : getFeature('owner_perf_report', true);

  const hasFeedbackAccess = isStaff 
    ? getFeature('staff_perf_feedback', false) 
    : getFeature('owner_perf_feedback', true);

  useEffect(() => {
    loadData();
  }, []);

  // Listen for Escape key to close modals
  useEffect(() => {
    const handleClose = () => {
      // Nothing here yet, but fits global Escape hook
    };
    document.addEventListener('close-modals', handleClose);
    return () => document.removeEventListener('close-modals', handleClose);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studentList, batchList, testList, marksList, attList, hwList] = await Promise.all([
        dbService.getStudents(),
        dbService.getBatches(),
        dbService.getTests(),
        dbService.getAllTestMarks(),
        dbService.getAllAttendance(),
        dbService.getHomework()
      ]);

      setStudents(studentList);
      setBatches(batchList);
      setTests(testList);
      setTestMarks(marksList);
      setAttendance(attList);
      setHomework(hwList);

      if (currentUser?.role === 'parent' && currentUser.studentId) {
        setSelectedStudentId(currentUser.studentId);
        setViewMode('details');
      } else {
        setViewMode('list');
        if (studentList.length > 0) {
          setSelectedStudentId(studentList[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load performance metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchChange = (batchId) => {
    setSelectedBatchId(batchId);
    setAiFeedback(null);
    const filtered = batchId === 'All' 
      ? students 
      : students.filter(s => s.batch_id === batchId);
    
    if (filtered.length > 0) {
      setSelectedStudentId(filtered[0].id);
    } else {
      setSelectedStudentId('');
    }
  };

  const handleStudentChange = (studentId) => {
    setSelectedStudentId(studentId);
    setAiFeedback(null);
  };

  // Perform Calculations
  const calculateMetrics = (studentId) => {
    if (!studentId) return null;

    // 1. Attendance Rate
    const studentAttendance = attendance.filter(a => a.student_id === studentId);
    const presentCount = studentAttendance.filter(a => a.status === 'Present').length;
    const totalAttendance = studentAttendance.length;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    // 2. Academic Test Scores
    const studentScores = testMarks.filter(m => m.student_id === studentId);
    let totalScorePct = 0;
    let testsCount = 0;
    const testTrends = [];
    
    studentScores.forEach(score => {
      const test = tests.find(t => t.id === score.test_id);
      if (test && test.total_marks > 0) {
        const pct = Math.round((score.marks_obtained / test.total_marks) * 100);
        totalScorePct += pct;
        testsCount++;
        testTrends.push({
          subject: test.subject,
          date: test.test_date,
          score: pct,
          marksObtained: score.marks_obtained,
          totalMarks: test.total_marks
        });
      }
    });
    
    // Sort trends chronologically
    testTrends.sort((a, b) => a.date.localeCompare(b.date));

    const averageScore = testsCount > 0 ? Math.round(totalScorePct / testsCount) : 0;

    // 3. Homework Completion Rate
    const student = students.find(s => s.id === studentId);
    const batchId = student ? student.batch_id : '';
    const studentHomeworks = homework.filter(h => h.batch_id === batchId);
    
    let submittedCount = 0;
    let lateCount = 0;
    let totalHw = studentHomeworks.length;
    const homeworkDetails = [];
    
    studentHomeworks.forEach(h => {
      const submission = h.submissions ? h.submissions[studentId] : null;
      let status = 'Not Submitted';
      let submittedDate = '--';

      if (submission) {
        status = submission.status;
        submittedDate = submission.submitted_at;
        submittedCount++;
        if (submission.status === 'Late') {
          lateCount++;
        }
      }

      homeworkDetails.push({
        id: h.id,
        subject: h.subject,
        title: h.title,
        created_at: h.created_at ? h.created_at.split('T')[0] : '--',
        due_date: h.due_date,
        submitted_at: submittedDate,
        status: status
      });
    });

    const homeworkRate = totalHw > 0 ? Math.round((submittedCount / totalHw) * 100) : 100;

    // 4. Overall Performance Score
    const overallScore = Math.round((averageScore * 0.5) + (homeworkRate * 0.25) + (attendanceRate * 0.25));
    let grade = 'F';
    let label = 'Needs Urgent Attention';
    let color = '#ef4444';
    
    if (overallScore >= 90) {
      grade = 'A+';
      label = 'Outstanding Performance';
      color = '#10b981';
    } else if (overallScore >= 80) {
      grade = 'A';
      label = 'Excellent Progress';
      color = '#059669';
    } else if (overallScore >= 70) {
      grade = 'B';
      label = 'Good Effort';
      color = '#3b82f6';
    } else if (overallScore >= 60) {
      grade = 'C';
      label = 'Average Standing';
      color = '#f59e0b';
    } else if (overallScore >= 45) {
      grade = 'D';
      label = 'Needs Improvement';
      color = '#ef4444';
    }

    return {
      attendanceRate,
      averageScore,
      homeworkRate,
      overallScore,
      grade,
      label,
      color,
      totalHw,
      submittedCount,
      lateCount,
      testsCount,
      testTrends,
      homeworkDetails,
      studentName: student ? student.name : 'Student',
      batchName: student ? (batches.find(b => b.id === student.batch_id)?.name || 'Unknown') : 'Batch'
    };
  };

  const currentStudent = students.find(s => s.id === selectedStudentId);
  const metrics = calculateMetrics(selectedStudentId);

  // AI Insights Generation using detailed Heuristics Rules Engine
  const handleGenerateAiFeedback = () => {
    if (!metrics) return;
    setAiLoading(true);

    setTimeout(() => {
      // Analyze data points to generate customized insights
      let academicInsight = "";
      let disciplineInsight = "";
      let actionPlan = [];

      // Academic Analysis
      if (metrics.testsCount === 0) {
        academicInsight = `${metrics.studentName} has not appeared in any class tests yet. Performance data is insufficient.`;
        actionPlan.push("Attend upcoming mock class examinations.");
      } else if (metrics.averageScore >= 85) {
        academicInsight = `${metrics.studentName} is demonstrating a brilliant grasp of topics. High mastery displayed with an average test score of ${metrics.averageScore}%.`;
        actionPlan.push("Solve advanced practice papers to prepare for competitive standards.");
      } else if (metrics.averageScore >= 70) {
        academicInsight = `${metrics.studentName} shows average test performance (${metrics.averageScore}%). Some concepts are clear, but practice is needed on complex chapters.`;
        actionPlan.push("Devote 20 minutes daily for revising formulas and definitions.");
        actionPlan.push("Attend doubts resolution sessions to clear difficult topics.");
      } else {
        academicInsight = `Warning: ${metrics.studentName}'s average test score is ${metrics.averageScore}%, which is below average. Struggles detected across multiple test topics.`;
        actionPlan.push("Begin 1-on-1 concepts review sessions with the batch tutor.");
        actionPlan.push("Re-solve all incorrect questions from previous test papers.");
      }

      // Consistency Analysis (Attendance + Homework)
      if (metrics.attendanceRate >= 90 && metrics.homeworkRate >= 90) {
        disciplineInsight = `Outstanding commitment! Regular attendance (${metrics.attendanceRate}%) and on-time homework submission (${metrics.homeworkRate}%) are driving positive learning patterns.`;
      } else {
        let attPart = "";
        let hwPart = "";
        
        if (metrics.attendanceRate < 90) {
          attPart = `Attendance is irregular at ${metrics.attendanceRate}%. Missing regular classes results in gaps in concept building.`;
          actionPlan.push("Improve attendance consistency above 90%.");
        } else {
          attPart = `Attendance is consistent (${metrics.attendanceRate}%).`;
        }

        if (metrics.homeworkRate < 90) {
          hwPart = `Homework completion rate is low at ${metrics.homeworkRate}% (with ${metrics.lateCount} late submissions). Lack of daily homework practice is affecting progress.`;
          actionPlan.push("Complete and submit homework assignments before the due date.");
        } else {
          hwPart = `Homework completion is regular (${metrics.homeworkRate}%).`;
        }
        
        disciplineInsight = `${attPart} ${hwPart}`;
      }

      // Fallback action plans
      if (actionPlan.length === 0) {
        actionPlan.push("Maintain the current excellent learning pace and regularity.");
      }

      setAiFeedback({
        grade: metrics.grade,
        academicInsight,
        disciplineInsight,
        actionPlan,
        generatedAt: new Date().toLocaleDateString('en-GB')
      });
      setAiLoading(false);
    }, 1200);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  if (loading) {
    return <div className="loading-container">Loading Student Performance...</div>;
  }

  const filteredStudents = selectedBatchId === 'All' 
    ? students 
    : students.filter(s => s.batch_id === selectedBatchId);

  const searchedStudents = filteredStudents.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.mobile.includes(searchQuery)
  );

  return (
    <div className="fade-in">
      
      {/* 🛠️ Non-Print Dashboard Layout */}
      {!isPrinting && (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">📈 Student Performance Analytics</h1>
              <p className="page-subtitle">Track academic test scores, attendance consistency, and homework regularity.</p>
            </div>
            
            {metrics && hasReportAccess && (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {isAdmin && viewMode === 'details' && (
                  <button className="btn btn-secondary" onClick={() => { setViewMode('list'); setAiFeedback(null); }}>
                    Back to Directory
                  </button>
                )}
                {viewMode === 'details' && (
                  <button className="btn btn-primary" onClick={handlePrint}>
                    <Download size={18} style={{ marginRight: '0.4rem' }} /> Print Report Card
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Student Selector Bar for Admins */}
          {isAdmin && (
            <div className="card" style={{ display: 'flex', gap: '1.5rem', padding: '1.25rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Select Batch</label>
                <select className="form-control" value={selectedBatchId} onChange={e => handleBatchChange(e.target.value)}>
                  <option value="All">All Batches</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.subject})</option>
                  ))}
                </select>
              </div>

              {viewMode === 'list' ? (
                <div className="form-group" style={{ marginBottom: 0, minWidth: '220px', flex: 1 }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>Filter by Student (Name or Roll Number)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by student name or phone roll digits..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: 0, minWidth: '220px', flex: 1 }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>Select Student</label>
                  <select className="form-control" value={selectedStudentId} onChange={e => handleStudentChange(e.target.value)} disabled={filteredStudents.length === 0}>
                    {filteredStudents.length === 0 ? (
                      <option value="">No students in batch</option>
                    ) : (
                      filteredStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (Roll: {s.mobile.slice(-4)})</option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Main Dashboard Panel */}
          {!hasReportAccess ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Award size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)' }} />
              <p style={{ fontWeight: '600', fontSize: '1.1rem' }}>Access Restricted</p>
              <p style={{ fontSize: '0.88rem' }}>SuperAdmin has disabled student performance reporting access for your account role.</p>
            </div>
          ) : viewMode === 'list' && isAdmin ? (
            /* Student-wise Performance Directory List */
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e3a8a', margin: 0 }}>👥 Student-wise Performance Overview</h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Showing {searchedStudents.length} students</span>
              </div>
              
              {searchedStudents.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No students found matching your filters.
                </div>
              ) : (
                <div className="table-container" style={{ margin: 0, overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Roll Number</th>
                        <th>Batch</th>
                        <th style={{ textAlign: 'center' }}>Attendance Rate</th>
                        <th style={{ textAlign: 'center' }}>Avg Exam Score</th>
                        <th style={{ textAlign: 'center' }}>Hw Efficiency</th>
                        <th style={{ textAlign: 'center' }}>Standing / Grade</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedStudents.map(student => {
                        const m = calculateMetrics(student.id);
                        if (!m) return null;
                        return (
                          <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td data-label="Student Name" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                              {student.name}
                            </td>
                            <td data-label="Roll Number">{student.mobile.slice(-4)}</td>
                            <td data-label="Batch">{m.batchName}</td>
                            <td data-label="Attendance Rate" style={{ textAlign: 'center', fontWeight: '700', color: m.attendanceRate >= 90 ? '#10b981' : m.attendanceRate >= 75 ? '#f59e0b' : '#ef4444' }}>
                              {m.attendanceRate}%
                            </td>
                            <td data-label="Avg Exam Score" style={{ textAlign: 'center', fontWeight: '700', color: m.averageScore >= 75 ? '#10b981' : m.averageScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                              {m.averageScore}%
                            </td>
                            <td data-label="Hw Efficiency" style={{ textAlign: 'center', fontWeight: '700', color: m.homeworkRate >= 90 ? '#10b981' : m.homeworkRate >= 70 ? '#f59e0b' : '#ef4444' }}>
                              {m.homeworkRate}%
                            </td>
                            <td data-label="Standing / Grade" style={{ textAlign: 'center' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                backgroundColor: `${m.color}15`,
                                color: m.color,
                                padding: '0.2rem 0.6rem',
                                borderRadius: '50px',
                                display: 'inline-block'
                              }}>
                                {m.grade} ({m.label})
                              </span>
                            </td>
                            <td data-label="Action" style={{ textAlign: 'center' }}>
                              <button 
                                className="btn btn-secondary" 
                                onClick={() => {
                                  setSelectedStudentId(student.id);
                                  setViewMode('details');
                                  setAiFeedback(null);
                                }}
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', height: 'auto', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Eye size={12} /> View Details
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
          ) : !metrics ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Award size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)' }} />
              <p style={{ fontWeight: '600', fontSize: '1.1rem' }}>No Student Selected</p>
              <p style={{ fontSize: '0.88rem' }}>Please select a student to load their performance metrics.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* KPI Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                
                {/* Overall Score / Grade */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: `5px solid ${metrics.color}` }}>
                  <div style={{ backgroundColor: `${metrics.color}15`, color: metrics.color, width: '45px', height: '45px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: '800', flexShrink: 0 }}>
                    {metrics.grade}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '700' }}>Overall Standing</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>{metrics.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Rating: {metrics.overallScore}/100</div>
                  </div>
                </div>

                {/* Academic Scores */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: '5px solid #3b82f6' }}>
                  <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '45px', height: '45px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '700' }}>Average Exam Score</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>{metrics.averageScore}%</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>From {metrics.testsCount} tests appeared</div>
                  </div>
                </div>

                {/* Attendance rate */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: '5px solid #10b981' }}>
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', width: '45px', height: '45px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckSquare size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '700' }}>Attendance Rate</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>{metrics.attendanceRate}%</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Punctual & Regular</div>
                  </div>
                </div>

                {/* Homework submits */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: '5px solid #f59e0b' }}>
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', width: '45px', height: '45px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClipboardList size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '700' }}>Homework Efficiency</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>{metrics.homeworkRate}%</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Submitted {metrics.submittedCount}/{metrics.totalHw}</div>
                  </div>
                </div>

              </div>

              {/* Progress Charts & Homework logs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }} className="quick-actions-grid">
                
                {/* SVG Line Graph for Test Trends */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e3a8a' }}>📊 Academic Growth Trend</h3>
                  
                  {metrics.testTrends.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      No test marks logged to draw progression chart.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Interactive CSS Bar Chart */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {metrics.testTrends.map((trend, idx) => (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '700' }}>
                              <span>{trend.subject} ({formatDateDisplay(trend.date)})</span>
                              <span style={{ color: trend.score >= 75 ? '#10b981' : trend.score >= 50 ? '#f59e0b' : '#ef4444' }}>
                                {trend.score}% ({trend.marksObtained}/{trend.totalMarks})
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${trend.score}%`, 
                                height: '100%', 
                                backgroundColor: trend.score >= 75 ? '#10b981' : trend.score >= 50 ? '#f59e0b' : '#ef4444',
                                borderRadius: '9999px',
                                transition: 'width 0.5s ease'
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Advisor Panel */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Brain size={18} style={{ color: 'var(--primary)' }} /> AI Study Advisor
                    </h3>
                    <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                  </div>

                  {!hasFeedbackAccess ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px', textAlign: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <Brain size={32} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: '0.85rem' }}>AI diagnostic insights are disabled for your account role.</span>
                    </div>
                  ) : !aiFeedback ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px', textAlign: 'center', gap: '1rem' }}>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '280px', margin: 0 }}>
                        Click generate to let AI analyze attendance, exam scores, and homework submissions to design a custom roadmap.
                      </p>
                      <button className="btn btn-primary" onClick={handleGenerateAiFeedback} disabled={aiLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        {aiLoading ? 'Analyzing Performance...' : '✨ Generate AI Diagnostics'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s ease' }}>
                      <div style={{ borderLeft: '3px solid var(--primary)', paddingLeft: '0.75rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>ACADEMIC RATING</div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', lineHeight: '1.4' }}>
                          {aiFeedback.academicInsight}
                        </p>
                      </div>

                      <div style={{ borderLeft: '3px solid #10b981', paddingLeft: '0.75rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>CONSISTENCY STATUS</div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', lineHeight: '1.4' }}>
                          {aiFeedback.disciplineInsight}
                        </p>
                      </div>

                      <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.03)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '0.4rem' }}>RECOMMENDED ACTION PLAN</div>
                        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {aiFeedback.actionPlan.map((action, index) => (
                            <li key={index} style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Generated on: {aiFeedback.generatedAt}</span>
                        <button className="btn" onClick={() => setAiFeedback(null)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', border: 'none', background: 'none' }}>
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Homework Log Table */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e3a8a' }}>📅 Homework Regularity & Submission Log</h3>
                
                {metrics.homeworkDetails.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                    No homework assignments logged for this student's batch.
                  </div>
                ) : (
                  <div className="table-container" style={{ margin: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Homework Topic</th>
                          <th>Given Date</th>
                          <th>Due Date</th>
                          <th>Submission Status</th>
                          <th>Submitted Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.homeworkDetails.map((hw, idx) => {
                          const isPending = hw.status === 'Not Submitted';
                          const isLate = hw.status === 'Late';
                          return (
                            <tr key={idx}>
                              <td data-label="Subject" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{hw.subject}</td>
                              <td data-label="Topic" style={{ color: 'var(--text-primary)' }}>{hw.title}</td>
                              <td data-label="Given">{formatDateDisplay(hw.created_at)}</td>
                              <td data-label="Due" style={{ fontWeight: '700' }}>{formatDateDisplay(hw.due_date)}</td>
                              <td data-label="Status">
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: '800',
                                  backgroundColor: isPending ? '#fee2e2' : isLate ? '#fef3c7' : '#d1fae5',
                                  color: isPending ? '#991b1b' : isLate ? '#b45309' : '#065f46',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '50px',
                                  display: 'inline-block'
                                }}>
                                  {hw.status}
                                </span>
                              </td>
                              <td data-label="Submitted Date" style={{ fontWeight: '700', color: isPending ? 'var(--text-muted)' : isLate ? '#b45309' : '#065f46' }}>
                                {hw.submitted_at !== '--' ? formatDateDisplay(hw.submitted_at) : '--'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </>
      )}

      {/* 📄 Print-Only Report Card Layout */}
      {isPrinting && metrics && (
        <div className="report-card-print" style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          color: '#0f172a !important',
          background: '#ffffff !important',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2.5px solid #1e3a8a', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activeTenant?.name || 'Tuition Academy'}
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: '#475569', fontWeight: '600' }}>
              {activeTenant?.custom_owner_subtitle || 'Official Student Progress Report Card'}
            </p>
          </div>

          {/* Student Profile Metadata block */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem', fontSize: '0.9rem' }}>
            <div>
              <div style={{ marginBottom: '0.4rem' }}>Student Name: <strong style={{ color: '#0f172a' }}>{metrics.studentName}</strong></div>
              <div>Batch / Class: <strong style={{ color: '#0f172a' }}>{metrics.batchName}</strong></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ marginBottom: '0.4rem' }}>Report Date: <strong>{new Date().toLocaleDateString('en-GB')}</strong></div>
              <div>Overall Standing: <strong style={{ color: metrics.color }}>{metrics.label} ({metrics.grade})</strong></div>
            </div>
          </div>

          {/* Core Analytics Metrics */}
          <h3 style={{ fontSize: '1.1rem', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.4rem', color: '#1e3a8a', marginBottom: '1rem', textTransform: 'uppercase' }}>
            I. Performance Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem', textAlign: 'center' }}>
            <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fafafa' }}>
              <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>Average Exam Score</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#1e3a8a', marginTop: '0.25rem' }}>{metrics.averageScore}%</div>
            </div>
            <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fafafa' }}>
              <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>Attendance Consistency</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#10b981', marginTop: '0.25rem' }}>{metrics.attendanceRate}%</div>
            </div>
            <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fafafa' }}>
              <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '700', textTransform: 'uppercase' }}>Homework Completion</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f59e0b', marginTop: '0.25rem' }}>{metrics.homeworkRate}%</div>
            </div>
          </div>

          {/* Test Performance Table */}
          <h3 style={{ fontSize: '1.1rem', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.4rem', color: '#1e3a8a', marginBottom: '1rem', textTransform: 'uppercase' }}>
            II. Examinations & Tests Detailed Log
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '2.5rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f1f5f9', color: '#334155' }}>
                <th style={{ padding: '0.6rem 0.5rem' }}>Subject</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Exam Date</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Score Obtained</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Total Marks</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {metrics.testTrends.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>No test marks recorded.</td>
                </tr>
              ) : (
                metrics.testTrends.map((t, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '700' }}>{t.subject}</td>
                    <td style={{ padding: '0.5rem' }}>{formatDateDisplay(t.date)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{t.marksObtained}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{t.totalMarks}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: t.score >= 75 ? '#059669' : '#0f172a' }}>{t.score}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* AI Analysis & Remarks */}
          {aiFeedback && (
            <div style={{ pageBreakInside: 'avoid' }}>
              <h3 style={{ fontSize: '1.1rem', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.4rem', color: '#1e3a8a', marginBottom: '1rem', textTransform: 'uppercase' }}>
                III. AI Study Advisor Diagnostic Remarks
              </h3>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#fafafa', marginBottom: '2.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: '800', textTransform: 'uppercase' }}>Academic Diagnostic</div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#0f172a', lineHeight: '1.4' }}>{aiFeedback.academicInsight}</p>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: '800', textTransform: 'uppercase' }}>Consistency & Regularity Diagnostic</div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#0f172a', lineHeight: '1.4' }}>{aiFeedback.disciplineInsight}</p>
                </div>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Recommended Learning Checklist</div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#0f172a' }}>
                    {aiFeedback.actionPlan.map((act, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem', lineHeight: '1.3' }}>{act}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4rem', pageBreakInside: 'avoid' }}>
            <div style={{ borderTop: '1.5px solid #94a3b8', width: '180px', textAlign: 'center', paddingTop: '0.5rem', fontSize: '0.82rem', color: '#475569', fontWeight: '600' }}>
              Class Teacher / Tutor
            </div>
            <div style={{ borderTop: '1.5px solid #94a3b8', width: '180px', textAlign: 'center', paddingTop: '0.5rem', fontSize: '0.82rem', color: '#475569', fontWeight: '600' }}>
              Tuition Administrator
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
