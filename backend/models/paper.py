from datetime import datetime
from extensions import db

class Category(db.Model):
    __tablename__ = 'categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)
    
    papers = db.relationship('Paper', backref='category', lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug
        }

class Paper(db.Model):
    __tablename__ = 'papers'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    abstract = db.Column(db.Text, nullable=False)
    keywords = db.Column(db.String(255), nullable=True) # Comma-separated list
    authors = db.Column(db.Text, nullable=False)  # Co-authors plain text representation
    
    primary_author_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    institution = db.Column(db.String(255), nullable=True)
    department = db.Column(db.String(255), nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id', ondelete='RESTRICT'), nullable=False)
    
    pdf_url = db.Column(db.Text, nullable=False) # R2 bucket URL or filename
    status = db.Column(db.String(20), default='published', nullable=False) # 'published', 'removed'
    
    view_count = db.Column(db.Integer, default=0, nullable=False)
    download_count = db.Column(db.Integer, default=0, nullable=False)
    
    published_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    bookmarks = db.relationship('Bookmark', backref='paper', lazy=True, cascade='all, delete-orphan')
    citations = db.relationship('Citation', backref='paper', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "abstract": self.abstract,
            "keywords": self.keywords,
            "authors": self.authors,
            "primary_author_id": self.primary_author_id,
            "primary_author_name": self.primary_author.profile_name if self.primary_author else "Unknown",
            "institution": self.institution,
            "department": self.department,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "pdf_url": f"/api/papers/{self.id}/pdf",
            "status": self.status,
            "view_count": self.view_count,
            "download_count": self.download_count,
            "published_at": self.published_at.isoformat(),
            "created_at": self.created_at.isoformat()
        }
