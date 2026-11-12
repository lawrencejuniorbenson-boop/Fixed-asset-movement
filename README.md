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

Any authorized staff member can sign in or register directly via the portal. User accounts and credentials are saved securely in Supabase / institutional database with role-based access for:
- **Requesting Officer** (Originator)
- **Requesting Department Head** (Department Review & Approval)
- **Asset & Archives Department Pool** (Asset Verification, Release & Register Closure)
- **Transport & Logistics Department Pool** (Fulfillment Scheduling & Physical Relocation)
- **IT Infrastructure & Systems Pool** (Hardware Pickup & Data Centre Logistics)
- **Internal Audit & Inspection** (Compliance & Audit Exports)
- **System Administrator** (Enterprise Oversight & System Configuration)

---

## 🚀 How to Run the Platform

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

