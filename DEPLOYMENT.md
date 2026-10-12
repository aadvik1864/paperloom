# Deployment checks

The Docker service bundles the website and API. Configure secrets only in the hosting environment, never in source files or `VITE_*` variables. The latter are public browser configuration.

The canonical website is **https://paperloom.onrender.com**, with the API at `/api` on that same origin. Use `VITE_API_URL=/api`, including local development through Vite's proxy. A separate frontend configured with an absolute cross-origin API URL remains a public preview; its sign-in screen links to the API origin's bundled website instead of requesting cross-site cookies or storing bearer tokens. Deploy the updated frontend to that preview as well; an old build will no longer be able to sign in.

## Database changes

Production startup validates the database schema without creating tables or seeding profiles. Database changes are explicit, reviewed operations. Back up PostgreSQL and verify restore access before changing its schema.

- **New empty database:** run `python -m alembic -c backend/alembic.ini upgrade head` from the repository root. Inside the image, use `alembic -c /app/alembic.ini upgrade head`.
- **Existing database from the previous release:** compare its tables, column types, foreign keys and unique constraints with `backend/migrations/versions/0001_initial_schema.py`. After confirming an exact match and taking a backup, run `alembic -c /app/alembic.ini stamp 0001`. Do not run the initial table-creation migration over populated tables.
- For subsequent releases, review the migration and run `upgrade head` before starting the new application. Do not run migrations automatically in every web worker.
- Run `flask --app app:create_app seed` explicitly to create categories in a new database. Use `bootstrap-admin` for the initial administrator; the command prompts for a password without exposing it in process arguments or shell history.

The baseline downgrade deliberately refuses to drop user data. Restore a verified backup if rollback is required.

## Service and file security

- `/health` is the readiness probe. It returns 503 if PostgreSQL or configured Redis is unavailable, without disclosing connection details. `/live` only checks that the process responds.
- Use TLS for hosted PostgreSQL (`sslmode=require`, or certificate verification where supported) and `rediss://` for hosted Redis. Restrict both services to authorized clients. Do not expose either service directly to the public internet.
- Keep R2 private and disable public bucket access. Browser paper and avatar access is proxied through authorized API routes; bucket keys and storage credentials are not returned to clients.
- Use distinct random `SECRET_KEY` and `JWT_SECRET_KEY` values of at least 32 characters, exact HTTPS CORS origins, and only the number of proxy hops actually supplied by the trusted hosting proxy.
- Configure credential rotation, database backups, monitoring and restore drills in the provider consoles. Source changes cannot prove those settings are enabled.

PDF replacement commits the new reference before deleting the old object. Failed commits roll back and attempt to remove newly uploaded objects. Storage cleanup failures are logged without disclosing keys or credentials; reconcile unreferenced private objects after recovery. Database and object storage do not share a transaction, so a crash or storage outage can leave an orphan object.

## Office conversion

The default Docker image uses Python 3.12 on Alpine 3.24, installs binary Python wheels without compilers, and is PDF-only. It omits LibreOffice and its unused parser dependencies. This matches Render's verified PDF-only capabilities. `GET /api/papers/capabilities` reports the available upload formats.

An optional Debian-based `office` build target retains namespace-isolated conversion for a host that supports it: `docker build --target office -f backend/Dockerfile -t paperloom-office .`. It is independent of the Alpine runtime, has additional package exposure and is not the default Render deployment. Its build was checked locally, but successful sandbox conversion has not been verified on a compatible host. Scan that target separately before considering deployment. Conversion never falls back to unrestricted LibreOffice or receives application credentials. Do not enable privileged containers or disable isolation to work around host restrictions.

The image updates OS packages and removes setuid/setgid privileges. Rescan the actual deployed image regularly; vendor vulnerabilities without available fixes can remain even when application dependency audits pass. Do not treat a clean dependency audit as proof of complete security.

## Verification

```sh
python -m pip install -r backend/requirements-dev.txt
python -m pytest backend/tests -q
python -m pip_audit -r backend/requirements.txt
```

In `frontend/`:

```sh
npm ci
npx playwright install --with-deps chromium
npm test
npm run lint
npm run build
npm audit
```

Browser regression tests use synthetic accounts and intercepted APIs, never production passwords. Traces are disabled to avoid capturing credentials. Also smoke-test the built Docker image and rerun public live-site checks after deploying.

For concurrent administrator and counter checks, set `PAPERLOOM_TEST_POSTGRES_URL` to a disposable PostgreSQL database on localhost named `paperloom_test`, then run `python -m pytest backend/tests/test_postgres.py -q`. These tests delete the test schema; never point them at application data.

For shared-session checks, set `PAPERLOOM_TEST_REDIS_URL` to disposable Redis on localhost, database `/15`, then run `python -m pytest backend/tests/test_sessions.py -q`. The integration test only creates and deletes its own random session/generation keys; it does not flush Redis.

## Sessions and rollout

Browser sessions use one-hour JWTs in host-only HttpOnly cookies backed by an active-session allowlist in shared Redis. Production cookies are always Secure, use `__Host-` names, have path `/`, no domain attribute and `SameSite=Lax`. Browser login explicitly requests cookie mode with a non-simple header; cross-origin login is rejected, even for an otherwise allowed CORS origin. Cookie login never returns the JWT in JSON. Authenticated writes require the JWT's matching double-submit CSRF header, including JSON, multipart uploads and logout. The readable CSRF cookie is not an authentication credential. Same-origin checks also reject cross-site cookie requests. Non-browser API clients may continue using explicit bearer authorization; bearer logout does not clear an unrelated cookie session.

Login only sets credentials after Redis registration succeeds. `POST /api/auth/logout` deletes that token's record and clears its cookies; copied tokens are then rejected on every instance using this release. Password or role changes also revoke existing sessions. Role changes rotate a per-profile session generation before committing, so reversing a role cannot revive old tokens and a Redis outage cannot save an unrevoked role change. A failed database save after rotation can require the target to sign in again. Missing/evicted records deny access, and Redis errors deny authenticated requests with a generic unavailable response. Existing browser users must sign in again: legacy localStorage tokens are discarded, not reused. Previously issued bearer credentials can remain valid until their original one-hour expiry unless separately revoked. No database migration or new production secret is required. Deploy every instance before relying on global logout revocation. Requests already in progress are not canceled.

The browser clears local state immediately, including when the service is offline. If server revocation cannot be confirmed, it displays a warning: the browser cookie and copied tokens can remain valid until their original expiry. JavaScript cannot erase an HttpOnly cookie. A non-secret signed-out marker survives reload, and application API requests then omit cookies; only explicit login/logout requests opt in. A successful new login clears that marker. This is local application-state protection, not server revocation: direct API navigation or another client can still use an unrevoked credential. Same-tab login/logout requests are serialized so a delayed logout cannot clear newer login cookies. CSRF from an older session cannot revoke a newer one, and stale unauthorized responses cannot clear newer browser state. Memory-backed sessions are for local development/testing only; restarting a local server signs those users out. Keep Redis private, use TLS, monitor its capacity, and do not restore stale `paperloom:sessions:*` or `paperloom:session-epochs:*` records from backups: a pre-logout snapshot could restore an unexpired session. Clear those namespaces as part of an authorized Redis restore before reopening the application.

HttpOnly cookies limit token theft through JavaScript, but do not make an active script injection harmless: malicious same-origin scripts can still act as the user. Do not add untrusted scripts or render untrusted HTML. Shared profiles should only be used by people authorized to access their content.

## Release and operational checks

`GET /version` exposes only a validated source commit or `unknown`, never environment details. Render supplies `RENDER_GIT_COMMIT`; other builders should pass `--build-arg APP_REVISION=<full-commit-hash>`. The image also records an OCI revision label. This identifies source, not the provider's deployed image digest.

Run a read-only public check after deploying:

```sh
python scripts/check_deployment.py --expected-revision <full-commit-hash>
```

The script checks readiness, liveness, source revision, bundled website, upload capabilities, security headers, hidden-file blocking and unauthenticated private routes. It never logs in, uploads files or changes production data. HTTPS certificates are verified; redirects are not followed. `--allow-local --origin http://127.0.0.1:5000` is available for local smoke tests.

- `.github/workflows/checks.yml` runs backend/PostgreSQL/Redis tests, dependency audits, frontend lint/build/browser tests, backend regressions on the actual Alpine runtime, bundled-container checks and authenticated local cookie/CSRF/logout smoke checks. The authenticated script refuses nonlocal targets and redirects; it must only be used with its synthetic profile on a disposable local service. The image scan fails on **all** high/critical findings, including vendor-unfixed entries; the complete report is retained for 14 days. The locally tested Alpine image has no reported high/critical findings, but rescan every release. Require the `backend`, `frontend` and `image` checks on `main`, including administrators, with force-pushes and deletion disabled. Branch protection is a GitHub setting, not a property of this file.
- `.github/workflows/health.yml` runs public checks approximately every 30 minutes, or manually. Scheduled jobs can be delayed and are not a continuous uptime monitor. Enable GitHub workflow-failure notifications and configure a provider/external alerting service for timely incident delivery; alert channels were not changed here.
- Committed administrative changes emit structured `administrative_change` logs with action, actor/resource IDs and UTC time. Passwords, tokens, profile text and storage keys are excluded. Bootstrap operations have no web actor. Logs are not a tamper-proof transactional audit database; configure restricted retention/export in the hosting provider before relying on them for compliance.
