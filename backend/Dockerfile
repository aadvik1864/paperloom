FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-core libreoffice-writer util-linux bubblewrap && rm -rf /var/lib/apt/lists/*

RUN python -c "from app import create_app; print('Import OK')" \
    && useradd --create-home --uid 10001 paperloom \
    && chown -R paperloom:paperloom /app

USER paperloom

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "60", "--log-level", "info", "app:create_app()"]
