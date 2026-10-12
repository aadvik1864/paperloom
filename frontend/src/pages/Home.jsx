import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import api from '../services/api';
import BlurText from '../components/ReactBits/BlurText';
import Icon from '../components/Common/Icon';
import PublicationCard from '../components/Common/PublicationCard';
import { SkeletonCard, SkeletonBlogCard } from '../components/Common/Skeleton';

const features = [
  { title: 'Publish your research', description: 'Upload a PDF or Word document. Give your work a place to be read, downloaded, and cited.', icon: 'file' },
  { title: 'Share a perspective', description: 'Bring your ideas beyond the abstract with blog posts and conversations with readers.', icon: 'pen' },
  { title: 'Follow your impact', description: 'See how your research reaches people with publication views and download counts.', icon: 'chart' },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [papers, setPapers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const authorPath = user && ['author', 'admin'].includes(user.role) ? '/dashboard' : '/login';

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setErrors({});
      const results = await Promise.allSettled([
        api.get('/papers?per_page=3&sort=most_viewed', { signal: controller.signal }),
        api.get('/blogs?per_page=3', { signal: controller.signal }),
        api.get('/papers/categories', { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      const [papersResult, blogsResult, categoriesResult] = results;
      setPapers(papersResult.status === 'fulfilled' ? papersResult.value.data.papers || [] : []);
      setBlogs(blogsResult.status === 'fulfilled' ? blogsResult.value.data.blogs || [] : []);
      setCategories(categoriesResult.status === 'fulfilled' ? categoriesResult.value.data.categories || [] : []);
      setErrors({ papers: papersResult.status === 'rejected', blogs: blogsResult.status === 'rejected' });
      setLoading(false);
    };
    fetchData();
    return () => controller.abort();
  }, [attempt]);

  const handleSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    navigate(query ? `/browse?search=${encodeURIComponent(query)}` : '/browse');
  };

  return (
    <div className="home-page">
      <section className="research-hero" aria-labelledby="hero-heading">
        <div className="page-container research-hero__layout">
          <div className="research-hero__copy">
            <p className="hero-intro"><span aria-hidden="true" />A meeting place for research and ideas</p>
            <BlurText as="h1" id="hero-heading" text="Good research deserves to be read." className="hero-heading" />
            <p className="hero-description">Discover scholarly work, share what you know, and be part of a community moving knowledge forward.</p>

            <form onSubmit={handleSearch} className="hero-search" role="search">
              <Icon name="search" />
              <label htmlFor="home-search" className="sr-only">Search research papers</label>
              <input id="home-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Title, author, or keyword" />
              <button type="submit" className="button button--primary">Search<Icon name="arrow" /></button>
            </form>

            <div className="hero-topics">
              <span>Explore</span>
              {categories.length > 0 ? categories.slice(0, 3).map((category) => (
                <Link key={category.id} to={`/browse?category_id=${category.id}`}>{category.name}</Link>
              )) : <><Link to="/browse">Research papers</Link><Link to="/browse?type=blogs">Community blogs</Link></>}
            </div>
          </div>

          <div className="research-folio">
            <div className="research-folio__dots" aria-hidden="true" />
            <div className="research-folio__back" aria-hidden="true" />
            <div className="research-folio__cover" aria-hidden="true">
              <div className="folio-masthead"><Icon name="book" /><span>Paperloom<br />Publications</span></div>
              <div className="folio-art"><span /><span /><span /><span /></div>
              <p>A world of<br />knowledge.<br />Open to you.</p>
              <div className="folio-bottom"><span>Research. Perspective. Progress.</span><Icon name="book" /></div>
            </div>
            <Link to={papers[0] ? `/papers/${papers[0].id}` : '/browse'} className="folio-feature">
              <div className="folio-feature__icon"><Icon name="file" /></div>
              <div><span>{papers[0] ? 'From the research library' : 'Your next discovery starts here'}</span><h2>{papers[0]?.title || 'Explore the research library'}</h2></div>
              <Icon name="arrow" className="folio-feature__arrow" />
            </Link>
          </div>
        </div>
        <div className="hero-bottom-bar">
          <div className="page-container hero-bottom-bar__inner">
            <p><Icon name="book" />Built for curious minds. Across every discipline.</p>
            <Link to="/about">Get to know Paperloom<Icon name="arrow" /></Link>
          </div>
        </div>
      </section>

      <section className="page-container content-section" aria-labelledby="featured-heading">
        <div className="section-heading">
          <div>
            <h2 id="featured-heading">Research worth exploring</h2>
            <p>A closer look at the most-read papers in our library.</p>
          </div>
          <Link to="/browse" className="text-link">Browse all papers<Icon name="arrow" /></Link>
        </div>
        <div className="publication-grid" aria-busy={loading}>
          {loading ? Array.from({ length: 3 }, (_, index) => <SkeletonCard key={index} />) : papers.map((paper) => <PublicationCard key={paper.id} paper={paper} />)}
        </div>
        {!loading && papers.length === 0 && (
          <div className="content-empty" role={errors.papers ? 'alert' : undefined}>
            <Icon name="book" />
            <h3>{errors.papers ? 'The library couldn’t load' : 'The next chapter starts with you'}</h3>
            <p>{errors.papers
              ? 'Check your connection and try again to see the latest research.'
              : 'Published papers will appear here. Sign in with your author profile to share your first paper.'}
            </p>
            {errors.papers ? (
              <button onClick={() => setAttempt((value) => value + 1)} className="button button--secondary">Try again</button>
            ) : (
              <Link to={authorPath} className="text-link">
                {authorPath === '/dashboard' ? 'Open author dashboard' : 'Author sign in'}
                <Icon name="arrow" />
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="publishing-section" aria-labelledby="publishing-heading">
        <div className="page-container publishing-layout">
          <div className="publishing-intro">
            <h2 id="publishing-heading">Your work.<br />A wider conversation.</h2>
            <p>From your first paper to your next perspective, make room for the ideas that matter.</p>
            <Link to={authorPath} className="button button--primary">
              {authorPath === '/dashboard' ? 'Open your dashboard' : 'Start with your author profile'}
              <Icon name="arrow" />
            </Link>
          </div>
          <div className="publishing-features">
            {features.map((feature) => (
              <div key={feature.title} className="publishing-feature">
                <div className="feature-icon"><Icon name={feature.icon} /></div>
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-container content-section" aria-labelledby="perspectives-heading">
        <div className="section-heading">
          <div>
            <h2 id="perspectives-heading">Beyond the paper</h2>
            <p>Fresh perspectives and notes from our research community.</p>
          </div>
          <Link to="/browse?type=blogs" className="text-link">Read all blogs<Icon name="arrow" /></Link>
        </div>
        <div className="publication-grid" aria-busy={loading}>
          {loading
            ? Array.from({ length: 3 }, (_, index) => <SkeletonBlogCard key={index} />)
            : blogs.map((blog) => <PublicationCard key={blog.id} blog={blog} />)}
        </div>
        {!loading && blogs.length === 0 && (
          <div className="content-empty content-empty--compact" role={errors.blogs ? 'alert' : undefined}>
            <Icon name="pen" />
            <h3>{errors.blogs ? 'Community posts couldn’t load' : 'There’s more to a paper than its pages'}</h3>
            <p>{errors.blogs
              ? 'Check your connection and try loading the posts again.'
              : 'Research notes, ideas, and conversations will appear here as our community shares them.'}
            </p>
            {errors.blogs && (
              <button onClick={() => setAttempt((value) => value + 1)} className="button button--secondary">Try again</button>
            )}
          </div>
        )}
      </section>

      <section className="page-container author-invitation">
        <div>
          <Icon name="pen" />
          <h2>Have something to contribute?</h2>
          <p>Your administrator can create an author profile. Once you have access, your next idea has a home.</p>
        </div>
        <Link to={authorPath} className="button button--secondary">
          {authorPath === '/dashboard' ? 'Go to dashboard' : 'Sign in to publish'}
          <Icon name="arrow" />
        </Link>
      </section>
    </div>
  );
}
