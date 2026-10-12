"""Baseline the existing Paperloom schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("profile_name", sa.String(150), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("bio", sa.Text()),
        sa.Column("institution", sa.String(255)),
        sa.Column("department", sa.String(255)),
        sa.Column("profile_photo_url", sa.Text()),
        sa.Column("website", sa.String(255)),
        sa.Column("google_scholar", sa.String(255)),
        sa.Column("linkedin", sa.String(255)),
        sa.Column("researchgate", sa.String(255)),
        sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_table("categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True))
    op.create_table("papers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("abstract", sa.Text(), nullable=False),
        sa.Column("keywords", sa.String(255)),
        sa.Column("authors", sa.Text(), nullable=False),
        sa.Column("primary_author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("institution", sa.String(255)),
        sa.Column("department", sa.String(255)),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("pdf_url", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("view_count", sa.Integer(), nullable=False),
        sa.Column("download_count", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_table("blogs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False, unique=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("cover_image_url", sa.Text()),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(100)),
        sa.Column("tags", sa.String(255)),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("view_count", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_table("comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blogs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False))
    op.create_table("bookmarks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("paper_id", sa.Integer(), sa.ForeignKey("papers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "paper_id", name="_user_paper_bookmark_uc"))
    op.create_table("citations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("paper_id", sa.Integer(), sa.ForeignKey("papers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("style", sa.String(50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False))


def downgrade():
    raise RuntimeError("The baseline contains user data. Restore a verified backup instead of dropping tables.")
