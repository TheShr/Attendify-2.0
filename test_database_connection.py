#!/usr/bin/env python
"""
Diagnostic script to test Attendify backend & database connection
"""
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

print("=" * 60)
print("ATTENDIFY BACKEND DIAGNOSTIC TEST")
print("=" * 60)

# Test 1: Check environment variables
print("\n[1] Checking environment variables...")
try:
    from dotenv import load_dotenv
    env_file = backend_path / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        print(f"✓ Loaded .env from {env_file}")
    else:
        print(f"✗ .env file not found at {env_file}")
except Exception as e:
    print(f"✗ Error loading .env: {e}")

# Test 2: Check configuration
print("\n[2] Checking configuration...")
try:
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        # Mask password
        masked_url = db_url.replace(db_url.split("@")[0].split("://")[1], "***:***")
        print(f"✓ DATABASE_URL: {masked_url}")
    else:
        print("✗ DATABASE_URL not set")
    
    secret_key = os.getenv("SECRET_KEY")
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    print(f"✓ SECRET_KEY: {'set' if secret_key else 'NOT SET'}")
    print(f"✓ JWT_SECRET_KEY: {'set' if jwt_secret else 'NOT SET'}")
    
    cors_origins = os.getenv("CORS_ORIGINS")
    print(f"✓ CORS_ORIGINS: {cors_origins}")
except Exception as e:
    print(f"✗ Configuration error: {e}")

# Test 3: Create Flask app
print("\n[3] Creating Flask app...")
try:
    from app import create_app
    app = create_app()
    print("✓ Flask app created successfully")
    
    # List registered routes
    print("\n  Registered routes:")
    for rule in app.url_map.iter_rules():
        if "static" not in rule.rule:
            methods = ",".join(sorted(rule.methods - {'HEAD', 'OPTIONS'}))
            print(f"    {rule.rule:40} [{methods}]")
except Exception as e:
    print(f"✗ Error creating Flask app: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 4: Test database connection
print("\n[4] Testing database connection...")
try:
    from extensions import db
    
    with app.app_context():
        # Try to connect
        result = db.session.execute("SELECT 1")
        print("✓ Database connection successful!")
        
        # Check tables
        from models import User, Student, Teacher, Course
        user_count = db.session.query(User).count()
        student_count = db.session.query(Student).count()
        teacher_count = db.session.query(Teacher).count()
        course_count = db.session.query(Course).count()
        
        print(f"  Database stats:")
        print(f"    - Users: {user_count}")
        print(f"    - Students: {student_count}")
        print(f"    - Teachers: {teacher_count}")
        print(f"    - Courses: {course_count}")
except Exception as e:
    print(f"✗ Database connection failed: {e}")
    import traceback
    traceback.print_exc()

# Test 5: Test creating a test user
print("\n[5] Testing user creation (INSERT)...")
try:
    from extensions import db
    from models import User
    import random
    
    with app.app_context():
        test_username = f"test_user_{random.randint(1000, 9999)}"
        user = User(username=test_username, role="student")
        user.set_password("testpass123")
        db.session.add(user)
        db.session.commit()
        print(f"✓ Successfully created test user: {test_username} (ID: {user.user_id})")
        
        # Verify we can read it back
        fetched = User.query.filter_by(username=test_username).first()
        if fetched:
            print(f"✓ Successfully queried test user back from database")
            # Clean up
            db.session.delete(fetched)
            db.session.commit()
            print(f"✓ Cleaned up test user")
        else:
            print(f"✗ Could not query test user back from database")
except Exception as e:
    print(f"✗ User creation/query test failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("DIAGNOSTIC TEST COMPLETE")
print("=" * 60)

# Summary
print("\nDiagnosis Summary:")
print("✓ If all tests passed above, database is connected and backend is ready")
print("✓ To start the backend server, run: cd backend && python app.py")
print("✓ Backend will run on: http://127.0.0.1:5000")
print("\nIf tests failed:")
print("✗ Check your DATABASE_URL in backend/.env")
print("✗ Verify PostgreSQL server is running and accessible")
print("✗ Make sure the database credentials are correct")
