import { readFile, writeFile } from "node:fs/promises";
import { validateCollections } from "./collections.mjs";
import { topics, topicFor, generalPatterns, patternSlug } from "./taxonomy.mjs";
const manifest = JSON.parse(
  await readFile(new URL("./collections.json", import.meta.url), "utf8"),
);
validateCollections(manifest);
const metadata = JSON.parse(
  await readFile(
    new URL("../topics/leetcode-topics.json", import.meta.url),
    "utf8",
  ),
).questions;
const mappings = Object.entries(metadata).map(([externalId, q]) => ({
  externalId,
  url: "https://leetcode.com/problems/" + q.titleSlug + "/",
  topic: topicFor((q.topics ?? []).map((t) => t.slug)),
  patterns: generalPatterns
    .filter(([tag]) => (q.topics ?? []).some((t) => t.slug === tag))
    .map(([, name]) => name),
}));
const names = [
  ...new Set([
    ...generalPatterns.map(([, name]) => name),
    ...manifest.collections.flatMap((s) =>
      s.questions.flatMap((q) => q.patterns ?? []),
    ),
  ]),
];
const literal = (value) =>
  "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const retirement = (
  await readFile(
    new URL(
      "../../supabase/migrations/20261007001300_practice_library.sql",
      import.meta.url,
    ),
    "utf8",
  )
).replace(/commit;\s*$/i, "");
const sql =
  retirement +
  `
-- Generated from the attributed practice manifest. Run as administrator in SQL
-- Editor after existing migrations. All changes roll back on any error.
select pg_advisory_xact_lock(hashtext('prepyard-patterns-v1'));
do $prepyard$
declare
 sheet jsonb; item jsonb; entry jsonb; pair jsonb; pattern_name text; tag jsonb;
 v_platform_id uuid; v_leetcode_id uuid; v_tag_id uuid; v_topic_id uuid; v_pattern_id uuid; v_question_id uuid; v_collection_id uuid;
 existing record; v_position integer; student_counts bigint[];
begin
 select array[(select count(*) from public.user_question_state),(select count(*) from public.notes),(select count(*) from public.practice_events)] into student_counts;
 insert into public.platforms(slug,name,base_url) values('leetcode','LeetCode','https://leetcode.com'),('geeksforgeeks','GeeksforGeeks','https://www.geeksforgeeks.org'),('spoj','SPOJ','https://www.spoj.com') on conflict(slug) do update set name=excluded.name;
 select id into v_leetcode_id from public.platforms where slug='leetcode';
 v_position:=0;
 for pair in select value from jsonb_array_elements(${literal(topics)}) loop
   insert into public.dsa_topics(slug,name,position) values(pair->>0,pair->>1,v_position) on conflict(slug) do update set name=excluded.name,position=excluded.position;
   v_position:=v_position+1;
 end loop;
 for pair in select value from jsonb_array_elements(${literal(names.map((name) => [patternSlug(name), name]))}) loop
   insert into public.patterns(slug,name) values(pair->>0,pair->>1) on conflict(slug) do update set name=excluded.name;
 end loop;
 delete from public.question_patterns where mapping_source in ('prepyard-editorial-v1','prepyard-topic-tags-v2');
 for sheet in select value from jsonb_array_elements(${literal(manifest.collections)}) loop
   insert into public.pattern_collections(slug,name) values(sheet->>'slug',sheet->>'name') on conflict(slug) do update set name=excluded.name returning id into v_collection_id;
   delete from public.pattern_collection_questions cq where cq.collection_id=v_collection_id;
   v_position:=0;
   for item in select value from jsonb_array_elements(sheet->'questions') loop
     select id into v_platform_id from public.platforms where slug=item->>'platform';
     if (select count(*) from public.questions q where q.platform_id=v_platform_id and (q.external_id=item->>'externalId' or rtrim(q.canonical_url,'/')=rtrim(item->>'url','/'))) > 1 then raise exception 'Conflicting canonical identities'; end if;
     select q.* into existing from public.questions q where q.platform_id=v_platform_id and (q.external_id=item->>'externalId' or rtrim(q.canonical_url,'/')=rtrim(item->>'url','/')) limit 1;
     if found then
       if existing.external_id is not null and existing.external_id<>item->>'externalId' then raise exception 'Conflicting question identity'; end if;
       v_question_id:=existing.id;
       update public.questions set is_listed=true,difficulty=coalesce(difficulty,item->>'difficulty') where id=v_question_id;
     else
       insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values(v_platform_id,item->>'externalId',item->>'url',item->>'title',item->>'difficulty',true) returning id into v_question_id;
     end if;
     select id into v_topic_id from public.dsa_topics where slug=item->>'topic';
     insert into public.question_dsa_topics values(v_question_id,v_topic_id) on conflict(question_id) do nothing;
     for pattern_name in select jsonb_array_elements_text(item->'patterns') loop
       select id into v_pattern_id from public.patterns where name=pattern_name;
       insert into public.question_patterns(question_id,pattern_id,mapping_source,reviewed) values(v_question_id,v_pattern_id,'prepyard-editorial-v1',true) on conflict(question_id,pattern_id) do nothing;
     end loop;
     for tag in select value from jsonb_array_elements(item->'topics') loop
       insert into public.topics(slug,name) values(tag->>'slug',tag->>'name') on conflict(slug) do update set name=excluded.name returning id into v_tag_id;
       insert into public.question_topics(question_id,topic_id,source) values(v_question_id,v_tag_id,'practice-reference-v1') on conflict do nothing;
     end loop;
     insert into public.pattern_collection_questions values(v_collection_id,v_question_id,v_position);
     v_position:=v_position+1;
   end loop;
   if v_position<>(sheet->>'expectedCount')::integer then raise exception 'Collection count mismatch'; end if;
 end loop;
 v_platform_id := v_leetcode_id;
 for entry in select value from jsonb_array_elements(${literal(mappings)}) loop
   select q.id into v_question_id from public.questions q where q.platform_id=v_platform_id and q.is_listed and (q.external_id=entry->>'externalId' or (q.external_id is null and rtrim(q.canonical_url,'/')=rtrim(entry->>'url','/'))) limit 1;
   if not found then continue; end if;
   select id into v_topic_id from public.dsa_topics where slug=entry->>'topic';
   insert into public.question_dsa_topics values(v_question_id,v_topic_id) on conflict(question_id) do update set topic_id=excluded.topic_id;
   for pattern_name in select jsonb_array_elements_text(entry->'patterns') loop
     select id into v_pattern_id from public.patterns where name=pattern_name;
     insert into public.question_patterns(question_id,pattern_id,mapping_source,reviewed) values(v_question_id,v_pattern_id,'prepyard-topic-tags-v2',true) on conflict(question_id,pattern_id) do nothing;
   end loop;
 end loop;
 if student_counts<>array[(select count(*) from public.user_question_state),(select count(*) from public.notes),(select count(*) from public.practice_events)] then raise exception 'Student record counts changed'; end if;
end
$prepyard$;
commit;
select c.slug,c.name,count(cq.question_id) as questions from public.pattern_collections c join public.pattern_collection_questions cq on cq.collection_id=c.id where c.slug in ('interview-launchpad','dsa-deep-dive') group by c.id order by c.name;
`;
await writeFile(new URL("./publish-prepyard.sql", import.meta.url), sql);
console.log("Generated scripts/patterns/publish-prepyard.sql for SQL Editor.");
