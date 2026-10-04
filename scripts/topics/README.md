# Topic tags

The catalogue's CSVs carry a title, a difficulty and a frequency. They do not carry
LeetCode's topic tags, and the application never calls leetcode.com at runtime, so the
tags are fetched once here and published.

```sh
pnpm topics:fetch              # write scripts/topics/leetcode-topics.json only
pnpm topics:fetch -- --refresh # refetch, overwriting the artifact
pnpm topics:fetch -- --publish # also insert; needs IMPORT_DATABASE_URL
```

The default run writes the artifact and stops. Review it, then re-run with
`--publish`. Publishing is one transaction guarded by an advisory lock and is safe to
repeat; existing mappings are left alone.

## What it reads

`questionList` on leetcode.com/graphql, paginated 100 at a time over the whole problem
set, which is roughly forty requests rather than one per question. Three details of
that endpoint are easy to get wrong and are all load-bearing:

- a `Referer` header is mandatory or the request is rejected as cross-site forgery;
- `categorySlug` and `filters` are both required, and `categorySlug` must be an empty
  string because an explicit null is dropped before the resolver runs;
- the paginated payload is `{ totalNum, data }`, not `{ total, questions }`.

The endpoint is undocumented and has already changed shape once. If a run fails with
`LeetCode rejected the query`, introspect the error message rather than guessing: it
names the type and suggests the replacement field.

## What it stores

`public.topics` holds one row per LeetCode topic. `public.question_topics` maps
questions to topics and records `source`, so a platform-side rename can be traced and
withdrawn. Questions are matched on `questions.external_id`, which is the LeetCode
question id the CSVs already use. Nothing is matched on title, so a renamed question
cannot silently pick up another question's tags.

Questions with no tag are expected: a handful of paid or retired problems carry none.
The publish step reports how many listed questions ended up with at least one tag.
