begin;

create function private.valid_note_tags(tags text[]) returns boolean
language plpgsql immutable strict set search_path = pg_catalog as $$
declare
  tag text;
  seen text[] := '{}';
begin
  if cardinality(tags) > 8 then return false; end if;
  if cardinality(tags) = 0 then return true; end if;
  if array_ndims(tags) <> 1 or array_lower(tags, 1) <> 1 then return false; end if;
  foreach tag in array tags loop
    if tag is null or length(tag) not between 1 and 32 or tag <> btrim(tag)
      or tag ~ '[[:cntrl:]]' or lower(tag) = any(seen) then return false; end if;
    seen := array_append(seen, lower(tag));
  end loop;
  return true;
end;
$$;
revoke all on function private.valid_note_tags(text[]) from public, anon;
grant execute on function private.valid_note_tags(text[]) to authenticated, service_role;

alter table public.notes add column tags text[] not null default '{}';
alter table public.notes add constraint notes_tags_valid check (private.valid_note_tags(tags));
comment on column public.notes.tags is 'Optional owner-written labels, up to 8 per note and 32 characters each. Private under the existing note owner policies.';

commit;
