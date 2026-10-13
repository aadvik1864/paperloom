import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { LoadingPage } from '../../components/Common/Loading';
import Pagination from '../../components/Common/Pagination';
import { useAuth } from '../../context/auth';
import FormField, { inputClass } from '../../components/Common/FormField';
import { Feedback } from '../../components/Dashboard/ContentForms';

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
    <div className="admin-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
      <h1 className="text-2xl font-bold text-navy-900 dark:text-white mb-6">Admin Dashboard</h1>

      <div className="dashboard-tabs" role="group" aria-label="Admin sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={tab === t.id ? 'dashboard-tab dashboard-tab--active' : 'dashboard-tab'}
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
  if (!data) return <p className="text-gray-500 dark:text-gray-400">Failed to load analytics.</p>;

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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-4">Papers by Category</h3>
          <div className="space-y-3">
            {categoryBreakdown.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{cat.name}</span>
                <span className="font-medium text-navy-900 dark:text-white">{cat.count}</span>
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
      <p className="text-2xl font-bold text-navy-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
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
      await api.post('/admin/users', { profile_name: profileName, password, role });
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
      <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">Create Profile</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Create a shared profile. Anyone who knows the profile name and password can sign in.
      </p>

      {result && (
        <div className={`text-sm p-3 rounded-lg mb-4 ${result.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
          {result.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Profile Name *">
          <input id="new-profile-name" type="text" maxLength={150} value={profileName} onChange={(e) => setProfileName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Research Lab, Dr. Smith, Editorial Team" required />
        </FormField>
        <FormField label="Password *">
          <input id="new-profile-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="At least 12 characters" minLength={12} autoComplete="new-password" required />
        </FormField>
        <div>
          <FormField label="Access Level">
            <select id="new-profile-role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              <option value="visitor">Reader (Read Only)</option>
              <option value="author">Author (Read &amp; Post)</option>
              <option value="admin">Admin (Full Access)</option>
            </select>
          </FormField>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {role === 'visitor' && 'Read papers, save bookmarks, and comment on blogs.'}
            {role === 'author' && 'Publish papers and blogs; manage your own work.'}
            {role === 'admin' && 'Manage profiles, access levels, and publications.'}
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
  const { user, fetchUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resetting, setResetting] = useState(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/admin/users?page=${page}&per_page=20`)
      .then((res) => { setUsers(res.data.users || []); setPages(res.data.pages ?? 1); })
      .catch(() => setError('Profiles could not load. Try again.'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId, role) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      if (userId === user.id) await fetchUser();
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update role');
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
      <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">Profile Management</h2>
      <Feedback message={error} />
      {error && <button className="button button--secondary mb-4" onClick={fetchUsers}>Try again</button>}
      {resetting && <PasswordReset key={resetting.id} profile={resetting} onCancel={() => setResetting(null)} onSaved={async () => {
        if (resetting.id === user.id) await fetchUser();
        setResetting(null);
      }} />}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Profile Name</th>
              <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Role</th>
              <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Created</th>
              <th className="text-right p-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="p-3">
                  <Link to={`/profile/${u.id}`} className="font-medium text-navy-900 dark:text-white hover:text-accent">{u.profile_name}</Link>
                </td>
                <td className="p-3">
                  <select
                    aria-label={`Access level for ${u.profile_name}`}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1 outline-none"
                  >
                    <option value="visitor">Reader (Read Only)</option>
                    <option value="author">Author (Read &amp; Post)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                </td>
                <td className="p-3 text-gray-400 dark:text-gray-500 text-xs">{u.created_at?.slice(0, 10)}</td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => setResetting(u)} className="text-xs text-accent hover:underline">
                    Set Password
                  </button>
                  <button disabled={u.id === user.id} onClick={() => handleDeleteUser(u.id)} className="text-xs text-red-700 dark:text-red-300 hover:underline disabled:opacity-50">
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
  const [error, setError] = useState(null);

  const fetchPapers = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/admin/papers?page=${page}&per_page=20`)
      .then((res) => { setPapers(res.data.papers || []); setPages(res.data.pages ?? 1); })
      .catch(() => setError('Papers could not load. Try again.'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

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
      <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">All Papers</h2>
      <Feedback message={error} />
      {error && <button className="button button--secondary mb-4" onClick={fetchPapers}>Try again</button>}
      <div className="space-y-3">
        {papers.map((p) => (
          <div key={p.id} className="dashboard-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 break-words">
              <Link to={`/papers/${p.id}`} className="font-medium text-navy-900 dark:text-white hover:text-accent">{p.title}</Link>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                By {p.authors} &middot; {p.view_count} views &middot; Status: <span className={`capitalize font-medium ${p.status === 'published' ? 'text-green-600' : 'text-red-500'}`}>{p.status}</span>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => handleToggleStatus(p.id)} className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                {p.status === 'published' ? 'Remove' : 'Restore'}
              </button>
              <button onClick={() => handleDelete(p.id)} className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        ))}
        {papers.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No papers found.</p>}
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
  const [error, setError] = useState(null);

  const fetchBlogs = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/admin/blogs?page=${page}&per_page=20`)
      .then((res) => { setBlogs(res.data.blogs || []); setPages(res.data.pages ?? 1); })
      .catch(() => setError('Blogs could not load. Try again.'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchBlogs(); }, [fetchBlogs]);

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
      <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">All Blogs</h2>
      <Feedback message={error} />
      {error && <button className="button button--secondary mb-4" onClick={fetchBlogs}>Try again</button>}
      <div className="space-y-3">
        {blogs.map((b) => (
          <div key={b.id} className="dashboard-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 break-words">
              <Link to={`/blogs/${b.slug}`} className="font-medium text-navy-900 dark:text-white hover:text-accent">{b.title}</Link>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                By {b.author_name} &middot; {b.view_count} views &middot; Status: <span className={`capitalize font-medium ${b.status === 'published' ? 'text-green-600' : 'text-red-500'}`}>{b.status}</span>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => handleToggleStatus(b.id)} className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                {b.status === 'published' ? 'Remove' : 'Restore'}
              </button>
              <button onClick={() => handleDelete(b.id)} className="text-xs px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        ))}
        {blogs.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No blogs found.</p>}
      </div>
      <Pagination page={page} pages={pages} onPageChange={setPage} />
    </div>
  );
}

function PasswordReset({ profile, onCancel, onSaved }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    if (new TextEncoder().encode(password).length > 72) {
      setError('Use at most 72 UTF-8 bytes.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.put(`/admin/users/${profile.id}/password`, { password });
      setPassword('');
      await onSaved();
    } catch (failure) {
      setError(failure.response?.data?.message || 'Password could not be updated. Try again.');
    } finally { setSaving(false); }
  };
  return <form onSubmit={submit} className="dashboard-card max-w-lg mb-6 space-y-4">
    <h3 className="text-xl">Set password for {profile.profile_name}</h3>
    <Feedback message={error} />
    <FormField label="New password"><input type="password" className={inputClass} value={password} onChange={event => setPassword(event.target.value)} required minLength={12} autoComplete="new-password" /></FormField>
    <div className="flex gap-3"><button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Password'}</button>
      <button type="button" className="button button--secondary" onClick={onCancel} disabled={saving}>Cancel</button></div>
  </form>;
}
