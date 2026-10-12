import { practiceQuestionsSql } from "../questions/practice.mjs";

// Recent practice and due revisions share a read and a database snapshot. Only
// the current student's state is selected; no dashboard response is shared.
export async function dashboardPractice(client) {
  const { rows } = await client.query(`with own as materialized (
    select q.id,q.title,q.canonical_url,q.difficulty,u.status,u.updated_at,
      u.next_revision_at,u.confidence as revision_confidence
    from public.user_question_state u join ${practiceQuestionsSql} q on q.id=u.question_id
    where u.user_id=private.student_id() and q.is_listed
  ), recent as (select * from own order by updated_at desc,id limit 5),
  revisions as (select * from own where next_revision_at<=now()
    order by next_revision_at,revision_confidence asc nulls last,id limit 3),
  visible as (select id from recent union select id from revisions),
  destinations as (
    select v.id,case when exists(select 1 from public.question_dsa_topics t where t.question_id=v.id)
      then '/patterns' else (select '/companies/'||c.slug||'?window='||o.time_window from public.company_question_observations o
        join public.companies c on c.id=o.company_id where o.question_id=v.id and o.frequency_kind in ('percent','unknown')
        order by case when o.time_window='all' then 0 else 1 end,c.name,c.slug,o.time_window limit 1)
      end as practice_path from visible v
  )
  select coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('practice_path',d.practice_path) order by r.updated_at desc,r.id)
    from recent r join destinations d on d.id=r.id),'[]'::jsonb) recent,
    coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('practice_path',d.practice_path) order by r.next_revision_at,r.revision_confidence asc nulls last,r.id)
    from revisions r join destinations d on d.id=r.id),'[]'::jsonb) revisions`);
  return rows[0];
}
