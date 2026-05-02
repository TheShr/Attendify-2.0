import logging
import redis
from config import Config

redis_client = redis.Redis.from_url(
    Config.REDIS_URL,
    decode_responses=True,
    socket_timeout=5,
    socket_connect_timeout=5,
    retry_on_timeout=True,
)

try:
    redis_client.ping()
except Exception as exc:
    logging.warning("Redis ping failed for %s: %s", Config.REDIS_URL, exc)
