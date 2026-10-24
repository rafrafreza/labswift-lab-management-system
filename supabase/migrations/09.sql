ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS "billAmount"     numeric(10,2),
  ADD COLUMN IF NOT EXISTS "discountType"   text check ("discountType" in ('FLAT','PERCENT')) default 'FLAT',
  ADD COLUMN IF NOT EXISTS "discount"       numeric(10,2) not null default 0,
  ADD COLUMN IF NOT EXISTS "amountPaid"     numeric(10,2),
  ADD COLUMN IF NOT EXISTS "paymentStatus"  text check ("paymentStatus" in ('PAID','PARTIAL','UNPAID','FREE')) not null default 'UNPAID';