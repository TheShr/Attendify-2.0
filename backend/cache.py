import functools
import json
import time

from flask import jsonify, make_response, request
from flask_jwt_extended import get_jwt_identity

from redis_client import redis_client

CACHE_PREFIX = "attendify:cache:"


def _get_identity():
    try:
        identity = get_jwt_identity()
        return str(identity) if identity is not None else "anon"
    except Exception:
        return "anon"


def _build_key(func_name: str) -> str:
    identity = _get_identity()
    path = request.path
    query = "&".join(f"{k}={v}" for k, v in sorted(request.args.items()))
    return f"{CACHE_PREFIX}{func_name}:{identity}:{path}?{query}"


def cache_response(ttl: int = 60, lock_timeout: int = 5):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if request.method != "GET":
                return fn(*args, **kwargs)

            key = _build_key(fn.__name__)
            cached = redis_client.get(key)
            if cached:
                entry = json.loads(cached)
                return make_response(jsonify(entry["payload"]), entry.get("status", 200))

            lock_key = f"{key}:lock"
            lock = redis_client.lock(lock_key, timeout=lock_timeout, blocking_timeout=0.5)
            got_lock = lock.acquire(blocking=False)
            if not got_lock:
                waited = 0.0
                while waited < lock_timeout:
                    time.sleep(0.05)
                    cached = redis_client.get(key)
                    if cached:
                        entry = json.loads(cached)
                        return make_response(jsonify(entry["payload"]), entry.get("status", 200))
                    waited += 0.05
                return fn(*args, **kwargs)

            try:
                response = fn(*args, **kwargs)
                if hasattr(response, "status_code"):
                    payload = response.get_json(silent=True)
                    status = response.status_code
                else:
                    payload = response
                    status = 200
                if payload is not None:
                    redis_client.set(key, json.dumps({"payload": payload, "status": status}), ex=ttl)
                return response
            finally:
                try:
                    lock.release()
                except Exception:
                    pass

        return wrapper

    return decorator


def invalidate_cache(pattern: str = "*") -> None:
    match = f"{CACHE_PREFIX}{pattern}"
    for key in redis_client.scan_iter(match):
        redis_client.delete(key)
