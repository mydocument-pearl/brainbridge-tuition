import React, { useState, useEffect } from 'react';
import { dbService, formatDateDisplay, sendWhatsAppMessage } from '../database/dbService';
import { Plus, Search, Filter, Edit, Phone, MapPin, MessageCircle } from 'lucide-react';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('students'); // 'students' or 'summary'
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [selectedStandard, setSelectedStandard] = useState('All');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [batchForm, setBatchForm] = useState({
    name: '',
    subject: '',
    timing: '',
    teacher_name: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    parent_mobile: '',
    address: '',
    school: '',
    standard: '10th',
    batch_id: '',
    admission_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [studentList, batchList] = await Promise.all([
          dbService.getStudents(),
          dbService.getBatches()
        ]);
        setStudents(studentList);
        setBatches(batchList);
        if (batchList.length > 0) {
          setFormData(prev => ({ ...prev, batch_id: batchList[0].id }));
        }
      } catch (err) {
        console.error("Failed to load students data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile || !formData.batch_id) {
      alert("Name, Mobile, and Batch are required.");
      return;
    }

    try {
      setLoading(true);
      if (isEditing) {
        // Update existing student details
        const updated = await dbService.updateStudent(editingStudentId, formData);
        setStudents(prev => prev.map(s => s.id === editingStudentId ? updated : s));
        alert("Student details updated successfully!");
      } else {
        // Register new student
        const newStudent = await dbService.addStudent(formData);
        setStudents(prev => [...prev, newStudent]);
      }
      setShowModal(false);
      setIsEditing(false);
      setEditingStudentId(null);
      setFormData({
        name: '',
        mobile: '',
        parent_mobile: '',
        address: '',
        school: '',
        standard: '10th',
        batch_id: batches[0]?.id || '',
        admission_date: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error("Error saving student:", err);
      alert("Failed to save details: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (student) => {
    setFormData({
      name: student.name || '',
      mobile: student.mobile || '',
      parent_mobile: student.parent_mobile || '',
      address: student.address || '',
      school: student.school || '',
      standard: student.standard || '10th',
      batch_id: student.batch_id || '',
      admission_date: student.admission_date || new Date().toISOString().split('T')[0]
    });
    setIsEditing(true);
    setEditingStudentId(student.id);
    setSelectedStudentForDetail(null); // Close detail modal
    setShowModal(true); // Open edit form modal
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setEditingStudentId(null);
    setFormData({
      name: '',
      mobile: '',
      parent_mobile: '',
      address: '',
      school: '',
      standard: '10th',
      batch_id: batches[0]?.id || '',
      admission_date: new Date().toISOString().split('T')[0]
    });
  };

  const handleArchiveStudent = async (studentId) => {
    if (window.confirm("Are you sure you want to archive this student? This will soft-delete their record from the active directory.")) {
      try {
        setLoading(true);
        await dbService.archiveStudent(studentId);
        // Refresh local student list
        setStudents(prev => prev.filter(s => s.id !== studentId));
        setSelectedStudentForDetail(null);
        alert("Student archived successfully.");
      } catch (err) {
        console.error("Error archiving student:", err);
        alert("Failed to archive student: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchForm.name || !batchForm.subject) {
      alert("Batch Name and Subject are required.");
      return;
    }
    try {
      setLoading(true);
      const newBatch = await dbService.addBatch(batchForm);
      setBatches(prev => [...prev, newBatch]);
      setShowBatchModal(false);
      setBatchForm({
        name: '',
        subject: '',
        timing: '',
        teacher_name: ''
      });
      // Set the newly created batch as selected in the student form if no batch is selected
      setFormData(prev => ({ ...prev, batch_id: prev.batch_id || newBatch.id }));
      alert(`Batch "${newBatch.name}" created successfully!`);
    } catch (err) {
      console.error("Error creating batch:", err);
      alert("Failed to create batch.");
    } finally {
      setLoading(false);
    }
  };

  // Filter & Search Logic
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          student.mobile.includes(searchTerm);
    const matchesBatch = selectedBatch === 'All' || student.batch_id === selectedBatch;
    const matchesStandard = selectedStandard === 'All' || student.standard === selectedStandard;
    return matchesSearch && matchesBatch && matchesStandard;
  });

  const getBatchName = (batchId) => {
    const batch = batches.find(b => b.id === batchId);
    return batch ? batch.name : 'Unassigned';
  };

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

  const getStandardDistribution = () => {
    const dist = { '10th': 0, '11th': 0, '12th': 0 };
    students.forEach(s => {
      if (!s.standard) return;
      const std = s.standard.includes('th') ? s.standard : `${s.standard}th`;
      dist[std] = (dist[std] || 0) + 1;
    });
    return dist;
  };
  const standardDistribution = getStandardDistribution();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admissions</h1>
          <p className="page-subtitle">Manage student registrations, details, standard distributions and summary reports.</p>
        </div>
        {activeSubTab === 'students' && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowBatchModal(true)} style={{ border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} />
              <span>Create Batch</span>
            </button>
            <button className="btn btn-primary" onClick={() => {
              setIsEditing(false);
              setEditingStudentId(null);
              setShowModal(true);
            }}>
              <Plus size={18} />
              <span>Register Student</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-tabs Toggle */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2.5rem', gap: '2rem' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('students')}
          style={{
            padding: '0.85rem 0.25rem',
            fontSize: '0.98rem',
            fontWeight: '800',
            color: activeSubTab === 'students' ? 'var(--primary)' : 'var(--text-secondary)',
            border: 'none',
            background: 'none',
            borderBottom: activeSubTab === 'students' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            marginBottom: '-2px',
            fontFamily: 'var(--font-body)'
          }}
        >
          Student Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('summary')}
          style={{
            padding: '0.85rem 0.25rem',
            fontSize: '0.98rem',
            fontWeight: '800',
            color: activeSubTab === 'summary' ? 'var(--primary)' : 'var(--text-secondary)',
            border: 'none',
            background: 'none',
            borderBottom: activeSubTab === 'summary' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            marginBottom: '-2px',
            fontFamily: 'var(--font-body)'
          }}
        >
          Admissions Summary
        </button>
      </div>

      {activeSubTab === 'students' ? (
        <>
          {/* Filters Bar */}
          <div className="filters-bar">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="form-control"
                placeholder="Search by student name or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <select 
                className="form-control" 
                value={selectedBatch} 
                onChange={(e) => setSelectedBatch(e.target.value)}
                style={{ width: '160px' }}
              >
                <option value="All">All Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <select 
                className="form-control" 
                value={selectedStandard} 
                onChange={(e) => setSelectedStandard(e.target.value)}
                style={{ width: '140px' }}
              >
                <option value="All">All Standards</option>
                <option value="10th">10th</option>
                <option value="11th">11th</option>
                <option value="12th">12th</option>
              </select>
            </div>
          </div>

          {/* Students Table */}
          {loading && students.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading students database...</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Standard</th>
                    <th>Admission Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No students match the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => (
                      <tr key={student.id}>
                        <td data-label="Student Name">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentForDetail(student)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              fontWeight: '600',
                              color: 'var(--primary)',
                              textAlign: 'left',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontFamily: 'var(--font-body)'
                            }}
                          >
                            {student.name}
                          </button>
                        </td>
                        <td data-label="Standard">{student.standard}</td>
                        <td data-label="Admission Date" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {formatDateDisplay(student.admission_date)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Admissions Summary View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Summary Stats Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.75rem' }}>
            <div className="card stat-card" style={{ borderLeft: '4px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span className="stat-label">Joined This Month</span>
                <div className="stat-val" style={{ color: 'var(--primary)', fontSize: '2.5rem', fontWeight: '800' }}>{thisMonthCount}</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>New student enrollments in current month</p>
              </div>
              <div className="stat-icon-wrapper">
                <Plus size={24} />
              </div>
            </div>

            <div className="card stat-card" style={{ borderLeft: '4px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span className="stat-label">Overall Total Admissions</span>
                <div className="stat-val" style={{ color: 'var(--success)', fontSize: '2.5rem', fontWeight: '800' }}>{students.length}</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>Total registered students in database</p>
              </div>
              <div className="stat-icon-wrapper success">
                <Search size={24} />
              </div>
            </div>
          </div>

          {/* Standard Distribution Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>Active Standard Distribution</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>Breakdown of active students enrolled in different standards/classes.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              {Object.entries(standardDistribution).map(([std, qty]) => {
                const total = students.length || 1;
                const pct = Math.round((qty / total) * 100);

                return (
                  <div key={std} style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1e3a8a' }}>{std} Standard</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>{pct}%</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0.25rem 0' }}>
                      {qty} <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-secondary)' }}>students</span>
                    </div>
                    {/* Progress slider bar */}
                    <div style={{ height: '6px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '50px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '50px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Student Details' : 'Register New Student'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>Close</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Student Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    placeholder="Enter name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Student Mobile *</label>
                    <input
                      type="tel"
                      name="mobile"
                      className="form-control"
                      placeholder="10-digit number"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Parent's Mobile</label>
                    <input
                      type="tel"
                      name="parent_mobile"
                      className="form-control"
                      placeholder="10-digit number"
                      value={formData.parent_mobile}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Standard/Class *</label>
                    <select
                      name="standard"
                      className="form-control"
                      value={formData.standard}
                      onChange={handleInputChange}
                    >
                      <option value="10th">10th Standard</option>
                      <option value="11th">11th Standard</option>
                      <option value="12th">12th Standard</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assign Batch *</label>
                    <select
                      name="batch_id"
                      className="form-control"
                      value={formData.batch_id}
                      onChange={handleInputChange}
                      required
                    >
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">School Name</label>
                  <input
                    type="text"
                    name="school"
                    className="form-control"
                    placeholder="E.g. Delhi Public School"
                    value={formData.school}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Home Address</label>
                  <textarea
                    name="address"
                    className="form-control"
                    rows="2"
                    placeholder="Enter street and locality details"
                    value={formData.address}
                    onChange={handleInputChange}
                    style={{ resize: 'none', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Batch Modal */}
      {showBatchModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Batch / Class</h3>
              <button className="modal-close" onClick={() => setShowBatchModal(false)}>Close</button>
            </div>
            
            <form onSubmit={handleBatchSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Batch Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="E.g. 10th Maths, 11th Chemistry"
                    value={batchForm.name}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subject *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="E.g. Mathematics, Chemistry"
                    value={batchForm.subject}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, subject: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Class Timing</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="E.g. 04:00 PM - 05:00 PM"
                    value={batchForm.timing}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, timing: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Teacher Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="E.g. Rakesh Sharma"
                    value={batchForm.teacher_name}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, teacher_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBatchModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Detail Modal Popup */}
      {selectedStudentForDetail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Student Profile</h3>
              <button className="modal-close" onClick={() => setSelectedStudentForDetail(null)}>Close</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', width: '100%' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  fontWeight: '800',
                  fontSize: '1.25rem'
                }}>
                  {selectedStudentForDetail.name.charAt(0)}
                </div>
                <div style={{ flexGrow: 1 }}>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>{selectedStudentForDetail.name}</h4>
                  <span className="badge badge-success" style={{ marginTop: '0.3rem' }}>{selectedStudentForDetail.standard} Standard</span>
                </div>
                <button 
                  onClick={() => handleOpenEdit(selectedStudentForDetail)}
                  style={{
                    background: 'rgba(37, 99, 235, 0.08)',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                  title="Edit Profile"
                >
                  <Edit size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.04em' }}>Assigned Batch</span>
                  <div style={{ fontWeight: '600', fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                    {getBatchName(selectedStudentForDetail.batch_id)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.04em' }}>Contact (Student)</span>
                  <div style={{ fontWeight: '600', fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                      {selectedStudentForDetail.mobile}
                    </span>
                    <button 
                      onClick={() => sendWhatsAppMessage(selectedStudentForDetail.mobile, `Hello ${selectedStudentForDetail.name},`)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#25d366',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}
                      title="WhatsApp Student"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.04em' }}>Parent's Contact</span>
                  <div style={{ fontWeight: '600', fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                      {selectedStudentForDetail.parent_mobile || 'N/A'}
                    </span>
                    {selectedStudentForDetail.parent_mobile && selectedStudentForDetail.parent_mobile !== 'N/A' && (
                      <button 
                        onClick={() => sendWhatsAppMessage(selectedStudentForDetail.parent_mobile, `Hello, this is from BrainBridge Tuition regarding ${selectedStudentForDetail.name}.`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#25d366',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '700'
                        }}
                        title="WhatsApp Parent"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.04em' }}>Admission Date</span>
                  <div style={{ fontWeight: '600', fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                    {formatDateDisplay(selectedStudentForDetail.admission_date)}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="btn btn-danger" 
                onClick={() => handleArchiveStudent(selectedStudentForDetail.id)} 
                disabled={loading}
                style={{ flex: 1 }}
              >
                Archive Student
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedStudentForDetail(null)} 
                style={{ flex: 1 }}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
