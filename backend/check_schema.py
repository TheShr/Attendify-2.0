#!/usr/bin/env python
"""
Check database schema for courses table
"""
from sqlalchemy import text
from app import create_app

app = create_app()
with app.app_context():
    from extensions import db

    # Check courses table columns
    result = db.session.execute(text("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'courses'
        ORDER BY ordinal_position
    """))

    print("Current courses table columns:")
    for row in result:
        print(f"  - {row[0]} ({row[1]}) {'NULL' if row[2] == 'YES' else 'NOT NULL'}")

    # Check if section column exists
    result = db.session.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'courses' AND column_name = 'section'
    """))

    if result.fetchone():
        print("\n✓ section column exists")
    else:
        print("\n✗ section column is MISSING")

        # Add the section column
        print("Adding section column...")
        db.session.execute(text("ALTER TABLE courses ADD COLUMN section VARCHAR(50)"))
        db.session.commit()
        print("✓ section column added successfully")

    # Check if schedule_info column exists
    result = db.session.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'courses' AND column_name = 'schedule_info'
    """))

    if result.fetchone():
        print("✓ schedule_info column exists")
    else:
        print("✗ schedule_info column is MISSING")

        # Add the schedule_info column
        print("Adding schedule_info column...")
        db.session.execute(text("ALTER TABLE courses ADD COLUMN schedule_info VARCHAR(255)"))
        db.session.commit()
        print("✓ schedule_info column added successfully")