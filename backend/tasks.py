from app import create_app
from extensions import db
from models import Student
from services.face_service_client import enroll_student_multi


def process_face_enrollment(student_id: str, images: list[tuple[bytes, str]]):
    """Background worker: enroll images for a student asynchronously."""
    app = create_app()
    with app.app_context():
        student = Student.query.get(int(student_id))
        if not student:
            return {"error": "student_not_found"}

        result = enroll_student_multi(str(student_id), images)
        enrolled = result.get("enrolled", [])
        if enrolled:
            student.face_enrolled = True
            db.session.commit()
        return result


def enqueue_face_enrollment(student_id: str, images: list[tuple[bytes, str]]):
    from queue import job_queue

    job = job_queue.enqueue(process_face_enrollment, student_id, images)
    return job.id
