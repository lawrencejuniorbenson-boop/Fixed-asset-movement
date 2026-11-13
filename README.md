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

## 👥 User Authentication & Access

Sign-in uses **Supabase Auth** (passwords are hashed and managed by Supabase, never stored in app tables). Each signed-in account is linked to a staff profile in `public.users`, which holds the role:
- **Requesting Officer** (Originator)
- **Requesting Department Head** (Department Review & Approval)
- **Asset & Archives Department Pool** (Asset Verification, Release & Register Closure)
- **Transport & Logistics Department Pool** (Fulfillment Scheduling & Physical Relocation)
- **IT Infrastructure & Systems Pool** (Hardware Pickup & Data Centre Logistics)
- **Internal Audit & Inspection** (Compliance & Audit Exports)
- **System Administrator** (Enterprise Oversight & System Configuration)

### How accounts work
- **Self sign-up** always creates a **Requesting Officer**. Nobody can choose their own role.
- **Other roles** are assigned by an administrator: on *Users → Add User* the admin pre-registers the email and role. The staff member then uses *Create Account* with that same email; once they confirm the email, they receive the pre-assigned role.
- **First administrator:** sign up, confirm your email, then run in the Supabase SQL Editor:
  ```sql
  UPDATE public.users SET role = 'admin' WHERE email = 'you@yourbank.com';
  ```

### Security model (enforced in the database, not the browser)
- Row Level Security on every table; signed-out visitors can read nothing.
- Each role only sees the requests relevant to it (see `supabase_schema.sql`, section 6).
- Approval stages can only be performed by the right role, in order, and the approver's name/ID is stamped by the database.
- Nobody can approve or close their own request.
- The audit log is append-only and attributed to the real signed-in user.

## 🔐 Supabase Setup (required for deployment)

1. Create a Supabase project.
2. In **SQL Editor**, run the whole of `supabase_schema.sql`. It is safe to re-run, and it upgrades an older install in place.
3. In **Authentication → Providers → Email**, keep **Confirm email ON**. Existing staff profiles are linked to a sign-up by email address only after confirmation.
4. In **Authentication → URL Configuration**, set the **Site URL** to your deployed URL (e.g. your Vercel domain).
5. In Vercel (or `frontend/.env.local` for local dev), set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable/anon key, **never** the service-role key).

**Upgrading from the previous version:** the old `users.password` column is deleted. Existing staff keep their profile and role, but each must use *Create Account* once with their existing email to set a new password.

### Security tests
`supabase/tests/rls_test.sh` checks the database rules (60 checks: privilege escalation, cross-user access, workflow bypass, etc.) against a plain local PostgreSQL:
```bash
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres ./supabase/tests/rls_test.sh
```

---

## 🚀 How to Run the Platform

> **Production runs on Supabase only.** The Vercel deployment serves the frontend, which talks directly to Supabase. The Express backend in `backend/` is a local development server and is not deployed. If you run it, set `JWT_SECRET` (32+ characters); it refuses to start in production without one.

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

