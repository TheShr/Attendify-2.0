# Backend Dockerfile for Attendify
# Build a lightweight Python image and run the Flask/Gunicorn app.
FROM python:3.11-slim

WORKDIR /app/backend

# Install system dependencies required by psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first to take advantage of Docker layer caching
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ .

# Ensure Docker log output is unbuffered
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Expose the backend port to the container runtime
EXPOSE 5000

# Start the backend using Gunicorn
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120"]
