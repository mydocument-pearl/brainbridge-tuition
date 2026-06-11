import { db, isFirebaseConfigured } from './firebase';
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  where 
} from "firebase/firestore";

// Helper to format date from YYYY-MM-DD to DD-MM-YYYY
export const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return dateStr;
};


// Helper to generate UUIDs locally
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Initial Mock Data for LocalStorage Fallback
const INITIAL_BATCHES = [
  { id: 'b1', name: '10th Maths', subject: 'Mathematics', timing: '04:00 PM - 05:00 PM', teacher_name: 'Rakesh Sharma' },
  { id: 'b2', name: '11th Physics', subject: 'Physics', timing: '05:30 PM - 06:30 PM', teacher_name: 'Neha Patel' },
  { id: 'b3', name: '12th Accounts', subject: 'Accountancy', timing: '06:30 PM - 07:30 PM', teacher_name: 'S. K. Mehta' }
];

const INITIAL_STUDENTS = [
  { id: 's1', name: 'Amit Sharma', mobile: '9876500001', parent_mobile: '9876500011', address: '12, Shanti Nagar, Indore', school: 'DPS', standard: '10th', admission_date: '2026-04-10', batch_id: 'b1' },
  { id: 's2', name: 'Priyanshu Patel', mobile: '9876500002', parent_mobile: '9876500012', address: '45, Scheme 54, Indore', school: 'St. Pauls', standard: '11th', admission_date: '2026-04-12', batch_id: 'b2' },
  { id: 's3', name: 'Riya Mehta', mobile: '9876500003', parent_mobile: '9876500013', address: '102, Silver Arcade, Indore', school: 'Choithram', standard: '12th', admission_date: '2026-04-15', batch_id: 'b3' },
  { id: 's4', name: 'Rahul Verma', mobile: '9876500004', parent_mobile: '9876500014', address: '88, Vijay Nagar, Indore', school: 'DPS', standard: '10th', admission_date: '2026-04-20', batch_id: 'b1' }
];

const INITIAL_FEES = [
  { id: 'f1', student_id: 's1', amount: 1500, due_date: '2026-06-10', status: 'Paid', payment_date: '2026-06-02', payment_mode: 'UPI' },
  { id: 'f2', student_id: 's2', amount: 2000, due_date: '2026-06-10', status: 'Pending', payment_date: null, payment_mode: '' },
  { id: 'f3', student_id: 's3', amount: 2500, due_date: '2026-06-05', status: 'Paid', payment_date: '2026-06-04', payment_mode: 'Cash' },
  { id: 'f4', student_id: 's4', amount: 1500, due_date: '2026-06-10', status: 'Pending', payment_date: null, payment_mode: '' }
];

const INITIAL_ATTENDANCE = [
  { id: 'a1', student_id: 's1', date: '2026-06-05', status: 'Present' },
  { id: 'a2', student_id: 's2', date: '2026-06-05', status: 'Absent' },
  { id: 'a3', student_id: 's3', date: '2026-06-05', status: 'Present' },
  { id: 'a4', student_id: 's4', date: '2026-06-05', status: 'Present' }
];

const INITIAL_TESTS = [
  { id: 't1', test_name: 'Unit Test 1 (Algebra)', subject: 'Mathematics', max_marks: 50, test_date: '2026-05-25' },
  { id: 't2', test_name: 'Electrostatics MCQ', subject: 'Physics', max_marks: 30, test_date: '2026-05-28' }
];

const INITIAL_TEST_MARKS = [
  { id: 'tm1', test_id: 't1', student_id: 's1', marks_obtained: 42 },
  { id: 'tm2', test_id: 't1', student_id: 's4', marks_obtained: 38 },
  { id: 'tm3', test_id: 't2', student_id: 's2', marks_obtained: 24 }
];

const INITIAL_TESTIMONIALS = [
  { id: 'tst1', parent_name: 'Sunita Sharma', student_name: 'Amit Sharma', rating: 5, feedback: 'Rakesh Sir teaches Mathematics so well that my son now looks forward to attending classes! Highly recommended!', date: '2026-06-01' },
  { id: 'tst2', parent_name: 'Dr. Rajesh Patel', student_name: 'Priyanshu Patel', rating: 5, feedback: 'Excellent study material and regular test series. Priyanshu showed 20% improvement in physics scores.', date: '2026-06-03' },
  { id: 'tst3', parent_name: 'Meera Mehta', student_name: 'Riya Mehta', rating: 5, feedback: 'Accounts classes are very interactive. The batch size is small which allows personalized attention for every student.', date: '2026-06-04' }
];

const INITIAL_TIMETABLE = [
  { id: 'tt1', batch_id: 'b1', date: '2026-06-05', start_time: '16:00', end_time: '17:00', subject: 'Mathematics', topic: 'Trigonometry Introduction', teacher_name: 'Rakesh Sharma', room: 'Room A' },
  { id: 'tt2', batch_id: 'b2', date: '2026-06-05', start_time: '17:30', end_time: '18:30', subject: 'Physics', topic: 'Electrostatics Part 1', teacher_name: 'Neha Patel', room: 'Room B' },
  { id: 'tt3', batch_id: 'b3', date: '2026-06-05', start_time: '18:30', end_time: '19:30', subject: 'Accountancy', topic: 'Double Entry System', teacher_name: 'S. K. Mehta', room: 'Room C' },

  { id: 'tt4', batch_id: 'b1', date: '2026-06-06', start_time: '16:00', end_time: '17:00', subject: 'Mathematics', topic: 'Trigonometric Identities', teacher_name: 'Rakesh Sharma', room: 'Room A' },
  { id: 'tt5', batch_id: 'b2', date: '2026-06-06', start_time: '17:30', end_time: '18:30', subject: 'Physics', topic: 'Coulomb\'s Law MCQ Practice', teacher_name: 'Neha Patel', room: 'Room B' },

  { id: 'tt6', batch_id: 'b1', date: '2026-06-08', start_time: '16:00', end_time: '17:00', subject: 'Mathematics', topic: 'Height and Distance Problems', teacher_name: 'Rakesh Sharma', room: 'Room A' },
  { id: 'tt7', batch_id: 'b3', date: '2026-06-08', start_time: '18:30', end_time: '19:30', subject: 'Accountancy', topic: 'Ledger Postings & Trial Balance', teacher_name: 'S. K. Mehta', room: 'Room C' }
];

// LocalStorage Initializer Helper
const getLocalData = (key, initial) => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const saveLocalData = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const getCurrentAdmin = () => {
  return sessionStorage.getItem('bb_current_admin') || 'Anonymous Admin';
};

// Fallback logic for database outages / offline mode
let useLocalStorageFallback = false;
const forceLocalMode = localStorage.getItem('bb_db_mode') === 'local';

const runQuery = async (firebaseQueryFn, localStorageFallbackFn) => {
  if (isFirebaseConfigured && !useLocalStorageFallback && !forceLocalMode) {
    try {
      const result = await Promise.race([
        firebaseQueryFn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase request timeout')), 2500))
      ]);
      return result;
    } catch (error) {
      console.warn("Firebase query failed or timed out, falling back to LocalStorage:", error);
      useLocalStorageFallback = true;
      return localStorageFallbackFn();
    }
  }
  return localStorageFallbackFn();
};

export const dbService = {
  // --- AUDIT LOGGING ---
  async logActivity(action) {
    const admin = getCurrentAdmin();
    const timestamp = new Date().toISOString();
    const logEntry = {
      admin,
      action,
      timestamp
    };

    return runQuery(
      async () => {
        try {
          await addDoc(collection(db, "logs"), logEntry);
        } catch (err) {
          console.error("Failed to write Cloud audit log:", err);
        }
      },
      () => {
        try {
          const logs = getLocalData('bb_logs', []);
          const newLog = { ...logEntry, id: generateUUID() };
          logs.unshift(newLog);
          if (logs.length > 500) {
            logs.length = 500;
          }
          saveLocalData('bb_logs', logs);
        } catch (err) {
          console.error("Failed to write Local audit log:", err);
        }
      }
    );
  },

  // --- BATCHES ---
  async getBatches() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "batches"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => getLocalData('bb_batches', INITIAL_BATCHES)
    );
  },

  async addBatch(batch) {
    await dbService.logActivity(`Created new batch "${batch.name}"`);
    return runQuery(
      async () => {
        const docRef = await addDoc(collection(db, "batches"), batch);
        return { id: docRef.id, ...batch };
      },
      () => {
        const batches = getLocalData('bb_batches', INITIAL_BATCHES);
        const newBatch = { ...batch, id: generateUUID() };
        batches.push(newBatch);
        saveLocalData('bb_batches', batches);
        return newBatch;
      }
    );
  },

  // --- STUDENTS ---
  async getStudents() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "students"));
        return querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(student => !student.archived);
      },
      () => getLocalData('bb_students', INITIAL_STUDENTS).filter(student => !student.archived)
    );
  },

  async addStudent(student) {
    await dbService.logActivity(`Registered student "${student.name}"`);
    return runQuery(
      async () => {
        // Create student document
        const docRef = await addDoc(collection(db, "students"), student);
        const newStudent = { id: docRef.id, ...student };

        // Also automatically initialize a pending fee entry for the new student
        const feeAmount = student.standard === '10th' ? 1500 : student.standard === '11th' ? 2000 : 2500;
        const today = new Date();
        const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 10).toISOString().split('T')[0]; // Next month 10th
        
        const feeData = {
          student_id: newStudent.id,
          amount: feeAmount,
          due_date: dueDate,
          status: 'Pending',
          payment_date: null,
          payment_mode: ''
        };
        await addDoc(collection(db, "fees"), feeData);

        return newStudent;
      },
      () => {
        const students = getLocalData('bb_students', INITIAL_STUDENTS);
        const newStudent = { ...student, id: generateUUID() };
        students.push(newStudent);
        saveLocalData('bb_students', students);
        
        // Also automatically initialize a pending fee entry for the new student
        const fees = getLocalData('bb_fees', INITIAL_FEES);
        const feeAmount = student.standard === '10th' ? 1500 : student.standard === '11th' ? 2000 : 2500;
        const today = new Date();
        const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 10).toISOString().split('T')[0]; // Next month 10th
        fees.push({
          id: generateUUID(),
          student_id: newStudent.id,
          amount: feeAmount,
          due_date: dueDate,
          status: 'Pending',
          payment_date: null,
          payment_mode: ''
        });
        saveLocalData('bb_fees', fees);

        return newStudent;
      }
    );
  },

  async updateStudent(id, updatedStudent) {
    await dbService.logActivity(`Updated student "${updatedStudent.name || id}" details`);
    return runQuery(
      async () => {
        const docRef = doc(db, "students", id);
        await updateDoc(docRef, updatedStudent);
        return { id, ...updatedStudent };
      },
      () => {
        const students = getLocalData('bb_students', INITIAL_STUDENTS);
        const idx = students.findIndex(s => s.id === id);
        if (idx !== -1) {
          students[idx] = { ...students[idx], ...updatedStudent };
          saveLocalData('bb_students', students);
          return students[idx];
        }
        throw new Error("Student not found");
      }
    );
  },

  async archiveStudent(studentId) {
    const admin = getCurrentAdmin();
    const timestamp = new Date().toISOString();
    const archiveData = {
      archived: true,
      archived_by: admin,
      archived_at: timestamp
    };

    await dbService.logActivity(`Archived student with ID "${studentId}"`);

    return runQuery(
      async () => {
        const docRef = doc(db, "students", studentId);
        await updateDoc(docRef, archiveData);
        return true;
      },
      () => {
        const students = getLocalData('bb_students', INITIAL_STUDENTS);
        const idx = students.findIndex(s => s.id === studentId);
        if (idx !== -1) {
          students[idx] = { ...students[idx], ...archiveData };
          saveLocalData('bb_students', students);
          return true;
        }
        throw new Error("Student not found");
      }
    );
  },

  // --- ATTENDANCE ---
  async getAttendance(date) {
    return runQuery(
      async () => {
        const q = query(collection(db, "attendance"), where("date", "==", date));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => {
        const attendance = getLocalData('bb_attendance', INITIAL_ATTENDANCE);
        return attendance.filter(a => a.date === date);
      }
    );
  },

  async getLatestAttendanceDate() {
    return runQuery(
      async () => {
        const q = query(collection(db, "attendance"), orderBy("date", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          return querySnapshot.docs[0].data().date;
        }
        return null;
      },
      () => {
        const attendance = getLocalData('bb_attendance', INITIAL_ATTENDANCE);
        if (attendance.length > 0) {
          const uniqueDates = [...new Set(attendance.map(a => a.date))].sort();
          return uniqueDates[uniqueDates.length - 1];
        }
        return null;
      }
    );
  },

  async getAllAttendance() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "attendance"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => getLocalData('bb_attendance', INITIAL_ATTENDANCE)
    );
  },

  async saveAttendance(date, records) {
    await dbService.logActivity(`Saved attendance for date ${date}`);
    return runQuery(
      async () => {
        const promises = records.map(record => {
          const docId = `${record.student_id}_${date}`;
          return setDoc(doc(db, "attendance", docId), {
            student_id: record.student_id,
            date: date,
            status: record.status
          });
        });
        await Promise.all(promises);
        return records;
      },
      () => {
        let attendance = getLocalData('bb_attendance', INITIAL_ATTENDANCE);
        // Remove existing records for this date first to avoid duplicates
        attendance = attendance.filter(a => a.date !== date);
        // Add new ones
        records.forEach(r => {
          attendance.push({
            id: generateUUID(),
            student_id: r.student_id,
            date: date,
            status: r.status
          });
        });
        saveLocalData('bb_attendance', attendance);
        return records;
      }
    );
  },

  // --- FEES ---
  async getFees() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "fees"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => getLocalData('bb_fees', INITIAL_FEES)
    );
  },

  async updateFeeStatus(feeId, statusUpdate) {
    await dbService.logActivity(`Updated fee status for record ${feeId} to ${statusUpdate.status}`);
    return runQuery(
      async () => {
        const docRef = doc(db, "fees", feeId);
        await updateDoc(docRef, statusUpdate);
        const docSnap = await getDoc(docRef);
        return { id: docSnap.id, ...docSnap.data() };
      },
      () => {
        const fees = getLocalData('bb_fees', INITIAL_FEES);
        const idx = fees.findIndex(f => f.id === feeId);
        if (idx !== -1) {
          fees[idx] = { ...fees[idx], ...statusUpdate };
          saveLocalData('bb_fees', fees);
          return fees[idx];
        }
        throw new Error("Fee record not found");
      }
    );
  },

  // --- TESTS & MARKS ---
  async getTests() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "tests"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => getLocalData('bb_tests', INITIAL_TESTS)
    );
  },

  async addTest(test) {
    await dbService.logActivity(`Added test "${test.test_name}"`);
    return runQuery(
      async () => {
        const docRef = await addDoc(collection(db, "tests"), test);
        return { id: docRef.id, ...test };
      },
      () => {
        const tests = getLocalData('bb_tests', INITIAL_TESTS);
        const newTest = { ...test, id: generateUUID() };
        tests.push(newTest);
        saveLocalData('bb_tests', tests);
        return newTest;
      }
    );
  },

  async getTestMarks(testId) {
    return runQuery(
      async () => {
        const q = query(collection(db, "test_marks"), where("test_id", "==", testId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => {
        const marks = getLocalData('bb_test_marks', INITIAL_TEST_MARKS);
        return marks.filter(m => m.test_id === testId);
      }
    );
  },

  async saveTestMarks(testId, marksList) {
    await dbService.logActivity(`Saved marks for test ID ${testId}`);
    return runQuery(
      async () => {
        const promises = marksList.map(m => {
          const docId = `${testId}_${m.student_id}`;
          return setDoc(doc(db, "test_marks", docId), {
            test_id: testId,
            student_id: m.student_id,
            marks_obtained: Number(m.marks_obtained)
          });
        });
        await Promise.all(promises);
        return marksList;
      },
      () => {
        let marks = getLocalData('bb_test_marks', INITIAL_TEST_MARKS);
        // Remove existing marks for this test first
        marks = marks.filter(m => m.test_id !== testId);
        marksList.forEach(m => {
          marks.push({
            id: generateUUID(),
            test_id: testId,
            student_id: m.student_id,
            marks_obtained: Number(m.marks_obtained)
          });
        });
        saveLocalData('bb_test_marks', marks);
        return marksList;
      }
    );
  },

  // --- TESTIMONIALS ---
  async getTestimonials() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "testimonials"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => getLocalData('bb_testimonials', INITIAL_TESTIMONIALS)
    );
  },

  async addTestimonial(testimonial) {
    await dbService.logActivity(`Added testimonial from parent "${testimonial.parent_name}" for student "${testimonial.student_name}"`);
    return runQuery(
      async () => {
        const docRef = await addDoc(collection(db, "testimonials"), testimonial);
        return { id: docRef.id, ...testimonial };
      },
      () => {
        const testimonials = getLocalData('bb_testimonials', INITIAL_TESTIMONIALS);
        const newTestimonial = { ...testimonial, id: generateUUID() };
        testimonials.push(newTestimonial);
        saveLocalData('bb_testimonials', testimonials);
        return newTestimonial;
      }
    );
  },

  // --- TIMETABLE ---
  async getTimetable(date) {
    return runQuery(
      async () => {
        const q = query(collection(db, "timetable"), where("date", "==", date));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(slot => !slot.archived);
      },
      () => {
        const timetable = getLocalData('bb_timetable', INITIAL_TIMETABLE);
        return timetable.filter(t => t.date === date && !t.archived);
      }
    );
  },

  async addTimetableSlot(slot) {
    await dbService.logActivity(`Added timetable slot for batch ID ${slot.batch_id} on ${slot.date}`);
    return runQuery(
      async () => {
        const docRef = await addDoc(collection(db, "timetable"), slot);
        return { id: docRef.id, ...slot };
      },
      () => {
        const timetable = getLocalData('bb_timetable', INITIAL_TIMETABLE);
        const newSlot = { ...slot, id: generateUUID() };
        timetable.push(newSlot);
        saveLocalData('bb_timetable', timetable);
        return newSlot;
      }
    );
  },

  async updateTimetableSlot(id, updatedSlot) {
    await dbService.logActivity(`Updated timetable slot ID ${id}`);
    return runQuery(
      async () => {
        const docRef = doc(db, "timetable", id);
        await updateDoc(docRef, updatedSlot);
        const docSnap = await getDoc(docRef);
        return { id: docSnap.id, ...docSnap.data() };
      },
      () => {
        const timetable = getLocalData('bb_timetable', INITIAL_TIMETABLE);
        const idx = timetable.findIndex(t => t.id === id);
        if (idx !== -1) {
          timetable[idx] = { ...timetable[idx], ...updatedSlot };
          saveLocalData('bb_timetable', timetable);
          return timetable[idx];
        }
        throw new Error("Timetable slot not found");
      }
    );
  },

  async deleteTimetableSlot(id) {
    const admin = getCurrentAdmin();
    const timestamp = new Date().toISOString();
    const archiveData = {
      archived: true,
      archived_by: admin,
      archived_at: timestamp
    };

    await dbService.logActivity(`Deleted timetable slot with ID "${id}"`);

    return runQuery(
      async () => {
        const docRef = doc(db, "timetable", id);
        await updateDoc(docRef, archiveData);
        return true;
      },
      () => {
        const timetable = getLocalData('bb_timetable', INITIAL_TIMETABLE);
        const idx = timetable.findIndex(t => t.id === id);
        if (idx !== -1) {
          timetable[idx] = { ...timetable[idx], ...archiveData };
          saveLocalData('bb_timetable', timetable);
          return true;
        }
        return false;
      }
    );
  },

  getDbMode() {
    return localStorage.getItem('bb_db_mode') || (isFirebaseConfigured ? 'cloud' : 'local');
  },

  setDbMode(mode) {
    localStorage.setItem('bb_db_mode', mode);
    window.location.reload();
  },

  isFirebaseConfigured() {
    return isFirebaseConfigured;
  },

  async resetDemoData() {
    await dbService.logActivity(`Reset database to demo data`);
    // 1. Clear LocalStorage anyway
    localStorage.removeItem('bb_batches');
    localStorage.removeItem('bb_students');
    localStorage.removeItem('bb_fees');
    localStorage.removeItem('bb_attendance');
    localStorage.removeItem('bb_tests');
    localStorage.removeItem('bb_test_marks');
    localStorage.removeItem('bb_testimonials');
    localStorage.removeItem('bb_timetable');

    // 2. If Cloud Mode (Firebase) is active and configured, reset Firestore collections
    const activeMode = localStorage.getItem('bb_db_mode') || (isFirebaseConfigured ? 'cloud' : 'local');
    if (isFirebaseConfigured && activeMode === 'cloud') {
      try {
        const collections = ['batches', 'students', 'fees', 'attendance', 'tests', 'test_marks', 'testimonials', 'timetable'];
        
        // Delete all existing documents in parallel
        await Promise.all(collections.map(async (colName) => {
          const querySnapshot = await getDocs(collection(db, colName));
          await Promise.all(querySnapshot.docs.map(docRef => deleteDoc(doc(db, colName, docRef.id))));
        }));

        // Now seed the default mock data into Firestore using defined IDs to keep relationships intact
        // Batches
        await Promise.all(INITIAL_BATCHES.map(b => 
          setDoc(doc(db, "batches", b.id), { name: b.name, subject: b.subject, timing: b.timing, teacher_name: b.teacher_name })
        ));

        // Students
        await Promise.all(INITIAL_STUDENTS.map(s => 
          setDoc(doc(db, "students", s.id), { name: s.name, mobile: s.mobile, parent_mobile: s.parent_mobile, address: s.address, school: s.school, standard: s.standard, admission_date: s.admission_date, batch_id: s.batch_id })
        ));

        // Fees
        await Promise.all(INITIAL_FEES.map(f => 
          setDoc(doc(db, "fees", f.id), { student_id: f.student_id, amount: f.amount, due_date: f.due_date, status: f.status, payment_date: f.payment_date, payment_mode: f.payment_mode })
        ));

        // Attendance
        await Promise.all(INITIAL_ATTENDANCE.map(a => 
          setDoc(doc(db, "attendance", a.id), { student_id: a.student_id, date: a.date, status: a.status })
        ));

        // Tests
        await Promise.all(INITIAL_TESTS.map(t => 
          setDoc(doc(db, "tests", t.id), { test_name: t.test_name, subject: t.subject, max_marks: t.max_marks, test_date: t.test_date })
        ));

        // Test Marks
        await Promise.all(INITIAL_TEST_MARKS.map(tm => 
          setDoc(doc(db, "test_marks", tm.id), { test_id: tm.test_id, student_id: tm.student_id, marks_obtained: tm.marks_obtained })
        ));

        // Testimonials
        await Promise.all(INITIAL_TESTIMONIALS.map(tst => 
          setDoc(doc(db, "testimonials", tst.id), { parent_name: tst.parent_name, student_name: tst.student_name, rating: tst.rating, feedback: tst.feedback, date: tst.date })
        ));

        // Timetable
        await Promise.all(INITIAL_TIMETABLE.map(tt => 
          setDoc(doc(db, "timetable", tt.id), { batch_id: tt.batch_id, date: tt.date, start_time: tt.start_time, end_time: tt.end_time, subject: tt.subject, topic: tt.topic, teacher_name: tt.teacher_name, room: tt.room })
        ));

      } catch (error) {
        console.error("Failed to reset Firestore collections:", error);
        alert("Error resetting Cloud database: " + error.message);
      }
    }

    window.location.reload();
  }
};
