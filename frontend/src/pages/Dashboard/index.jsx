import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { LoadingPage } from '../../components/Common/Loading';
import Pagination from '../../components/Common/Pagination';

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('stats');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/users/dashboard');
        setDashboard(res.data || {});
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <LoadingPage />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Dashboard</h1>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit mb-8 overflow-x-auto">
        {[
          { id: 'stats', label: 'Overview' },
          { id: 'upload', label: 'Upload Paper' },
          { id: 'write', label: 'Write Blog' },
          { id: 'papers', label: 'My Papers' },
          { id: 'blogs', label: 'My Blogs' },
          { id: 'bookmarks', label: 'Bookmarks' },
          { id: 'profile', label: 'Edit Profile' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition ${
              tab === t.id ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stats' && dashboard && <StatsTab dashboard={dashboard} />}
      {tab === 'upload' && <UploadPaperTab />}
      {tab === 'write' && <WriteBlogTab />}
      {tab === 'papers' && <MyPapersTab />}
      {tab === 'blogs' && <MyBlogsTab />}
      {tab === 'bookmarks' && <BookmarksTab />}
      {tab === 'profile' && <EditProfileTab />}
    </div>
  );
}

function StatsTab({ dashboard }) {
  const stats = dashboard.stats || {};
  const recent_papers = dashboard.recent_papers || [];
  const recent_blogs = dashboard.recent_blogs || [];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Papers', value: stats.total_papers ?? 0 },
          { label: 'Views', value: (stats.total_views ?? 0).toLocaleString() },
          { label: 'Downloads', value: (stats.total_downloads ?? 0).toLocaleString() },
          { label: 'Blogs', value: stats.total_blogs ?? 0 },
          { label: 'Bookmarks', value: stats.total_bookmarks ?? 0 },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-navy-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {recent_papers.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-navy-900 mb-3">Recent Papers</h3>
            <div className="space-y-2">
              {recent_papers.map((p) => (
                <Link key={p.id} to={`/papers/${p.id}`} className="block bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition">
                  <p className="text-sm font-medium text-navy-900 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400">{p.view_count} views &middot; {p.download_count} downloads</p>
                </Link>
              ))}
            </div>
          </div>
        )}
        {recent_blogs?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-navy-900 mb-3">Recent Blogs</h3>
            <div className="space-y-2">
              {recent_blogs.map((b) => (
                <Link key={b.id} to={`/blogs/${b.slug}`} className="block bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition">
                  <p className="text-sm font-medium text-navy-900 truncate">{b.title}</p>
                  <p className="text-xs text-gray-400">{b.view_count} views</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadPaperTab() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', abstract: '', authors: '', keywords: '',
    institution: '', department: '', category_id: '',
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get('/papers/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !form.title || !form.abstract || !form.authors || !form.category_id) {
      setMessage({ type: 'error', text: 'Title, abstract, authors, category, and file are required.' });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      const res = await api.post('/papers', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessage({ type: 'success', text: 'Paper published successfully!' });
      setForm({ title: '', abstract: '', authors: '', keywords: '', institution: '', department: '', category_id: '' });
      setFile(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Upload Research Paper</h2>
      {message && (
        <div className={`text-sm p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Abstract *</label>
          <textarea rows={4} value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent resize-none" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Authors *</label>
            <input type="text" value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
              placeholder="John Smith, Jane Doe" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent">
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
            <input type="text" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
              placeholder="machine learning, AI" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
            <input type="text" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">File (PDF or DOCX) *</label>
          <input type="file" accept=".pdf,.docx,.doc" onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent file:text-white hover:file:bg-accent-hover" />
        </div>
        <button type="submit" disabled={uploading}
          className="bg-accent text-white px-6 py-2.5 rounded-lg hover:bg-accent-hover transition font-medium text-sm disabled:opacity-50">
          {uploading ? 'Uploading...' : 'Publish Paper'}
        </button>
      </form>
    </div>
  );
}

function WriteBlogTab() {
  const [form, setForm] = useState({ title: '', content: '', category: '', tags: '', cover_image_url: '', status: 'published' });
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      setMessage({ type: 'error', text: 'Title and content are required.' });
      return;
    }
    setPublishing(true);
    setMessage(null);
    try {
      await api.post('/blogs', form);
      setMessage({ type: 'success', text: 'Blog published!' });
      setForm({ title: '', content: '', category: '', tags: '', cover_image_url: '', status: 'published' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to publish.' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Write Blog Post</h2>
      {message && (
        <div className={`text-sm p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content (Markdown) *</label>
          <textarea rows={12} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent font-mono resize-none" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent">
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
          <input type="url" value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
            placeholder="https://example.com/image.jpg" />
        </div>
        <button type="submit" disabled={publishing}
          className="bg-accent text-white px-6 py-2.5 rounded-lg hover:bg-accent-hover transition font-medium text-sm disabled:opacity-50">
          {publishing ? 'Publishing...' : 'Publish Blog'}
        </button>
      </form>
    </div>
  );
}

function MyPapersTab() {
  const { user } = useAuth();
  const [papers, setPapers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPapers = async () => {
    setLoading(true);
    try {
      const authorId = user?.id ?? '';
      const res = await api.get(`/papers?author_id=${authorId}&per_page=20&page=${page}`);
      setPapers(res.data.papers || []);
      setPages(res.data.pages ?? 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPapers(); }, [page]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this paper permanently?')) return;
    try {
      await api.delete(`/papers/${id}`);
      fetchPapers();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <LoadingPage />;
  return (
    <div>
      <h2 className="text-lg font-semibold text-navy-900 mb-4">My Papers</h2>
      {papers.length === 0 ? (
        <p className="text-sm text-gray-400">No papers yet.</p>
      ) : (
        <div className="space-y-3">
          {papers.map((p) => (
            <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <Link to={`/papers/${p.id}`} className="font-medium text-navy-900 hover:text-accent">{p.title}</Link>
                <p className="text-xs text-gray-400 mt-1">{p.view_count} views &middot; {p.download_count} downloads &middot; {p.published_at?.slice(0, 10)}</p>
              </div>
              <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}

function MyBlogsTab() {
  const { user } = useAuth();
  const [blogs, setBlogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const uid = user?.id ?? null;
      const res = await api.get(`/blogs?author_id=${uid || ''}&per_page=20&page=${page}`);
      setBlogs(res.data.blogs || []);
      setPages(res.data.pages ?? 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBlogs(); }, [page]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this blog permanently?')) return;
    try {
      await api.delete(`/blogs/${id}`);
      fetchBlogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <LoadingPage />;
  return (
    <div>
      <h2 className="text-lg font-semibold text-navy-900 mb-4">My Blogs</h2>
      {blogs.length === 0 ? (
        <p className="text-sm text-gray-400">No blog posts yet.</p>
      ) : (
        <div className="space-y-3">
          {blogs.map((b) => (
            <div key={b.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <Link to={`/blogs/${b.slug}`} className="font-medium text-navy-900 hover:text-accent">{b.title}</Link>
                <p className="text-xs text-gray-400 mt-1">{b.view_count} views &middot; {b.published_at?.slice(0, 10)} &middot; <span className="capitalize">{b.status}</span></p>
              </div>
              <button onClick={() => handleDelete(b.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}

function BookmarksTab() {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/bookmarks').then((res) => setBookmarks(res.data.bookmarks || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingPage />;
  return (
    <div>
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Bookmarked Papers</h2>
      {bookmarks.length === 0 ? (
        <p className="text-sm text-gray-400">No bookmarked papers.</p>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((p) => (
            <Link key={p.id} to={`/papers/${p.id}`} className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition">
              <p className="font-medium text-navy-900">{p.title}</p>
              <p className="text-xs text-gray-400 mt-1">{p.authors} &middot; {p.view_count} views</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EditProfileTab() {
  const { user, fetchUser } = useAuth();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        profile_name: user.profile_name || '',
        bio: user.bio || '',
        institution: user.institution || '',
        department: user.department || '',
        website: user.website || '',
        google_scholar: user.google_scholar || '',
        linkedin: user.linkedin || '',
        researchgate: user.researchgate || '',
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/users/profile', form);
      await fetchUser();
      setMessage({ type: 'success', text: 'Profile updated!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Edit Profile</h2>
      {message && (
        <div className={`text-sm p-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profile Name</label>
          <input type="text" value={form.profile_name} onChange={(e) => setForm({ ...form, profile_name: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent resize-none" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
            <input type="text" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Scholar</label>
            <input type="url" value={form.google_scholar} onChange={(e) => setForm({ ...form, google_scholar: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
            <input type="url" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ResearchGate</label>
            <input type="url" value={form.researchgate} onChange={(e) => setForm({ ...form, researchgate: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent" />
          </div>
        </div>
        <button type="submit" disabled={saving}
          className="bg-accent text-white px-6 py-2.5 rounded-lg hover:bg-accent-hover transition font-medium text-sm disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
