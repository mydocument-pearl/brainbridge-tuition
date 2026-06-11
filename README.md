# BrainBridge Tuition Class Management System

BrainBridge is a premium, highly responsive web application designed for modern tuition classes to streamline student management, attendance tracking, fee collection, exam scoring, and class scheduling.

---

## 🗄️ Database & Storage Architecture

BrainBridge has a dual-mode database service built into the [dbService.js](file:///src/database/dbService.js) layer. This allows you to run the application immediately without server setups, while being fully ready to connect to a production cloud database.

### 1. LocalStorage Fallback Mode (Default)
* If no Supabase credentials are configured in your `.env` file, the application automatically runs in **LocalStorage Mode**.
* All database entities (Admissions, Batches, Attendance Logs, Fees, Receipts, Exams, Testimonials, and Timetables) are saved locally inside your web browser's storage (`localStorage`).
* **Initial Mock Data:** On first launch, the app populates mock records (dummy students, batches, and schedules) so you can interact with the dashboard immediately.

### 2. Supabase Cloud Database Mode (Production)
* To synchronize data across multiple devices (for teachers, admins, and owners) and ensure permanent cloud backups, connect the app to **Supabase** (a hosted PostgreSQL cloud database).
* All operations (Adding students, marking attendance, updating fees, scheduling timetables) will save in real-time to your cloud instance.

---

## 🚀 Step-by-Step Supabase Setup

Follow these simple steps to move your data storage to the cloud:

### Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up for a free account.
2. Click **New Project** and select a name (e.g., `BrainBridge Tuition`) and database password.
3. Choose a server location closest to you and click **Create New Project**.

### Step 2: Run the Database Schema SQL
1. Once your project is ready, navigate to the **SQL Editor** tab in the left sidebar of your Supabase dashboard.
2. Click **New Query**.
3. Open the [schema.sql](file:///schema.sql) file located in the root of this project.
4. Copy the entire contents of the SQL script and paste it into the Supabase SQL editor.
5. Click **Run** at the bottom-right. This creates all the required tables (`batches`, `students`, `attendance`, `fees`, `tests`, `test_marks`, `testimonials`, `timetable`) and automatically disables Row Level Security (RLS) so the browser client can read/write data.

### Step 3: Configure Environment Variables
1. Open the `.env` file in the root of the `tuition-management-app` project directory.
2. Retrieve your credentials from the Supabase dashboard:
   - Go to **Project Settings** -> **API**.
   - Copy the **Project URL** and paste it under `VITE_SUPABASE_URL`.
   - Copy the **anon / public** API key and paste it under `VITE_SUPABASE_ANON_KEY`.
3. Example `.env` setup:
   ```env
   VITE_SUPABASE_URL=https://abcde12345.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Save the `.env` file and **restart** your development server. The app will automatically detect these credentials and swap to Supabase Cloud Mode.

---

## 🏃 Local Development Commands

To run the application on your computer:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Local Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

3. **Build for Production:**
   ```bash
   npm run build
   ```
   This compiles a highly optimized bundle inside the `dist` directory, ready to deploy to free hosting providers like Netlify, Vercel, or GitHub Pages.
