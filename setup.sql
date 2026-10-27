-- Supabase SQL Editor에서 직접 한 번 실행하세요. 기존 표는 삭제하지 않습니다.
-- 로그인 없는 교육용 프로토타입: 공개 방문자에게 조회·추가만 허용합니다.
begin;

create table public.wx_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null check (length(btrim(title)) > 0),
  region text not null check (region in ('세종', '대전', '태안', '보령')),
  kind text not null check (kind in ('야외', '고소', '실내')),
  owner text not null check (length(btrim(owner)) > 0)
);

alter table public.wx_tasks enable row level security;

revoke all on public.wx_tasks from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.wx_tasks to anon, authenticated;
grant insert (title, region, kind, owner) on public.wx_tasks to anon, authenticated;

create policy wx_tasks_read on public.wx_tasks
  for select to anon, authenticated using (true);
create policy wx_tasks_add on public.wx_tasks
  for insert to anon, authenticated with check (true);

commit;

-- 초기 데이터는 자동으로 넣지 않습니다. 가상 일정만 화면에서 추가하세요.
-- CHECK 제약은 API를 거치지 않는 SQL INSERT에도 지역·구분 규칙을 적용합니다.
