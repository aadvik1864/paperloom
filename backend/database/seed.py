from extensions import db
from models.user import User
from models.paper import Category
from flask import current_app


def seed_database():
    if Category.query.count() == 0:
        default_categories = [
            ("Computer Science", "computer-science"),
            ("Engineering", "engineering"),
            ("Mathematics", "mathematics"),
            ("Physics", "physics"),
            ("Chemistry", "chemistry"),
            ("Biology", "biology"),
            ("Medicine", "medicine"),
            ("Economics", "economics"),
            ("Business", "business"),
            ("Social Sciences", "social-sciences"),
            ("Arts & Humanities", "arts-humanities"),
            ("Education", "education"),
            ("Environmental Science", "environmental-science"),
            ("Agricultural Science", "agricultural-science"),
            ("Other", "other"),
        ]
        for name, slug in default_categories:
            db.session.add(Category(name=name, slug=slug))
        print("  Categories created.")

    password = current_app.config.get("ADMIN_PASSWORD")
    if password and User.query.filter_by(profile_name=current_app.config.get("ADMIN_PROFILE_NAME", "Administrator")).first() is None and User.query.count() == 0:
        admin = User(
            profile_name=current_app.config.get("ADMIN_PROFILE_NAME", "Administrator"),
            role="admin",
        )
        admin.set_password(password)
        db.session.add(admin)
        current_app.logger.info("Initial administrator created. No credentials are logged.")

    db.session.commit()
