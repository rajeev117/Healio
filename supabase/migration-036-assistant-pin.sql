-- Assistant PIN: doctors can set a 4-digit PIN to protect the revenue/earnings
-- section from their assistant. Default is '0000'. Admin panel can query this
-- column from the staff table to see/reference PINs per doctor.
alter table public.staff
  add column if not exists assistant_pin text not null default '0000';
