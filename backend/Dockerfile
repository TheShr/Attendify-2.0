FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Unbuffered logs
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Render provides PORT dynamically
CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
