FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-core libreoffice-writer && rm -rf /var/lib/apt/lists/*

RUN python -c "from app import create_app; print('Import OK')" 2>&1

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--log-level", "debug", "app:create_app()"]
