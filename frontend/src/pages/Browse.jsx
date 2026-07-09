import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import Pagination from '../components/Common/Pagination';
import Breadcrumbs from '../components/Common/Breadcrumbs';
import { SkeletonCard } from '../components/Common/Skeleton';

const SORT_OPTIONS = {
  newest: { label: 'Newest First', field: 'published_at', dir: 'desc' },
  oldest: { label: 'Oldest First', field: 'published_at', dir: 'asc' },
  most_viewed: { label: 'Most Viewed', field: 'view_count', dir: 'desc' },
  most_downloaded: { label: 'Most Downloaded', field: 'download_count', dir: 'desc' },
};

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [papers, setPapers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const type = searchParams.get('type') || 'papers';
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('category_id') || '';
  const sort = searchParams.get('sort') || 'newest';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (type === 'blogs') {
        const params = { page, per_page: 12 };
        if (search) params.search = search;

        const res = await api.get('/blogs', { params });
        setBlogs(res.data.blogs);
        setTotal(res.data.total);
        setPages(res.data.pages);
      } else {
        const params = { page, per_page: 12, sort };
        if (search) params.search = search;
        if (categoryId) params.category_id = categoryId;

        const res = await api.get('/papers', { params });
        setPapers(res.data.papers);
        setTotal(res.data.total);
        setPages(res.data.pages);
      }
    } catch (err) {
      console.error('Browse fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [type, page, search, categoryId, sort]);

  useEffect(() => {
    api.get('/papers/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) newParams.set(key, value);
      else newParams.delete(key);
    });
    setSearchParams(newParams);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { label: type === 'blogs' ? 'Blogs' : 'Papers' },
      ]} />

      <div className="flex gap-8">
        {/* Sidebar Filters */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6 sticky top-20">
            {/* Search */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Search</label>
              <input
                type="text"
                placeholder={type === 'blogs' ? 'Search blogs...' : 'Search papers...'}
                value={search}
                onChange={(e) => updateParams({ search: e.target.value, page: '1' })}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>

            {/* Type toggle */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Content Type</label>
              <div className="mt-2 space-y-2">
                <button
                  onClick={() => updateParams({ type: 'papers', page: '1' })}
                  className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                    type === 'papers' ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Papers
                </button>
                <button
                  onClick={() => updateParams({ type: 'blogs', page: '1' })}
                  className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                    type === 'blogs' ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Blog Posts
                </button>
              </div>
            </div>

            {/* Categories (papers only) */}
            {type === 'papers' && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</label>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => updateParams({ category_id: '', page: '1' })}
                    className={`block w-full text-left px-3 py-1.5 text-sm rounded transition ${
                      !categoryId ? 'text-accent font-medium' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => updateParams({ category_id: String(cat.id), page: '1' })}
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded transition ${
                        categoryId === String(cat.id) ? 'text-accent font-medium' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sort By</label>
              <select
                value={sort}
                onChange={(e) => updateParams({ sort: e.target.value, page: '1' })}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
              >
                {Object.entries(SORT_OPTIONS).map(([key, opt]) => {
                  if (type === 'blogs' && (key === 'most_viewed' || key === 'most_downloaded')) return null;
                  return <option key={key} value={key}>{opt.label}</option>;
                })}
              </select>
            </div>
          </div>
        </aside>

        {/* Mobile filters bar */}
        <div className="lg:hidden flex flex-wrap gap-2 mb-4 w-full">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => updateParams({ search: e.target.value, page: '1' })}
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
          />
          <select
            value={type}
            onChange={(e) => updateParams({ type: e.target.value, page: '1' })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
          >
            <option value="papers">Papers</option>
            <option value="blogs">Blogs</option>
          </select>
          {type === 'papers' && (
            <select
              value={categoryId}
              onChange={(e) => updateParams({ category_id: e.target.value, page: '1' })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          )}
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value, page: '1' })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
          >
            {Object.entries(SORT_OPTIONS).map(([key, opt]) => {
              if (type === 'blogs' && (key === 'most_viewed' || key === 'most_downloaded')) return null;
              return <option key={key} value={key}>{opt.label}</option>;
            })}
          </select>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {search && (
            <p className="text-sm text-gray-500 mb-4">
              {total} result{total !== 1 ? 's' : ''} for &quot;{search}&quot;
            </p>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : type === 'blogs' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {blogs.map((blog) => (
                <Link
                  key={blog.id}
                  to={`/blogs/${blog.slug}`}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group"
                >
                  {blog.cover_image_url ? (
                    <img src={blog.cover_image_url} alt={blog.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-44 bg-gradient-to-br from-navy-100 to-navy-50 flex items-center justify-center">
                      <span className="text-navy-300 text-4xl font-bold">AQ</span>
                    </div>
                  )}
                  <div className="p-5">
                    {blog.category && (
                      <span className="text-xs font-medium text-accent bg-accent-light px-2 py-1 rounded-full">
                        {blog.category}
                      </span>
                    )}
                    <h3 className="font-semibold text-navy-900 mt-2 mb-1 line-clamp-2 group-hover:text-accent transition-colors">{blog.title}</h3>
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2">{blog.content?.substring(0, 120)}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      By {blog.author_name} &middot; {blog.published_at?.slice(0, 10)}
                    </p>
                  </div>
                </Link>
              ))}
              {blogs.length === 0 && (
                <div className="col-span-2 text-center py-20 text-gray-500">No blogs found.</div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {papers.map((paper) => (
                <Link
                  key={paper.id}
                  to={`/papers/${paper.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group"
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-xs font-medium text-accent bg-accent-light px-2.5 py-1 rounded-full">
                      {paper.category_name || 'Uncategorized'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-navy-900 mb-2 line-clamp-2 leading-snug group-hover:text-accent transition-colors">
                    {paper.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">{paper.abstract}</p>
                  <p className="text-xs text-gray-400">
                    {paper.authors && paper.authors.length > 40
                      ? paper.authors.substring(0, 40) + ' et al.'
                      : paper.authors
                    }
                    {paper.institution && ` \u00b7 ${paper.institution}`}
                  </p>
                  <p className="text-xs text-gray-300 mt-2">{paper.published_at?.slice(0, 10)}</p>
                </Link>
              ))}
              {papers.length === 0 && (
                <div className="col-span-2 text-center py-20 text-gray-500">No papers found.</div>
              )}
            </div>
          )}

          <Pagination page={page} pages={pages} onPageChange={(p) => updateParams({ page: String(p) })} />
        </div>
      </div>
    </div>
  );
}
