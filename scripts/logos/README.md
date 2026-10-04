# Company logos

Brand marks live in `public.company_logos` as bytes, not as URLs. A card then never
renders a broken image, never calls a third party at page load, and never leaks a
student's visit to somebody else's CDN.

```sh
pnpm logos:vendor                        # download Simple Icons, vendor assets/company-logos
pnpm logos:fetch                         # publish those marks to the database
pnpm logos:fetch -- --slug adobe         # one company
pnpm logos:fetch -- --favicons           # fill the gaps from favicons
pnpm logos:fetch -- --dry-run            # report, write nothing
```

`logos:vendor` needs network and writes `assets/company-logos/`. `logos:fetch` needs
`IMPORT_DATABASE_URL`, because these are operator-supplied brand assets. Re-running
either is safe; a replaced mark changes its ETag, so clients refetch exactly once.

## Coverage is 31%, and that is the ceiling for free sources

205 of the 656 companies have real artwork. The other 451 keep a generated monogram.

That is not a shortcoming of the matching. It is what the sources actually contain:

- **Simple Icons 16.33 is the source**, chosen because the marks are real brand
  artwork, the set is CC0-1.0 so there is nothing to track, and every entry carries a
  brand hex. It has 3463 brands, but only 205 of them are companies from this list.
- **Simple Icons has deleted Adobe, Amazon, Alibaba, Microsoft, LinkedIn, Agoda,
  Affirm, Oracle, Salesforce, Canva and OpenAI** for trademark reasons. They are not
  available from the current release at all.
- **Older releases do not rescue this.** v13.21.0 adds exactly 15 companies and
  v11.15.0 adds 6, because the gaps are companies the project never had, not
  companies it dropped. Resurrection is possible but worth 2 points, and it would use
  artwork the maintainers removed on purpose.
- **Wikidata was evaluated and rejected.** Name lookup mis-resolves constantly:
  `Adobe` returns the building-material company, `Amazon` the rainforest, `Ascend`
  and `Aurora` unrelated entities, `Acko` a place in Israel, `Alibaba` a
  disambiguation page. A guarded probe over 40 names yielded 4 usable logos. Shipping
  Amazon's rainforest as Amazon's logo is worse than shipping a monogram.
- **Favicon services are not artwork.** `--favicons` exists to fill gaps for the
  recognisable names only, and is off by default.

The long tail here is Indian IT services, Chinese firms and small startups. No free
bulk source carries original artwork for them. Closing the remaining gap means
supplying files: drop `<slug>.svg` into `assets/company-logos/` and re-run
`logos:fetch`. That path needs no code.

## Matching is deliberately conservative

A company is matched only when a normalised slug, name, alias, or corporate-suffix-
stripped stem lands exactly on one brand. Two brands answering to one name is treated
as ambiguous and skipped rather than guessed: `hive` is left unmatched because it could
be Apache Hive or Hive the bank. Wrong attribution is the failure mode that matters,
so it is not traded for coverage.

## Favicon guessing is off by default

A slug is not a domain. `--favicons --guess` tries `<slug>.com`, `.io`, `.co.in` and
`.ai`, and `goldman` resolves to `goldman.io`, a different business. A wrong logo is
worse than a monogram, so guessing has to be asked for explicitly. Every stored mark
records the domain or file it came from, so a bad attribution is visible and
correctable.

## Handling and security

Only `image/svg+xml`, `image/png`, `image/webp` and `image/x-icon` are accepted,
matching the table's check constraint. The favicon service does return `image/jpeg`
for some domains and those are skipped rather than failing the run.

Stored SVG is third-party artwork that can script. It is served sandboxed, with a
restrictive `Content-Security-Policy` and `X-Content-Type-Options: nosniff`. The
vendored marks are single-path files with no script, and `vendor.mjs` refuses any SVG
that is not a plain `<svg>...</svg>` or that contains `<script>` or `<foreignObject>`.

Two vendored marks are not CC0 and are listed in `assets/company-logos/ATTRIBUTION.md`:
Broadcom (custom) and Canonical (CC-BY-SA-3.0).
