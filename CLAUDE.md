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
- **Invite / password-reset links:** both land on `/login#...type=invite|recovery` and sign the browser in with a one-time session. `supabase.ts` records that in `localStorage` (`src/lib/passwordSetup.ts`) before the hash is stripped; invitees also carry `user_metadata.password_set = false` (set by the invite function). While either marker is present `ProtectedRoute` sends the user back to `/login`, which shows the two-field "Create password" screen. After a successful `updateUser` the app signs the user out and asks them to sign in with the new password. The site's `/login` URL must be in Supabase Authentication > URL Configuration > Redirect URLs.
- **Row mapping:** `src/lib/services/helpers.ts` holds the `mapX` functions that convert raw DB rows into the types in `src/types/index.ts`. New columns must be added to the mapper as well as the query's `select`.
- **Reports** are the core entity. A report links one patient to one template and stores one `report_values` row per template field, with `isAbnormal` computed client-side at save time by `isValueAbnormalGender` in `src/lib/utils.ts` (gender-specific ranges). Billing (`billAmount`, discount, `amountPaid`, `paymentStatus`) lives on the report row. Net bill is computed in the browser in `reports.ts` and drives the doctor incentive.
- **Incentives:** finalising a report or updating its payment calls `tryCreateIncentive`, which looks up the patient's `doctorId` and the doctor's `incentiveRate` and upserts a `report_incentives` row. Failures are swallowed with `console.error`.
- **Templates are soft-deleted.** Fields have `isActive`, and `mapTemplate` filters out inactive ones, because `report_values.fieldId` has `on delete restrict` and old reports must stay valid.
- **PDFs** are generated in the browser: `@react-pdf/renderer` (`src/components/shared/LabReportPDF.tsx`) for lab reports. Branding, logo, signature and `useSignature` come from the singleton `lab_settings` row.
- **PDF designs:** the lab picks one in Settings, stored in `lab_settings."reportTemplate"` (`modern` | `classic` | `executive` | `minimal`; the DB has a CHECK constraint). `src/lib/reportTemplates.ts` is the catalogue; `LabReportPDF.tsx` builds styles from `baseStyles()` (the modern design) plus the per-design overrides in `themeFor()`, and `ReportDesignPicker` draws the thumbnails. To add a design: add it to the catalogue, `themeFor()`, the picker's `Thumb`, and a migration that extends the CHECK constraint. `getSampleReport()` feeds the Settings "Preview sample report" button.
- **QR code on reports (optional):** `lab_settings."showQrCode"` (Settings checkbox, off by default). `LabReportPDF` draws a vector QR (`qrcode` package) next to the signature pointing at `<site>/r/<reports."publicToken">`. `/r/:token` (`PublicReportPage`, outside `ProtectedRoute`) calls the `get_public_report` RPC (`20.sql`, the only thing `anon` may run; returns FINAL/SENT reports only, without billing or patient contact details) and builds the PDF in the browser. The token is a long random per-report value; to revoke a link, regenerate that report's `publicToken`.
- **Uploaded logo/signature** are re-encoded to plain 8-bit PNG/JPG in the browser (`src/lib/image.ts`) because the PDF engine silently drops some PNG/JPEG variants. Uploads only take effect after "Save Settings" (the page shows an unsaved-changes notice).
- **Template form drafts** live in `sessionStorage` (survive a refresh) and are deleted when the form unmounts, so Cancel/back/menu always starts the next form clean.
- **Keyboard entry:** `useFieldNavigation` (called once in `DashboardLayout`) moves focus field to field with Enter / Arrow Down (next) and Shift+Enter / Arrow Up (previous) inside any `<form>` or `data-nav-scope` element (the report pages). `data-nav-ignore` opts a field out (the search boxes). Selects, textareas, date inputs and datalist inputs keep their native arrow behaviour; Enter on the last field still submits.
- **Storage:** a single public bucket `lab-assets` (logo, signature) via `uploadFile` in `src/lib/supabase.ts`.
- **Edge function:** `supabase/functions/invite-user` (Deno) invites users using the service-role key after verifying that the caller is an active admin. It is the only way to create users. When the `APP_URL` secret is set it only accepts browser calls from that origin plus `ALLOWED_ORIGINS` (comma separated, e.g. `http://localhost:5173` for local testing) and links the invite email back to the origin the call came from when that origin is allowed, otherwise to `APP_URL`; when unset it accepts any origin and links back to the caller's site. It validates the input and allows at most 20 invites per hour; redeploy it after changing it (`supabase functions deploy invite-user`).

## Database

- Schema is the numbered scripts `supabase/migrations/01.sql`–`20.sql`, run manually, in order, in the Supabase SQL Editor (no Supabase CLI workflow). Add new changes as the next number.
- **Column casing is inconsistent and matters.** Most columns are quoted camelCase (`"patientId"`, `"createdAt"`). But the `doctors` and `report_incentives` tables were created with some unquoted columns, which Postgres lowercases: `isactive`, `billamount`, `incentiveamount`, `ispaid`, `paidat`. `src/lib/services/doctors.ts` uses those exact names (see the comment at the top of that file). Check the real column name before writing a query.
- Several service functions retry without newer columns (`billAmount`, `ageMonths`, `useSignature`) if the insert or update fails because the column is missing, to tolerate a stale PostgREST schema cache. After adding a column, run `NOTIFY pgrst, 'reload schema';`.
- Patient codes and report numbers come from the RPCs `next_patient_code` (prefix `PAT-`) and `next_report_number`.
- Some later migrations (06, 07, 11) added permissive `using (true)` policies that overrode the admin-only ones in `01.sql`, since RLS policies are OR'd. `18.sql` removes them and is the authority on who can do what: read it (and any later migration) before reasoning about access. Policies are OR'd, so never add an open policy to a table that already has a restrictive one.
- **Security rules enforced in the database (`18.sql`):** only admins can change a profile's `role` / `isActive` / `email` (trigger); new auth users are always `STAFF` and, since `19.sql`, start **inactive** (the invite function activates them and sets `ADMIN` when asked, using the service role); templates and fields, doctors and incentive payment are admin-only (staff may only insert/re-sync *unpaid* incentive rows that match the report's doctor and rate); FINAL/SENT reports and their values are locked for non-admins; `audit_logs` is written only by triggers. Triggers skip checks when `auth.uid()` is null (SQL editor, service role). Saving a report is one transaction: `createReport` / `updateReport` call the `create_report_atomic` / `update_report_atomic` RPCs (`21.sql`, security invoker so RLS and these locks still apply), which write the values *before* the final status so a draft can be completed, and roll back everything (including the report number) on any failure. The old "retry without billing columns" fallback for these two is gone: migrations 09/11/21 must be applied.
- Dashboard setting that code cannot enforce: Authentication > Providers > Email > "Allow new users to sign up" must be OFF (users are created only through the invite function).
