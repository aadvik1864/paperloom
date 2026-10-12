# Deployment checks

The Docker service bundles the website and API. Configure secrets only in the hosting environment, never in source files or `VITE_*` variables. The latter are public browser configuration.

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

`GET /api/papers/capabilities` reports whether a namespace-isolated converter is available. When the host does not support that sandbox, the website offers PDF-only uploads. Conversion never falls back to unrestricted LibreOffice or receives application credentials. Do not enable privileged containers or disable isolation to work around host restrictions.

The image updates OS packages and removes setuid/setgid privileges. Rescan the actual deployed image regularly; vendor vulnerabilities without available fixes can remain even when application dependency audits pass. Do not treat a clean dependency audit as proof of complete security.

## Verification

```sh
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

Sessions use short-lived bearer tokens. The browser stores them locally; do not add third-party scripts or render untrusted HTML. Logout clears browser state and prevents stale responses from restoring it; it does not revoke an already copied token. Password or role changes revoke existing sessions. Shared profiles should only be used by people authorized to access their content.
