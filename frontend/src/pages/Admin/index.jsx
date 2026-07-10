import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { LoadingPage } from '../../components/Common/Loading';
import Pagination from '../../components/Common/Pagination';

export default function AdminDashboard() {
  const [tab, setTab] = useState('analytics');

  const tabs = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'create', label: 'Create Profile' },
    { id: 'users', label: 'Profiles' },
    { id: 'papers', label: 'Papers' },
    { id: 'blogs', label: 'Blogs' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Admin Dashboard</h1>

      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit mb-8 overflow-x-auto">
        {tabs.map((t) => (
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

      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'create' && <CreateProfileTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'papers' && <AdminPapersTab />}
      {tab === 'blogs' && <AdminBlogsTab />}
    </div>
  );
}

function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics').then((res) => setData(res.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingPage />;
  if (!data) return <p className="text-gray-500">Failed to load analytics.</p>;

  const stats = data.stats || {};
  const userBreakdown = data.user_breakdown || {};
  const categoryBreakdown = data.category_breakdown || [];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={stats.total_users ?? 0} />
        <StatCard label="Total Papers" value={stats.total_papers ?? 0} />
        <StatCard label="Total Blogs" value={stats.total_blogs ?? 0} />
        <StatCard label="Total Views" value={(stats.total_views ?? 0).toLocaleString()} />
        <StatCard label="Total Downloads" value={(stats.total_downloads ?? 0).toLocaleString()} />
        <StatCard label="Admins" value={userBreakdown.admins ?? 0} />
        <StatCard label="Authors" value={userBreakdown.authors ?? 0} />
        <StatCard label="Visitors" value={userBreakdown.visitors ?? 0} />
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-navy-900 mb-4">Papers by Category</h3>
          <div className="space-y-3">
            {categoryBreakdown.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{cat.name}</span>
                <span className="font-medium text-navy-900">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className="text-2xl font-bold text-navy-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function CreateProfileTab() {
  const [profileName, setProfileName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('visitor');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setResult(null);
    try {
      const res = await api.post('/admin/users', { profile_name: profileName, password, role });
      setResult({ type: 'success', text: `Profile "${profileName}" created!` });
      setProfileName('');
      setPassword('');
      setRole('visitor');
    } catch (err) {
      setResult({ type: 'error', text: err.response?.data?.message || 'Creation failed.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Create Profile</h2>
      <p className="text-sm text-gray-500 mb-4">
        Create a shared profile. Anyone who knows the profile name and password can sign in.
      </p>

      {result && (
        <div className={`text-sm p-3 rounded-lg mb-4 ${result.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {result.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profile Name *</label>
          <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g. Research Lab, Dr. Smith, Editorial Team" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
            placeholder="At least 6 characters" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent">
            <option value="visitor">Reader (Read Only)</option>
            <option value="author">Author (Read &amp; Post)</option>
            <option value="admin">Admin (Full Access)</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            {role === 'visitor' && 'Can browse, search, and view content only.'}
            {role === 'author' && 'Can publish papers and blogs, manage own content.'}
            {role === 'admin' && 'Full access: manage users, content, and platform settings.'}
          </p>
        </div>
        <button type="submit" disabled={creating}
          className="bg-accent text-white px-6 py-2.5 rounded-lg hover:bg-accent-hover transition font-medium text-sm disabled:opacity-50">
          {creating ? 'Creating...' : 'Create Profile'}
        </button>
      </form>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    setLoading(true);
    api.get(`/admin/users?page=${page}&per_page=20`)
      .then((res) => { setUsers(res.data.users || []); setPages(res.data.pages ?? 1); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const handleRoleChange = async (userId, role) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleSetPassword = async (userId) => {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    try {
      await api.put(`/admin/users/${userId}/password`, { password: newPassword });
      alert('Password updated successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update password');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Delete this profile and all associated content?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <div>
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Profile Management</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">Profile Name</th>
              <th className="text-left p-3 font-medium text-gray-600">Role</th>
              <th className="text-left p-3 font-medium text-gray-600">Created</th>
              <th className="text-right p-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="p-3">
                  <Link to={`/profile/${u.id}`} className="font-medium text-navy-900 hover:text-accent">{u.profile_name}</Link>
                </td>
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1 outline-none"
                  >
                    <option value="visitor">Reader (Read Only)</option>
                    <option value="author">Author (Read &amp; Post)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                </td>
                <td className="p-3 text-gray-400 text-xs">{u.created_at?.slice(0, 10)}</td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => handleSetPassword(u.id)} className="text-xs text-accent hover:underline">
                    Set Password
                  </button>
                  <button onClick={() => handleDeleteUser(u.id)} className="text-xs text-red-400 hover:text-red-600">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}

function AdminPapersTab() {
  const [papers, setPapers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPapers = () => {
    setLoading(true);
    api.get(`/admin/papers?page=${page}&per_page=20`)
      .then((res) => { setPapers(res.data.papers || []); setPages(res.data.pages ?? 1); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPapers(); }, [page]);

  const handleToggleStatus = async (id) => {
    try {
      await api.put(`/admin/papers/${id}/toggle-status`);
      fetchPapers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this paper?')) return;
    try {
      await api.delete(`/admin/papers/${id}/delete`);
      fetchPapers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <LoadingPage />;
  return (
    <div>
      <h2 className="text-lg font-semibold text-navy-900 mb-4">All Papers</h2>
      <div className="space-y-3">
        {papers.map((p) => (
          <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <Link to={`/papers/${p.id}`} className="font-medium text-navy-900 hover:text-accent">{p.title}</Link>
              <p className="text-xs text-gray-400 mt-1">
                By {p.authors} &middot; {p.view_count} views &middot; Status: <span className={`capitalize font-medium ${p.status === 'published' ? 'text-green-600' : 'text-red-500'}`}>{p.status}</span>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => handleToggleStatus(p.id)} className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
                {p.status === 'published' ? 'Remove' : 'Restore'}
              </button>
              <button onClick={() => handleDelete(p.id)} className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        ))}
        {papers.length === 0 && <p className="text-sm text-gray-400">No papers found.</p>}
      </div>
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}

function AdminBlogsTab() {
  const [blogs, setBlogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchBlogs = () => {
    setLoading(true);
    api.get(`/admin/blogs?page=${page}&per_page=20`)
      .then((res) => { setBlogs(res.data.blogs || []); setPages(res.data.pages ?? 1); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBlogs(); }, [page]);

  const handleToggleStatus = async (id) => {
    try {
      await api.put(`/admin/blogs/${id}/toggle-status`);
      fetchBlogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this blog?')) return;
    try {
      await api.delete(`/admin/blogs/${id}/delete`);
      fetchBlogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <LoadingPage />;
  return (
    <div>
      <h2 className="text-lg font-semibold text-navy-900 mb-4">All Blogs</h2>
      <div className="space-y-3">
        {blogs.map((b) => (
          <div key={b.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <Link to={`/blogs/${b.slug}`} className="font-medium text-navy-900 hover:text-accent">{b.title}</Link>
              <p className="text-xs text-gray-400 mt-1">
                By {b.author_name} &middot; {b.view_count} views &middot; Status: <span className={`capitalize font-medium ${b.status === 'published' ? 'text-green-600' : 'text-red-500'}`}>{b.status}</span>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => handleToggleStatus(b.id)} className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
                {b.status === 'published' ? 'Remove' : 'Restore'}
              </button>
              <button onClick={() => handleDelete(b.id)} className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        ))}
        {blogs.length === 0 && <p className="text-sm text-gray-400">No blogs found.</p>}
      </div>
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}
