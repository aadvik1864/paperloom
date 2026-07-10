from extensions import db
from models.user import User
from models.paper import Category


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

    if User.query.count() == 0:
        admin = User(
            profile_name="Administrator",
            role="admin",
        )
        admin.set_password("6205641276")
        db.session.add(admin)
        print(f"  Admin profile created (profile: Administrator, password: 6205641276)")

    db.session.commit()
