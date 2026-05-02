from rq import Queue

from redis_client import redis_client

job_queue = Queue("attendify", connection=redis_client, default_timeout=300)
