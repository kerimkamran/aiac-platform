-- Development plan v2, Phase 2: appearance preferences follow the user.
--
-- The theme (light, dark, system) and background (white, cream, grey) are
-- kept in the browser for an instant first paint and mirrored here, so they
-- follow the person across devices. Only the owner can write their own value,
-- through the function below, so the profile's other columns (role, status)
-- stay protected.

alter table public.profiles
  add column if not exists appearance jsonb not null default '{}'::jsonb;

create or replace function public.set_my_appearance(p_appearance jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme text := p_appearance->>'theme';
  v_canvas text := p_appearance->>'canvas';
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if v_theme is not null and v_theme not in ('light', 'dark', 'system') then
    raise exception 'unknown theme';
  end if;
  if v_canvas is not null and v_canvas not in ('white', 'cream', 'grey') then
    raise exception 'unknown background';
  end if;

  update public.profiles
  set appearance = jsonb_strip_nulls(jsonb_build_object('theme', v_theme, 'canvas', v_canvas))
  where id = auth.uid();
end;
$$;

revoke all on function public.set_my_appearance(jsonb) from public;
grant execute on function public.set_my_appearance(jsonb) to authenticated;
