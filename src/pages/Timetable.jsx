import React, { useState, useEffect } from 'react';
import { dbService, formatDateDisplay } from '../database/dbService';
import { 
  Plus, 
  Clock, 
  MapPin, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Edit, 
  Trash2,
  BookOpen
} from 'lucide-react';

export default function Timetable() {
  const [batches, setBatches] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Tab
  const [activeSubTab, setActiveSubTab] = useState('daily'); // 'daily' or 'weekly'

  // Date and Filters
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBatch, setSelectedBatch] = useState('All');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states
  const [formSlot, setFormSlot] = useState({
    date: currentDate,
    batch_id: '',
    subject: '',
    start_time: '16:00',
    end_time: '17:00',
    topic: '',
    teacher_name: '',
    room: ''
  });
  const [editingSlotId, setEditingSlotId] = useState(null);

  const [students, setStudents] = useState([]);

  // Filter States
  const [filterTeacher, setFilterTeacher] = useState('All');
  const [filterStudent, setFilterStudent] = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterTime, setFilterTime] = useState('All');

  // Load Initial Parameters
  useEffect(() => {
    async function loadData() {
      try {
        const [batchList, studentList] = await Promise.all([
          dbService.getBatches(),
          dbService.getStudents()
        ]);
        setBatches(batchList);
        setStudents(studentList);
        if (batchList.length > 0) {
          // Initialize form defaults based on first batch
          setFormSlot(prev => ({
            ...prev,
            batch_id: batchList[0].id,
            subject: batchList[0].subject,
            teacher_name: batchList[0].teacher_name,
            room: 'Room A'
          }));
        }
      } catch (err) {
        console.error("Failed to load parameters for timetable:", err);
      }
    }
    loadData();
  }, []);

  // Fetch slots whenever the date changes
  useEffect(() => {
    async function fetchDailySlots() {
      try {
        setLoading(true);
        const dailySlots = await dbService.getTimetable(currentDate);
        setSlots(dailySlots);
      } catch (err) {
        console.error("Failed to fetch timetable slots:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDailySlots();
  }, [currentDate]);

  // Sync date picker/navigation with form date
  useEffect(() => {
    setFormSlot(prev => ({ ...prev, date: currentDate }));
  }, [currentDate]);

  // Handle batch selection in modal form (auto-fill subject & teacher defaults)
  const handleFormBatchChange = (batchId) => {
    const selected = batches.find(b => b.id === batchId);
    if (selected) {
      setFormSlot(prev => ({
        ...prev,
        batch_id: batchId,
        subject: selected.subject,
        teacher_name: selected.teacher_name,
        room: selected.id === 'b1' ? 'Room A' : selected.id === 'b2' ? 'Room B' : 'Room C'
      }));
    }
  };

  // Navigating Dates
  const handlePrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const formatTime12h = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${String(displayHour).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Create slot handler
  const handleAddSlotSubmit = async (e) => {
    e.preventDefault();
    if (formSlot.start_time >= formSlot.end_time) {
      alert("Start time must be earlier than the end time.");
      return;
    }
    try {
      setLoading(true);
      const newSlot = await dbService.addTimetableSlot(formSlot);
      setSlots(prev => [...prev, newSlot]);
      setShowCreateModal(false);
      // Reset form topic
      setFormSlot(prev => ({ ...prev, topic: '' }));
    } catch (err) {
      console.error("Failed to add timetable slot:", err);
      alert("Error adding class slot.");
    } finally {
      setLoading(false);
    }
  };

  // Edit slot trigger
  const handleOpenEditModal = (slot) => {
    setEditingSlotId(slot.id);
    setFormSlot({
      date: slot.date,
      batch_id: slot.batch_id,
      subject: slot.subject,
      start_time: slot.start_time,
      end_time: slot.end_time,
      topic: slot.topic || '',
      teacher_name: slot.teacher_name || '',
      room: slot.room || ''
    });
    setShowEditModal(true);
  };

  // Edit slot handler
  const handleEditSlotSubmit = async (e) => {
    e.preventDefault();
    if (formSlot.start_time >= formSlot.end_time) {
      alert("Start time must be earlier than the end time.");
      return;
    }
    try {
      setLoading(true);
      const updated = await dbService.updateTimetableSlot(editingSlotId, formSlot);
      setSlots(prev => prev.map(s => s.id === editingSlotId ? updated : s));
      setShowEditModal(false);
      setEditingSlotId(null);
    } catch (err) {
      console.error("Failed to update timetable slot:", err);
      alert("Error updating class slot.");
    } finally {
      setLoading(false);
    }
  };

  // Delete slot handler
  const handleDeleteSlot = async (id) => {
    if (!window.confirm("Are you sure you want to delete this class slot?")) return;
    try {
      setLoading(true);
      await dbService.deleteTimetableSlot(id);
      setSlots(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error("Failed to delete timetable slot:", err);
      alert("Error deleting slot.");
    } finally {
      setLoading(false);
    }
  };

  // Helpers
  const getBatchName = (batchId) => {
    const batch = batches.find(b => b.id === batchId);
    return batch ? batch.name : 'Unknown Class';
  };

  const getSubjectColor = (subject) => {
    switch (subject) {
      case 'Mathematics': return '#2563eb'; // blue
      case 'Physics': return '#06b6d4';     // cyan
      case 'Accountancy': return '#d97706';   // amber
      default: return 'var(--primary)';
    }
  };

  // Get unique teachers and subjects from batches
  const uniqueTeachers = [...new Set(batches.map(b => b.teacher_name).filter(Boolean))];
  const uniqueSubjects = [...new Set(batches.map(b => b.subject).filter(Boolean))];

  // Filter & Sort Slots
  const filteredSlots = slots
    .filter(s => {
      // 1. Batch filter
      if (selectedBatch !== 'All' && s.batch_id !== selectedBatch) return false;
      
      // 2. Subject filter
      if (filterSubject !== 'All' && s.subject !== filterSubject) return false;
      
      // 3. Teacher filter
      if (filterTeacher !== 'All' && s.teacher_name !== filterTeacher) return false;
      
      // 4. Student filter (look up what batch the student belongs to)
      if (filterStudent !== 'All') {
        const student = students.find(std => std.id === filterStudent);
        if (!student || s.batch_id !== student.batch_id) return false;
      }
      
      // 5. Time wise filter
      if (filterTime !== 'All') {
        if (!s.start_time) return false;
        const hour = parseInt(s.start_time.split(':')[0], 10);
        if (filterTime === 'Morning' && hour >= 12) return false;
        if (filterTime === 'Afternoon' && (hour < 12 || hour >= 16)) return false;
        if (filterTime === 'Evening' && hour < 16) return false;
      }
      
      return true;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // --- WEEKLY MASTER GRID DATA GENERATION ---
  // Get date for days of the current week (Monday to Saturday)
  const getWeeklyDates = () => {
    const current = new Date();
    const day = current.getDay();
    // distance to previous Monday
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    
    const week = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let i = 0; i < 6; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      week.push({
        dayName: dayNames[i],
        dateStr: date.toISOString().split('T')[0]
      });
    }
    return week;
  };

  const weeklyDays = getWeeklyDates();

  // We need to fetch/prepare all slots for the current week's dates
  const [weeklySlotsMap, setWeeklySlotsMap] = useState({});
  useEffect(() => {
    async function loadWeeklySlots() {
      if (activeSubTab !== 'weekly') return;
      try {
        const promises = weeklyDays.map(d => dbService.getTimetable(d.dateStr));
        const results = await Promise.all(promises);
        
        const map = {};
        weeklyDays.forEach((day, idx) => {
          map[day.dayName] = results[idx];
        });
        setWeeklySlotsMap(map);
      } catch (err) {
        console.error("Failed to compile weekly routine map:", err);
      }
    }
    loadWeeklySlots();
  }, [activeSubTab]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Class Schedule & Timetable</h1>
          <p className="page-subtitle">Organize and monitor daily class schedules, subject topics, and teachers.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} />
          <span>Schedule Class</span>
        </button>
      </div>

      {/* Sub tabs navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem', gap: '0.5rem' }}>
        <button 
          onClick={() => setActiveSubTab('daily')} 
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'daily' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'daily' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: '800',
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>📅</span> Daily Timeline
        </button>
        <button 
          onClick={() => setActiveSubTab('weekly')} 
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeSubTab === 'weekly' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeSubTab === 'weekly' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: '800',
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>🗓️</span> Weekly Master Routine
        </button>
      </div>

      {activeSubTab === 'daily' ? (
        /* DAILY TIMETABLE VIEW */
        <div>
          {/* Filters Bar Grid */}
          <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Top row: Date navigation & Clear actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button className="btn btn-secondary" onClick={handlePrevDay} style={{ padding: '0.55rem 0.85rem' }}>
                  <ChevronLeft size={16} />
                </button>
                
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Calendar size={16} style={{ position: 'absolute', left: '0.85rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input 
                    type="date" 
                    className="form-control" 
                    style={{ paddingLeft: '2.5rem', width: '165px', fontSize: '0.85rem', fontWeight: '700' }}
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                  />
                </div>

                <button className="btn btn-secondary" onClick={handleNextDay} style={{ padding: '0.55rem 0.85rem' }}>
                  <ChevronRight size={16} />
                </button>

                <button 
                  className="btn btn-secondary" 
                  onClick={() => setCurrentDate(new Date().toISOString().split('T')[0])} 
                  style={{ fontSize: '0.8rem', padding: '0.55rem 1rem', display: currentDate === new Date().toISOString().split('T')[0] ? 'none' : 'inline-flex' }}
                >
                  Today
                </button>
              </div>

              {/* Clear Filters Indicator */}
              {(selectedBatch !== 'All' || filterTeacher !== 'All' || filterSubject !== 'All' || filterStudent !== 'All' || filterTime !== 'All') && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setSelectedBatch('All');
                    setFilterTeacher('All');
                    setFilterSubject('All');
                    setFilterStudent('All');
                    setFilterTime('All');
                  }}
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Bottom Row: Detailed selectors grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              
              {/* 1. Class wise filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Class/Batch</label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
                  value={selectedBatch}
                  onChange={(e) => {
                    setSelectedBatch(e.target.value);
                    setFilterStudent('All'); // Clear student to avoid filter clash
                  }}
                >
                  <option value="All">All Batches</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* 2. Subject wise filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Subject</label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <option value="All">All Subjects</option>
                  {uniqueSubjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* 3. Teacher wise filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Teacher</label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                >
                  <option value="All">All Teachers</option>
                  {uniqueTeachers.map(teach => (
                    <option key={teach} value={teach}>{teach}</option>
                  ))}
                </select>
              </div>

              {/* 4. Student wise filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Student</label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
                  value={filterStudent}
                  onChange={(e) => {
                    setFilterStudent(e.target.value);
                    if (e.target.value !== 'All') {
                      const stud = students.find(s => s.id === e.target.value);
                      if (stud) setSelectedBatch(stud.batch_id); // Auto select corresponding batch
                    }
                  }}
                >
                  <option value="All">All Students</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.standard})</option>
                  ))}
                </select>
              </div>

              {/* 5. Time wise filter */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Time of Day</label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                >
                  <option value="All">All Times</option>
                  <option value="Morning">Morning (before 12 PM)</option>
                  <option value="Afternoon">Afternoon (12 PM - 4 PM)</option>
                  <option value="Evening">Evening (after 4 PM)</option>
                </select>
              </div>

            </div>

          </div>

          {/* Timeline Slots Grid */}
          {loading ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading schedule slots...</div>
          ) : filteredSlots.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(37,99,235,0.05)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                <Calendar size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.25rem' }}>No Classes Scheduled</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  There are no active timetable items registered for this date.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ marginTop: '0.5rem', padding: '0.6rem 1.25rem', fontSize: '0.8rem' }}>
                Schedule a Class
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {filteredSlots.map(slot => {
                const subColor = getSubjectColor(slot.subject);
                return (
                  <div 
                    key={slot.id} 
                    className="card timetable-slot-card"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.1fr 2fr 1.2fr',
                      alignItems: 'center',
                      padding: '1.4rem 1.8rem',
                      borderLeft: `5px solid ${subColor}`,
                      gap: '1.5rem',
                      position: 'relative'
                    }}
                  >
                    {/* 1. Time Badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: '800', fontSize: '1rem' }}>
                        <Clock size={16} style={{ color: subColor }} />
                        <span>{formatTime12h(slot.start_time)}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '1.5rem', fontWeight: '600' }}>
                        to {formatTime12h(slot.end_time)}
                      </span>
                    </div>

                    {/* 2. Lecture Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="badge" style={{ backgroundColor: `${subColor}15`, color: subColor, border: `1px solid ${subColor}30`, padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                          {getBatchName(slot.batch_id)}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                          {slot.subject}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                        {slot.topic || 'Regular Coaching Session'}
                      </h4>
                    </div>

                    {/* 3. Teacher, Room & Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-secondary)' }}>
                          <User size={13} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontWeight: '600' }}>{slot.teacher_name || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-secondary)' }}>
                          <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontWeight: '600' }}>{slot.room || 'General Classroom'}</span>
                        </div>
                      </div>

                      {/* Controls */}
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => handleOpenEditModal(slot)} 
                          style={{ padding: '0.45rem 0.55rem', border: '1px solid var(--border-color)' }}
                          title="Edit Schedule Slot"
                        >
                          <Edit size={14} style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => handleDeleteSlot(slot.id)} 
                          style={{ padding: '0.45rem 0.55rem', border: '1px solid var(--border-color)' }}
                          title="Delete Schedule Slot"
                        >
                          <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* WEEKLY MASTER ROUTINE GRID MATRIX */
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.35rem' }}>🗓️ Weekly Schedule Matrix</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
              Review the standard class timings scheduled for the current week (Monday to Saturday).
            </p>
          </div>

          <div className="table-container timetable-matrix-container" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '150px' }}>Class / Batch</th>
                  {weeklyDays.map(day => (
                    <th key={day.dayName} style={{ minWidth: '140px', textAlign: 'center' }}>
                      <div>{day.dayName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{formatDateDisplay(day.dateStr)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                      No batches created. Please add batches to view the routine.
                    </td>
                  </tr>
                ) : (
                  batches.map(batch => (
                    <tr key={batch.id}>
                      <td style={{ fontWeight: '800', fontSize: '0.92rem', borderRight: '1px solid var(--border-color)' }}>
                        <div>{batch.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontWeight: '500' }}>
                          {batch.subject}
                        </div>
                      </td>
                      
                      {weeklyDays.map(day => {
                        const daySlots = weeklySlotsMap[day.dayName] || [];
                        const batchDaySlots = daySlots.filter(s => s.batch_id === batch.id);

                        return (
                          <td key={day.dayName} style={{ verticalAlign: 'middle', padding: '0.75rem 0.5rem', borderRight: '1px solid var(--border-color)', textAlign: 'center' }}>
                            {batchDaySlots.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                -
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                                {batchDaySlots.map(slot => (
                                  <div 
                                    key={slot.id} 
                                    style={{
                                      padding: '0.45rem 0.65rem',
                                      backgroundColor: 'rgba(37,99,235,0.04)',
                                      border: '1px solid rgba(37,99,235,0.15)',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      width: '100%',
                                      maxWidth: '130px',
                                      textAlign: 'center'
                                    }}
                                  >
                                    <div style={{ fontWeight: '800', color: 'var(--primary)' }}>
                                      {formatTime12h(slot.start_time)}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                                      {slot.topic || 'Session'}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>
                                      📍 {slot.room || 'Room A'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE SLOT MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Schedule New Class</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>Close</button>
            </div>
            
            <form onSubmit={handleAddSlotSubmit}>
              <div className="modal-body">
                
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formSlot.date}
                    onChange={(e) => setFormSlot(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Select Class / Batch *</label>
                  <select
                    className="form-control"
                    value={formSlot.batch_id}
                    onChange={(e) => handleFormBatchChange(e.target.value)}
                    required
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Start Time *</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formSlot.start_time}
                      onChange={(e) => setFormSlot(prev => ({ ...prev, start_time: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time *</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formSlot.end_time}
                      onChange={(e) => setFormSlot(prev => ({ ...prev, end_time: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Topic / Subject Lesson</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="E.g. Quadratic equations formulas, coulomb's law practice"
                    value={formSlot.topic}
                    onChange={(e) => setFormSlot(prev => ({ ...prev, topic: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Teacher Assigned</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formSlot.teacher_name}
                      onChange={(e) => setFormSlot(prev => ({ ...prev, teacher_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room / Hall</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="E.g. Room A"
                      value={formSlot.room}
                      onChange={(e) => setFormSlot(prev => ({ ...prev, room: e.target.value }))}
                    />
                  </div>
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Add Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SLOT MODAL */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Class Schedule</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>Close</button>
            </div>
            
            <form onSubmit={handleEditSlotSubmit}>
              <div className="modal-body">
                
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formSlot.date}
                    onChange={(e) => setFormSlot(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Select Class / Batch *</label>
                  <select
                    className="form-control"
                    value={formSlot.batch_id}
                    onChange={(e) => handleFormBatchChange(e.target.value)}
                    required
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Start Time *</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formSlot.start_time}
                      onChange={(e) => setFormSlot(prev => ({ ...prev, start_time: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time *</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formSlot.end_time}
                      onChange={(e) => setFormSlot(prev => ({ ...prev, end_time: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Topic / Subject Lesson</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formSlot.topic}
                    onChange={(e) => setFormSlot(prev => ({ ...prev, topic: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Teacher Assigned</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formSlot.teacher_name}
                      onChange={(e) => setFormSlot(prev => ({ ...prev, teacher_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room / Hall</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formSlot.room}
                      onChange={(e) => setFormSlot(prev => ({ ...prev, room: e.target.value }))}
                    />
                  </div>
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
