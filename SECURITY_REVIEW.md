# Security review — 12 October 2026

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
- PDF-only default image without unused Office parser packages; conversion remains an explicitly selected, fail-closed optional target.
- Shared Redis active-session allowlist and server-side logout, with fail-closed registry loss/outages and explicit browser warnings if revocation cannot be confirmed. Per-profile session generations prevent a role reversal from reviving older tokens; failed revocation blocks the role save.
- Validated release-revision endpoint, read-only deployment checks, pinned GitHub Actions, scheduled public health checks and credential-free administrative change logs.

## Verification

- 157 backend tests passed, including real disposable PostgreSQL concurrency/migration checks, shared Redis session-revocation checks, role-reversal protection and sanitized Redis-outage handling. The suite still emits SQLAlchemy/Python deprecation warnings.
- Fourteen browser regression tests, including mobile layout/accessibility, captured-token logout and safe local logout when server revocation fails.
- End-to-end browser checks against the real local API for author, reader and admin workflows. Object storage was isolated in memory; no production files were written.
- Frontend build and lint completed without warnings. Python and npm dependency audits reported no known vulnerabilities.
- Redacted Gitleaks scans found no detected secrets in the local Git history, source snapshot or built frontend. Five configured local sensitive values were also checked against the browser bundle without displaying them; none appeared.
- Live public/private-route checks returned no tested sensitive fields, required authentication for private lists/admin routes, and rejected untrusted browser CORS origins. These checks covered the release deployed at review time, before the source changes described here.
- Follow-up live checks passed readiness/liveness, CSP, uncached API responses, hidden-file blocking and private-route authentication. The served JavaScript matched the tested bundle associated with `8a4a22a`. Render reported PDF-only capabilities; exact backend commit/image-digest verification was not available before the new revision endpoint.
- Production-mode local container checks passed with disposable PostgreSQL/Redis, two web workers, synthetic login, copied-token rejection after logout/role reversal, and Redis-outage 503 responses. The default runtime was non-root, its application code was not writable, and no environment files or LibreOffice executable were bundled. No production files were uploaded.

## Open risks and deployment checks

1. **OS packages:** removing unused Office packages reduced the default image from 1 critical/80 high findings across 33 CVEs to **0 critical/44 high findings across 8 CVEs** in the local scan. The critical `libxml2` package is absent, not patched or suppressed. Remaining findings concern Debian base packages (util-linux, ACL, ncurses, systemd libraries and Perl); the scanner reports no vendor fixed versions. The optional Office target retains additional package exposure and is not covered by the default-image count. The image CI gate deliberately remains blocked on high findings. Package findings are not proof of remote exploitability; they must not be hidden or marked fixed. Rescan the actual deployed digest and review vendor updates.
2. **Provider settings:** production database/Redis TLS, R2 public-access settings, backups, restore access and the deployed image digest were not verified through the provider consoles. Local configuration does not explicitly select database TLS or TLS Redis; this does not establish what Render uses or whether its database connection is encrypted.
3. **Conversion:** Render reports secure Office conversion unavailable. The default image now intentionally supports PDF only; the optional Office target still needs a compatible-host sandbox/conversion smoke test before deployment.
4. **File cleanup:** crashes or storage outages can leave private orphan objects because PostgreSQL and R2 do not share a transaction. Reconcile unreferenced objects after recovery; active original files are never deleted before a successful database commit.
5. **Sessions:** bearer tokens remain browser-stored and expire after one hour. Confirmed server logout now revokes copied tokens through shared Redis. Offline/failed revocation is explicitly warned about; already-running requests are not canceled. Redis restore procedures must not reintroduce stale session records. HttpOnly cookies/CSRF remain pending a canonical-origin routing decision. Do not add untrusted scripts or render raw HTML.
6. **Operations:** scheduled health checks and administrative change logs are source-level additions, not proof of configured incident notifications, durable retention, branch protection or monitoring coverage. Verify those provider/GitHub settings separately.

Use `DEPLOYMENT.md` for the reviewed migration and release procedure. Production authenticated uploads and post-deployment smoke tests still require a release and an authorized test profile.

### Remaining default-image CVEs

The local scanner reported no fixed versions for these entries. Multiple binary packages from one Debian source explain the difference between package findings and distinct CVEs.

| CVEs | Debian source / affected package family |
| --- | --- |
| `CVE-2026-76642`, `CVE-2026-78408`, `CVE-2026-78409`, `CVE-2026-78410` | util-linux binaries and libraries |
| `CVE-2026-54369` | ACL (`libacl1`) |
| `CVE-2025-69720` | ncurses and terminfo |
| `CVE-2026-16742` | systemd/udev libraries |
| `CVE-2026-9538` | Perl base runtime |
