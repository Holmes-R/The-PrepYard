begin;
-- Retire copied sheet memberships, preserving canonical questions and all
-- question-keyed student progress, notes, and revision history.
delete from public.pattern_collections where slug in ('striver-sde','striver-a2z','neetcode-150','blind-75','kushal-essential-patterns');
delete from public.question_patterns where mapping_source in ('prepyard-patterns-v1','prepyard-collections-v1');
-- Old or manually supplied sheet links must not expose retired memberships.
alter policy pattern_collections_read on public.pattern_collections using (private.student_id() is not null and slug in ('prepyard-foundations','prepyard-sequence-strategies','prepyard-structure-traversal','prepyard-search-and-dp'));
alter policy collection_questions_read on public.pattern_collection_questions using (private.student_id() is not null and exists(select 1 from public.questions q where q.id=question_id) and exists(select 1 from public.pattern_collections c where c.id=collection_id));
commit;
