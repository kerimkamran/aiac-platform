-- 0003: New roles for the enterprise RBAC model.
-- Kept separate because ALTER TYPE ... ADD VALUE cannot be used in the same
-- transaction that references the new values (0004 seeds the matrix).

alter type public.user_role add value if not exists 'org_admin';
alter type public.user_role add value if not exists 'assessor';
alter type public.user_role add value if not exists 'client_user';
