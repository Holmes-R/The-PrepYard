# Company logos

Company cards use authenticated, locally served image bytes from public.company_logos. Page loads do not request images from third parties. Missing logos retain initials.

## Coverage: 629 of 656

| Assets                    | Companies |
| ------------------------- | --------- |
| Original supplied artwork | 205       |
| Additional reviewed icons | 424       |
| Initials pending review   | 27        |

See coverage.json for the remaining names. Sources and review evidence are operator metadata and are not shown on student pages.

## Publish reviewed icons

Additional assets live in assets/company-logos-verified/, separately from the original assets/company-logos/. Its manifest records each company slug, exact display name, source website, evidence, content type and SHA-256 checksum. Review employer identity before adding a mapping; a matching website title alone is insufficient.

Set IMPORT_DATABASE_URL to the administrator database connection and run:

```sh
pnpm logos:publish-reviewed
```

Publishing validates checksums and company identities before a transaction. It preserves supplied original artwork and makes no changes on an identical repeated run. Updating image bytes changes the existing logo route's ETag. The manifest and assets are checked in so deployment does not depend on external favicon services.

## Original artwork and discovery tools

```sh
pnpm logos:vendor
pnpm logos:fetch
pnpm logos:fetch -- --dry-run --snapshot --favicons --guess
pnpm logos:fetch -- --reject gartner,lowe,aurora
```

Vendor refreshes only the original artwork directory. Discovery guesses are candidates for manual review, not evidence that a domain belongs to the intended employer. Public caches can return obsolete artwork; ambiguous names should retain initials until their identity is confirmed.

## Attribution and serving

These are company brand assets; no blanket public-domain licence is assumed. See each asset directory's ATTRIBUTION.md. Converted JPEG files retain original hashes in the reviewed manifest. PNG, SVG, ICO and WebP are accepted; stored SVG is served with restrictive CSP, sandboxing and nosniff headers by the existing authenticated logo route.
