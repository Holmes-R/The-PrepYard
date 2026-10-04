# Company logos

Brand marks live in `public.company_logos` as bytes, not as URLs. A card then never
renders a broken image, never calls a third party at page load, and never leaks a
student's visit to somebody else's CDN.

`assets/company-logos/` holds vendored original artwork; everything else is a favicon
fetched from the company's own verified site. Both are stored as bytes with the
provenance recorded alongside them.

```sh
pnpm logos:vendor                        # download Simple Icons, vendor assets/company-logos
pnpm logos:fetch                         # publish vendored artwork only
pnpm logos:fetch -- --favicons --guess   # + fill the gaps from verified favicons
pnpm logos:fetch -- --reject gartner,lowe # refuse marks found to be wrong on review
pnpm logos:fetch -- --dry-run --snapshot --favicons --guess   # audit, no database
```

`logos:vendor` needs network and writes `assets/company-logos/`. `logos:fetch` needs
`IMPORT_DATABASE_URL`, because these are operator-supplied brand assets. Re-running
either is safe; a replaced mark changes its ETag, so clients refetch exactly once.

`--snapshot` reads the company list from the import snapshot instead of the database,
so coverage can be audited with no credentials at all. It refuses to write.

## Coverage: 465 of 656

| Layer                   | Companies | What it is                                             |
| ----------------------- | --------- | ------------------------------------------------------ |
| `assets/company-logos/` | 205       | Original brand artwork from Simple Icons               |
| Verified favicons       | 260       | The site's own favicon, after the site was vouched for |
| Monogram only           | 191       | No public asset found                                  |

## Why there are two layers

Simple Icons has deleted Adobe, Amazon, Alibaba, Microsoft, LinkedIn, Agoda, Affirm,
Oracle, Salesforce, Canva and OpenAI for trademark reasons, so the companies a reader
recognises most are exactly the ones it will not supply. Older releases add only 15
and 6 respectively, because the gaps are companies it never had. Favicons close most
of what is left.

## How a favicon earns its place

A slug is not a domain, and `aurora.com` belongs to Vistance Networks while
`gartner.org` is a hotel in Tirolo. So no domain is trusted on its own. A candidate is
fetched and kept only if all of the following hold:

1. **The site's own title names the company.** Matched with word boundaries, so `Aon`
   matches "Better Decisions | Aon" and `AT&T` matches "AT&T" or "AT and T", while `aon`
   does not match inside another word.
2. **It is not a parked or listed domain.** `ascend.com` answers 200 with a title
   containing "Ascend" and is for sale; `amadeus.co.in` is listed on DaaZ under a title
   that names Amadeus. Both are refused.
3. **The landing domain is still the same brand.** `gartner.org` resolving to
   `hotel-gartner.com`, `lowe.com` to boat engines, `appdynamics.com` to `splunk.com`
   are all refused, while `micro1.io` to `micro1.ai` and `in.ixl.com` are kept.

The evidence travels with the bytes: every stored mark records the domain and the title
that justified it.

## Review is still required

Title matching proves a site belongs to something with the company's name. It does not
prove that thing is the employer in a list of interview hints. `aurora.org` is titled
"Aurora Health Care" and passes every rule above, and it is almost certainly the wrong
Aurora.

So every automatically accepted favicon is written to
`artifacts/logos/favicon-review.json` with its evidence. Read it, then:

```sh
pnpm logos:fetch -- --reject gartner,lowe,aurora
```

Rejected slugs are never fetched again, so the correction survives re-runs. Scanning the
list once is what turns 465 automatic marks into 465 trustworthy ones. The run also
prints why candidates were refused, grouped: `unreachable` dominates, which is the long
tail genuinely not having those domains.

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
