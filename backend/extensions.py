from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_session import Session
from flask_compress import Compress

db = SQLAlchemy()
limiter = Limiter(key_func=get_remote_address)
session_store = Session()
compress = Compress()