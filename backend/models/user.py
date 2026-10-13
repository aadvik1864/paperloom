import bcrypt
from extensions import db
from utils.dates import utc_now

_DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"paperloom-dummy-login-password", bcrypt.gensalt())

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    profile_name = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='visitor', nullable=False)

    bio = db.Column(db.Text, nullable=True)
    institution = db.Column(db.String(255), nullable=True)
    department = db.Column(db.String(255), nullable=True)
    profile_photo_url = db.Column(db.Text, nullable=True)

    website = db.Column(db.String(255), nullable=True)
    google_scholar = db.Column(db.String(255), nullable=True)
    linkedin = db.Column(db.String(255), nullable=True)
    researchgate = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)

    papers = db.relationship('Paper', backref='primary_author', lazy=True, cascade='all, delete-orphan')
    blogs = db.relationship('Blog', backref='author', lazy=True, cascade='all, delete-orphan')
    comments = db.relationship('Comment', backref='user', lazy=True, cascade='all, delete-orphan')
    bookmarks = db.relationship('Bookmark', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        from utils.security import validate_password
        validate_password(password)
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password):
        from utils.security import validate_password
        if not self.password_hash:
            candidate = password.encode("utf-8")[:72] if isinstance(password, str) else b"invalid"
            try:
                bcrypt.checkpw(candidate, _DUMMY_PASSWORD_HASH)
            except ValueError:
                pass
            return False
        try:
            validate_password(password)
            return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
        except (ValueError, TypeError):
            candidate = password.encode("utf-8")[:72] if isinstance(password, str) else b"invalid"
            try:
                bcrypt.checkpw(candidate, _DUMMY_PASSWORD_HASH)
            except ValueError:
                pass
            return False

    def to_dict(self):
        return {
            "id": self.id,
            "profile_name": self.profile_name,
            "role": self.role,
            "bio": self.bio,
            "institution": self.institution,
            "department": self.department,
            "profile_photo_url": f"/api/users/{self.id}/avatar" if self.profile_photo_url and self.profile_photo_url.startswith("avatars/") else None,
            "website": self.website,
            "google_scholar": self.google_scholar,
            "linkedin": self.linkedin,
            "researchgate": self.researchgate,
            "created_at": self.created_at.isoformat()
        }
