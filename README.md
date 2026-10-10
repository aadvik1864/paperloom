# Paperloom

Repository: https://github.com/aadvik1864/paperloom

A full-stack academic publication platform for browsing, downloading, and managing research papers and blog posts. Authors can submit papers, and admins can manage content through a dedicated dashboard.

## Features

### Frontend
- **Paper Browsing** -- Search and filter research papers by category, author, and keywords
- **Paper Details** -- View abstracts, metadata, view/download counts, and inline PDF viewer
- **Blog System** -- Read and interact with academic blog posts with comments
- **User Profiles** -- Public author profiles with publication history
- **Author Dashboard** -- Upload papers, manage drafts, view analytics
- **Admin Dashboard** -- Full content management, user oversight, and moderation
- **Dark/Light Theme** -- Toggle-able theme with persistent preference
- **Responsive UI** -- Mobile-first design with TailwindCSS

### Backend
- **JWT Authentication** -- Secure signup/login with role-based access (author, admin)
- **Paper Management** -- CRUD operations for research papers with PDF upload
- **Blog Engine** -- Create, edit, publish, and archive blog posts
- **Cloudflare R2 Storage** -- PDF and image storage via S3-compatible API
- **Interaction Tracking** -- Bookmarks, citations, comments, and view/download counts
- **Auto-seeding** -- Database auto-seeds with admin user and categories on startup

## Architecture

```
React (Vite)  ──▶  Flask API  ──▶  PostgreSQL
   │                  │
   │                  ├──▶  JWT Auth
   │                  ├──▶  Cloudflare R2  (file storage)
   │                  └──▶  SQLAlchemy ORM
   │
   └── TailwindCSS v4
```

## Tech Stack

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Frontend   | React 19, Vite 8, TailwindCSS v4, React Router 7, React Bits, Motion |
| Backend    | Python 3, Flask, SQLAlchemy, Flask-JWT-Extended     |
| Database   | PostgreSQL (dev: SQLite)                            |
| Storage    | Cloudflare R2 (S3-compatible)                       |
| Auth       | JWT (Flask-JWT-Extended), bcrypt                    |
| Deployment | Render (Docker), Vite static build                  |

## Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL (or SQLite for local dev)
- Cloudflare R2 bucket (for file uploads)
- Render account (for deployment)

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/paperloom_db
# For local dev without PostgreSQL, omit DATABASE_URL to use SQLite

SECRET_KEY=<unique random value, at least 32 characters>
JWT_SECRET_KEY=<different unique random value, at least 32 characters>
FLASK_ENV=development
CORS_ORIGINS=http://localhost:5173
ADMIN_PROFILE_NAME=Administrator
# Optional: creates the first administrator only when the database has no users.
# Prefer `flask --app app bootstrap-admin` for an existing database.
ADMIN_PASSWORD=

R2_BUCKET_NAME=your-r2-bucket
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
```

Run the backend:

```bash
flask --app app run --debug
```

For an existing database, securely create/reset the administrator without
putting a password in shell history:

```bash
flask --app app bootstrap-admin --profile Administrator
```

Passwords must be at least 12 characters and at most 72 UTF-8 bytes. Changing a
password or role revokes existing sessions; access tokens expire after one hour.
Office documents are converted only when LibreOffice, `prlimit`, and `bwrap`
(Bubblewrap) are available; otherwise upload a validated PDF.

Run the security regression suite and dependency audit with:

```bash
pip install -r requirements-dev.txt
pytest -q
pip-audit -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Run the dev server:

```bash
npm run dev
```

### Production Build

```bash
cd frontend
npm run build    # outputs to frontend/dist/
```

### Docker

```bash
cd backend
docker build -t paperloom-backend .
docker run -p 5000:5000 --env-file .env paperloom-backend
```

## API Routes

| Prefix          | Description                          |
|-----------------|--------------------------------------|
| `/api/auth`     | Login, signup, token refresh         |
| `/api/papers`   | Browse, search, upload papers        |
| `/api/blogs`    | CRUD for blog posts                  |
| `/api/users`    | User profiles and public info        |
| `/api/admin`    | Admin-only management endpoints      |
| `/health`       | Health check                         |

## Deployment

The project includes a `render.yaml` blueprint for one-click Render deployment:

- **Backend**: Docker-based web service with PostgreSQL
- **Frontend**: Static site built from Vite output

Before the production backend can start, configure `RATELIMIT_STORAGE_URI` to a
shared Redis/Key Value `redis://` or `rediss://` URL and `CORS_ORIGINS` to the
exact deployed frontend origin(s), e.g. `https://paperloom.example`. The
Render blueprint intentionally prompts for these values; it does not silently
enable wildcard CORS or single-process rate limits. Also set the frontend's
`VITE_API_URL` to the deployed backend URL including `/api`.

Set the frontend's `VITE_API_URL` to the actual deployed backend URL, including
`/api`. Renaming the GitHub repository does not automatically rename deployed
services, PostgreSQL databases, or R2 buckets. Keep existing infrastructure
identifiers in private environment files until those resources are migrated.

## License

MIT
