# Deployment Guide

## Backend (Render Docker)

Render can deploy the backend from this repository using Docker.

### 1. Create a new Render Web Service
- Service type: `Docker`
- Repository: your Attendify repository
- Dockerfile path: `backend/Dockerfile`
- Build context: `backend`

### 2. Set environment variables
Required values:
- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `FLASK_ENV=production`
- `FACE_SERVICE_URL`
- `CORS_ORIGINS` (e.g. `https://your-app.vercel.app`)
- `GEOFENCE_RADIUS_METERS=100`

### 3. Render service settings
- Port: `5000`
- Health check path: `/api/health`
- Start command: no start command needed because Dockerfile handles it

### 4. Verify deployment
Open the Render service URL and call:
```bash
curl https://<your-render-backend-url>/api/health
```
Expected response:
```json
{"status":"ok","service":"attendify-backend"}
```

## Frontend (Vercel)

### 1. Create a new Vercel project
- Link the same repository to Vercel
- Set root directory to `frontend`

### 2. Add environment variables
- `NEXT_PUBLIC_API_URL` → `https://<your-render-backend-url>`
- Any other frontend-specific values required by the app

### 3. Deploy
- Vercel will automatically build the Next.js app from `frontend`
- After deploy, verify the site loads and connects to the backend

## Notes
- The backend Dockerfile is in `backend/Dockerfile`
- Use `backend/render.yaml` only if you prefer Render's native service definitions instead of Docker
- Keep secrets out of source control by setting them in Render/Vercel rather than `.env` files
