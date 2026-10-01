# Import pipeline boundary

Reserved for Node.js/TypeScript import jobs. No job or schedule is active in this scaffold.

- adapters/: source-specific fetching and parsing
- normalise/: canonical question IDs, company aliases, URLs, and time windows
- validate/: schema checks, duplicates, missing fields, suspicious changes
- publish/: transactional snapshot activation and cache refresh

Use fixture data before enabling remote imports. Re-running the same revision must be idempotent. An empty or malformed source must not delete the published catalogue. Keep source permissions, attribution, dataset dates, commit references, and errors with every import run. Credentials belong in GitHub Actions secrets, never tracked files.
