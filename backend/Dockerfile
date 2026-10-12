FROM node:22-alpine AS frontend

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build

FROM python:3.12-slim-trixie

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends libreoffice-core libreoffice-writer util-linux bubblewrap \
    && rm -rf /var/lib/apt/lists/* \
    && find /usr -xdev -type f -perm /6000 -exec chmod a-s {} + \
    && getcap -r /usr | cut -d ' ' -f 1 | xargs -r -n 1 setcap -r

COPY backend/ .
COPY --from=frontend /frontend/dist ./frontend_dist

RUN python -c "import app; print('Import OK')" \
    && useradd --create-home --uid 10001 paperloom \
    && mkdir -p /app/instance \
    && chown paperloom:paperloom /app/instance

USER paperloom

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "60", "--log-level", "info", "app:create_app()"]
