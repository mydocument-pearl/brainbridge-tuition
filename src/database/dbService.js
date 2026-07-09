import { 
  db, 
  isFirebaseConfigured, 
  auth,
  collection as firestoreCollection, 
  getDocs, 
  getDoc,
  doc as firestoreDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  where,
  onSnapshot,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from './firebase';

// --- FIREBASE AUTHENTICATION HELPERS ---
const AUTH_PROJECT_SECRET = "EduBridgeSecurePass2026!";

// Helper to generate a unique deterministic email address for each user type
const getVirtualEmail = (role, tenantId, docId, passwordHash) => {
  const cleanTenant = String(tenantId || 'global').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const cleanDocId = String(docId || 'user').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  const cleanHash = String(passwordHash || '').trim().toLowerCase();
  return `${role}_${cleanTenant}_${cleanDocId}_${cleanHash.slice(0, 32)}@edubridge.internal`;
};

// Log in or dynamically register the user in Firebase Auth using the project secret
const authenticateUserWithAuth = async (role, tenantId, docId, passwordHash) => {
  if (!isFirebaseConfigured || !auth) return null;
  const email = getVirtualEmail(role, tenantId, docId, passwordHash);
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, AUTH_PROJECT_SECRET);
    return userCred.user;
  } catch (error) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, AUTH_PROJECT_SECRET);
        return userCred.user;
      } catch (createError) {
        console.error("Failed to create Firebase Auth user:", createError);
        throw createError;
      }
    }
    console.error("Firebase Auth sign in error:", error);
    throw error;
  }
};

const signInGuest = async () => {
  if (!isFirebaseConfigured || !auth) return null;
  try {
    const userCred = await signInWithEmailAndPassword(auth, 'guest@edubridge.com', 'guestPassword123!');
    return userCred.user;
  } catch (error) {
    console.error("Failed to sign in as guest:", error);
    throw error;
  }
};

let isAuthInitialized = false;
let authInitPromise = null;

const ensureAuthInitialized = async () => {
  if (!isFirebaseConfigured || !auth) return null;

  const storedUser = sessionStorage.getItem('bb_current_user');
  const userObj = storedUser ? JSON.parse(storedUser) : null;
  const authEmail = userObj?.authEmail;
  const authPassword = userObj?.authPassword;

  // Wait for Firebase Auth to restore the session from cache initially
  if (!isAuthInitialized) {
    if (authInitPromise) {
      await authInitPromise;
    } else {
      authInitPromise = new Promise((resolve) => {
        const timer = setTimeout(() => {
          isAuthInitialized = true;
          resolve(auth.currentUser);
        }, 1000);

        const unsubscribe = onAuthStateChanged(auth, (user) => {
          clearTimeout(timer);
          isAuthInitialized = true;
          resolve(user);
          unsubscribe();
        });
      });
      await authInitPromise;
    }
  }

  // Verify and dynamically restore the expected logged-in user session
  if (authEmail) {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.email !== authEmail) {
      try {
        const password = authPassword || AUTH_PROJECT_SECRET;
        const userCred = await signInWithEmailAndPassword(auth, authEmail, password);
        return userCred.user;
      } catch (err) {
        console.error("Failed to restore authenticated user session:", err);
      }
    }
  }

  return auth.currentUser;
};

const ensureAuthenticatedForTenant = async (tenantId) => {
  if (!isFirebaseConfigured || !auth) return null;
  
  // Wait for Firebase Auth to restore the session from cache
  await ensureAuthInitialized();

  const currentUser = auth.currentUser;
  if (currentUser) {
    const email = currentUser.email || '';
    const cleanTenant = String(tenantId || '').trim().toLowerCase();
    
    // If already logged in as superadmin, we have access to everything
    if (email === 'superadmin@edubridge.internal' || email === 'admin@edubridge.com') {
      return currentUser;
    }
    
    // If logged in as a user for this specific tenant, we don't need guest sign-in
    if (email.startsWith('owner_' + cleanTenant + '_') || 
        email.startsWith('staff_' + cleanTenant + '_') || 
        email.startsWith('student_' + cleanTenant + '_')) {
      return currentUser;
    }
  }
  
  // Otherwise, we must sign in as guest to get read access
  return await signInGuest();
};

const signOutUser = async () => {
  if (isFirebaseConfigured && auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
  }
};

// --- SAAS MULTI-TENANCY DB WRAPPERS ---
const collection = (dbInstance, name) => {
  const tenantCode = dbService.getTenantCode();
  if (name === "tenants") {
    return firestoreCollection(dbInstance, "tenants");
  }
  if (tenantCode) {
    return firestoreCollection(dbInstance, "tenants", tenantCode, name);
  }
  return firestoreCollection(dbInstance, name);
};

const doc = (dbInstance, name, id) => {
  const tenantCode = dbService.getTenantCode();
  if (name === "tenants") {
    return firestoreDoc(dbInstance, "tenants", id);
  }
  if (tenantCode) {
    return firestoreDoc(dbInstance, "tenants", tenantCode, name, id);
  }
  return firestoreDoc(dbInstance, name, id);
};

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

// Helper to open WhatsApp web/app with pre-filled message
export const sendWhatsAppMessage = (mobileNumber, messageText) => {
  if (!mobileNumber) return;
  let cleanNumber = mobileNumber.replace(/\D/g, '');
  if (cleanNumber.length === 10) {
    cleanNumber = '91' + cleanNumber;
  }
  const encodedText = encodeURIComponent(messageText);
  const whatsappScheme = `whatsapp://send?phone=${cleanNumber}&text=${encodedText}`;
  const whatsappWebUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodedText}`;
  
  try {
    // Try to open using Capacitor _system target (opens system browser/app)
    const opened = window.open(whatsappScheme, '_system') || window.open(whatsappWebUrl, '_system') || window.open(whatsappWebUrl, '_blank');
    if (!opened) {
      // Fallback if window.open returns null/falsy
      window.location.href = whatsappWebUrl;
    }
  } catch (err) {
    console.error("Failed to open WhatsApp window, trying location.href:", err);
    try {
      window.location.href = whatsappWebUrl;
    } catch (e) {
      console.error("Failed to navigate to WhatsApp URL:", e);
    }
  }
};


// Helper to generate UUIDs locally
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Cryptographic helper to hash passwords using SHA-256 (Web Crypto API)
const hashPassword = async (password) => {
  if (!password) return "";
  const msgUint8 = new TextEncoder().encode(password.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};


// Initial Mock Data for LocalStorage Fallback
const INITIAL_BATCHES = [
  { id: 'b1', name: '10th Maths', subject: 'Mathematics', timing: '04:00 PM - 05:00 PM', teacher_name: 'Rakesh Sharma' },
  { id: 'b2', name: '11th Physics', subject: 'Physics', timing: '05:30 PM - 06:30 PM', teacher_name: 'Neha Patel' },
  { id: 'b3', name: '12th Accounts', subject: 'Accountancy', timing: '06:30 PM - 07:30 PM', teacher_name: 'S. K. Mehta' }
];

const INITIAL_STUDENTS = [
  { id: 's1', student_id: 1001, name: 'Amit Sharma', mobile: '9876500001', parent_mobile: '9876500011', parent_name: 'Sunita Sharma', address: '12, Shanti Nagar, Indore', school: 'DPS', standard: '10th', admission_date: '2026-04-10', batch_id: 'b1', email: 'amit@example.com' },
  { id: 's2', student_id: 1002, name: 'Priyanshu Patel', mobile: '9876500002', parent_mobile: '9876500012', parent_name: 'Dr. Rajesh Patel', address: '45, Scheme 54, Indore', school: 'St. Pauls', standard: '11th', admission_date: '2026-04-12', batch_id: 'b2', email: 'priyanshu@example.com' },
  { id: 's3', student_id: 1003, name: 'Riya Mehta', mobile: '9876500003', parent_mobile: '9876500013', parent_name: 'Meera Mehta', address: '102, Silver Arcade, Indore', school: 'Choithram', standard: '12th', admission_date: '2026-04-15', batch_id: 'b3', email: 'riya@example.com' },
  { id: 's4', student_id: 1004, name: 'Rahul Verma', mobile: '9876500004', parent_mobile: '9876500014', parent_name: 'Suresh Verma', address: '88, Vijay Nagar, Indore', school: 'DPS', standard: '10th', admission_date: '2026-04-20', batch_id: 'b1', email: 'rahul@example.com' }
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

const DEFAULT_FEATURES = {
  students: true,
  students_directory: true,
  students_summary: true,
  students_register: true,
  students_create_batch: true,
  owner_students_directory: true,
  owner_students_summary: true,
  owner_students_register: true,
  owner_students_create_batch: true,
  staff_students_directory: true,
  staff_students_summary: true,
  staff_students_register: true,
  staff_students_create_batch: true,
  timetable: true,
  attendance: true,
  fees: true,
  tests: true,
  homework: true,
  materials: true,
  branding: true,
  inquiries: true,
  inquiry_pending: true,
  inquiry_approved: true,
  inquiry_rejected: true,
  inquiry_all: true,
  inquiry_qrcode: true,
  owner_inquiry_pending: true,
  owner_inquiry_approved: true,
  owner_inquiry_rejected: true,
  owner_inquiry_all: true,
  owner_inquiry_qrcode: true,
  staff_inquiry_pending: true,
  staff_inquiry_approved: true,
  staff_inquiry_rejected: true,
  staff_inquiry_all: true,
  staff_inquiry_qrcode: true,
  owner_staff_pending: true,
  owner_staff_active: true,
  owner_staff_rejected: true,
  owner_staff_all: true,
  staff_staff_pending: false,
  staff_staff_active: false,
  staff_staff_rejected: false,
  staff_staff_all: false,
  teacher_login: true,
  fee_reminder: true,
  db_fees: true,
  db_attendance: true,
  db_tests: true,
  db_homework: true,
  db_materials: true,
  db_testimonials: true,
  owner_db_fees: true,
  owner_db_attendance: true,
  owner_db_tests: true,
  owner_db_homework: true,
  owner_db_materials: true,
  owner_db_testimonials: true,
  staff_db_fees: false,
  staff_db_attendance: true,
  staff_db_tests: true,
  staff_db_homework: true,
  staff_db_materials: true,
  staff_db_testimonials: true,
  owner_fee_reminder: true,
  staff_fee_reminder: false,
  owner_fee_date_filter: true,
  staff_fee_date_filter: true,
  owner_fee_father_search: true,
  staff_fee_father_search: true,
  owner_fee_date_search: true,
  staff_fee_date_search: true,
  owner_fee_receipt_edit: true,
  db_analytics: true,
  owner_db_analytics: true,
  staff_db_analytics: false
};

const INITIAL_TENANTS = [
  { id: 'owner_a', name: 'EduBridge Tuition', logo_url: '/logo.png', owner_whatsapp: '9876500000', admin_password: 'admin123', features: { ...DEFAULT_FEATURES }, created_at: new Date().toISOString() },
  { id: 'owner_b', name: 'Elite Coaching', logo_url: '/logo.png', owner_whatsapp: '9876500001', admin_password: 'admin123', features: { ...DEFAULT_FEATURES }, created_at: new Date().toISOString() }
];

const getLocalKey = (key) => {
  if (key === 'bb_tenants') {
    return key;
  }
  const tenantCode = dbService.getTenantCode();
  if (tenantCode) {
    return key.replace('bb_', `bb_${tenantCode}_`);
  }
  return key;
};

// LocalStorage Initializer Helper
const getLocalData = (key, initial) => {
  const scopedKey = getLocalKey(key);
  const data = localStorage.getItem(scopedKey);
  if (!data) {
    localStorage.setItem(scopedKey, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const saveLocalData = (key, data) => {
  const scopedKey = getLocalKey(key);
  localStorage.setItem(scopedKey, JSON.stringify(data));
};

const getCurrentAdmin = () => {
  return sessionStorage.getItem('bb_current_admin') || 'Anonymous Admin';
};

// Fallback logic for database outages / offline mode
const forceLocalMode = localStorage.getItem('bb_db_mode') === 'local';

const runQuery = async (firebaseQueryFn, localStorageFallbackFn) => {
  if (isFirebaseConfigured && !forceLocalMode) {
    try {
      return await firebaseQueryFn();
    } catch (error) {
      console.error("Firebase query failed:", error);
      throw error;
    }
  }
  return localStorageFallbackFn();
};

export const dbService = {
  // --- HELPERS ---
  sendWhatsAppMessage,
  signOutUser,

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
        const docId = String(batch.name || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_-]/g, '');
        const finalDocId = docId || generateUUID();
        const docRef = doc(db, "batches", finalDocId);
        await setDoc(docRef, batch);
        return { id: finalDocId, ...batch };
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
        const fallbackMap = { s1: 1001, s2: 1002, s3: 1003, s4: 1004 };
        return querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            const studentIdField = data.student_id || data.student_numeric_id || fallbackMap[doc.id] || null;
            return { id: doc.id, ...data, student_id: studentIdField };
          })
          .filter(student => !student.archived);
      },
      () => getLocalData('bb_students', INITIAL_STUDENTS).filter(student => !student.archived)
    );
  },

  async addStudent(student) {
    await dbService.logActivity(`Registered student "${student.name}"`);
    return runQuery(
      async () => {
        // Calculate next numerical student ID in Firebase
        const querySnapshot = await getDocs(collection(db, "students"));
        let maxId = 1000;
        querySnapshot.forEach(doc => {
          let val = parseInt(doc.data().student_id || doc.data().student_numeric_id);
          if (!val) {
            // Fallback for default documents
            if (doc.id === 's1') val = 1001;
            else if (doc.id === 's2') val = 1002;
            else if (doc.id === 's3') val = 1003;
            else if (doc.id === 's4') val = 1004;
          }
          if (val && val > maxId) {
            maxId = val;
          }
        });
        const nextId = maxId + 1;
        const studentWithId = { ...student, student_id: nextId };

        // Create custom student doc ID using name and nextId, e.g. Amit_Sharma_1001
        const cleanName = String(student.name || '').trim().replace(/\s+/g, '_');
        const customStudentDocId = `${cleanName}_${nextId}`;
        const docRef = doc(db, "students", customStudentDocId);
        await setDoc(docRef, studentWithId);
        const newStudent = { id: customStudentDocId, ...studentWithId };

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
        const customFeeDocId = `${newStudent.id}_${dueDate}`;
        await setDoc(doc(db, "fees", customFeeDocId), feeData);

        return newStudent;
      },
      () => {
        const students = getLocalData('bb_students', INITIAL_STUDENTS);
        let maxId = 1000;
        students.forEach(s => {
          const val = parseInt(s.student_id);
          if (val && val > maxId) {
            maxId = val;
          }
        });
        const nextId = maxId + 1;
        const studentWithId = { ...student, student_id: nextId };
        const cleanName = String(student.name || '').trim().replace(/\s+/g, '_');
        const customStudentDocId = `${cleanName}_${nextId}`;

        const newStudent = { ...studentWithId, id: customStudentDocId };
        students.push(newStudent);
        saveLocalData('bb_students', students);
        
        // Also automatically initialize a pending fee entry for the new student
        const fees = getLocalData('bb_fees', INITIAL_FEES);
        const feeAmount = student.standard === '10th' ? 1500 : student.standard === '11th' ? 2000 : 2500;
        const today = new Date();
        const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 10).toISOString().split('T')[0]; // Next month 10th
        const customFeeDocId = `${newStudent.id}_${dueDate}`;
        fees.push({
          id: customFeeDocId,
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

  async saveAttendance(date, records, options = {}) {
    await dbService.logActivity(`Saved attendance for date ${date}`);
    return runQuery(
      async () => {
        // Fetch existing records first to check lock status and track changes
        const q = query(collection(db, "attendance"), where("date", "==", date));
        const querySnapshot = await getDocs(q);
        const existingRecords = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const todayStr = new Date().toISOString().split('T')[0];
        const currentTime = Date.now();
        const changes = [];

        // Verify lock status for status changes
        records.forEach(record => {
          const existing = existingRecords.find(e => e.student_id === record.student_id);
          if (existing && existing.status !== record.status) {
            let isLocked = false;
            if (existing.createdAt) {
              const createdTime = new Date(existing.createdAt).getTime();
              if (currentTime - createdTime > 30 * 60 * 1000) {
                isLocked = true;
              }
            } else {
              if (date < todayStr) {
                isLocked = true;
              }
            }

            if (isLocked) {
              throw new Error("Attendance is locked. Edits are not allowed after 30 minutes.");
            }

            // Track changes
            const student = (options.studentsInfo || []).find(s => s.id === record.student_id);
            const studentName = student ? student.name : `Student (${record.student_id})`;
            changes.push({
              student_id: record.student_id,
              student_name: studentName,
              old_status: existing.status,
              new_status: record.status
            });
          }
        });

        // Write edit log if changes were made
        if (changes.length > 0) {
          const logId = generateUUID();
          await setDoc(doc(db, "attendance_edit_logs", logId), {
            date: date,
            batch_id: options.batchId || '',
            edited_by: options.editedBy || 'System',
            edited_at: new Date().toISOString(),
            changes: changes
          });
        }

        const promises = records.map(record => {
          const docId = `${record.student_id}_${date}`;
          const existing = existingRecords.find(e => e.student_id === record.student_id);
          const createdAt = existing?.createdAt || new Date().toISOString();
          return setDoc(doc(db, "attendance", docId), {
            student_id: record.student_id,
            date: date,
            status: record.status,
            createdAt: createdAt
          });
        });
        await Promise.all(promises);
        return records;
      },
      () => {
        let attendance = getLocalData('bb_attendance', INITIAL_ATTENDANCE);
        const existingRecords = attendance.filter(a => a.date === date);

        const todayStr = new Date().toISOString().split('T')[0];
        const currentTime = Date.now();
        const changes = [];

        // Verify lock status for status changes
        records.forEach(record => {
          const existing = existingRecords.find(e => e.student_id === record.student_id);
          if (existing && existing.status !== record.status) {
            let isLocked = false;
            if (existing.createdAt) {
              const createdTime = new Date(existing.createdAt).getTime();
              if (currentTime - createdTime > 30 * 60 * 1000) {
                isLocked = true;
              }
            } else {
              if (date < todayStr) {
                isLocked = true;
              }
            }

            if (isLocked) {
              throw new Error("Attendance is locked. Edits are not allowed after 30 minutes.");
            }

            // Track changes
            const student = (options.studentsInfo || []).find(s => s.id === record.student_id);
            const studentName = student ? student.name : `Student (${record.student_id})`;
            changes.push({
              student_id: record.student_id,
              student_name: studentName,
              old_status: existing.status,
              new_status: record.status
            });
          }
        });

        // Write edit log if changes were made
        if (changes.length > 0) {
          let editLogs = getLocalData('bb_attendance_edit_logs', []);
          editLogs.push({
            id: generateUUID(),
            date: date,
            batch_id: options.batchId || '',
            edited_by: options.editedBy || 'System',
            edited_at: new Date().toISOString(),
            changes: changes
          });
          saveLocalData('bb_attendance_edit_logs', editLogs);
        }

        // Remove existing records for this date first to avoid duplicates
        attendance = attendance.filter(a => a.date !== date);
        // Add new ones
        records.forEach(r => {
          const existing = existingRecords.find(e => e.student_id === r.student_id);
          const createdAt = existing?.createdAt || new Date().toISOString();
          attendance.push({
            id: existing?.id || generateUUID(),
            student_id: r.student_id,
            date: date,
            status: r.status,
            createdAt: createdAt
          });
        });
        saveLocalData('bb_attendance', attendance);
        return records;
      }
    );
  },

  async getAttendanceEditLogs(date, batchId) {
    return runQuery(
      async () => {
        const q = query(
          collection(db, "attendance_edit_logs"),
          where("date", "==", date),
          where("batch_id", "==", batchId)
        );
        const querySnapshot = await getDocs(q);
        const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return logs.sort((a, b) => new Date(b.edited_at) - new Date(a.edited_at));
      },
      () => {
        const logs = getLocalData('bb_attendance_edit_logs', []);
        const filtered = logs.filter(l => l.date === date && l.batch_id === batchId);
        filtered.sort((a, b) => new Date(b.edited_at) - new Date(a.edited_at));
        return filtered;
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

  async getAllTestMarks() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "test_marks"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => getLocalData('bb_test_marks', INITIAL_TEST_MARKS)
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
    // 1. Clear LocalStorage
    localStorage.removeItem('bb_batches');
    localStorage.removeItem('bb_students');
    localStorage.removeItem('bb_fees');
    localStorage.removeItem('bb_attendance');
    localStorage.removeItem('bb_tests');
    localStorage.removeItem('bb_test_marks');
    localStorage.removeItem('bb_testimonials');
    localStorage.removeItem('bb_timetable');
    localStorage.removeItem('bb_parent_accounts');
    localStorage.removeItem('bb_homework');
    localStorage.removeItem('bb_study_materials');

    // 2. If Cloud Mode (Firebase) is active and configured, reset Firestore collections
    const activeMode = localStorage.getItem('bb_db_mode') || (isFirebaseConfigured ? 'cloud' : 'local');
    if (isFirebaseConfigured && activeMode === 'cloud') {
      try {
        const collections = ['batches', 'students', 'fees', 'attendance', 'tests', 'test_marks', 'testimonials', 'timetable', 'homework', 'study_material', 'parent_accounts'];
        
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
          setDoc(doc(db, "students", s.id), { student_id: s.student_id, name: s.name, mobile: s.mobile, parent_mobile: s.parent_mobile, parent_name: s.parent_name || '', address: s.address, school: s.school, standard: s.standard, admission_date: s.admission_date, batch_id: s.batch_id, email: s.email || '' })
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
  },

  // --- PARENT / STUDENT PORTAL AUTH ---
  async registerParent(studentNumericId, password) {
    const numId = parseInt(studentNumericId);
    return runQuery(
      async () => {
        // 1. Verify Student exists
        const studentSnap = await getDocs(query(collection(db, "students"), where("student_id", "==", numId)));
        if (studentSnap.empty) {
          throw new Error("Invalid Student ID number. Student is not registered by tuition owner.");
        }
        const studentDoc = studentSnap.docs[0];
        const studentId = studentDoc.id;

        // 2. Check if parent account already exists
        const parentSnap = await getDoc(doc(db, "parent_accounts", studentId));
        if (parentSnap.exists()) {
          throw new Error("This Student ID is already registered. Please login or contact admin.");
        }

        // 3. Register parent account
        await setDoc(doc(db, "parent_accounts", studentId), {
          student_id: studentId,
          student_numeric_id: numId,
          password: password
        });

        return { studentId, studentName: studentDoc.data().name };
      },
      () => {
        const students = getLocalData('bb_students', INITIAL_STUDENTS);
        const student = students.find(s => parseInt(s.student_id) === numId);
        if (!student) {
          throw new Error("Invalid Student ID number. Student is not registered by tuition owner.");
        }

        const parents = getLocalData('bb_parent_accounts', []);
        const parentExists = parents.some(p => p.student_numeric_id === numId);
        if (parentExists) {
          throw new Error("This Student ID is already registered. Please login or contact admin.");
        }

        parents.push({
          student_id: student.id,
          student_numeric_id: numId,
          password: password
        });
        saveLocalData('bb_parent_accounts', parents);

        return { studentId: student.id, studentName: student.name };
      }
    );
  },

  async deleteParentAccount(studentId) {
    await dbService.logActivity(`Deleted parent account access for student "${studentId}"`);
    return runQuery(
      async () => {
        // 1. Delete parent credentials document
        const credentialRef = doc(db, "parent_accounts", studentId);
        await deleteDoc(credentialRef);

        // 2. Set parent_portal_disabled flag on the student document
        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, { parent_portal_disabled: true });
        return true;
      },
      () => {
        // 1. Filter out parent credential entry from local storage
        const parents = getLocalData('bb_parent_accounts', []);
        const filteredParents = parents.filter(p => p.student_id !== studentId);
        saveLocalData('bb_parent_accounts', filteredParents);

        // 2. Set parent_portal_disabled = true on the local student record
        const students = getLocalData('bb_students', INITIAL_STUDENTS);
        const idx = students.findIndex(s => s.id === studentId);
        if (idx !== -1) {
          students[idx] = { ...students[idx], parent_portal_disabled: true };
          saveLocalData('bb_students', students);
        }
        return true;
      }
    );
  },

  async verifyParentLogin(studentNumericId, password) {
    const numId = parseInt(studentNumericId) || 0;
    const cleanPassword = String(password || '').trim();
    const cleanStudentNumericId = String(studentNumericId || '').trim();
    const hashedInput = await hashPassword(cleanPassword);

    const reverseFallbackMap = {
      '1001': 's1',
      '1002': 's2',
      '1003': 's3',
      '1004': 's4'
    };

    return runQuery(
      async () => {
        // 1. Sign in as guest to search students and parent accounts
        await signInGuest();

        // Verify Student exists
        let studentSnap = await getDocs(query(collection(db, "students"), where("student_id", "==", numId)));
        if (studentSnap.empty) {
          studentSnap = await getDocs(query(collection(db, "students"), where("student_id", "==", cleanStudentNumericId)));
        }
        
        let studentDoc = null;
        let studentId = null;
        let studentData = null;

        if (!studentSnap.empty) {
          studentDoc = studentSnap.docs[0];
          studentId = studentDoc.id;
          studentData = studentDoc.data();
        } else {
          // Fallback to check default document ID map
          const fallbackDocId = reverseFallbackMap[cleanStudentNumericId];
          if (fallbackDocId) {
            const docRef = doc(db, "students", fallbackDocId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              studentDoc = docSnap;
              studentId = docSnap.id;
              studentData = docSnap.data();
            }
          }
        }

        if (!studentDoc) {
          await signOutUser();
          throw new Error("Invalid Student ID number.");
        }

        if (studentData && (studentData.parent_portal_disabled === true || studentData.parent_portal_disabled === 'true')) {
          await signOutUser();
          throw new Error("This parent portal access has been deleted/disabled. Please contact your tuition administrator.");
        }

        // Ensure student_id is set in the returned data
        const studentIdVal = studentData.student_id || studentData.student_numeric_id || numId;

        // Verify parent credentials (registered password or parent/student mobile number)
        const parentSnap = await getDoc(doc(db, "parent_accounts", studentId));
        let isValid = false;
        let needsUpgrade = false;
        let dbPassword = "";
        
        if (parentSnap.exists()) {
          dbPassword = String(parentSnap.data().password || '').trim();
          if (dbPassword.length === 64) {
            if (dbPassword === hashedInput) {
              isValid = true;
            }
          } else {
            if (dbPassword === cleanPassword) {
              isValid = true;
              needsUpgrade = true;
            }
          }
        }
        
        if (!isValid) {
          const pMobile = String(studentData.parent_mobile || '').trim();
          const sMobile = String(studentData.mobile || '').trim();
          if ((pMobile && pMobile === cleanPassword) || (sMobile && sMobile === cleanPassword)) {
            isValid = true;
            needsUpgrade = true;
            dbPassword = cleanPassword;
          }
        }

        if (!isValid) {
          await signOutUser();
          throw new Error("Invalid Student ID or password.");
        }

        // 3. Authenticate user's individual session using virtual email and project secret
        await signOutUser(); // Sign out guest
        const tenantId = dbService.getTenantCode();
        const activeHash = needsUpgrade ? hashedInput : dbPassword;
        await authenticateUserWithAuth('student', tenantId, studentId, activeHash);

        if (needsUpgrade) {
          try {
            const parentRef = doc(db, "parent_accounts", studentId);
            await setDoc(parentRef, {
              student_id: studentId,
              student_numeric_id: studentIdVal,
              password: hashedInput
            }, { merge: true });
          } catch (e) {
            console.error("Failed to auto-upgrade parent password hash:", e);
          }
        }

        return { id: studentId, student_id: studentIdVal, ...studentData, authEmail: getVirtualEmail('student', tenantId, studentId, activeHash), authPassword: AUTH_PROJECT_SECRET };
      },
      () => {
        const students = getLocalData('bb_students', INITIAL_STUDENTS);
        const student = students.find(s => 
          parseInt(s.student_id) === numId || 
          String(s.student_id).trim() === cleanStudentNumericId ||
          (s.id === 's1' && cleanStudentNumericId === '1001') ||
          (s.id === 's2' && cleanStudentNumericId === '1002') ||
          (s.id === 's3' && cleanStudentNumericId === '1003') ||
          (s.id === 's4' && cleanStudentNumericId === '1004')
        );
        if (!student) {
          throw new Error("Invalid Student ID number.");
        }

        if (student.parent_portal_disabled === true || student.parent_portal_disabled === 'true') {
          throw new Error("This parent portal access has been deleted/disabled. Please contact your tuition administrator.");
        }

        const parents = getLocalData('bb_parent_accounts', []);
        let needsSave = false;
        let parentAccount = null;

        parents.forEach(p => {
          if ((parseInt(p.student_numeric_id) === numId || String(p.student_numeric_id).trim() === cleanStudentNumericId || p.student_id === student.id)) {
            const dbPassword = String(p.password || '').trim();
            if (dbPassword.length === 64) {
              if (dbPassword === hashedInput) {
                parentAccount = p;
              }
            } else {
              if (dbPassword === cleanPassword) {
                parentAccount = p;
                p.password = hashedInput;
                needsSave = true;
              }
            }
          }
        });
        
        let isValid = false;
        if (parentAccount) {
          isValid = true;
        } else {
          const pMobile = String(student.parent_mobile || '').trim();
          const sMobile = String(student.mobile || '').trim();
          if ((pMobile && pMobile === cleanPassword) || (sMobile && sMobile === cleanPassword)) {
            isValid = true;
          }
        }

        if (!isValid) {
          throw new Error("Invalid Student ID or password.");
        }

        if (needsSave) {
          saveLocalData('bb_parent_accounts', parents);
        }

        const studentIdVal = student.student_id || numId;
        return { ...student, student_id: studentIdVal };
      }
    );
  },

  async verifyParentLoginWithoutTenant(studentNumericId, password) {
    const numId = parseInt(studentNumericId) || 0;
    const cleanPassword = String(password || '').trim();
    const cleanStudentNumericId = String(studentNumericId || '').trim();
    const hashedInput = await hashPassword(cleanPassword);

    const reverseFallbackMap = {
      '1001': 's1',
      '1002': 's2',
      '1003': 's3',
      '1004': 's4'
    };

    return runQuery(
      async () => {
        // 1. Sign in as guest to search tenants and student accounts
        await signInGuest();

        const tenantsSnapshot = await getDocs(firestoreCollection(db, "tenants"));
        const tenants = tenantsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

        for (const tenant of tenants) {
          try {
            dbService.setTenantCode(tenant.id);

            // Verify Student exists
            let studentSnap = await getDocs(query(collection(db, "students"), where("student_id", "==", numId)));
            if (studentSnap.empty) {
              studentSnap = await getDocs(query(collection(db, "students"), where("student_id", "==", cleanStudentNumericId)));
            }
            
            let studentDoc = null;
            let studentId = null;
            let studentData = null;

            if (!studentSnap.empty) {
              studentDoc = studentSnap.docs[0];
              studentId = studentDoc.id;
              studentData = studentDoc.data();
            } else {
              // Fallback to check default document ID map
              const fallbackDocId = reverseFallbackMap[cleanStudentNumericId];
              if (fallbackDocId) {
                const docRef = doc(db, "students", fallbackDocId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  studentDoc = docSnap;
                  studentId = docSnap.id;
                  studentData = docSnap.data();
                }
              }
            }

            if (studentDoc && studentData) {
              if (studentData.parent_portal_disabled === true || studentData.parent_portal_disabled === 'true') {
                continue;
              }

              const studentIdVal = studentData.student_id || studentData.student_numeric_id || numId;

              // Verify parent credentials (registered password or parent/student mobile number)
              const parentSnap = await getDoc(doc(db, "parent_accounts", studentId));
              let isValid = false;
              let needsUpgrade = false;
              let dbPassword = "";
              
              if (parentSnap.exists()) {
                dbPassword = String(parentSnap.data().password || '').trim();
                if (dbPassword.length === 64) {
                  if (dbPassword === hashedInput) {
                    isValid = true;
                  }
                } else {
                  if (dbPassword === cleanPassword) {
                    isValid = true;
                    needsUpgrade = true;
                  }
                }
              }
              
              if (!isValid) {
                const pMobile = String(studentData.parent_mobile || '').trim();
                const sMobile = String(studentData.mobile || '').trim();
                if ((pMobile && pMobile === cleanPassword) || (sMobile && sMobile === cleanPassword)) {
                  isValid = true;
                  needsUpgrade = true;
                  dbPassword = cleanPassword;
                }
              }

              if (isValid) {
                await signOutUser(); // Sign out guest
                const activeHash = needsUpgrade ? hashedInput : dbPassword;
                const authUser = await authenticateUserWithAuth('student', tenant.id, studentId, activeHash);
                const authEmail = authUser ? authUser.email : null;

                if (needsUpgrade) {
                  try {
                    const parentRef = doc(db, "parent_accounts", studentId);
                    await setDoc(parentRef, {
                      student_id: studentId,
                      student_numeric_id: studentIdVal,
                      password: hashedInput
                    }, { merge: true });
                  } catch (e) {
                    console.error("Failed to auto-upgrade parent password hash:", e);
                  }
                }

                return { student: { id: studentId, student_id: studentIdVal, ...studentData }, tenant, authEmail, authPassword: AUTH_PROJECT_SECRET };
              }
            }
          } catch (e) {
            console.error(`Failed to verify parent login for tenant ${tenant.id}:`, e);
          }
        }

        await signOutUser();
        dbService.setTenantCode(null);
        throw new Error("Invalid Student ID or password.");
      },
      () => {
        const tenants = getLocalData('bb_tenants', INITIAL_TENANTS);
        for (const tenant of tenants) {
          const prefix = `bb_${tenant.id}_`;
          const students = JSON.parse(localStorage.getItem(prefix + 'students') || '[]');
          
          const student = students.find(s => 
            parseInt(s.student_id) === numId || 
            String(s.student_id).trim() === cleanStudentNumericId ||
            (s.id === 's1' && cleanStudentNumericId === '1001') ||
            (s.id === 's2' && cleanStudentNumericId === '1002') ||
            (s.id === 's3' && cleanStudentNumericId === '1003') ||
            (s.id === 's4' && cleanStudentNumericId === '1004')
          );

          if (student) {
            if (student.parent_portal_disabled === true || student.parent_portal_disabled === 'true') {
              continue;
            }

            const parents = JSON.parse(localStorage.getItem(prefix + 'parent_accounts') || '[]');
            let needsSave = false;
            let parentAccount = null;

            parents.forEach(p => {
              if ((parseInt(p.student_numeric_id) === numId || String(p.student_numeric_id).trim() === cleanStudentNumericId || p.student_id === student.id)) {
                const dbPassword = String(p.password || '').trim();
                if (dbPassword.length === 64) {
                  if (dbPassword === hashedInput) {
                    parentAccount = p;
                  }
                } else {
                  if (dbPassword === cleanPassword) {
                    parentAccount = p;
                    p.password = hashedInput;
                    needsSave = true;
                  }
                }
              }
            });
            
            let isValid = false;
            if (parentAccount) {
              isValid = true;
            } else {
              const pMobile = String(student.parent_mobile || '').trim();
              const sMobile = String(student.mobile || '').trim();
              if ((pMobile && pMobile === cleanPassword) || (sMobile && sMobile === cleanPassword)) {
                isValid = true;
              }
            }

            if (isValid) {
              dbService.setTenantCode(tenant.id);
              if (needsSave) {
                localStorage.setItem(prefix + 'parent_accounts', JSON.stringify(parents));
              }
              const studentIdVal = student.student_id || numId;
              return { student: { ...student, student_id: studentIdVal }, tenant };
            }
          }
        }

        throw new Error("Invalid Student ID or password.");
      }
    );
  },

  // --- HOMEWORK ---
  async getHomework() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "homework"));
        return querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(h => !h.archived);
      },
      () => getLocalData('bb_homework', []).filter(h => !h.archived)
    );
  },

  async addHomework(hw) {
    const newHw = { ...hw, created_at: new Date().toISOString() };
    await dbService.logActivity(`Added homework for batch "${hw.batch_id}"`);
    return runQuery(
      async () => {
        const docRef = await addDoc(collection(db, "homework"), newHw);
        return { id: docRef.id, ...newHw };
      },
      () => {
        const homework = getLocalData('bb_homework', []);
        const createdHw = { ...newHw, id: generateUUID() };
        homework.push(createdHw);
        saveLocalData('bb_homework', homework);
        return createdHw;
      }
    );
  },

  async deleteHomework(id) {
    const archiveData = { archived: true, archived_at: new Date().toISOString() };
    await dbService.logActivity(`Archived homework "${id}"`);
    return runQuery(
      async () => {
        const docRef = doc(db, "homework", id);
        await updateDoc(docRef, archiveData);
        return true;
      },
      () => {
        const homework = getLocalData('bb_homework', []);
        const idx = homework.findIndex(h => h.id === id);
        if (idx !== -1) {
          homework[idx] = { ...homework[idx], ...archiveData };
          saveLocalData('bb_homework', homework);
          return true;
        }
        return false;
      }
    );
  },

  async updateHomeworkSubmissions(id, submissions) {
    await dbService.logActivity(`Updated submissions for homework "${id}"`);
    return runQuery(
      async () => {
        const docRef = doc(db, "homework", id);
        await updateDoc(docRef, { submissions });
        return true;
      },
      () => {
        const homework = getLocalData('bb_homework', []);
        const idx = homework.findIndex(h => h.id === id);
        if (idx !== -1) {
          homework[idx] = { ...homework[idx], submissions };
          saveLocalData('bb_homework', homework);
          return true;
        }
        return false;
      }
    );
  },

  // --- STUDY MATERIAL ---
  async getStudyMaterials() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "study_material"));
        return querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(m => !m.archived);
      },
      () => getLocalData('bb_study_materials', []).filter(m => !m.archived)
    );
  },

  async addStudyMaterial(material) {
    const newMaterial = { ...material, created_at: new Date().toISOString() };
    await dbService.logActivity(`Added study material "${material.title}"`);
    return runQuery(
      async () => {
        const docRef = await addDoc(collection(db, "study_material"), newMaterial);
        return { id: docRef.id, ...newMaterial };
      },
      () => {
        const materials = getLocalData('bb_study_materials', []);
        const createdMaterial = { ...newMaterial, id: generateUUID() };
        materials.push(createdMaterial);
        saveLocalData('bb_study_materials', materials);
        return createdMaterial;
      }
    );
  },

  async deleteStudyMaterial(id) {
    const archiveData = { archived: true, archived_at: new Date().toISOString() };
    await dbService.logActivity(`Archived study material "${id}"`);
    return runQuery(
      async () => {
        const docRef = doc(db, "study_material", id);
        await updateDoc(docRef, archiveData);
        return true;
      },
      () => {
        const materials = getLocalData('bb_study_materials', []);
        const idx = materials.findIndex(m => m.id === id);
        if (idx !== -1) {
          materials[idx] = { ...materials[idx], ...archiveData };
          saveLocalData('bb_study_materials', materials);
          return true;
        }
        return false;
      }
    );
  },

  // --- ADMISSION INQUIRIES ---
  async getInquiries() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "inquiries"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => getLocalData('bb_inquiries', [])
    );
  },

  async addInquiry(inquiry) {
    const newInquiry = {
      ...inquiry,
      status: inquiry.status || 'Pending',
      created_at: new Date().toISOString()
    };
    return runQuery(
      async () => {
        const docRef = await addDoc(collection(db, "inquiries"), newInquiry);
        return { id: docRef.id, ...newInquiry };
      },
      () => {
        const inquiries = getLocalData('bb_inquiries', []);
        const createdInquiry = { ...newInquiry, id: generateUUID() };
        inquiries.unshift(createdInquiry);
        saveLocalData('bb_inquiries', inquiries);
        return createdInquiry;
      }
    );
  },

  async updateInquiryStatus(id, status) {
    return runQuery(
      async () => {
        const docRef = doc(db, "inquiries", id);
        await updateDoc(docRef, { status });
        return true;
      },
      () => {
        const inquiries = getLocalData('bb_inquiries', []);
        const idx = inquiries.findIndex(iq => iq.id === id);
        if (idx !== -1) {
          inquiries[idx].status = status;
          saveLocalData('bb_inquiries', inquiries);
          return true;
        }
        return false;
      }
    );
  },

  async deleteInquiry(id) {
    return runQuery(
      async () => {
        const docRef = doc(db, "inquiries", id);
        await deleteDoc(docRef);
        return true;
      },
      () => {
        const inquiries = getLocalData('bb_inquiries', []);
        const filtered = inquiries.filter(iq => iq.id !== id);
        saveLocalData('bb_inquiries', filtered);
        return true;
      }
    );
  },

  // --- REAL-TIME NOTIFICATIONS ---
  async addNotification(studentId, type, title, message) {
    const timestamp = new Date().toISOString();
    const notification = {
      student_id: studentId,
      type,
      title,
      message,
      timestamp,
      read: false
    };

    return runQuery(
      async () => {
        const docRef = await addDoc(collection(db, "notifications"), notification);
        return { id: docRef.id, ...notification };
      },
      () => {
        const list = getLocalData('bb_notifications', []);
        const newNotif = { id: generateUUID(), ...notification };
        list.unshift(newNotif);
        saveLocalData('bb_notifications', list);
        return newNotif;
      }
    );
  },

  async markNotificationAsRead(id) {
    return runQuery(
      async () => {
        const docRef = doc(db, "notifications", id);
        await updateDoc(docRef, { read: true });
        return true;
      },
      () => {
        const list = getLocalData('bb_notifications', []);
        const idx = list.findIndex(n => n.id === id);
        if (idx !== -1) {
          list[idx].read = true;
          saveLocalData('bb_notifications', list);
          return true;
        }
        return false;
      }
    );
  },

  async getNotifications() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "notifications"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => getLocalData('bb_notifications', [])
    );
  },

  async sendMessage(senderId, senderName, receiverId, receiverName, text) {
    const msg = {
      sender_id: senderId,
      sender_name: senderName,
      receiver_id: receiverId,
      receiver_name: receiverName,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      read: false
    };
    return runQuery(
      async () => {
        const docRef = await addDoc(collection(db, "chats"), msg);
        return { id: docRef.id, ...msg };
      },
      () => {
        const list = getLocalData('bb_chats', []);
        const newMsg = { id: generateUUID(), ...msg };
        list.push(newMsg);
        saveLocalData('bb_chats', list);
        return newMsg;
      }
    );
  },

  listenToMessages(userId1, userId2, callback) {
    if (isFirebaseConfigured && localStorage.getItem('bb_db_mode') !== 'local' && !forceLocalMode) {
      const q = query(
        collection(db, "chats"),
        orderBy("timestamp", "asc")
      );
      return onSnapshot(q, (snapshot) => {
        const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filtered = allMsgs.filter(m => 
          (m.sender_id === userId1 && m.receiver_id === userId2) ||
          (m.sender_id === userId2 && m.receiver_id === userId1)
        );
        callback(filtered);
      }, (error) => {
        console.error("Error listening to messages:", error);
      });
    } else {
      const interval = setInterval(() => {
        const list = getLocalData('bb_chats', []);
        const filtered = list.filter(m => 
          (m.sender_id === userId1 && m.receiver_id === userId2) ||
          (m.sender_id === userId2 && m.receiver_id === userId1)
        );
        callback(filtered);
      }, 1000);
      return () => clearInterval(interval);
    }
  },

  async markMessagesAsRead(senderId, receiverId) {
    return runQuery(
      async () => {
        const q = query(
          collection(db, "chats"),
          where("sender_id", "==", senderId),
          where("receiver_id", "==", receiverId),
          where("read", "==", false)
        );
        const querySnapshot = await getDocs(q);
        const promises = querySnapshot.docs.map(d => {
          const docRef = doc(db, "chats", d.id);
          return updateDoc(docRef, { read: true });
        });
        await Promise.all(promises);
        return true;
      },
      () => {
        const list = getLocalData('bb_chats', []);
        let updated = false;
        const newList = list.map(m => {
          if (m.sender_id === senderId && m.receiver_id === receiverId && !m.read) {
            updated = true;
            return { ...m, read: true };
          }
          return m;
        });
        if (updated) {
          saveLocalData('bb_chats', newList);
        }
        return true;
      }
    );
  },

  listenToAllUnreadMessages(receiverId, callback) {
    if (isFirebaseConfigured && localStorage.getItem('bb_db_mode') !== 'local' && !forceLocalMode) {
      const q = query(
        collection(db, "chats"),
        where("receiver_id", "==", receiverId),
        where("read", "==", false)
      );
      return onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(list);
      }, (error) => {
        console.error("Error listening to unread messages:", error);
      });
    } else {
      const interval = setInterval(() => {
        const list = getLocalData('bb_chats', []);
        const unread = list.filter(m => m.receiver_id === receiverId && !m.read);
        callback(unread);
      }, 2000);
      return () => clearInterval(interval);
    }
  },

  listenToNotifications(studentId, callback) {
    if (isFirebaseConfigured && localStorage.getItem('bb_db_mode') !== 'local' && !forceLocalMode) {
      const q = query(
        collection(db, "notifications"), 
        where("student_id", "==", studentId),
        where("read", "==", false),
        orderBy("timestamp", "desc")
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(list);
      }, (error) => {
        console.error("Error listening to notifications:", error);
      });
      return unsubscribe;
    } else {
      // LocalStorage polling simulator
      const interval = setInterval(() => {
        const list = getLocalData('bb_notifications', []);
        const unread = list.filter(n => n.student_id === studentId && !n.read);
        callback(unread);
      }, 2000);
      return () => clearInterval(interval);
    }
  },

  getTenantCode() {
    let code = localStorage.getItem('bb_tenant_code') || '';
    if (code === 'ak007' || code === 'akash academy') {
      code = 'akash_academy';
      localStorage.setItem('bb_tenant_code', 'akash_academy');
    }
    return code;
  },

  setTenantCode(code) {
    let targetCode = code;
    if (targetCode === 'ak007' || targetCode === 'akash academy') {
      targetCode = 'akash_academy';
    }
    if (targetCode) {
      localStorage.setItem('bb_tenant_code', targetCode);
    } else {
      localStorage.removeItem('bb_tenant_code');
    }
  },

  async verifyTenantCode(code) {
    let cleanCode = String(code || '').trim().toLowerCase();
    if (cleanCode === 'ak007' || cleanCode === 'akash academy') {
      cleanCode = 'akash_academy';
    }
    if (!cleanCode) return null;
    
    return runQuery(
      async () => {
        // Ensure we are authenticated (either as a tenant user or guest) to read metadata
        await ensureAuthenticatedForTenant(cleanCode);

        // 1. Try matching by tenant document ID
        const docRef = firestoreDoc(db, "tenants", cleanCode);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          return { ...data, id: docSnap.id, features: data.features || DEFAULT_FEATURES };
        }
        
        // 2. Try matching by tenant Name (case-insensitive)
        const querySnapshot = await getDocs(firestoreCollection(db, "tenants"));
        let matchedTenant = null;
        querySnapshot.forEach(doc => {
          const data = doc.data();
          const name = String(data.name || '').trim().toLowerCase();
          if (name === cleanCode) {
            matchedTenant = { ...data, id: doc.id, features: data.features || DEFAULT_FEATURES };
          }
        });
        
        if (!matchedTenant) {
          const email = auth.currentUser?.email || '';
          if (email !== 'superadmin@edubridge.internal' && email !== 'admin@edubridge.com' && email !== 'guest@edubridge.com') {
            await signOutUser();
          }
        }
        return matchedTenant;
      },
      () => {
        const list = getLocalData('bb_tenants', INITIAL_TENANTS);
        // 1. Try matching by ID
        let tenant = list.find(t => t.id === cleanCode);
        if (tenant) {
          return { ...tenant, features: tenant.features || DEFAULT_FEATURES };
        }
        // 2. Try matching by Name
        tenant = list.find(t => String(t.name || '').trim().toLowerCase() === cleanCode);
        if (tenant) {
          return { ...tenant, features: tenant.features || DEFAULT_FEATURES };
        }
        return null;
      }
    );
  },

  async getTenants() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(firestoreCollection(db, "tenants"));
        return querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            return { ...data, id: doc.id, features: data.features || DEFAULT_FEATURES };
          })
          .filter(t => t.id !== 'ak007');
      },
      () => getLocalData('bb_tenants', INITIAL_TENANTS)
        .map(t => ({
          ...t,
          features: t.features || DEFAULT_FEATURES
        }))
        .filter(t => t.id !== 'ak007')
    );
  },

  async addTenant(tenant) {
    const cleanId = String(tenant.id || '').trim().toLowerCase();
    const hashedPassword = tenant.admin_password ? await hashPassword(tenant.admin_password) : '';
    const newTenant = {
      status: 'Approved',
      ...tenant,
      id: cleanId,
      admin_password: hashedPassword,
      features: tenant.features || {
        students: true,
        timetable: true,
        attendance: true,
        fees: true,
        tests: true,
        homework: true,
        materials: true,
        branding: true,
        inquiries: true,
        db_fees: true,
        db_attendance: true,
        db_tests: true,
        db_homework: true,
        db_materials: true,
        db_testimonials: true
      },
      created_at: new Date().toISOString()
    };
    return runQuery(
      async () => {
        const docRef = firestoreDoc(db, "tenants", cleanId);
        await setDoc(docRef, newTenant);
        return newTenant;
      },
      () => {
        const list = getLocalData('bb_tenants', INITIAL_TENANTS);
        if (list.some(t => t.id === cleanId)) {
          throw new Error("This Tuition Code is already taken.");
        }
        list.push(newTenant);
        saveLocalData('bb_tenants', list);
        return newTenant;
      }
    );
  },

  async updateTenant(tenantId, data) {
    const cleanId = String(tenantId).trim().toLowerCase();
    const updateData = { ...data };
    if (updateData.admin_password) {
      updateData.admin_password = await hashPassword(updateData.admin_password);
    }
    return runQuery(
      async () => {
        const docRef = firestoreDoc(db, "tenants", cleanId);
        await updateDoc(docRef, updateData);
        return true;
      },
      () => {
        const list = getLocalData('bb_tenants', INITIAL_TENANTS);
        const idx = list.findIndex(t => t.id === cleanId);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updateData };
          saveLocalData('bb_tenants', list);
          return true;
        }
        return false;
      }
    );
  },

  async deleteTenant(tenantId) {
    const cleanId = String(tenantId).trim().toLowerCase();
    return runQuery(
      async () => {
        const docRef = firestoreDoc(db, "tenants", cleanId);
        await deleteDoc(docRef);
        return true;
      },
      () => {
        const list = getLocalData('bb_tenants', INITIAL_TENANTS);
        const filtered = list.filter(t => t.id !== cleanId);
        saveLocalData('bb_tenants', filtered);
        return true;
      }
    );
  },

  async updateTenantFeatures(tenantId, features) {
    return dbService.updateTenant(tenantId, { features });
  },

  async getSuperAdminStats() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(firestoreCollection(db, "tenants"));
        const tenantsList = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

        const statsList = [];
        let totalStudents = 0;
        let totalTeachers = new Set();
        let totalPending = 0;
        let totalRejected = 0;
        let totalActiveUsers = 0;

        for (const t of tenantsList) {
          const batchesSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "batches"));
          const studentsSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "students"));
          const inquiriesSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "inquiries"));
          const parentsSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "parent_accounts"));
          
          const feesSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "fees"));
          const attendanceSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "attendance"));
          const testsSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "tests"));
          const marksSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "test_marks"));
          const timetableSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "timetable"));
          const homeworkSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "homework"));
          const materialsSnap = await getDocs(firestoreCollection(db, "tenants", t.id, "study_material"));

          const batches = batchesSnap.docs.map(d => d.data());
          const students = studentsSnap.docs.map(d => d.data()).filter(s => !s.archived);
          const inquiries = inquiriesSnap.docs.map(d => d.data());
          const parents = parentsSnap.docs.map(d => d.data());

          batches.forEach(b => {
            if (b.teacher_name) totalTeachers.add(`${t.id}_${b.teacher_name}`);
          });

          const pendingCount = inquiries.filter(iq => iq.status === 'Pending').length;
          const rejectedCount = inquiries.filter(iq => iq.status === 'Rejected').length;

          const allData = {
            tenant: t,
            batches,
            students,
            inquiries,
            parents,
            fees: feesSnap.docs.map(d => d.data()),
            attendance: attendanceSnap.docs.map(d => d.data()),
            tests: testsSnap.docs.map(d => d.data()),
            marks: marksSnap.docs.map(d => d.data()),
            timetable: timetableSnap.docs.map(d => d.data()),
            homework: homeworkSnap.docs.map(d => d.data()),
            materials: materialsSnap.docs.map(d => d.data())
          };

          const sizeBytes = JSON.stringify(allData).length;

          statsList.push({
            tenantId: t.id,
            tenantName: t.name,
            studentsCount: students.length,
            batchesCount: batches.length,
            inquiriesCount: inquiries.length,
            pendingInquiries: pendingCount,
            rejectedInquiries: rejectedCount,
            activeUsers: parents.length,
            dataSizeKb: Math.round((sizeBytes / 1024) * 100) / 100
          });

          totalStudents += students.length;
          totalPending += pendingCount;
          totalRejected += rejectedCount;
          totalActiveUsers += parents.length;
        }

        return {
          totalTuitions: tenantsList.length,
          totalOwners: tenantsList.length,
          totalTeachers: totalTeachers.size,
          totalStudents,
          totalPending,
          totalRejected,
          totalActiveUsers,
          tuitionWiseStats: statsList
        };
      },
      () => {
        const tenants = getLocalData('bb_tenants', INITIAL_TENANTS);
        const statsList = [];
        let totalStudents = 0;
        let totalTeachers = new Set();
        let totalPending = 0;
        let totalRejected = 0;
        let totalActiveUsers = 0;

        tenants.forEach(t => {
          const prefix = `bb_${t.id}_`;
          const batches = JSON.parse(localStorage.getItem(prefix + 'batches') || '[]');
          const students = JSON.parse(localStorage.getItem(prefix + 'students') || '[]').filter(s => !s.archived);
          const inquiries = JSON.parse(localStorage.getItem(prefix + 'inquiries') || '[]');
          const parents = JSON.parse(localStorage.getItem(prefix + 'parent_accounts') || '[]');

          batches.forEach(b => {
            if (b.teacher_name) totalTeachers.add(`${t.id}_${b.teacher_name}`);
          });

          const pendingCount = inquiries.filter(iq => iq.status === 'Pending').length;
          const rejectedCount = inquiries.filter(iq => iq.status === 'Rejected').length;

          let sizeBytes = 0;
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(prefix) || key === `bb_tenants`)) {
              sizeBytes += (localStorage.getItem(key) || '').length;
            }
          }

          statsList.push({
            tenantId: t.id,
            tenantName: t.name,
            studentsCount: students.length,
            batchesCount: batches.length,
            inquiriesCount: inquiries.length,
            pendingInquiries: pendingCount,
            rejectedInquiries: rejectedCount,
            activeUsers: parents.length,
            dataSizeKb: Math.round((sizeBytes / 1024) * 100) / 100
          });

          totalStudents += students.length;
          totalPending += pendingCount;
          totalRejected += rejectedCount;
          totalActiveUsers += parents.length;
        });

        return {
          totalTuitions: tenants.length,
          totalOwners: tenants.length,
          totalTeachers: totalTeachers.size,
          totalStudents,
          totalPending,
          totalRejected,
          totalActiveUsers,
          tuitionWiseStats: statsList
        };
      }
    );
  },

  // --- STAFF / TEACHER PORTAL AUTH ---
  async getStaffAccounts() {
    return runQuery(
      async () => {
        const querySnapshot = await getDocs(collection(db, "staff_accounts"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      },
      () => getLocalData('bb_staff_accounts', [])
    );
  },

  async addStaffAccount(staff) {
    const hashedPassword = staff.password ? await hashPassword(staff.password) : '';
    const newStaff = {
      ...staff,
      password: hashedPassword,
      status: 'Pending',
      must_change_password: true,
      created_at: new Date().toISOString()
    };
    const cleanName = String(staff.name || '').trim().replace(/\s+/g, '_');
    const cleanMobile = String(staff.mobile || '').trim().replace(/\D/g, '');
    const customStaffDocId = `${cleanName}_${cleanMobile}`;
    return runQuery(
      async () => {
        const docRef = doc(db, "staff_accounts", customStaffDocId);
        await setDoc(docRef, newStaff);
        return { id: customStaffDocId, ...newStaff };
      },
      () => {
        const list = getLocalData('bb_staff_accounts', []);
        const created = { ...newStaff, id: customStaffDocId };
        list.unshift(created);
        saveLocalData('bb_staff_accounts', list);
        return created;
      }
    );
  },

  async updateStaffAccountStatus(id, status) {
    return runQuery(
      async () => {
        const docRef = doc(db, "staff_accounts", id);
        const updateData = { status };
        if (status === 'Approved') {
          updateData.must_change_password = true;
          updateData.approved_at = new Date().toISOString();
        }
        await updateDoc(docRef, updateData);
        return true;
      },
      () => {
        const list = getLocalData('bb_staff_accounts', []);
        const idx = list.findIndex(s => s.id === id);
        if (idx !== -1) {
          list[idx].status = status;
          if (status === 'Approved') {
            list[idx].must_change_password = true;
            list[idx].approved_at = new Date().toISOString();
          }
          saveLocalData('bb_staff_accounts', list);
          return true;
        }
        return false;
      }
    );
  },

  async verifyStaffLogin(username, password) {
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();

    if (!cleanUsername || !cleanPassword) {
      throw new Error("Login code/mobile and password are required.");
    }

    const hashedInput = await hashPassword(cleanPassword);

    return runQuery(
      async () => {
        const tenantId = dbService.getTenantCode();
        if (!tenantId) {
          throw new Error("No active tuition center selected.");
        }

        // 1. Sign in as guest to search the staff document
        await signInGuest();

        const q = query(
          collection(db, "staff_accounts"), 
          where("status", "==", "Approved")
        );
        const querySnapshot = await getDocs(q);
        
        let matchedStaff = null;
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          const mob = String(data.mobile || '').trim().toLowerCase();
          const email = String(data.email || '').trim().toLowerCase();
          const name = String(data.name || '').trim().toLowerCase();
          if (mob === cleanUsername || email === cleanUsername || name === cleanUsername) {
            matchedStaff = { id: docSnap.id, ...data };
          }
        });

        if (!matchedStaff) {
          await signOutUser();
          throw new Error("Invalid staff credentials or account is not approved yet.");
        }

        // 2. Verify password against hash
        const dbPassword = String(matchedStaff.password || '').trim();
        let isMatched = false;
        let needsUpgrade = false;

        if (dbPassword.length === 64) {
          if (dbPassword === hashedInput) {
            isMatched = true;
          }
        } else {
          if (dbPassword === cleanPassword) {
            isMatched = true;
            needsUpgrade = true;
          }
        }

        if (!isMatched) {
          await signOutUser();
          throw new Error("Invalid staff credentials or account is not approved yet.");
        }

        // 3. Authenticate with virtual email
        await signOutUser(); // Sign out guest first
        const activeHash = needsUpgrade ? hashedInput : dbPassword;
        const authUser = await authenticateUserWithAuth('staff', tenantId, matchedStaff.id, activeHash);
        const authEmail = authUser ? authUser.email : null;

        if (needsUpgrade) {
          try {
            const docRef = doc(db, "staff_accounts", matchedStaff.id);
            await updateDoc(docRef, { password: hashedInput });
            matchedStaff.password = hashedInput;
          } catch (e) {
            console.error("Failed to auto-upgrade staff password hash:", e);
          }
        }

        return { ...matchedStaff, authEmail, authPassword: AUTH_PROJECT_SECRET };
      },
      () => {
        const list = getLocalData('bb_staff_accounts', []);
        let needsSave = false;
        let matched = null;

        list.forEach(s => {
          if (s.status !== 'Approved') return;
          const mob = String(s.mobile || '').trim().toLowerCase();
          const email = String(s.email || '').trim().toLowerCase();
          const name = String(s.name || '').trim().toLowerCase();
          if (mob === cleanUsername || email === cleanUsername || name === cleanUsername) {
            const dbPassword = String(s.password || '').trim();
            if (dbPassword.length === 64) {
              if (dbPassword === hashedInput) {
                matched = s;
              }
            } else {
              if (dbPassword === cleanPassword) {
                matched = s;
                s.password = hashedInput;
                needsSave = true;
              }
            }
          }
        });

        if (!matched) {
          throw new Error("Invalid staff credentials or account is not approved yet.");
        }

        if (needsSave) {
          saveLocalData('bb_staff_accounts', list);
        }

        return matched;
      }
    );
  },

  async verifyStaffLoginWithoutTenant(mobile, password) {
    const cleanMobile = String(mobile || '').trim().replace(/\D/g, '');
    const cleanPassword = String(password || '').trim();

    if (!cleanMobile || !cleanPassword) {
      throw new Error("Mobile number and password are required.");
    }

    const hashedInput = await hashPassword(cleanPassword);

    return runQuery(
      async () => {
        // 1. Sign in as guest to search tenants and staff accounts
        await signInGuest();

        const tenantsSnapshot = await getDocs(firestoreCollection(db, "tenants"));
        const tenants = tenantsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        
        for (const tenant of tenants) {
          try {
            // Check if Owner
            const ownerMob = String(tenant.owner_whatsapp || '').trim().replace(/\D/g, '');
            const requiredPassword = String(tenant.admin_password || 'admin123').trim();
            
            let ownerMatch = false;
            let ownerNeedsUpgrade = false;

            if (requiredPassword.length === 64) {
              if (requiredPassword === hashedInput) {
                ownerMatch = true;
              }
            } else {
              if (requiredPassword === cleanPassword) {
                ownerMatch = true;
                ownerNeedsUpgrade = true;
              }
            }

            if (ownerMatch && ownerMob === cleanMobile) {
              await signOutUser();
              const activeHash = ownerNeedsUpgrade ? hashedInput : requiredPassword;
              const authUser = await authenticateUserWithAuth('owner', tenant.id, 'owner', activeHash);
              const authEmail = authUser ? authUser.email : null;

              dbService.setTenantCode(tenant.id);
              if (ownerNeedsUpgrade) {
                try {
                  const docRef = firestoreDoc(db, "tenants", tenant.id);
                  await updateDoc(docRef, { admin_password: hashedInput });
                  tenant.admin_password = hashedInput;
                } catch (err) {
                  console.error(`Failed to auto-upgrade tenant ${tenant.id} password hash:`, err);
                }
              }
              return { role: 'admin', username: 'Owner', tenant, authEmail, authPassword: AUTH_PROJECT_SECRET };
            }

            // Check if Staff
            dbService.setTenantCode(tenant.id);
            const querySnapshot = await getDocs(
              query(collection(db, "staff_accounts"), where("status", "==", "Approved"))
            );
            
            let matchedStaff = null;
            let staffNeedsUpgrade = false;

            querySnapshot.forEach(docSnap => {
              const data = docSnap.data();
              const mob = String(data.mobile || '').trim().replace(/\D/g, '');
              if (mob === cleanMobile) {
                const dbPassword = String(data.password || '').trim();
                if (dbPassword.length === 64) {
                  if (dbPassword === hashedInput) {
                    matchedStaff = { id: docSnap.id, ...data };
                  }
                } else {
                  if (dbPassword === cleanPassword) {
                    matchedStaff = { id: docSnap.id, ...data };
                    staffNeedsUpgrade = true;
                  }
                }
              }
            });

            if (matchedStaff) {
              await signOutUser();
              const activeHash = staffNeedsUpgrade ? hashedInput : matchedStaff.password;
              const authUser = await authenticateUserWithAuth('staff', tenant.id, matchedStaff.id, activeHash);
              const authEmail = authUser ? authUser.email : null;

              if (staffNeedsUpgrade) {
                try {
                  const staffDocRef = doc(db, "staff_accounts", matchedStaff.id);
                  await updateDoc(staffDocRef, { password: hashedInput });
                  matchedStaff.password = hashedInput;
                } catch (e) {
                  console.error("Failed to auto-upgrade staff password hash:", e);
                }
              }
              return { role: 'staff', staff: matchedStaff, tenant, authEmail, authPassword: AUTH_PROJECT_SECRET };
            }
          } catch (e) {
            console.error(`Failed to verify staff login for tenant ${tenant.id}:`, e);
          }
        }
        await signOutUser();
        dbService.setTenantCode(null);
        throw new Error("Invalid mobile number or password, or account is not approved yet.");
      },
      () => {
        const tenants = getLocalData('bb_tenants', INITIAL_TENANTS);
        for (const tenant of tenants) {
          // Check if Owner
          const ownerMob = String(tenant.owner_whatsapp || '').trim().replace(/\D/g, '');
          const requiredPassword = String(tenant.admin_password || 'admin123').trim();
          
          let ownerMatch = false;
          let ownerNeedsUpgrade = false;

          if (requiredPassword.length === 64) {
            if (requiredPassword === hashedInput) {
              ownerMatch = true;
            }
          } else {
            if (requiredPassword === cleanPassword) {
              ownerMatch = true;
              ownerNeedsUpgrade = true;
            }
          }

          if (ownerMatch && ownerMob === cleanMobile) {
            dbService.setTenantCode(tenant.id);
            if (ownerNeedsUpgrade) {
              tenant.admin_password = hashedInput;
              const idx = tenants.findIndex(t => t.id === tenant.id);
              if (idx !== -1) {
                tenants[idx].admin_password = hashedInput;
                saveLocalData('bb_tenants', tenants);
              }
            }
            return { role: 'admin', username: 'Owner', tenant };
          }

          // Check if Staff
          const prefix = `bb_${tenant.id}_`;
          const staffAccounts = JSON.parse(localStorage.getItem(prefix + 'staff_accounts') || '[]');
          let staffNeedsUpgrade = false;
          const matched = staffAccounts.find(s => {
            if (s.status !== 'Approved') return false;
            const mob = String(s.mobile || '').trim().replace(/\D/g, '') === cleanMobile;
            if (mob) {
              const dbPassword = String(s.password || '').trim();
              if (dbPassword.length === 64) {
                return dbPassword === hashedInput;
              } else {
                if (dbPassword === cleanPassword) {
                  staffNeedsUpgrade = true;
                  s.password = hashedInput;
                  return true;
                }
              }
            }
            return false;
          });

          if (matched) {
            dbService.setTenantCode(tenant.id);
            if (staffNeedsUpgrade) {
              localStorage.setItem(prefix + 'staff_accounts', JSON.stringify(staffAccounts));
            }
            return { role: 'staff', staff: matched, tenant };
          }
        }
        throw new Error("Invalid mobile number or password, or account is not approved yet.");
      }
    );
  },

  async verifySuperAdminLogin(password) {
    const cleanPassword = String(password || '').trim();
    if (cleanPassword !== 'Super123!') {
      throw new Error("Invalid Super Admin password.");
    }
    return runQuery(
      async () => {
        if (isFirebaseConfigured && auth) {
          await signInWithEmailAndPassword(auth, 'superadmin@edubridge.internal', 'Super123!');
        }
        return { username: 'Super Admin', role: 'superadmin', authEmail: 'superadmin@edubridge.internal', authPassword: 'Super123!' };
      },
      () => {
        return { username: 'Super Admin', role: 'superadmin', authEmail: 'superadmin@edubridge.internal', authPassword: 'Super123!' };
      }
    );
  },

  async getStaffAccount(staffId) {
    const cleanId = String(staffId || '').trim();
    if (!cleanId) return null;
    return runQuery(
      async () => {
        const docRef = doc(db, "staff_accounts", cleanId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
      },
      () => {
        const list = getLocalData('bb_staff_accounts', []);
        return list.find(s => s.id === cleanId) || null;
      }
    );
  },

  async updateStaffPassword(staffId, newPassword) {
    const cleanPassword = String(newPassword || '').trim();
    const hashedPassword = await hashPassword(cleanPassword);
    return runQuery(
      async () => {
        const docRef = doc(db, "staff_accounts", staffId);
        await updateDoc(docRef, { 
          password: hashedPassword, 
          must_change_password: false 
        });
        return true;
      },
      () => {
        const list = getLocalData('bb_staff_accounts', []);
        const idx = list.findIndex(s => s.id === staffId);
        if (idx !== -1) {
          list[idx].password = hashedPassword;
          list[idx].must_change_password = false;
          saveLocalData('bb_staff_accounts', list);
          return true;
        }
        return false;
      }
    );
  },

  async updateStaffAccount(staffId, updatedData) {
    await dbService.logActivity(`Updated staff account details for "${staffId}"`);
    const cleanData = { ...updatedData };
    if (cleanData.password) {
      cleanData.password = await hashPassword(cleanData.password);
    }
    return runQuery(
      async () => {
        const docRef = doc(db, "staff_accounts", staffId);
        await updateDoc(docRef, cleanData);
        return true;
      },
      () => {
        const list = getLocalData('bb_staff_accounts', []);
        const idx = list.findIndex(s => s.id === staffId);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...cleanData };
          saveLocalData('bb_staff_accounts', list);
          return true;
        }
        return false;
      }
    );
  },

  async updateParentPassword(studentId, newPassword) {
    const cleanPassword = String(newPassword || '').trim();
    const hashedPassword = await hashPassword(cleanPassword);
    return runQuery(
      async () => {
        const docRef = doc(db, "parent_accounts", studentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          await updateDoc(docRef, { password: hashedPassword });
        } else {
          const studentRef = doc(db, "students", studentId);
          const studentSnap = await getDoc(studentRef);
          const studentData = studentSnap.exists() ? studentSnap.data() : {};
          const numId = parseInt(studentData.student_id || studentData.student_numeric_id) || 0;
          await setDoc(docRef, {
            student_id: studentId,
            student_numeric_id: numId,
            password: hashedPassword
          });
        }
        return true;
      },
      () => {
        const list = getLocalData('bb_parent_accounts', []);
        const idx = list.findIndex(p => p.student_id === studentId);
        if (idx !== -1) {
          list[idx].password = hashedPassword;
        } else {
          const students = getLocalData('bb_students', INITIAL_STUDENTS);
          const student = students.find(s => s.id === studentId) || {};
          const numId = parseInt(student.student_id) || 0;
          list.push({
            student_id: studentId,
            student_numeric_id: numId,
            password: hashedPassword
          });
        }
        saveLocalData('bb_parent_accounts', list);
        return true;
      }
    );
  },

  async verifyResetEmail(role, centreName, email) {
    const cleanCode = String(centreName || '').trim().toLowerCase();
    const cleanEmail = String(email || '').trim().toLowerCase();
    
    // First verify center exists
    const tenant = await dbService.verifyTenantCode(cleanCode);
    if (!tenant) {
      throw new Error("Invalid Centre Name.");
    }
    
    // Set tenant code temporarily so that sub-collection queries work under correct tenant
    const origTenantCode = dbService.getTenantCode();
    dbService.setTenantCode(tenant.id);
    
    try {
      if (role === 'owner') {
        const ownerEmail = String(tenant.owner_email || '').trim().toLowerCase();
        if (ownerEmail !== cleanEmail) {
          throw new Error("Registered email does not match for this Tuition Owner.");
        }
        return { id: tenant.id, name: tenant.owner_name || 'Owner', email: ownerEmail };
      } 
      
      if (role === 'staff') {
        const staffAccounts = await dbService.getStaffAccounts();
        const matched = staffAccounts.find(s => String(s.email || '').trim().toLowerCase() === cleanEmail);
        if (!matched) {
          throw new Error("No staff account found with this registered email.");
        }
        return { id: matched.id, name: matched.name, email: matched.email };
      } 
      
      if (role === 'student') {
        const students = await dbService.getStudents();
        const matched = students.find(s => String(s.email || '').trim().toLowerCase() === cleanEmail);
        if (!matched) {
          throw new Error("No student account found with this registered email.");
        }
        return { id: matched.id, name: matched.name, email: matched.email };
      }
      
      throw new Error("Invalid reset role.");
    } finally {
      // Restore original tenant code
      dbService.setTenantCode(origTenantCode);
    }
  },

  async resetPassword(role, centreName, accountId, newPassword) {
    const cleanCode = String(centreName || '').trim().toLowerCase();
    const cleanPassword = String(newPassword || '').trim();
    
    const tenant = await dbService.verifyTenantCode(cleanCode);
    const resolvedTenantCode = tenant ? tenant.id : cleanCode;
    
    const origTenantCode = dbService.getTenantCode();
    dbService.setTenantCode(resolvedTenantCode);
    
    try {
      if (role === 'owner') {
        await dbService.updateTenant(resolvedTenantCode, { admin_password: cleanPassword });
        return true;
      }
      if (role === 'staff') {
        await dbService.updateStaffPassword(accountId, cleanPassword);
        return true;
      }
      if (role === 'student') {
        await dbService.updateParentPassword(accountId, cleanPassword);
        return true;
      }
      return false;
    } finally {
      dbService.setTenantCode(origTenantCode);
    }
  }
};
