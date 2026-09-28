create table if not exists mise.pin_login_attempts (
  key_hash text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table mise.pin_login_attempts enable row level security;
revoke all on mise.pin_login_attempts from anon, authenticated;

create or replace function mise.record_pin_login_failure(p_key_hash text)
returns void
language plpgsql
security definer
set search_path = mise, pg_temp
as $$
begin
  insert into mise.pin_login_attempts as attempts (
    key_hash,
    attempts,
    window_started_at,
    blocked_until,
    updated_at
  ) values (
    p_key_hash,
    1,
    now(),
    null,
    now()
  )
  on conflict (key_hash) do update set
    attempts = case
      when attempts.window_started_at <= now() - interval '15 minutes' then 1
      else attempts.attempts + 1
    end,
    window_started_at = case
      when attempts.window_started_at <= now() - interval '15 minutes' then now()
      else attempts.window_started_at
    end,
    blocked_until = case
      when attempts.window_started_at <= now() - interval '15 minutes' then null
      when attempts.attempts + 1 >= 5 then now() + interval '15 minutes'
      else attempts.blocked_until
    end,
    updated_at = now();
end;
$$;

revoke all on function mise.record_pin_login_failure(text) from public, anon, authenticated;
grant execute on function mise.record_pin_login_failure(text) to service_role;

create index if not exists pin_login_attempts_updated_at_idx
  on mise.pin_login_attempts (updated_at);

comment on table mise.pin_login_attempts is
  'Rate limiting persistente do login por PIN. A chave armazena somente SHA-256 de IP e employee_id.';
