# Paperloom

Academic publishing platform for research papers and blog posts.

Repository: https://github.com/aadvik1864/paperloom

## Requirements

- Node.js 20.19+ or 22.12+
- Python 3.11+
- SQLite for local development, or PostgreSQL for deployment

## Local setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` with separate random secrets (32+ characters each):

```env
SECRET_KEY=<random-secret>
JWT_SECRET_KEY=<different-random-secret>
FLASK_ENV=development
CORS_ORIGINS=http://localhost:5173
# Optional; needed for file uploads:
R2_BUCKET_NAME=<bucket>
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
```

Run with `flask --app app run --debug`. Create or reset an administrator with
`flask --app app bootstrap-admin --profile Administrator`; enter the password
at the hidden prompt. Passwords must be 12+ characters and at most 72 UTF-8
bytes.

### Frontend

```bash
cd frontend
npm ci
```

Create `frontend/.env` with `VITE_API_URL=http://localhost:5000/api`. Run
`npm run dev`; build with `npm run build`.

## Render deployment

Create PostgreSQL and a **Key Value** service. Then create one Docker web service
from this repository with Dockerfile path `./backend/Dockerfile`, Docker context
`.`, and no root directory. This builds and serves the frontend and API from the
same service and URL.

Set these backend environment variables before deploying:

- `DATABASE_URL`: PostgreSQL internal URL
- `SECRET_KEY` and `JWT_SECRET_KEY`: different random secrets, 32+ characters
- `FLASK_ENV=production`
- `RATELIMIT_STORAGE_URI`: Redis internal URL (`redis://` or `rediss://`)
- `CORS_ORIGINS`: exact HTTPS origin of the web service, no path or trailing slash
- `PROXY_HOPS=1`

After deployment, create the administrator in the Render Shell:

```bash
flask --app app bootstrap-admin --profile Administrator
```

## Cloudflare R2 (optional)

Create a private bucket and an **Object Read & Write** API token scoped to it.
Set `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and
`R2_SECRET_ACCESS_KEY` on the backend. Public bucket access and browser CORS are
not required. Keep credentials private and preserve any bucket referenced by
existing database records.

## Tests

From `backend/`, install `requirements-dev.txt`, then run `pytest -q` and
`pip-audit -r requirements.txt`.
