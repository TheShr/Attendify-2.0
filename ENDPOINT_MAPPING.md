# API Endpoint Mapping - Frontend to Backend

## Overview
Frontend proxies through Next.js `/api/*` routes to Flask backend at `http://127.0.0.1:5000/api/*`

## Endpoint Mappings

### Authentication
| Frontend Path | Backend Path | Method | Auth Required | Purpose |
|---|---|---|---|---|
| `/api/auth/login` | `/api/auth/login` | POST | No | User login |
| `/api/auth/register/student` | `/api/auth/register/student` | POST | No | Register new student |
| `/api/auth/register/teacher` | `/api/auth/register/teacher` | POST | No | Register new teacher |
| `/api/auth/me` | `/api/auth/me` | GET | Yes | Get current user info |

### Student Routes
| Frontend Path | Backend Path | Method | Auth Required | Notes |
|---|---|---|---|---|
| `/api/student/profile` | `/api/student/profile` | GET | Yes | Get student profile |
| `/api/student/courses` | `/api/student/courses` | GET | Yes | Get enrolled courses |
| `/api/student/attendance/summary` | `/api/student/attendance/summary` | GET | Yes | Get attendance stats |

### Teacher Routes  
| Frontend Path | Backend Path | Method | Auth Required | Notes |
|---|---|---|---|---|
| **`/api/classes`** | **`/api/teacher/classes`** | GET | Yes | ⚠️ FIXED: List teacher's classes |
| **`/api/classes`** | **`/api/teacher/classes`** | POST | Yes | ⚠️ FIXED: Create new class |
| `/api/teacher/profile` | `/api/teacher/profile` | GET | Yes | Get teacher profile |
| `/api/teacher/courses` | `/api/teacher/courses` | GET | Yes | List courses taught |
| `/api/teacher/stats` | `/api/teacher/stats` | GET | Yes | Get teacher stats |
| **`/api/teacher/course/[courseId]/attendance/start`** | **`/api/teacher/course/<courseId>/attendance/start`** | POST | Yes | ⚠️ NEW: Start attendance session |
| **`/api/teacher/course/[courseId]/attendance/stop`** | **`/api/teacher/course/<courseId>/attendance/stop`** | POST | Yes | ⚠️ NEW: Stop attendance session |
| **`/api/teacher/student/[studentId]/enroll`** | **`/api/teacher/student/<studentId>/enroll`** | POST | Yes | ⚠️ NEW: Enroll student's face |

### Attendance Routes
| Frontend Path | Backend Path | Method | Auth Required | Notes |
|---|---|---|---|---|
| `/api/attendance/mark` | `/api/attendance/mark` | POST | Yes | Mark attendance (face/manual) |
| **`/api/attendance/mark-face`** | **`/api/attendance/mark/face`** | POST | Yes | ⚠️ NEW: Mark attendance from classroom photo |
| `/api/attendance/mark/manual` | `/api/attendance/mark/manual` | POST | Yes | Mark manually |
| `/api/attendance/history` | `/api/attendance/history` | GET | Yes | Get attendance history |
| `/api/attendance/latest` | `/api/attendance/latest` | GET | Yes | Get latest attendance |
| `/api/attendance/checkin` | `/api/attendance/mark` | POST | Yes | Attendance checkin |

### Admin Routes
| Frontend Path | Backend Path | Method | Auth Required | Notes |
|---|---|---|---|---|
| `/api/admin/register` | `/api/admin/register` | POST | No | Create admin account; supports optional face photo enrollment |
| `/api/admin/profile` | `/api/admin/profile` | GET | Yes | Get admin profile |
| `/api/admin/stats` | `/api/admin/stats` | GET | Yes | Get system stats |
| `/api/admin/students` | `/api/admin/students` | GET | Yes | List all students |
| `/api/admin/teachers` | `/api/admin/teachers` | GET | Yes | List all teachers |

### Geofence Routes
| Frontend Path | Backend Path | Method | Auth Required | Notes |
|---|---|---|---|---|
| `/api/geofences` | `/api/geofences` | GET | Yes | List geofence zones |
| `/api/geofences` | `/api/geofences` | POST | Yes | Create geofence zone |
| `/api/geofences/[id]` | `/api/geofences/<id>` | GET | Yes | Get zone details |
| `/api/geofences/[id]` | `/api/geofences/<id>` | PATCH | Yes | Update zone |
| `/api/geofences/[id]` | `/api/geofences/<id>` | DELETE | Yes | Delete zone |

### Insights Routes
| Frontend Path | Backend Path | Method | Auth Required | Notes |
|---|---|---|---|---|
| `/api/insights/department` | `/api/insights/department?range=month` | GET | Yes | Department analytics |
| `/api/insights/policymaker` | `/api/insights/policymaker?range=month` | GET | Yes | Policy maker analytics |
| `/api/insights/management` | `/api/insights/management?range=month` | GET | Yes | Management analytics |

### Other Routes
| Frontend Path | Backend Path | Method | Auth Required | Notes |
|---|---|---|---|---|
| `/api/health` | `/api/health` | GET | No | Health check |
| `/api/verify` | `/api/attendance/verify` | POST | Yes | Face verification |
| `/api/class-students` | `/api/class-students` | GET | Yes | Get class students |

## Example Request Flow

### Example 1: Teacher Creating a Class

```
1. Frontend (React Component)
   ↓
   POST /api/classes
   {
     "class_name": "Math 101",
     "section": "A",
     "subject": "Algebra",
     "schedule_info": "Mon/Wed/Fri 10:00"
   }

2. Next.js Proxy Router (/frontend/app/api/classes/route.ts)
   ↓
   Maps to: /api/teacher/classes
   Adds: Authorization: Bearer <JWT_TOKEN>
   
3. Flask Backend
   ↓
   POST /api/teacher/classes
   ↓ (with JWT validation)
   
4. Database
   ↓
   INSERT INTO courses (code, name, section, staff_id, ...)
   ↓
   
5. Response
   ✓ 201 Created with course data
```

### Example 2: Student Getting Their Courses

```
1. Frontend
   ↓
   GET /api/student/courses?limit=10
   
2. Next.js Proxy
   ↓
   Maps to: /api/student/courses
   Adds auth headers
   
3. Flask Backend
   ↓
   GET /api/student/courses
   ↓ (validates JWT as student)
   
4. Database
   ↓
   SELECT * FROM courses JOIN student_courses WHERE student_id=...
   ↓
   
5. Response
   ✓ 200 OK with course list
```

## Testing Endpoints

### Test Health Check
```bash
curl http://localhost:5000/api/health
```

### Test Authentication (Backend Direct)
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teacher1","password":"password123","role":"teacher"}'

# Response includes access_token
```

### Test via Frontend Proxy
```bash
# Browser console or Network tab:
fetch('/api/classes', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer <token_from_login>'
  }
}).then(r => r.json()).then(console.log)
```

## Fixed Issues

✓ Frontend `/api/classes` now correctly maps to backend `/api/teacher/classes`
✓ All authorization headers properly forwarded
✓ All endpoints tested and working with PostgreSQL database
✓ Database connection verified successful

## Database Connection Status

```
✓ Database: PostgreSQL (Render)
✓ Host: dpg-d7etk0flk1mc73c1inbg-a.oregon-postgres.render.com
✓ Connection: ACTIVE
✓ Tables: All created successfully
✓ Data: Can read/write successfully
```

## How to Start Backend

```bash
cd backend
python app.py
# Server starts on http://127.0.0.1:5000
```

## How to Test Teacher Class Creation

```bash
1. Start backend: python backend/app.py
2. Start frontend: npm run dev (from frontend/)
3. Login as teacher
4. Navigate to teacher dashboard
5. Click "Add Class" button
6. Submit form
7. Check Network tab - should see 201 response with course data
```
