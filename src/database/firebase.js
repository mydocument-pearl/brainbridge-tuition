import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isFirebaseConfigured = !!supabaseUrl && !!supabaseAnonKey;
export const db = {}; // Placeholder

// Local Storage Session Helper
const getCachedUser = () => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && data.user) return data.user;
      } catch (e) {}
    }
  }
  return null;
};

export const auth = {
  get currentUser() {
    return getCachedUser();
  }
};

// Query Reference Mock Class
class SupabaseQueryRef {
  constructor(tableName, id = null, tenantId = null) {
    this.tableName = tableName;
    this.id = id;
    this.tenantId = tenantId;
    this.constraints = [];
  }
}

// Helpers for multi-tenancy collection/doc mappings
export const collection = (dbInstance, name, tenantCode = null, subName = null) => {
  if (name === "tenants" && tenantCode && subName) {
    return new SupabaseQueryRef(subName, null, tenantCode);
  }
  return new SupabaseQueryRef(name);
};

export const doc = (dbInstance, name, id = null, subName = null, subId = null) => {
  if (name === "tenants" && id && subName && subId) {
    return new SupabaseQueryRef(subName, subId, id);
  }
  return new SupabaseQueryRef(name, id);
};

// Constraints
export const where = (field, operator, value) => {
  return (queryRef) => {
    queryRef.constraints.push({ type: 'where', field, operator, value });
  };
};

export const orderBy = (field, direction = 'asc') => {
  return (queryRef) => {
    queryRef.constraints.push({ type: 'orderBy', field, direction });
  };
};

export const limit = (n) => {
  return (queryRef) => {
    queryRef.constraints.push({ type: 'limit', value: n });
  };
};

export const query = (ref, ...constraints) => {
  const newRef = new SupabaseQueryRef(ref.tableName, ref.id, ref.tenantId);
  constraints.forEach(c => c(newRef));
  return newRef;
};

// Date Formatter Helper (SQL DATE column expects YYYY-MM-DD)
const formatSqlDate = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal;
    const match = dateVal.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
  }
  return dateVal;
};

// Get Documents
export const getDocs = async (queryRef) => {
  let q = supabase.from(queryRef.tableName).select('*');
  
  // Apply tenant isolation check (unless it's the tenants table itself)
  if (queryRef.tableName !== 'tenants' && queryRef.tenantId) {
    q = q.eq('tenant_id', queryRef.tenantId);
  }
  
  // Apply constraints
  queryRef.constraints.forEach(c => {
    if (c.type === 'where') {
      let val = c.value;
      if (c.field === 'date' || c.field === 'due_date' || c.field === 'paid_date') {
        val = formatSqlDate(val);
      }
      if (c.operator === '==') q = q.eq(c.field, val);
      else if (c.operator === '!=') q = q.neq(c.field, val);
      else if (c.operator === '>=') q = q.gte(c.field, val);
      else if (c.operator === '<=') q = q.lte(c.field, val);
      else if (c.operator === '>') q = q.gt(c.field, val);
      else if (c.operator === '<') q = q.lt(c.field, val);
    } else if (c.type === 'orderBy') {
      q = q.order(c.field, { ascending: c.direction === 'asc' });
    } else if (c.type === 'limit') {
      q = q.limit(c.value);
    }
  });
  
  const { data, error } = await q;
  if (error) {
    console.error(`Supabase select error on table ${queryRef.tableName}:`, error);
    throw error;
  }
  
  return {
    empty: data.length === 0,
    size: data.length,
    docs: data.map(row => ({
      id: row.id || `${row.student_id}_${row.date}` || `${row.test_id}_${row.student_id}`,
      data: () => row
    }))
  };
};

// Get Document
export const getDoc = async (docRef) => {
  let q = supabase.from(docRef.tableName).select('*');
  if (docRef.tableName === 'attendance') {
    const [studentId, date] = docRef.id.split('_');
    q = q.eq('student_id', studentId).eq('date', date);
  } else if (docRef.tableName === 'test_marks') {
    const [testId, studentId] = docRef.id.split('_');
    q = q.eq('test_id', testId).eq('student_id', studentId);
  } else {
    q = q.eq('id', docRef.id);
  }
  
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error(`Supabase maybeSingle error on table ${docRef.tableName}:`, error);
    throw error;
  }
  
  return {
    exists: () => !!data,
    id: docRef.id,
    data: () => data || null
  };
};

// Set Document
export const setDoc = async (docRef, data) => {
  const payload = { ...data };
  if (docRef.tableName !== 'tenants' && docRef.tenantId) {
    payload.tenant_id = docRef.tenantId;
  }
  
  if (payload.date) payload.date = formatSqlDate(payload.date);
  if (payload.due_date) payload.due_date = formatSqlDate(payload.due_date);
  if (payload.paid_date) payload.paid_date = formatSqlDate(payload.paid_date);
  
  if (docRef.tableName === 'attendance') {
    const [studentId, date] = docRef.id.split('_');
    payload.student_id = studentId;
    payload.date = date;
    delete payload.id;
  } else if (docRef.tableName === 'test_marks') {
    const [testId, studentId] = docRef.id.split('_');
    payload.test_id = testId;
    payload.student_id = studentId;
    delete payload.id;
  } else {
    if (docRef.id) payload.id = docRef.id;
  }
  
  const { error } = await supabase
    .from(docRef.tableName)
    .upsert(payload);
    
  if (error) {
    console.error(`Supabase upsert error on table ${docRef.tableName}:`, error);
    throw error;
  }
};

// Update Document
export const updateDoc = async (docRef, data) => {
  const payload = { ...data };
  if (payload.date) payload.date = formatSqlDate(payload.date);
  if (payload.due_date) payload.due_date = formatSqlDate(payload.due_date);
  if (payload.paid_date) payload.paid_date = formatSqlDate(payload.paid_date);

  let q = supabase.from(docRef.tableName).update(payload);
  if (docRef.tableName === 'attendance') {
    const [studentId, date] = docRef.id.split('_');
    q = q.eq('student_id', studentId).eq('date', date);
  } else if (docRef.tableName === 'test_marks') {
    const [testId, studentId] = docRef.id.split('_');
    q = q.eq('test_id', testId).eq('student_id', studentId);
  } else {
    q = q.eq('id', docRef.id);
  }
  
  const { error } = await q;
  if (error) {
    console.error(`Supabase update error on table ${docRef.tableName}:`, error);
    throw error;
  }
};

// Add Document
export const addDoc = async (colRef, data) => {
  const payload = { ...data };
  if (colRef.tableName !== 'tenants' && colRef.tenantId) {
    payload.tenant_id = colRef.tenantId;
  }
  if (payload.date) payload.date = formatSqlDate(payload.date);
  if (payload.due_date) payload.due_date = formatSqlDate(payload.due_date);
  if (payload.paid_date) payload.paid_date = formatSqlDate(payload.paid_date);

  const { data: inserted, error } = await supabase
    .from(colRef.tableName)
    .insert(payload)
    .select()
    .single();
    
  if (error) {
    console.error(`Supabase insert error on table ${colRef.tableName}:`, error);
    throw error;
  }
  return { id: inserted.id };
};

// Delete Document
export const deleteDoc = async (docRef) => {
  let q = supabase.from(docRef.tableName).delete();
  if (docRef.tableName === 'attendance') {
    const [studentId, date] = docRef.id.split('_');
    q = q.eq('student_id', studentId).eq('date', date);
  } else if (docRef.tableName === 'test_marks') {
    const [testId, studentId] = docRef.id.split('_');
    q = q.eq('test_id', testId).eq('student_id', studentId);
  } else {
    q = q.eq('id', docRef.id);
  }
  
  const { error } = await q;
  if (error) {
    console.error(`Supabase delete error on table ${docRef.tableName}:`, error);
    throw error;
  }
};

// Real-time Subscriptions (onSnapshot)
export const onSnapshot = (queryRef, callback, errorCallback) => {
  getDocs(queryRef)
    .then(snapshot => callback(snapshot))
    .catch(err => {
      if (errorCallback) errorCallback(err);
      else console.error("onSnapshot error:", err);
    });
    
  const channelName = `${queryRef.tableName}-changes-${Math.random().toString(36).slice(2)}`;
  
  const sub = supabase.channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: queryRef.tableName
      },
      async (payload) => {
        try {
          const snapshot = await getDocs(queryRef);
          callback(snapshot);
        } catch (err) {
          if (errorCallback) errorCallback(err);
        }
      }
    )
    .subscribe();
    
  return () => {
    supabase.removeChannel(sub);
  };
};

// --- AUTHENTICATION MOCKS ---

export const signInWithEmailAndPassword = async (authInstance, email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    console.error("Supabase Auth signIn error:", error);
    throw error;
  }
  return { user: data.user };
};

export const createUserWithEmailAndPassword = async (authInstance, email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) {
    console.error("Supabase Auth signUp error:", error);
    throw error;
  }
  return { user: data.user };
};

export const signOut = async (authInstance) => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Supabase Auth signOut error:", error);
    throw error;
  }
};

export const onAuthStateChanged = (authInstance, callback) => {
  supabase.auth.getSession().then(({ data }) => {
    callback(data.session ? data.session.user : null);
  });
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session ? session.user : null);
  });
  
  return () => {
    subscription.unsubscribe();
  };
};
