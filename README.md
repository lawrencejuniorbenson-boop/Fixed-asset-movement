# Fixed Asset Movement Platform

A dedicated institutional digital platform for managing the enterprise fixed asset movement lifecycle across two interconnected forms:
1. **Form A — Fixed Asset Movement Request & Authorization** (Multi-tier review & approval)
2. **Form B — Transport & Logistics Execution** (Vehicle arrangement, physical relocation & asset register closure)

Built with a simple, clean, and professional **White & Blue** enterprise interface powered by **Poppins** typography and corporate **Active Directory** integration.

---

## 🏛️ The Two Forms & Workflows

### 📋 Form 1 (Form A): Fixed Asset Movement Request
```
Requesting Officer (Fills Form A & Table of Assets)
         │
         ▼
Unit / Department Head (Step 1: Departmental Review & Approval)
         │
         ▼
AMA Officer (Step 2: Fixed Asset Register & Tag Verification)
         │
         ▼
Head, Fixed Assets / AMA Head (Step 3: Final Authorization)
         │
         ▼  (Automatically generates and forwards Form B)
Transport & Logistics Unit
```

### 🚚 Form 2 (Form B): Transport & Logistics Execution
```
Unit Head, Transport/Logistics (Assesses logistics & assigns Officer + Vehicle)
         │
         ▼
Assigned Transport Officer (Executes physical move & delivers to destination)
         │
         ▼
Formal Notification Sent to AMA Department (Confirms relocation completion)
         │
         ▼
Asset Monitoring & Archives Department (Updates Asset Register & closes file)
```

---

## 📋 Form Fields (Exact Match to Bank Document)

- **PRESENT LOCATION OF THE ASSET**: Specific branch/office and floor.
- **NEW LOCATION OF THE ASSET**: Destination department or branch.
- **PURPOSE FOR THE MOVEMENT**: Operational or administrative reason.
- **OFFICER DOING THE MOVEMENT**: Designated custodian or transport officer.
- **SIGNATURE**: Digital signature of the requesting officer.
- **AUTHORIZED BY**: Supervisor or Head of Unit name.
- **DATE**: Request / movement date.
- **ASSET SCHEDULE TABLE**:
  - `No.` (Sequential row counter)
  - `NAME OF ASSET` (e.g. `SWIVEL CHAIR(2)`, `EXECUTIVE DESK`)
  - `ASSET CODE` (e.g. `T11127FF0008`)
  - Dynamic support for multiple asset items.
- **APPROVED BY HEAD, FIXED ASSETS**: Name, digital signature stamp, and authorization date.
- **PRINTABLE SLIP**: One-click official bank slip print/export matching the exact bank paper layout.

---

## 🏢 Active Directory / LDAP Staff Integration

The platform integrates directly with the organization's corporate **Active Directory (AD / LDAP / Microsoft Entra ID)**:

1. **Auto-Population on Form Creation**:
   - The logged-in staff member's profile is queried live from Active Directory (`Staff ID`, `Job Title`, `Department`, `Unit`, and assigned `Office Location`).
   - The **Present Location** defaults automatically to their physical office/branch registered in Active Directory.
   - The **Authorized By** field automatically suggests their designated direct supervisor/unit head based on Active Directory's organizational reporting hierarchy (`manager_name`, `manager_staff_id`).

2. **Live Active Directory Staff Picker**:
   - Live autocomplete lookup for **Officer Doing Movement** and **Authorized By (Supervisor / Head)**.
   - Searches across `Name`, `Staff ID` (e.g. `EMP-0021`), `Email`, `sAMAccountName`, `Department`, and `Job Title`.
   - Populates the staff member's official corporate details.

3. **Active Directory Status & Directory Browser**:
   - Accessible via the **Active Directory** button in the top navigation bar.
   - Live directory controller health check, LDAP search base inspection, department filters, and manual sync verification.
   - Directory API endpoints:
     - `GET /api/directory/search?q=...&department=...`
     - `GET /api/directory/staff/:staffIdOrEmail`
     - `GET /api/directory/departments`
     - `GET /api/directory/status`
     - `POST /api/directory/test-connection`

---

## 🎬 Demo setup: one administrator login

For client demonstrations the app uses a single sign-in: one administrator who can perform every step of the workflow. There is no sign-up link.

1. In Supabase, run `supabase_schema.sql` once (SQL Editor). The default mode is `login`.
2. **Authentication → Users → Add user → Create new user**: enter the admin email and a password, and tick **Auto Confirm User**.
3. In the SQL Editor, make that user the administrator:
   ```sql
   UPDATE public.users SET role = 'admin', name = 'Demo Administrator'
   WHERE email = 'admin@yourcompany.com';
   ```
4. Open the site and sign in with that email and password.

The admin can approve every stage, assign themselves to a move, and close requests, so one person can demonstrate the full flow. Other staff can be added on the **Users** page as profiles (for names, roles and assignments); in this demo version they do not sign in.

## 👥 Access modes

The database decides how people get in (`private.settings`, key `access_mode`):

| Mode | What users see | Who can do what |
|---|---|---|
| `login` (default) | A sign-in page (Supabase Auth). | Each person acts only as themselves. |
| `open` | **No login page.** An "Acting as" switcher in the sidebar. | **Anyone with the link can act as any staff profile, including admin.** |

In both modes the database still enforces the workflow: the right role for each stage, stages in order, nobody approves their own request, and every action is recorded in the audit trail under the profile used.

Switch modes in the Supabase SQL Editor; no redeploy is needed:

```sql
UPDATE private.settings SET value = 'open'  WHERE key = 'access_mode';  -- no login
UPDATE private.settings SET value = 'login' WHERE key = 'access_mode';  -- require sign-in
```

**Open mode also needs:** Supabase → Authentication → Sign In / Providers → enable **"Allow anonymous sign-ins"**. If there are no staff profiles yet, the app asks you to create the first administrator.

### Roles
Requesting Officer, Department Head, AMA Officer, AMA Head, Transport Head/Officer, IT Head/Officer, Internal Auditor, Administrator. Administrators add people and change roles on the **Users** page.

### Accounts in login mode
- **Self sign-up** always creates a **Requesting Officer**. Nobody can choose their own role.
- **Other roles:** the admin adds the person on *Users*; the person then uses *Create an account* with that same email and confirms it.
- **First administrator:** sign up, confirm your email, then run:
  ```sql
  UPDATE public.users SET role = 'admin' WHERE email = 'you@yourbank.com';
  ```

### Security model (enforced in the database, not the browser)
- Row Level Security on every table; visitors without a session can read nothing.
- Each role only sees the requests relevant to it.
- Approval stages can only be performed by the right role, in order; approver names and IDs are stamped by the database.
- The audit log is append-only. The app shows only recorded entries; it never fills gaps with generated ones.

## 🔐 Supabase Setup (required for deployment)

1. Create a Supabase project.
2. In **SQL Editor**, run the whole of `supabase_schema.sql`. It is safe to re-run, and it upgrades an older install in place.
3. In **Authentication → Providers → Email**, keep **Confirm email ON**. Existing staff profiles are linked to a sign-up by email address only after confirmation.
4. In **Authentication → URL Configuration**, set the **Site URL** to your deployed URL (e.g. your Vercel domain).
5. The project's public Supabase URL and anon key are built in (`frontend/src/lib/publicConfig.js`). To point at a different project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel (or `frontend/.env.local` for local dev); they take priority. Never use the service-role key (the publishable/anon key, **never** the service-role key), then redeploy. Without them the site shows a "Supabase is not configured" page.
6. For open mode, enable anonymous sign-ins (see *Access modes*) and run the `UPDATE private.settings …` line.

**Upgrading from the previous version:** the old `users.password` column is deleted. Existing staff keep their profile and role, but each must use *Create Account* once with their existing email to set a new password.

### Security tests
`supabase/tests/rls_test.sh` checks the database rules (83 checks: privilege escalation, cross-user access, workflow bypass, open/login modes, etc.) against a plain local PostgreSQL:
```bash
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres ./supabase/tests/rls_test.sh
```

---

## 🚀 How to Run the Platform

> **The app runs on Supabase only.** The frontend talks directly to Supabase and no longer calls the Express API in `backend/` at all. That backend is legacy code; if it stays deployed, set `JWT_SECRET` (32+ characters) or it refuses to start in production.

### Option 1: Quick Launch
Double-click `start.bat` in this folder. It will launch both the backend and frontend in separate command windows.

### Option 2: Manual Start

**Backend:**
```bash
cd backend
npm start
```
*Backend runs on http://localhost:3001*

**Frontend:**
```bash
cd frontend
npm run dev
```
*Frontend runs on http://localhost:5173*

