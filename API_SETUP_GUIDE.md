# Attendify API Setup & Testing Guide

## Quick Start

### Prerequisites
- Python 3.8+ (backend)
- Node.js 16+ & npm (frontend)  
- PostgreSQL 12+ running and accessible

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables  
# .env file is already configured with:
# - DATABASE_URL: PostgreSQL connection string
# - JWT_SECRET_KEY and SECRET_KEY
# - CORS_ORIGINS for frontend localhost ports
# - FaceNet service URL

# Initialize/migrate database (SQLAlchemy auto-creates tables)
python -c "from app import create_app; app = create_app(); app.app_context().push(); from extensions import db; db.create_all()"

# Start backend server
python app.py
# Server will start on http://127.0.0.1:5000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server  
npm run dev
# Frontend will start on http://localhost:3000
```

## Deployment

### Frontend (Vercel)
- Set `NEXT_PUBLIC_API_URL` to the Render backend base URL.
- Example: `https://your-backend.onrender.com`
- Set `NEXTAUTH_SECRET` and `NEXTAUTH_URL` to the Vercel app URL.
- Vercel automatically exposes `NEXT_PUBLIC_*` variables to the browser.

### Backend (Render)
- Use `backend/render.yaml` or Render Dashboard env vars.
- Required values:
  - `SECRET_KEY`
  - `JWT_SECRET_KEY`
  - `DATABASE_URL`
  - `FACE_SERVICE_URL`
  - `CORS_ORIGINS`
- `FLASK_ENV=production` is configured in `backend/render.yaml`.

## Architecture

### Communication Flow
```
Browser (Frontend)
    ↓
Next.js API Routes (/api/*)
    ↓
Flask Backend (http://127.0.0.1:5000/api/*)
    ↓
PostgreSQL Database
```

### Frontend API Routes (Proxies)
All frontend API calls go through Next.js routes that proxy to Flask:
- `/api/auth/*` → `/api/auth/*` on Flask
- `/api/student/*` → `/api/student/*` on Flask
- `/api/teacher/*` → `/api/teacher/*` on Flask
- `/api/admin/*` → `/api/admin/*` on Flask
- `/api/attendance/*` → `/api/attendance/*` on Flask
- `/api/geofences/*` → `/api/geofences/*` on Flask
- `/api/insights/*` → `/api/insights/*` on Flask

## Testing API Connections

### 1. Test Health Check
```bash
curl http://127.0.0.1:5000/api/health
# Expected: {"status": "ok", "service": "attendify-backend"}
```

### 2. Test Student Registration
```bash
curl -X POST http://127.0.0.1:5000/api/auth/register/student \
  -H "Content-Type: application/json" \
  -d '{
    "username": "student1",
    "password": "password123",
    "roll_no": "CS2024001",
    "name": "John Doe",
    "class_code": "CS101"
  }'
```

### 3. Test Teacher Registration
```bash
curl -X POST http://127.0.0.1:5000/api/auth/register/teacher \
  -H "Content-Type: application/json" \
  -d '{
    "username": "teacher1",
    "password": "password123",
    "name": "Prof. Smith",
    "email": "prof@university.edu"
  }'
```

### 4. Test Login
```bash
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "student1",
    "password": "password123",
    "role": "student"
  }'
# Returns: { "access_token": "...", "role": "student", "user_id": 1, ... }
```

### 5. Test Authenticated Request (using token from login)
```bash
TOKEN="<token_from_login_response>"
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:5000/api/student/profile
```

### 6. Test Frontend API Routes
```bash
# From browser, check Network tab when:
# 1. Login - POST /api/auth/login → 200
# 2. View profile - GET /api/student/profile → 200
# 3. View courses - GET /api/student/courses → 200
# 4. Mark attendance - POST /api/attendance/mark → 200+
```

## Key Configuration Files

### Backend
- **backend/.env** - Environment variables (database URL, ports, secrets)
- **backend/config.py** - Flask configuration class
- **backend/app.py** - Main application factory
- **backend/models.py** - SQLAlchemy models
- **backend/*_routes.py** - Route blueprints

### Frontend  
- **frontend/.env.local** - Environment variables (NEXT_PUBLIC_API_URL, etc.)
- **frontend/lib/api.ts** - API client utilities (getApiBase, apiFetch, apiJson)
- **frontend/app/api/** - Next.js API proxy routes
- **frontend/app/page.tsx** - Login page with proper authentication

## Database

### Schema Overview
- **users** - Authentication, roles (student/teacher/admin)
- **students** - Student profiles, enrollment, face recognition flag
- **teachers** - Teacher/staff profiles, courses
- **courses** - Classes/courses taught by teachers
- **student_courses** - Enrollment records
- **sessions** - Attendance sessions with location (lat/lon)
- **attendance** - Attendance records with method (Face/Manual)
- **face_embeddings** - Stored face embeddings for recognition
- **geofence_zones** - Geographic zones for location validation
- **notifications** - System notifications for users
- **logs** - Audit logs for admin tracking

## Common Issues & Solutions

### Issue: CORS Error
**Error**: `No 'Access-Control-Allow-Origin' header`
**Solution**: 
- Check CORS_ORIGINS in backend/.env includes frontend URL
- Verify CORS is enabled in app.py
- Frontend should proxy through Next.js /api routes, not direct calls

### Issue: 401 Unauthorized
**Error**: `{"error": "authorization_required"}`
**Solution**: 
- Token not being sent or expired
- Check Authorization header is being forwarded in Next.js routes
- Verify JWT_SECRET_KEY matches between frontend and backend
- Clear localStorage and re-login

### Issue: Database Connection Failed
**Error**: `could not connect to server`
**Solution**: 
- Verify PostgreSQL is running
- Check DATABASE_URL is correct in .env
- Test connection: `psql -c "SELECT 1"`
- Verify database exists

### Issue: Token Invalid
**Error**: `{"error": "invalid_token"}`
**Solution**: 
- Check JWT_SECRET_KEY in both backend and frontend matches
- Verify token hasn't expired (default 12 hours)
- Clear browser localStorage and re-login

## API Endpoint Reference

### Authentication
- POST /api/auth/register/student
- POST /api/auth/register/teacher
- POST /api/auth/login
- GET /api/auth/me (requires auth)

### Student Routes
- GET /api/student/profile (requires auth)
- GET /api/student/courses (requires auth)

### Teacher Routes  
- GET /api/teacher/profile (requires auth)
- GET /api/teacher/courses (requires auth)
- POST /api/teacher/classes (create course, requires auth)

### Attendance
- POST /api/attendance/mark (face recognition)
- POST /api/attendance/manual (manual marking)
- GET /api/attendance/latest (get latest attendance)
- GET /api/attendance/history (attendance records)

### Admin
- GET /api/admin/stats (system statistics)
- GET /api/admin/profile (admin profile)
- GET /api/admin/students (list students)
- POST /api/admin/register (create admin account)

### Geofencing
- GET /api/geofences (list zones)
- POST /api/geofences (create zone)
- GET /api/geofences/<id> (get zone)
- PATCH /api/geofences/<id> (update zone)
- DELETE /api/geofences/<id> (delete zone)

### Insights
- GET /api/insights/department?range=month
- GET /api/insights/policymaker?range=month
- GET /api/insights/management?range=month

## Debugging

### Enable Verbose Logging
```python
# In backend app.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check Next.js API Route Logs
```bash
# Terminal running "npm run dev" shows proxy logs:
# [Auth Proxy] POST /auth/login -> http://127.0.0.1:5000/api/auth/login
```

### Browser DevTools
1. Open Network tab
2. Make API call from frontend
3. Check:
   - Request headers (Authorization, Content-Type)
   - Response status (200, 401, 500, etc.)
   - Response body (error messages)

## Performance Notes

- Database connection pooling configured for stability
- JWT tokens expire after 12 hours
- Face recognition requires FaceNet microservice running on port 5001
- Geofence radius default is 100 meters

## Security Considerations

- All passwords hashed with werkzeug security
- JWT tokens signed with SECRET_KEY
- Role-based access control on all protected endpoints
- CORS restricted to configured origins
- SQL injection protected via SQLAlchemy ORM

## Next Steps

1. [x] Configure database
2. [x] Fix API proxy routes  
3. [x] Verify authentication flow
4. [ ] Test face recognition integration (requires FaceNet service)
5. [ ] Test geofencing with actual GPS data
6. [ ] Deploy to Render (backend) and Vercel (frontend)
