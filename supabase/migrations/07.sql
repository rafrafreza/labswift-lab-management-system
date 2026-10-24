-- Run this in Supabase SQL Editor
-- The current policy only lets ADMINs insert into report_incentives.
-- Staff users create reports and need to insert incentive rows too.
-- We split the policy: READ stays admin-only, WRITE (insert/update) is open to all authenticated.

-- 1. Drop the old blanket admin policy
DROP POLICY IF EXISTS "Admins can manage incentives" ON report_incentives;

-- 2. Admins can do everything
CREATE POLICY "Admins full access to incentives"
  ON report_incentives FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- 3. Staff can INSERT incentive rows (needed when they create/finalise reports)
CREATE POLICY "Staff can insert incentives"
  ON report_incentives FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. Staff can UPDATE incentive rows they are involved with
--    (needed when updating a report that already has an incentive)
CREATE POLICY "Staff can update incentives"
  ON report_incentives FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. All authenticated users can SELECT incentives
--    (already covered by the existing read policy — keep if it exists, else add:)
DROP POLICY IF EXISTS "Authenticated can read incentives" ON report_incentives;
CREATE POLICY "Authenticated can read incentives"
  ON report_incentives FOR SELECT TO authenticated
  USING (true);