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
- Canonical same-origin browser sessions using Secure/HttpOnly `__Host-` cookies, double-submit CSRF protection, cross-origin login rejection and no browser-stored bearer tokens. Signed-out markers survive reload; same-tab auth mutations are serialized and stale responses cannot clear newer state. The separate frontend directs sign-in to the bundled site.
- Alpine 3.24 PDF runtime with binary Python wheels, no build toolchain and independent optional Debian Office target. The unsuppressed image security gate is retained; Trivy was updated to 0.75.0 for current Alpine support.

## Verification

- 184 backend tests passed both on the host and inside the Alpine runtime, including real disposable PostgreSQL concurrency/migration checks, shared Redis session revocation, role-reversal protection, sanitized Redis outages, cookie/CSRF regressions and local-only authenticated smoke-script guards. The suite still emits SQLAlchemy/Python deprecation warnings.
- Eighteen browser regression tests passed, covering mobile layout/accessibility, HttpOnly cookie-mode requests, captured-CSRF logout, failed-logout reload protection and cookie omission on later private-content requests, serialized login/logout, legacy-token removal and stale-response guards.
- End-to-end browser checks against the real local API for author, reader and admin workflows. Object storage was isolated in memory; no production files were written.
- Frontend build and lint completed without warnings. Python and npm dependency audits reported no known vulnerabilities.
- Redacted Gitleaks scans found no detected secrets in the local Git history, source snapshot or built frontend. Five configured local sensitive values were also checked against the browser bundle without displaying them; none appeared.
- Live public/private-route checks returned no tested sensitive fields, required authentication for private lists/admin routes, and rejected untrusted browser CORS origins. These checks covered the release deployed at review time, before the source changes described here.
- Follow-up live checks passed readiness/liveness, CSP, uncached API responses, hidden-file blocking and private-route authentication. The served JavaScript matched the tested bundle associated with `8a4a22a`. Render reported PDF-only capabilities; exact backend commit/image-digest verification was not available before the new revision endpoint.
- Production-mode local container checks passed with disposable PostgreSQL/Redis, two web workers, synthetic login, copied-token rejection after logout/role reversal, and Redis-outage 503 responses. The default runtime was non-root, its application code was not writable, and no environment files or LibreOffice executable were bundled. No production files were uploaded.
- Real Chromium checks against the Alpine container in production mode through a disposable localhost TLS proxy passed Secure/HttpOnly host-cookie login, page reload, JSON/multipart CSRF enforcement, logout cookie clearing and rejection of a copied token. Certificate bypass was limited to the generated localhost test certificate, not application or deployment-check code.
- The full Alpine application image scanned with **0 critical and 0 high findings**, including OS and Python packages, using Trivy 0.75.0 with no vulnerability exclusions or unfixed-finding suppression. This is a time-specific local scan, not verification of the deployed image digest.

## Open risks and deployment checks

1. **Image releases:** switching the default PDF runtime from Debian to tested Alpine removed the previous 44 high package findings from the shipped package set. The current local image has 0 high/critical findings, without exclusions. This does not patch Debian's affected packages or prove there are no other vulnerabilities. The optional Debian Office target retains additional exposure and is not covered by this count. Rescan the actual deployed digest and retain the blocking image gate.
2. **Provider settings:** production database/Redis TLS, R2 public-access settings, backups, restore access and the deployed image digest were not verified through the provider consoles. Local configuration does not explicitly select database TLS or TLS Redis; this does not establish what Render uses or whether its database connection is encrypted.
3. **Conversion:** Render reports secure Office conversion unavailable. The default image now intentionally supports PDF only; the optional Office target still needs a compatible-host sandbox/conversion smoke test before deployment.
4. **File cleanup:** crashes or storage outages can leave private orphan objects because PostgreSQL and R2 do not share a transaction. Reconcile unreferenced objects after recovery; active original files are never deleted before a successful database commit.
5. **Sessions:** browser bearer-token storage has been replaced with HttpOnly cookies and CSRF protection on the canonical bundled site. Existing browsers must sign in again; previously issued bearer credentials are not reused but may remain valid until their original expiry unless revoked. Offline/failed revocation is explicitly warned about, with local signed-out state retained across reload. Already-running requests are not canceled. Redis restores must not reintroduce stale session records. HttpOnly cookies do not prevent malicious same-origin scripts from acting as a user; do not add untrusted scripts or render raw HTML.
6. **Operations:** scheduled health checks and administrative change logs are source-level additions, not proof of configured incident notifications, durable retention, branch protection or monitoring coverage. Verify those provider/GitHub settings separately.

Use `DEPLOYMENT.md` for the reviewed migration and release procedure. Production authenticated uploads and post-deployment smoke tests still require a release and an authorized test profile.

### Previous Debian-runtime findings (historical)

These entries were reported against the previous Debian PDF image, not the current Alpine default. That scan reported no fixed versions. Multiple binary packages from one Debian source explain the difference between package findings and distinct CVEs. Keep this history distinct from scanning the optional Office target.

| CVEs | Debian source / affected package family |
| --- | --- |
| `CVE-2026-76642`, `CVE-2026-78408`, `CVE-2026-78409`, `CVE-2026-78410` | util-linux binaries and libraries |
| `CVE-2026-54369` | ACL (`libacl1`) |
| `CVE-2025-69720` | ncurses and terminfo |
| `CVE-2026-16742` | systemd/udev libraries |
| `CVE-2026-9538` | Perl base runtime |
