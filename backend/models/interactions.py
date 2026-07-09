from datetime import datetime
from extensions import db

class Comment(db.Model):
    __tablename__ = 'comments'
    
    id = db.Column(db.Integer, primary_key=True)
    blog_id = db.Column(db.Integer, db.ForeignKey('blogs.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "blog_id": self.blog_id,
            "user_id": self.user_id,
            "user_name": self.user.profile_name if self.user else "Unknown",
            "user_photo": self.user.profile_photo_url if self.user else None,
            "content": self.content,
            "created_at": self.created_at.isoformat()
        }

class Bookmark(db.Model):
    __tablename__ = 'bookmarks'
    __table_args__ = (db.UniqueConstraint('user_id', 'paper_id', name='_user_paper_bookmark_uc'),)
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    paper_id = db.Column(db.Integer, db.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "paper_id": self.paper_id,
            "paper_title": self.paper.title if self.paper else None,
            "created_at": self.created_at.isoformat()
        }

class Citation(db.Model):
    __tablename__ = 'citations'
    
    id = db.Column(db.Integer, primary_key=True)
    paper_id = db.Column(db.Integer, db.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False)
    style = db.Column(db.String(50), nullable=False) # 'APA', 'MLA', 'BibTeX'
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "paper_id": self.paper_id,
            "style": self.style,
            "text": self.text,
            "created_at": self.created_at.isoformat()
        }
