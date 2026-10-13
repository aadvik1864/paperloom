from extensions import db
from utils.dates import utc_now

class Blog(db.Model):
    __tablename__ = 'blogs'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), unique=True, nullable=False)
    content = db.Column(db.Text, nullable=False)  # Markdown; raw HTML is not rendered.
    cover_image_url = db.Column(db.Text, nullable=True)
    
    author_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    category = db.Column(db.String(100), nullable=True)
    tags = db.Column(db.String(255), nullable=True) # Comma-separated tags
    
    status = db.Column(db.String(20), default='draft', nullable=False) # 'draft', 'published', 'removed'
    view_count = db.Column(db.Integer, default=0, nullable=False)
    
    published_at = db.Column(db.DateTime, default=utc_now, nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now, nullable=False)
    
    comments = db.relationship('Comment', backref='blog', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, include_comments=False):
        data = {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "content": self.content,
            "cover_image_url": self.cover_image_url,
            "author_id": self.author_id,
            "author_name": self.author.profile_name if self.author else "Unknown",
            "category": self.category,
            "tags": self.tags,
            "status": self.status,
            "view_count": self.view_count,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "created_at": self.created_at.isoformat()
        }
        if include_comments:
            data["comments"] = [comment.to_dict() for comment in sorted(self.comments, key=lambda c: c.created_at)]
        return data
