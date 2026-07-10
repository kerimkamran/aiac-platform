-- Secrets finding: generation_engines.api_key stored real AI-provider API
-- keys (Claude/Fugu/Kimi) as plaintext columns, readable by anyone with
-- direct DB/service-role access or a dump/backup, with no encryption at
-- rest. Move the secret values into Supabase Vault (libsodium-encrypted,
-- key managed outside the accessible schema), keep only a reference id on
-- generation_engines, and expose narrow SECURITY DEFINER RPCs for the app
-- to read/write/clear the value -- the raw column is dropped once backfilled.

alter table public.generation_engines
  add column if not exists api_key_secret_id uuid;

-- Backfill: move each existing plaintext key into a vault secret, one per
-- engine, named for easy identification in the vault UI.
do $$
declare
  r record;
  v_id uuid;
begin
  for r in select key, api_key from public.generation_engines where api_key is not null loop
    v_id := vault.create_secret(r.api_key, 'generation_engine_api_key_' || r.key, 'AI generation engine API key for ' || r.key);
    update public.generation_engines set api_key_secret_id = v_id where key = r.key;
  end loop;
end $$;

alter table public.generation_engines drop column api_key;

-- Read the decrypted key for a configured engine. Callers are staff-only
-- server actions (loadEngineKey/loadEngine) that already require an active
-- generation engine to do their job; re-check is_staff() here too so the
-- function fails closed even if called some other way.
create or replace function public.get_engine_api_key(p_engine_key text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_value text;
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;

  select api_key_secret_id into v_secret_id from public.generation_engines where key = p_engine_key;
  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_value from vault.decrypted_secrets where id = v_secret_id;
  return v_value;
end;
$$;

-- Set (create or rotate) an engine's API key. Only hr_admin/system_admin may
-- manage engine settings -- mirrors the existing app-level requireAdmin()
-- check in staff/settings/actions.ts, enforced here too as defense in depth.
create or replace function public.set_engine_api_key(p_engine_key text, p_new_key text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('hr_admin', 'system_admin')) then
    raise exception 'not authorized';
  end if;

  select api_key_secret_id into v_secret_id from public.generation_engines where key = p_engine_key;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_new_key);
  else
    v_secret_id := vault.create_secret(p_new_key, 'generation_engine_api_key_' || p_engine_key, 'AI generation engine API key for ' || p_engine_key);
    update public.generation_engines set api_key_secret_id = v_secret_id where key = p_engine_key;
  end if;
end;
$$;

-- Clear an engine's key (used when disabling/removing an engine).
create or replace function public.clear_engine_api_key(p_engine_key text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('hr_admin', 'system_admin')) then
    raise exception 'not authorized';
  end if;

  select api_key_secret_id into v_secret_id from public.generation_engines where key = p_engine_key;
  update public.generation_engines set api_key_secret_id = null where key = p_engine_key;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;
