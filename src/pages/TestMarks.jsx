import React, { useState, useEffect } from 'react';
import { dbService, formatDateDisplay } from '../database/dbService';
import { Plus, Check, Award, BarChart2, Save, FileSpreadsheet, ChevronRight } from 'lucide-react';

export default function TestMarks() {
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters / Selected States
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [activeTestForMarks, setActiveTestForMarks] = useState(null); // test object
  const [marksInput, setMarksInput] = useState({}); // student_id -> marks (obtained)
  
  // Stats
  const [testStats, setTestStats] = useState(null);

  // Modals
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [newTestForm, setNewTestForm] = useState({
    test_name: '',
    subject: '',
    max_marks: 50,
    test_date: new Date().toISOString().split('T')[0],
    batch_id: ''
  });

  useEffect(() => {
    async function loadTestData() {
      try {
        const [batchList, testList, studentList] = await Promise.all([
          dbService.getBatches(),
          dbService.getTests(),
          dbService.getStudents()
        ]);
        
        setBatches(batchList);
        setTests(testList);
        setStudents(studentList);
        
        if (batchList.length > 0) {
          setNewTestForm(prev => ({ ...prev, batch_id: batchList[0].id, subject: batchList[0].subject }));
        }
      } catch (err) {
        console.error("Failed to load test parameters:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTestData();
  }, []);

  // When opening marks sheet
  const handleOpenMarksSheet = async (test) => {
    try {
      setLoading(true);
      const existingMarks = await dbService.getTestMarks(test.id);
      const batchStudents = students.filter(s => s.batch_id === test.batch_id);
      
      const inputMap = {};
      batchStudents.forEach(s => {
        const score = existingMarks.find(m => m.student_id === s.id);
        inputMap[s.id] = score ? score.marks_obtained : '';
      });
      
      setMarksInput(inputMap);
      setActiveTestForMarks(test);
      calculateStats(existingMarks, test.max_marks);
    } catch (err) {
      console.error("Failed to load test marks list:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (marksList, maxMarks) => {
    if (marksList.length === 0) {
      setTestStats(null);
      return;
    }
    const scores = marksList.map(m => m.marks_obtained).filter(v => v !== '');
    if (scores.length === 0) {
      setTestStats(null);
      return;
    }
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / scores.length) * 10) / 10;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const passCount = scores.filter(s => s >= (maxMarks * 0.35)).length; // 35% passing
    const passRate = Math.round((passCount / scores.length) * 100);

    setTestStats({ avg, highest, lowest, passRate });
  };

  const handleMarksChange = (studentId, val) => {
    // Validate value isn't greater than max marks
    const num = Number(val);
    if (num > activeTestForMarks.max_marks) {
      return;
    }
    setMarksInput(prev => ({ ...prev, [studentId]: val }));
  };

  const handleSaveMarks = async (e) => {
    e.preventDefault();
    if (!activeTestForMarks) return;

    try {
      setLoading(true);
      const marksList = Object.keys(marksInput).map(studentId => ({
        student_id: studentId,
        marks_obtained: marksInput[studentId] === '' ? 0 : Number(marksInput[studentId])
      }));

      await dbService.saveTestMarks(activeTestForMarks.id, marksList);
      
      // Re-calculate stats
      calculateStats(marksList, activeTestForMarks.max_marks);
      alert("Test marks saved successfully!");
      setActiveTestForMarks(null);
    } catch (err) {
      console.error("Failed to save student test scores:", err);
      alert("Error saving test marks.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestSubmit = async (e) => {
    e.preventDefault();
    if (!newTestForm.test_name || !newTestForm.batch_id) return;

    try {
      setLoading(true);
      const createdTest = await dbService.addTest(newTestForm);
      setTests(prev => [createdTest, ...prev]);
      setShowCreateTestModal(false);
      
      // Reset form
      setNewTestForm({
        test_name: '',
        subject: batches.find(b => b.id === newTestForm.batch_id)?.subject || '',
        max_marks: 50,
        test_date: new Date().toISOString().split('T')[0],
        batch_id: newTestForm.batch_id
      });
    } catch (err) {
      console.error("Failed to schedule exam:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSelectChange = (batchId) => {
    const batch = batches.find(b => b.id === batchId);
    setNewTestForm(prev => ({
      ...prev,
      batch_id: batchId,
      subject: batch ? batch.subject : ''
    }));
  };

  const getBatchName = (batchId) => {
    const batch = batches.find(b => b.id === batchId);
    return batch ? batch.name : 'Unknown Batch';
  };

  // Filtered Tests
  const filteredTests = tests.filter(t => selectedBatch === 'All' || t.batch_id === selectedBatch);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Test & Examination Marks</h1>
          <p className="page-subtitle">Schedule quizzes/tests, log marks and review academic metrics.</p>
        </div>
        {!activeTestForMarks && (
          <button className="btn btn-primary" onClick={() => setShowCreateTestModal(true)}>
            <Plus size={18} />
            <span>Create Test</span>
          </button>
        )}
      </div>

      {activeTestForMarks ? (
        /* Marks Entry Sheet View */
        <div>
          {/* Back Navigation Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <button className="btn btn-secondary" onClick={() => setActiveTestForMarks(null)} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                &larr; Back to Tests List
              </button>
              <h2 style={{ fontSize: '1.5rem', marginTop: '0.75rem' }}>
                Marks Sheet: {activeTestForMarks.test_name}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Batch: {getBatchName(activeTestForMarks.batch_id)} | Subject: {activeTestForMarks.subject} | Max Marks: {activeTestForMarks.max_marks}
              </p>
            </div>
          </div>

          {/* Test Performance Statistics Card */}
          {testStats && (
            <div className="card grid-cols-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '2rem', padding: '1.25rem', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Class Average</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{testStats.avg} / {activeTestForMarks.max_marks}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Highest Score</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>{testStats.highest}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Lowest Score</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--danger)' }}>{testStats.lowest}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Pass Percentage</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--secondary)' }}>{testStats.passRate}%</span>
              </div>
            </div>
          )}

          {/* Sheet Form */}
          <form onSubmit={handleSaveMarks}>
            <div className="table-container">
              <div className="table-header-row">
                <h4 style={{ fontSize: '1.1rem' }}>Enter Student Scores</h4>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} />
                  <span>Save Marks</span>
                </button>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Standard</th>
                    <th style={{ width: '250px' }}>Marks Obtained (Max {activeTestForMarks.max_marks})</th>
                  </tr>
                </thead>
                <tbody>
                  {students.filter(s => s.batch_id === activeTestForMarks.batch_id).length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No students enrolled in this batch yet.
                      </td>
                    </tr>
                  ) : (
                    students.filter(s => s.batch_id === activeTestForMarks.batch_id).map(student => (
                      <tr key={student.id}>
                        <td data-label="Student Name" style={{ fontWeight: '600' }}>{student.name}</td>
                        <td data-label="Standard">{student.standard}</td>
                        <td data-label="Marks Obtained">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="number"
                              className="form-control"
                              style={{ width: '100px', textAlign: 'center' }}
                              min="0"
                              max={activeTestForMarks.max_marks}
                              value={marksInput[student.id] ?? ''}
                              onChange={(e) => handleMarksChange(student.id, e.target.value)}
                              placeholder="0"
                            />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/ {activeTestForMarks.max_marks}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </form>
        </div>
      ) : (
        /* Tests Directory List View */
        <div>
          {/* Filters */}
          <div className="filters-bar" style={{ marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ width: '200px', marginBottom: 0 }}>
              <select
                className="form-control"
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
              >
                <option value="All">All Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table list */}
          {loading && tests.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading examinations register...</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Subject</th>
                    <th>Batch</th>
                    <th>Max Marks</th>
                    <th>Exam Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTests.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No tests Scheduled. Click "Create Test" to add one.
                      </td>
                    </tr>
                  ) : (
                    filteredTests.map(test => (
                      <tr key={test.id}>
                        <td data-label="Test Name" style={{ fontWeight: '600' }}>{test.test_name}</td>
                        <td data-label="Subject">{test.subject}</td>
                        <td data-label="Batch">
                          <span className="badge badge-success" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                            {getBatchName(test.batch_id)}
                          </span>
                        </td>
                        <td data-label="Max Marks" style={{ fontWeight: '700' }}>{test.max_marks}</td>
                        <td data-label="Exam Date" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{formatDateDisplay(test.test_date)}</td>
                        <td data-label="Actions" style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => handleOpenMarksSheet(test)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '0.35rem' }}
                          >
                            <FileSpreadsheet size={14} /> Score Sheet &rarr;
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Test Modal */}
      {showCreateTestModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Schedule New Examination</h3>
              <button className="modal-close" onClick={() => setShowCreateTestModal(false)}>Close</button>
            </div>
            
            <form onSubmit={handleCreateTestSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Test Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="E.g. Algebra Unit Test 1"
                    value={newTestForm.test_name}
                    onChange={(e) => setNewTestForm(prev => ({ ...prev, test_name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Batch *</label>
                  <select
                    className="form-control"
                    value={newTestForm.batch_id}
                    onChange={(e) => handleBatchSelectChange(e.target.value)}
                    required
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newTestForm.subject}
                      readOnly
                      style={{ opacity: 0.8 }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Marks *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={newTestForm.max_marks}
                      onChange={(e) => setNewTestForm(prev => ({ ...prev, max_marks: Number(e.target.value) }))}
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Exam Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newTestForm.test_date}
                    onChange={(e) => setNewTestForm(prev => ({ ...prev, test_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateTestModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Schedule Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
