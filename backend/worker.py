from app import create_app
from job_queue import job_queue
from redis_client import redis_client
from rq import Worker, Connection

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        with Connection(redis_client):
            worker = Worker([job_queue])
            worker.work()
