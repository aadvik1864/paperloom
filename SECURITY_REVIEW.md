# Security review — 11 October 2026

The confirmed application findings have been addressed in source. This review records local verification; publishing the source does not verify the deployed release. Production credentials and infrastructure were not changed during the review.

## Application changes

- Transaction-safe PDF/avatar replacement and deletion, rollback cleanup, and safe SDK error handling.
- Last-administrator protection serialized across PostgreSQL transactions; concurrent demotions cannot leave zero admins.
- Consistent account-name throttling, rejection of example secrets and oversized identifiers, atomic counters, and required metadata validation.
- Database/Redis readiness checks, explicit database migrations, generic error responses and logs without connection strings or SDK details.
- Content Security Policy, blocked hidden-file paths, uncached authenticated responses, and self-hosted fonts.
- Masked password-reset forms; no browser logging of request objects; stale-response and logout guards.
- Draft editing/publication, reader bookmarks, avatar proxy/display, safe Markdown, not-found screens, mobile layouts and accessible forms.
- Non-root Docker runtime, root-owned application files, no bundled environment files, and removed setuid/setgid/file capabilities.

## Verification

- 126 backend security/regression tests passed, including real local PostgreSQL concurrency and migration checks. The suite still emits SQLAlchemy/Python deprecation warnings; no test failures remain.
- Twelve browser regression tests, including mobile layout and accessibility in light and dark modes.
- End-to-end browser checks against the real local API for author, reader and admin workflows. Object storage was isolated in memory; no production files were written.
- Frontend build and lint completed without warnings. Python and npm dependency audits reported no known vulnerabilities.
- Redacted Gitleaks scans found no detected secrets in the local Git history, source snapshot or built frontend. Five configured local sensitive values were also checked against the browser bundle without displaying them; none appeared.
- Live public/private-route checks returned no tested sensitive fields, required authentication for private lists/admin routes, and rejected untrusted browser CORS origins. These checks covered the release deployed at review time, before the source changes described here.

## Open risks and deployment checks

1. **OS packages:** the final local image still has 1 critical and 80 high package findings, spanning 33 distinct CVEs. The critical finding is `CVE-2026-6653` in `libxml2`. The scanner reports no vendor fixed versions for these entries. Package findings are not proof of remote exploitability; they must not be hidden or marked fixed. Rescan the deployed digest and review vendor updates or an isolated converter deployment.
2. **Provider settings:** production database/Redis TLS, R2 public-access settings, backups, restore access and the deployed image digest were not verified through the provider consoles. Local configuration does not explicitly select database TLS or TLS Redis; this does not establish what Render uses or whether its database connection is encrypted.
3. **Conversion:** namespace isolation is unavailable in the default local Docker environment. The application fails closed and offers PDF uploads instead. Render sandbox support is still unverified.
4. **File cleanup:** crashes or storage outages can leave private orphan objects because PostgreSQL and R2 do not share a transaction. Reconcile unreferenced objects after recovery; active original files are never deleted before a successful database commit.
5. **Sessions:** bearer tokens remain browser-stored and expire after one hour. Logout clears the browser session, but an already copied token remains valid until expiry or a password/role change. Do not add untrusted scripts or render raw HTML.

Use `DEPLOYMENT.md` for the reviewed migration and release procedure. Production authenticated uploads and post-deployment smoke tests still require a release and an authorized test profile.
