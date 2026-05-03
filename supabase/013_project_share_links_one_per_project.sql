-- At most one share link per project (keeps earliest if duplicates exist).
-- Run in Supabase SQL Editor after 011_project_share_links.sql.

delete from public.project_share_links p
where p.id not in (
  select distinct on (tracked_project_id) id
  from public.project_share_links
  order by tracked_project_id, created_at asc, id asc
);

create unique index if not exists project_share_links_tracked_project_id_key
  on public.project_share_links (tracked_project_id);

comment on table public.project_share_links is
  'One unlisted client URL per project: /share/{client-slug}/{token} (+ legacy /share/{token} redirects).';
