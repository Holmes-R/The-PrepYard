import { prepYardCollectionSlugs } from "@/features/patterns/collections.mjs";
import type { PoolClient } from "pg";
export async function dashboardData(client: PoolClient) {
  const stats = (
    await client.query<{
      solved: number;
      attempted: number;
      total: number;
      notes: number;
      due: number;
      easy: number;
      medium: number;
      hard: number;
    }>(`
    select count(*) filter(where u.status='solved')::int solved,
      count(*) filter(where u.status in ('solved','attempted'))::int attempted,
      count(*)::int total,
      count(*) filter(where u.next_revision_at <= now())::int due,
      count(*) filter(where u.status='solved' and q.difficulty='easy')::int easy,
      count(*) filter(where u.status='solved' and q.difficulty='medium')::int medium,
      count(*) filter(where u.status='solved' and q.difficulty='hard')::int hard,
      (select count(*)::int from public.notes where user_id=private.student_id() and length(btrim(content))>0) notes
    from public.questions q left join public.user_question_state u on u.question_id=q.id and u.user_id=private.student_id() where q.is_listed
  `)
  ).rows[0];
  const collections = (
    await client.query<{
      slug: string;
      name: string;
      total: number;
      solved: number;
    }>(
      `
    select c.slug,c.name,count(q.id)::int total,count(q.id) filter(where u.status='solved')::int solved
    from public.pattern_collections c join (select pc.slug,cq.question_id from public.pattern_collection_questions cq join public.pattern_collections pc on pc.id=cq.collection_id union all select 'interview-hotlist',question_id from public.topic_frequency_questions) cq on cq.slug=c.slug
    join public.questions q on q.id=cq.question_id and q.is_listed
    left join public.user_question_state u on u.question_id=q.id and u.user_id=private.student_id()
    where c.slug=any($1::text[])
    group by c.id order by count(q.id) filter(where u.status='solved') desc,c.name limit 5
  `,
      [prepYardCollectionSlugs],
    )
  ).rows;
  const recent = (
    await client.query<{
      id: string;
      title: string;
      difficulty: string | null;
      status: string;
      updated_at: Date;
    }>(`
    select q.id,q.title,q.difficulty,u.status,u.updated_at from public.user_question_state u
    join public.questions q on q.id=u.question_id where u.user_id=private.student_id()
    order by u.updated_at desc,q.id limit 5
  `)
  ).rows;
  const activity = (
    await client.query<{ day: string; count: number }>(`
    select to_char(d.activity_date,'YYYY-MM-DD') as "day",count(e.id)::int count
    from generate_series((now() at time zone 'Asia/Kolkata')::date-6,(now() at time zone 'Asia/Kolkata')::date,interval '1 day') d(activity_date)
    left join public.practice_events e on e.user_id=private.student_id() and e.event_type='reviewed' and (e.occurred_at at time zone 'Asia/Kolkata')::date=d.activity_date::date
    group by d.activity_date order by d.activity_date
  `)
  ).rows;
  return { stats, collections, recent, activity };
}
