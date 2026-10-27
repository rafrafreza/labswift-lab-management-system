# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LabSwift is a LIMS for small pathology labs: patients, test templates, reports with PDF output, billing, and doctor referral incentives. It is a client-only React 18 + TypeScript + Vite SPA that talks directly to Supabase (Postgres + RLS, Auth, Storage). There is no custom backend except one Supabase Edge Function. Deployed on Vercel (`vercel.json` rewrites everything to `index.html`).

## Commands

- `npm run dev` — Vite dev server on port 5173
- `npm run build` — `tsc --noEmit && vite build`
- `npm run typecheck` — type check only
- `npm run preview` — serve the production build

There is no linter and no test framework configured, so `npm run typecheck` is the only automated check.

Env vars go in `.env.local` (template in `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`. The app throws at startup if the first two are missing.

## Architecture

- Path alias `@/` maps to `src/` (set in both `tsconfig.json` and `vite.config.ts`).
- **No server layer.** Pages call functions in `src/lib/services/*.ts` (one module per domain: patients, reports, templates, doctors, settings, users, analytics), which call the shared Supabase client in `src/lib/supabase.ts`. Authorization is enforced only by Postgres RLS, so the client-side `ProtectedRoute adminOnly` guard is UX, not security.
- **Auth:** `AuthContext` wraps the Supabase session and loads the user's row from `profiles` (role `ADMIN` | `STAFF`, `isActive`). Inactive users are signed out. Routes in `App.tsx` are split into an authenticated group and an `adminOnly` group (templates, users, analytics, settings, doctors, incentives). Pages are lazy-loaded.
- **Row mapping:** `src/lib/services/helpers.ts` holds the `mapX` functions that convert raw DB rows into the types in `src/types/index.ts`. New columns must be added to the mapper as well as the query's `select`.
- **Reports** are the core entity. A report links one patient to one template and stores one `report_values` row per template field, with `isAbnormal` computed client-side at save time by `isValueAbnormalGender` in `src/lib/utils.ts` (gender-specific ranges). Billing (`billAmount`, discount, `amountPaid`, `paymentStatus`) lives on the report row. Net bill is computed in the browser in `reports.ts` and drives the doctor incentive.
- **Incentives:** finalising a report or updating its payment calls `tryCreateIncentive`, which looks up the patient's `doctorId` and the doctor's `incentiveRate` and upserts a `report_incentives` row. Failures are swallowed with `console.error`.
- **Templates are soft-deleted.** Fields have `isActive`, and `mapTemplate` filters out inactive ones, because `report_values.fieldId` has `on delete restrict` and old reports must stay valid.
- **PDFs** are generated in the browser: `@react-pdf/renderer` (`src/components/shared/LabReportPDF.tsx`) for lab reports, with `html2pdf.js` also installed. Branding, logo, signature and `useSignature` come from the singleton `lab_settings` row.
- **PDF designs:** the lab picks one in Settings, stored in `lab_settings."reportTemplate"` (`modern` | `classic` | `executive` | `minimal`; the DB has a CHECK constraint). `src/lib/reportTemplates.ts` is the catalogue; `LabReportPDF.tsx` builds styles from `baseStyles()` (the modern design) plus the per-design overrides in `themeFor()`, and `ReportDesignPicker` draws the thumbnails. To add a design: add it to the catalogue, `themeFor()`, the picker's `Thumb`, and a migration that extends the CHECK constraint. `getSampleReport()` feeds the Settings "Preview sample report" button.
- **Storage:** a single public bucket `lab-assets` (logo, signature) via `uploadFile` in `src/lib/supabase.ts`.
- **Edge function:** `supabase/functions/invite-user` (Deno) invites users using the service-role key after verifying that the caller is an active admin. It is the only way to create users.

## Database

- Schema is the numbered scripts `supabase/migrations/01.sql`–`12.sql`, run manually, in order, in the Supabase SQL Editor (no Supabase CLI workflow). Add new changes as the next number.
- **Column casing is inconsistent and matters.** Most columns are quoted camelCase (`"patientId"`, `"createdAt"`). But the `doctors` and `report_incentives` tables were created with some unquoted columns, which Postgres lowercases: `isactive`, `billamount`, `incentiveamount`, `ispaid`, `paidat`. `src/lib/services/doctors.ts` uses those exact names (see the comment at the top of that file). Check the real column name before writing a query.
- Several service functions retry without newer columns (`billAmount`, `ageMonths`, `useSignature`) if the insert or update fails because the column is missing, to tolerate a stale PostgREST schema cache. After adding a column, run `NOTIFY pgrst, 'reload schema';`.
- Patient codes and report numbers come from the RPCs `next_patient_code` (prefix `PAT-`) and `next_report_number`.
- Some later migrations (06, 07, 11) add permissive `using (true)` policies that override the admin-only ones in `01.sql`, since RLS policies are OR'd. Read all migrations before reasoning about who can do what.
