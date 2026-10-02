begin;
create table private.password_accounts (
 student_id uuid primary key references private.students(id) on delete cascade,
 email text not null unique check(email=lower(email) and length(email) between 3 and 254),
 password_hash text not null check(password_hash ~ '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$'),
 verified_at timestamptz not null default now(),
 version integer not null default 1 check(version > 0)
);
create table private.email_tokens (
 digest text primary key check(digest ~ '^[0-9a-f]{64}$'),
 purpose text not null check(purpose in ('verify','reset')),
 email text not null check(email=lower(email) and length(email) between 3 and 254),
 name text not null default '' check(length(name)<=200),
 password_hash text check(password_hash ~ '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$'),
 expires_at timestamptz not null,
 unique(email,purpose),
 check((purpose='verify' and password_hash is not null) or (purpose='reset' and password_hash is null))
);
create index email_tokens_expiry on private.email_tokens(expires_at);
create table private.auth_limits (
 key text primary key check(length(key)<=100),
 started_at timestamptz not null,
 attempts integer not null check(attempts>0)
);
alter table private.password_accounts enable row level security;
alter table private.email_tokens enable row level security;
alter table private.auth_limits enable row level security;
revoke all on private.password_accounts,private.email_tokens,private.auth_limits from public,anon,authenticated,prepyard_web;

-- These primitives are callable only by the trusted server login, not PostgREST users.
create function private.auth_attempt(k text, maximum integer, seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if maximum not between 1 and 1000 or seconds not between 1 and 3600 then raise exception 'Invalid limit'; end if;
 delete from private.auth_limits where started_at < now()-interval '2 hours';
 insert into private.auth_limits as a values(k,now(),1)
 on conflict(key) do update set
 attempts=case when a.started_at < now()-make_interval(secs=>seconds) then 1 else a.attempts+1 end,
 started_at=case when a.started_at < now()-make_interval(secs=>seconds) then now() else a.started_at end
 returning attempts into n;
 return n<=maximum;
end $$;
create function private.password_identity(address text) returns table(id uuid,email text,name text,password_hash text,version integer)
language sql security definer set search_path='' as $$
 select s.id,p.email,s.name,p.password_hash,p.version from private.password_accounts p join private.students s on s.id=p.student_id where p.email=address;
$$;
create function private.password_session(student uuid,expected integer) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from private.password_accounts where student_id=student and version=expected);
$$;
create function private.issue_email_token(address text,kind text,hash text,display_name text,secret_digest text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(address,0));
 delete from private.email_tokens where expires_at < now();
 if kind='verify' and exists(select 1 from private.password_accounts where email=address) then return false; end if;
 if kind='reset' and not exists(select 1 from private.password_accounts where email=address) then return false; end if;
 insert into private.email_tokens(digest,purpose,email,name,password_hash,expires_at)
 values(secret_digest,kind,address,display_name,hash,now()+case when kind='verify' then interval '1 hour' else interval '30 minutes' end)
 on conflict(email,purpose) do update set digest=excluded.digest,name=excluded.name,password_hash=excluded.password_hash,expires_at=excluded.expires_at;
 return true;
end $$;
create function private.consume_email_token(secret_digest text,kind text,new_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare t private.email_tokens; student uuid;
begin
 delete from private.email_tokens where digest=secret_digest and purpose=kind and expires_at>now() returning * into t;
 if not found then return false; end if;
 if kind='verify' then
   if exists(select 1 from private.password_accounts where email=t.email) then return false; end if;
   insert into private.students(email,name) values(t.email,t.name) returning id into student;
   insert into private.password_accounts(student_id,email,password_hash) values(student,t.email,t.password_hash);
 elsif kind='reset' then
   if new_hash is null then raise exception 'Password required'; end if;
   update private.password_accounts set password_hash=new_hash,version=version+1 where email=t.email;
   if not found then return false; end if;
 else return false;
 end if;
 return true;
end $$;
revoke all on function private.auth_attempt(text,integer,integer),private.password_identity(text),private.password_session(uuid,integer),private.issue_email_token(text,text,text,text,text),private.consume_email_token(text,text,text) from public,anon,authenticated,service_role;
grant execute on function private.auth_attempt(text,integer,integer),private.password_identity(text),private.password_session(uuid,integer),private.issue_email_token(text,text,text,text,text),private.consume_email_token(text,text,text) to prepyard_web;
commit;
