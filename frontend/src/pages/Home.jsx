import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { SkeletonCard, SkeletonBlogCard } from '../components/Common/Skeleton';

const features = [
  {
    title: 'Publish Research',
    desc: 'Upload papers in PDF or DOCX format. Automatic conversion to PDF, embedded viewer, and DOI-style citation generation.',
    icon: '📄',
  },
  {
    title: 'Write Blogs',
    desc: 'Share insights and commentary with the research community through rich blog posts with comments and discussion.',
    icon: '✍️',
  },
  {
    title: 'Discover Content',
    desc: 'Search across papers, authors, institutions, and keywords. Filter by category, date, and popularity.',
    icon: '🔍',
  },
  {
    title: 'Track Impact',
    desc: 'Monitor views, downloads, and engagement for your publications through the author dashboard.',
    icon: '📊',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [papersRes, blogsRes] = await Promise.all([
          api.get('/papers?per_page=3&sort=most_viewed'),
          api.get('/blogs?per_page=3'),
        ]);
        setPapers(papersRes.data.papers || []);
        setBlogs(blogsRes.data.blogs || []);
      } catch (err) {
        console.error('Failed to load home data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-block text-xs font-medium text-navy-200 bg-white/10 px-3 py-1 rounded-full mb-4">
              Academic Research Platform(scopus-indexed)
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4">
              Publish. Discover. Connect.
            </h1>
            <p className="text-lg md:text-xl text-navy-200 mb-10 leading-relaxed">
              Al-Qwal Publications is a modern platform for researchers, academics, and institutions
              to publish scholarly work, share insights, and advance knowledge.
            </p>
            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="flex items-center bg-white rounded-xl shadow-lg overflow-hidden">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search papers by title, author, or keyword..."
                  className="flex-1 px-5 py-3.5 text-gray-900 outline-none text-sm"
                />
                <button
                  type="submit"
                  className="px-6 py-3.5 bg-accent text-white font-medium text-sm hover:bg-accent-hover transition"
                >
                  Search
                </button>
              </div>
            </form>
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Link
                to="/browse"
                className="inline-flex items-center px-5 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-sm font-medium border border-white/20"
              >
                Browse Papers
              </Link>
              <Link
                to="/browse?type=blogs"
                className="inline-flex items-center px-5 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-sm font-medium border border-white/20"
              >
                Read Blogs
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center px-5 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition text-sm font-medium border border-white/20"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-navy-900 dark:text-white mb-3">What We Offer</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Everything you need to publish, manage, and share academic research.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
              <span className="text-3xl block mb-3">{f.icon}</span>
              <h3 className="font-semibold text-navy-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 dark:bg-gray-900 border-y border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-navy-900 dark:text-white mb-3">How It Works</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Three simple steps to start publishing and discovering research.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Get Access', desc: 'Your administrator creates a profile for you. You receive your credentials to sign in.' },
              { step: '2', title: 'Publish', desc: 'Upload papers or write blog posts through the author dashboard. Your work is live immediately.' },
              { step: '3', title: 'Engage', desc: 'Share your publications, track views and downloads, and connect with readers through comments.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-xl">{s.step}</span>
                </div>
                <h3 className="font-semibold text-navy-900 dark:text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Papers */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-navy-900 dark:text-white">Featured Papers</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Most viewed publications on the platform</p>
          </div>
          <Link to="/browse" className="text-accent hover:underline text-sm font-medium">
            View All &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : papers.map((paper) => <PaperCard key={paper.id} paper={paper} />)
          }
          {!loading && papers.length === 0 && (
            <p className="col-span-3 text-center text-gray-400 dark:text-gray-500 py-12">No papers published yet.</p>
          )}
        </div>
      </section>

      {/* Latest Blogs */}
      {!loading && blogs.length > 0 && (
        <section className="bg-gray-50 dark:bg-gray-900 border-y border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-navy-900 dark:text-white">Latest Blog Posts</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Recent insights from the research community</p>
              </div>
              <Link to="/browse?type=blogs" className="text-accent hover:underline text-sm font-medium">
                View All &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {blogs.map((blog) => (
                <Link
                  key={blog.id}
                  to={`/blogs/${blog.slug}`}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group"
                >
                  {blog.cover_image_url ? (
                    <img src={blog.cover_image_url} alt={blog.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-navy-100 to-navy-50 flex items-center justify-center">
                      <span className="text-navy-300 text-4xl font-bold">AQ</span>
                    </div>
                  )}
                  <div className="p-5">
                    {blog.category && (
                      <span className="text-xs font-medium text-accent bg-accent-light px-2 py-1 rounded-full">{blog.category}</span>
                    )}
                    <h3 className="font-semibold text-navy-900 dark:text-white mt-2 mb-1 line-clamp-2 group-hover:text-accent transition-colors">{blog.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{blog.content?.substring(0, 120)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">By {blog.author_name} &middot; {blog.published_at?.slice(0, 10)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PaperCard({ paper }) {
  return (
    <Link
      to={`/papers/${paper.id}`}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group"
    >
      <span className="text-xs font-medium text-accent bg-accent-light px-2.5 py-1 rounded-full inline-block mb-3">
        {paper.category_name || 'Uncategorized'}
      </span>
      <h3 className="font-semibold text-navy-900 dark:text-white mb-2 line-clamp-2 leading-snug group-hover:text-accent transition-colors">
        {paper.title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">{paper.abstract}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {paper.authors?.length > 40 ? paper.authors.substring(0, 40) + ' et al.' : paper.authors}
        {paper.institution && ` \u00b7 ${paper.institution}`}
      </p>
      <p className="text-xs text-gray-300 dark:text-gray-500 mt-2">Published {paper.published_at?.slice(0, 10)}</p>
    </Link>
  );
}
