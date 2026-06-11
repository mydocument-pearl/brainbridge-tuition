-- BrainBridge Database Schema Setup for Supabase / PostgreSQL
-- Copy and run this script in your Supabase SQL Editor (supabase.com -> Project -> SQL Editor -> New Query)

-- 1. Create Batches table
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    timing TEXT,
    teacher_name TEXT
);

-- 2. Create Students table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mobile TEXT,
    parent_mobile TEXT,
    address TEXT,
    school TEXT,
    standard TEXT,
    admission_date DATE DEFAULT CURRENT_DATE,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL
);

-- 3. Create Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
    CONSTRAINT student_date_unique UNIQUE (student_id, date)
);

-- 4. Create Fees table
CREATE TABLE IF NOT EXISTS fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Paid', 'Pending')),
    payment_date DATE,
    payment_mode TEXT
);

-- 5. Create Tests table
CREATE TABLE IF NOT EXISTS tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    max_marks NUMERIC NOT NULL,
    test_date DATE NOT NULL,
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL
);

-- 6. Create Test Marks table
CREATE TABLE IF NOT EXISTS test_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    marks_obtained NUMERIC NOT NULL,
    CONSTRAINT test_student_unique UNIQUE (test_id, student_id)
);

-- 7. Create Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_name TEXT NOT NULL,
    student_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE
);

-- 8. Create Timetable table
CREATE TABLE IF NOT EXISTS timetable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    subject TEXT NOT NULL,
    topic TEXT,
    teacher_name TEXT,
    room TEXT
);

-- NOTE ON ROW LEVEL SECURITY (RLS):
-- By default, Supabase enables RLS on new tables. To allow direct admin panel operations
-- from the browser client using the public anonymous key (without setting up user auth screens),
-- you should disable RLS on these tables by running the commands below:

ALTER TABLE batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE fees DISABLE ROW LEVEL SECURITY;
ALTER TABLE tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_marks DISABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials DISABLE ROW LEVEL SECURITY;
ALTER TABLE timetable DISABLE ROW LEVEL SECURITY;
