import { Link } from 'react-router-dom';
import SpotlightCard from '../ReactBits/SpotlightCard';
import Icon from './Icon';

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PublicationCard({ paper, blog }) {
  const item = paper || blog;
  const date = formatDate(item.published_at);

  return (
    <SpotlightCard as={Link} to={paper ? `/papers/${paper.id}` : `/blogs/${blog.slug}`} className={`publication-card ${blog ? 'publication-card--blog' : ''}`}>
      {blog?.cover_image_url && <div className="publication-card__image"><img src={blog.cover_image_url} alt="" loading="lazy" /></div>}
      <div className="publication-card__body">
        <div className="publication-card__top">
          <span className="category-tag">{paper ? paper.category_name || 'Research paper' : blog.category || 'Community perspectives'}</span>
          <Icon name={paper ? 'file' : 'pen'} className="publication-card__type" />
        </div>
        <h3>{item.title}</h3>
        <p className="publication-card__abstract">{paper ? paper.abstract : blog.content}</p>
        <p className="publication-card__author">{paper ? paper.authors || paper.primary_author_name : blog.author_name}</p>
        <div className="publication-card__bottom">
          <span>{date || (paper ? 'Research paper' : 'Blog post')}</span>
          <span className="publication-card__action"><span>{paper ? 'Read paper' : 'Read post'}</span><Icon name="arrow" /></span>
        </div>
      </div>
    </SpotlightCard>
  );
}
