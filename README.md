# LabSwift (LabFlow) — Modern Pathology & Laboratory Information System (LIMS)

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5-purple?logo=vite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-teal?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%7C%20Auth%20%7C%20Storage-emerald?logo=supabase)
![React-PDF](https://img.shields.io/badge/@react--pdf/renderer-Client--Side%20PDF-red)

A robust, cloud-enabled Laboratory Information Management System (LIMS) engineered for pathology labs and diagnostic centres. Battle-tested in live daily clinical environments, LabSwift streamlines patient intake, test template customization, reporting, billing, doctor referral commissions, and report dispatch.

---

## 🌟 Key Features

### 1. Patient & Demographic Management
- **Pediatric & Adult Age Precision**: Supports both **Years (0–150)** and **Months (0–11)** for accurate pediatric/infant lab reference evaluations.
- **Unique Patient Identifier**: Automated sequential numbering format (e.g. `P-00001`).
- **Complete Patient Profile**: Searchable history, contact details, blood groups, and referring physicians.

### 2. Clinical Test Template Engine
- **Pre-Configured Medical Profiles**: Out-of-the-box support for Complete Blood Count (CBC), Liver Function Tests (LFT), Kidney Function Tests (KFT), Lipid Profiles, Urine Routine, Thyroid Panels, and **Widal Antigen-Antibody Agglutination Matrix**.
- **Gender-Aware Reference Ranges**: Custom normal ranges for Male, Female, and General patients with automatic abnormality flagging.
- **Safe Template Architecture**: Soft-deactivation avoids Postgres foreign-key delete restrictions, ensuring historic patient records are never invalidated when updating template fields.
- **Template Duplication**: "Duplicate as New" action enables creating specialized test variations in seconds without retyping parameters from scratch.

### 3. Patient Timeline & Combined PDF Generation
- **Chronological History**: Reports are sorted from latest to oldest and organized into date groups (e.g. *Today*, *Yesterday*, *24 October 2026*).
- **Multi-Test Batch Selection**: One-click checkboxes to select multiple reports or "Select all for this date".
- **Single Cumulative PDF**: Compiles all selected tests for a patient into a single unified multi-page PDF document (`<patientCode>-<patientName>-<DD-MM>-Combined-Reports.pdf`) for single-click printing or WhatsApp sharing.

### 4. Real-World Lab Billing & Doctor Referral Accounting
- **Collection-First Workflow**: Default report status is set to **`UNPAID`**, matching laboratory workflows where patients pay upon report collection.
- **Interactive Payment Modal**: Quickly record payments with 4 distinct statuses:
  - **`Paid`**: Full net bill collected.
  - **`Partial`**: Custom amount collected with live **Balance Due** calculation.
  - **`Free / Waived`**: Zero-cost fee waiver.
  - **`Unpaid`**: Outstanding dues tracked on dashboard.
- **Patient Discounts**: Apply flat (₹) or percentage (%) discounts with quick preset chips (10%, 20%, 50%, Free).
- **Accurate Doctor Incentives**: Referral payouts are automatically calculated on the **net bill after discounts**, preventing commission/revenue mismatches.

### 5. Branding & Configurable Pathologist Signature
- **Custom Header & Watermark**: Laboratory branding with high-resolution logo watermark and customizable theme accent colors.
- **Toggleable Digital Signature**: In **Settings**, lab owners can check/uncheck *"Use uploaded signature in PDF lab reports"*:
  - **Checked**: Digitally signs the report above the pathologist's credentials.
  - **Unchecked**: Leaves an uncluttered, standardized signing space for physical pen signatures and stamps.

### 6. Security & Role-Based Access Control
- **Supabase Authentication & Row-Level Security (RLS)**: Enforces role isolation between **Admin** and **Staff** members.
- **Session Protection**: Guarded routes, password reset workflows, and token expiration handling.
- **Sanitized Client Assets**: No secrets or private database strings exposed in client-side bundles.

---

## 🛠️ Tech Stack

- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL with RLS, Auth, and Storage)
- **PDF Engine**: [@react-pdf/renderer](https://react-pdf.org/)
- **Icons & UI**: [Lucide React](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- A Supabase project (free tier supported)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rafrafreza/labswift-demo.git
   cd labswift-demo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment template:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL="https://your-project-id.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-public-key"
   VITE_APP_URL="http://localhost:5173"
   ```

4. **Database Setup**:
   Execute the migration scripts located in `supabase/migrations/` in sequential order (from `01.sql` to `12.sql`) using the **Supabase SQL Editor**.

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📦 Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the Vite local development server |
| `npm run build` | Compiles TypeScript and creates production build in `dist/` |
| `npm run typecheck` | Validates TypeScript types across the entire codebase |
| `npm run preview` | Previews the compiled production build locally |

---

## 🔒 Security & Deployment Notes

- **Never commit `.env` or `.env.local`**: Ensure private service role keys and secrets remain in environment configurations only.
- **Row-Level Security (RLS)**: Verify that all PostgreSQL tables have RLS enabled as defined in `supabase/migrations/`.
- **Public Anon Key**: The `VITE_SUPABASE_ANON_KEY` is meant for public client access and restricted by PostgreSQL RLS policies.

---

## 📄 License

This software is developed for pathology diagnostic centers. All rights reserved.
