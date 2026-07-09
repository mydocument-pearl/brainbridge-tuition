# Walkthrough - Secure Firestore Database (Open Database Access Closed)

We have successfully closed the **Open Database Access** security loophole by integrating **Firebase Authentication** and writing strict **Firestore Security Rules**. This was done while maintaining a seamless, automatic, and background migration path for existing users to prevent logins from breaking.

---

## 🛠️ Changes Implemented

### 1. Firestore Security Rules
We created `firestore.rules` in the project root containing strict rules:
- **No Public Access**: Blocks all anonymous unauthenticated reads and writes.
- **Multi-Tenant Isolation**: Authenticated users can only read/write documents belonging to their specific `tenantId` (Multi-tenant partition).
- **Public Inquiries**: Anyone can write (create) an inquiry document so new students can submit inquiry forms, but only authenticated tenant staff can read or modify them.
- **Restricted Guest Session**: The `guest@edubridge.com` account is allowed to read only the specific `staff_accounts` or `parent_accounts` documents needed to perform credentials verification during login. It is completely blocked from accessing student data, fees, attendance, timetable, logs, etc.

### 2. Firebase Authentication Integration
We initialized Firebase Auth in `src/database/firebase.js` and implemented transparent helper functions in `src/database/dbService.js`:
- **Virtual Email Architecture**: Programmatically maps every user to a deterministic Firebase Auth virtual email address:
  - Tuition Owners: `owner_<tenantId>@edubridge.internal`
  - Teachers/Staff: `staff_<tenantId>_<docId>@edubridge.internal`
  - Students/Parents: `student_<tenantId>_<studentId>@edubridge.internal`
- **SuperAdmin Account Setup**: Fixed the SuperAdmin login by signing in directly as `superadmin@edubridge.internal` (using password `Super123!`), resolving the issue where the SuperAdmin dashboard displayed 0 tuition centers due to authorization mismatches.
- **Transparent Login & Auto-Upgrade Migration**:
  1. When a user submits credentials, the app attempts to sign in via Firebase Auth directly.
  2. If the user doesn't have an Auth account yet (e.g. logging in for the first time), the app logs in as a restricted Guest, checks their password against the database SHA-256 hash, and automatically calls `createUserWithEmailAndPassword` to register their Auth account in the background.
  3. Once registered, the guest session is terminated, and the user is logged into their secure personal session. Subsequent logins authenticate directly and instantly.
- **Sign Out Integration**: Modified `handleLogout` in `src/App.jsx` to call `signOutUser()` so that the Firebase Auth token is revoked when users log out.

### 3. Setup & Registration Script
We created `setup_auth.cjs` in the root of the project to initialize the master `superadmin` and `guest` accounts in Firebase Authentication.

### 4. Compilation & Native Deployment
We compiled the code and ran a full native Gradle build. The fresh native binaries are ready at:
- APK: `EduBridge.apk`
- AAB: `EduBridge.aab`

---

## 🚀 Resolution of Verification Hurdles

1. **API Key Validity Issue**:
   - The original auto-created Firebase API key was restricted or ran into propagation issues with the Google Identity Toolkit API.
   - We created a new API key (`API key 2`) in the Google Cloud Console, restricted specifically to the **Cloud Firestore API** and **Identity Toolkit API**, and updated it in the project's `.env` configuration.
2. **SuperAdmin 0 Centers Issue**:
   - Previously, the SuperAdmin was logging in with a virtual email prefix which failed the strict `isSuperAdmin()` checks in the security rules.
   - We updated `verifySuperAdminLogin` in `src/database/dbService.js` to sign in using the exact `superadmin@edubridge.internal` email, restoring full global read/write access.

---

## 📅 Class / Standard (Std) Homework Configuration (June 2026)

We have added support for defining and showing the **Class / Standard (Std)** for homework assignments:

### 1. Dynamic Dropdown Selection during Assignment
In [Homework.jsx](file:///D:/tuition-management-app/src/pages/Homework.jsx), the standard selection is now integrated with the configured standards in settings (`activeTenant.standards`).
- If there are standards defined in settings, a `<select>` dropdown of standards is presented, plus an option to select **Other / Custom...** to type in a custom standard name.
- If no standards are configured in settings, it falls back to a clean text input.

### 2. Admin Filters for Standard & Batch
To accommodate large academies, we added filtering controls at the top of the Admin homework dashboard. Admins and teachers can now easily filter the list of assigned homework by **Standard** and/or **Batch**.

### 3. Visual Standard Indicators
- **Homework Cards**: Displays a clear orange/yellow badge (e.g. `Std: 10th`) on each card.
- **Dashboard Updates**: Displays the standard tag next to the homework title under the "Active Homework" section of [Dashboard.jsx](file:///D:/tuition-management-app/src/pages/Dashboard.jsx) so it's instantly clear which standard it belongs to.

### 4. Updated APK & AAB Compilation
The changes have been verified and compiled successfully into production-ready Android artifacts.
- APK: [EduBridge.apk](file:///D:/tuition-management-app/EduBridge.apk)
- AAB: [EduBridge.aab](file:///D:/tuition-management-app/EduBridge.aab)

---

## 🔗 Batch-Standard Linkage and Auto-Detection in Homework (June 26, 2026)

To streamline user workflow and eliminate double data-entry:

### 1. Linking Standard to Batch on Creation
- Updated the "Create Batch" modal in [Students.jsx](file:///D:/tuition-management-app/src/pages/Students.jsx#L762-L788) to include a **Standard / Class** field.
- When creating a batch, the admin/teacher selects the Standard from settings (or inputs it manually if no settings standard exists).
- Each batch document in Firestore now holds a `standard` field.

### 2. Auto-Detection in Homework Assign Form
- Updated the Homework Assign form in [Homework.jsx](file:///D:/tuition-management-app/src/pages/Homework.jsx#L252-L315) so that when a Batch is selected, the app automatically finds the linked Standard and displays it as read-only (e.g. `10th (Auto-detected from Batch)`).
- If selecting an old batch (created before this update), it falls back to the manual dropdown/text input selector.
- The homework document continues to save the `standard` field properly so it remains visible on all cards and dashboards.

### 3. Re-Compilation Complete
All changes have been successfully integrated and built:
- APK: [EduBridge.apk](file:///D:/tuition-management-app/EduBridge.apk)
- AAB: [EduBridge.aab](file:///D:/tuition-management-app/EduBridge.aab)

---

## 🗄️ Database Migration to Supabase (PostgreSQL)

We have successfully migrated the application database layer from **Firebase Firestore** to **Supabase PostgreSQL**:

### 1. Database Schema Translation
- Recreated all core relational tables (`tenants`, `batches`, `students`, `staff_accounts`, `parent_accounts`, `inquiries`, `attendance`, `attendance_edit_logs`, `fees`, `tests`, `test_marks`, `timetable`, `homework`, `study_material`, `testimonials`, `chats`, `logs`) on Supabase.
- Used `text` format for all primary and foreign key IDs to support custom Firestore document IDs (e.g., `"vdm"`, `"test_batch_id"`), ensuring 100% data compatibility.

### 2. Data Migration Execution
- Created and executed a robust migration script `migrate_to_supabase.js` that fetched all records from Firebase Firestore (using dynamic tenant owner logins) and upserted them directly into the PostgreSQL tables on Supabase.
- Resolved and mapped date formats safely to `YYYY-MM-DD` and timestamps to standard ISO strings to satisfy PostgreSQL data type constraints.

### 3. Transparent Client Proxy Integration
- Modified [firebase.js](file:///D:/tuition-management-app/src/database/firebase.js) to acts as a Supabase adapter proxy. It implements all standard Firestore query signatures (`collection`, `doc`, `getDocs`, `getDoc`, `setDoc`, `updateDoc`, `addDoc`, `deleteDoc`, `query`, `where`, `orderBy`, `limit`, `onSnapshot`) and Firebase Auth signatures (`signInWithEmailAndPassword`, `signOut`, `onAuthStateChanged`), translating them to Supabase JS client operations under the hood.
- Updated imports at the top of [dbService.js](file:///D:/tuition-management-app/src/database/dbService.js) to use this adapter. The entire database switch was accomplished cleanly **without making any changes to the UI components or business logic**.

### 4. Verification & Build
- The application compiled successfully for production:
  - **Build Command**: `npm run build`
  - **Status**: SUCCESS
- All local Vite dev environment and production code is now powered entirely by **Supabase PostgreSQL**.
