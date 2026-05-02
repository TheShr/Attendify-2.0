import os
import sys
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379/0')
os.environ.setdefault('SECRET_KEY', 'test')
os.environ.setdefault('JWT_SECRET_KEY', 'test')
os.environ.setdefault('DATABASE_URL', 'sqlite:///test.db')
os.environ.setdefault('FACE_SERVICE_URL', 'http://localhost')
os.environ.setdefault('FLASK_ENV', 'production')

sys.path.insert(0, '.')
from app import app

with app.test_request_context('/api/auth/login', method='OPTIONS', headers={'Origin': 'https://attendify-kyzu8c1db-anujsharma214692-gmailcoms-projects.vercel.app', 'Access-Control-Request-Method': 'POST'}):
    try:
        resp = app.full_dispatch_request()
        print('status', resp.status)
        print('headers', dict(resp.headers))
        print('data', resp.get_data(as_text=True))
    except Exception as exc:
        import traceback
        traceback.print_exc()
