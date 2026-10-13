# Security

Published papers and blog posts are public. R2 objects stay private; the API serves files and checks access to unpublished content.

## Application safeguards

- Browser sessions use one-hour Secure/HttpOnly cookies, same-origin checks and CSRF protection. Tokens are not stored in browser localStorage.
- Shared Redis session records support logout and password/role invalidation. Missing records or Redis outages deny authenticated access.
- Roles restrict publication and administration. PostgreSQL locking protects the last administrator from concurrent demotions.
- Uploads have size limits. PDFs with scripts, encryption or embedded files are rejected; avatars are validated and re-encoded.
- File replacement saves the database reference before deleting the original. Failed saves attempt to clean up new uploads.
- Markdown does not render raw HTML. The site uses a Content Security Policy, self-hosted fonts and uncached authenticated responses.
- Production uses explicit migrations and a non-root container. CI checks dependencies and blocks all high/critical image findings, including unfixed ones.
- Administrative logs exclude passwords, tokens, profile text and storage keys.

## Before deploying

Use [DEPLOYMENT.md](DEPLOYMENT.md) for setup, migrations and verification commands. In the provider consoles, check database/Redis connections, private R2 access, backups and failure notifications. Keep secrets out of source files and `VITE_*` variables.

Provider settings, backups and authenticated production upload flows still require separate verification. Passing CI does not establish those settings or identify the deployed image digest.

## Known limits

- Failed or offline logout clears local state and omits cookies on later application requests, but cannot erase an HttpOnly cookie or confirm server revocation. The app warns that the credential may remain valid until expiry.
- Do not restore stale Redis session records: a pre-logout backup can revive an unexpired session. Follow the authorized restore procedure in `DEPLOYMENT.md`.
- Database and object storage are not one transaction. Crashes or cleanup failures can leave private orphan objects that need reconciliation.
- The default image accepts PDFs only. The optional Office image needs its own sandbox smoke test and security scan before deployment.
- Scheduled health checks can be delayed. Administrative logs are not a tamper-proof audit database, and a clean vulnerability scan is not a guarantee of security.
