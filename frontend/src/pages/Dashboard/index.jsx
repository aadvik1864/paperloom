import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import api from '../../services/api';
import { LoadingPage } from '../../components/Common/Loading';
import Pagination from '../../components/Common/Pagination';
import FormField, { inputClass } from '../../components/Common/FormField';
import { PaperForm, BlogForm, Feedback } from '../../components/Dashboard/ContentForms';

function useList(path, field) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.get(path, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setData(response.data);
    }).catch(() => {
      if (!controller.signal.aborted) setError('This section could not load. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision]);
  return { data, items: data?.[field] || [], loading, error, refresh: () => setRevision(value => value + 1) };
}

function ListError({ error, refresh }) {
  return error ? <div><Feedback message={error} /><button className="button button--secondary" onClick={refresh}>Try again</button></div> : null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const canPublish = ['author', 'admin'].includes(user.role);
  const [tab, setTab] = useState(canPublish ? 'stats' : 'bookmarks');
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const tabs = [
    ...(canPublish ? [
      { id: 'stats', label: 'Overview' }, { id: 'upload', label: 'Upload Paper' }, { id: 'write', label: 'Write Blog' },
      { id: 'papers', label: 'My Papers' }, { id: 'blogs', label: 'My Blogs' },
    ] : []),
    { id: 'bookmarks', label: 'Bookmarks' }, { id: 'profile', label: 'Edit Profile' },
  ];
  const saved = destination => {
    setRevision(value => value + 1);
    setMessage(destination === 'blogs' ? 'Blog saved successfully.' : 'Paper saved successfully.');
    setTab(destination);
  };
  return <div className="dashboard-page max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0">
    <h1 className="text-2xl mb-6">Dashboard</h1>
    <div className="dashboard-tabs" role="group" aria-label="Dashboard sections">
      {tabs.map(item => <button key={item.id} aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setMessage(null); }}
        className={tab === item.id ? 'dashboard-tab dashboard-tab--active' : 'dashboard-tab'}>{item.label}</button>)}
    </div>
    {message && <p role="status" className="action-feedback mb-4">{message}</p>}
    {canPublish && tab === 'stats' && <StatsTab key={revision} />}
    {canPublish && tab === 'upload' && <PaperForm onSaved={() => saved('papers')} />}
    {canPublish && tab === 'write' && <BlogForm onSaved={() => saved('blogs')} />}
    {canPublish && tab === 'papers' && <ContentTab kind="papers" key={`papers-${revision}`} />}
    {canPublish && tab === 'blogs' && <ContentTab kind="blogs" key={`blogs-${revision}`} />}
    {tab === 'bookmarks' && <BookmarksTab />}
    {tab === 'profile' && <EditProfileTab />}
  </div>;
}

function StatsTab() {
  const { data, loading, error, refresh } = useList('/users/dashboard');
  if (loading) return <LoadingPage />;
  if (error) return <ListError error={error} refresh={refresh} />;
  const stats = data?.stats || {};
  return <div>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      {[
        ['Papers', stats.total_papers], ['Views', stats.total_views], ['Downloads', stats.total_downloads],
        ['Blogs', stats.total_blogs], ['Bookmarks', stats.total_bookmarks],
      ].map(([label, value]) => <div key={label} className="dashboard-card text-center">
        <p className="text-2xl font-bold">{(value || 0).toLocaleString()}</p><p className="text-sm text-gray-600 dark:text-gray-300">{label}</p>
      </div>)}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {['papers', 'blogs'].map(kind => <section key={kind} className="min-w-0">
        <h2 className="text-xl mb-3">Recent {kind === 'papers' ? 'Papers' : 'Blogs'}</h2>
        <div className="space-y-3">{(data?.[`recent_${kind}`] || []).map(item => <Link key={item.id}
          to={kind === 'papers' ? `/papers/${item.id}` : `/blogs/${item.slug}`} className="dashboard-card block break-words">
          <p className="font-medium">{item.title}</p><p className="text-sm text-gray-600 dark:text-gray-300">{item.view_count} views · {item.status}</p>
        </Link>)}</div>
      </section>)}
    </div>
  </div>;
}

function ContentTab({ kind }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(null);
  const { data, items, loading, error, refresh } = useList(`/${kind}?author_id=${user.id}&status=all&per_page=20&page=${page}`, kind);
  const remove = async id => {
    if (busy || !confirm(`Delete this ${kind === 'papers' ? 'paper' : 'blog'} permanently?`)) return;
    setBusy(id);
    setActionError(null);
    try {
      await api.delete(`/${kind}/${id}`);
      refresh();
    } catch (failure) {
      setActionError(failure.response?.data?.message || 'Delete failed. Try again.');
    } finally { setBusy(null); }
  };
  const publish = async id => {
    if (busy) return;
    setBusy(id);
    setActionError(null);
    try {
      await api.put(`/blogs/${id}`, { status: 'published' });
      refresh();
    } catch (failure) {
      setActionError(failure.response?.data?.message || 'Publishing failed. Try again.');
    } finally { setBusy(null); }
  };
  if (editing) {
    const props = { onSaved: () => { setEditing(null); refresh(); }, onCancel: () => setEditing(null) };
    return kind === 'papers' ? <PaperForm paper={editing} {...props} /> : <BlogForm blog={editing} {...props} />;
  }
  if (loading) return <LoadingPage />;
  if (error) return <ListError error={error} refresh={refresh} />;
  return <div>
    <h2 className="text-xl mb-4">My {kind === 'papers' ? 'Papers' : 'Blogs'}</h2>
    <Feedback message={actionError} />
    {items.length === 0 && <p className="text-gray-600 dark:text-gray-300">No {kind === 'papers' ? 'papers' : 'blog posts'} yet.</p>}
    <div className="space-y-3">{items.map(item => <div key={item.id} className="dashboard-card flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
      <div className="min-w-0 break-words">
        <Link to={kind === 'papers' ? `/papers/${item.id}` : `/blogs/${item.slug}`} className="font-medium text-link">{item.title}</Link>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.view_count} views · <span className="capitalize">{item.status}</span></p>
      </div>
      <div className="flex flex-wrap gap-3 shrink-0">
        <button className="text-link" disabled={busy !== null} onClick={() => setEditing(item)}>Edit</button>
        {kind === 'blogs' && item.status === 'draft' && <button className="text-link" disabled={busy !== null} onClick={() => publish(item.id)}>Publish draft</button>}
        <button className="text-sm text-red-700 dark:text-red-300" disabled={busy !== null} onClick={() => remove(item.id)}>Delete</button>
      </div>
    </div>)}</div>
    <Pagination page={page} pages={data?.pages || 1} onPageChange={setPage} />
  </div>;
}

function BookmarksTab() {
  const { items, loading, error, refresh } = useList('/users/bookmarks', 'bookmarks');
  if (loading) return <LoadingPage />;
  if (error) return <ListError error={error} refresh={refresh} />;
  return <div>
    <h2 className="text-xl mb-4">Bookmarked Papers</h2>
    {items.length === 0 && <p className="text-gray-600 dark:text-gray-300">No bookmarked papers.</p>}
    <div className="space-y-3">{items.map(paper => <Link key={paper.id} to={`/papers/${paper.id}`} className="dashboard-card block break-words">
      <p className="font-medium">{paper.title}</p><p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{paper.authors} · {paper.view_count} views</p>
    </Link>)}</div>
  </div>;
}

function EditProfileTab() {
  const { user, fetchUser } = useAuth();
  const fields = ['profile_name', 'bio', 'institution', 'department', 'website', 'google_scholar', 'linkedin', 'researchgate'];
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(field => [field, user[field] || ''])));
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, value));
      if (photo) data.append('profile_photo', photo);
      await api.put('/users/profile', data);
      await fetchUser();
      setSaved(true);
    } catch (failure) {
      setError(failure.response?.data?.message || 'Profile could not be saved. Try again.');
    } finally { setSaving(false); }
  };
  return <div className="max-w-2xl">
    <h2 className="text-xl mb-4">Edit Profile</h2>
    <Feedback message={error} />
    {saved && <p role="status" className="action-feedback mb-4">Profile updated.</p>}
    <form onSubmit={submit} className="space-y-4">
      {fields.map(field => <FormField key={field} label={field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}>
        {field === 'bio' ? <textarea className={inputClass} rows={4} value={form[field]} maxLength={5000} onChange={event => setForm({ ...form, [field]: event.target.value })} />
          : <input className={inputClass} type={['website', 'google_scholar', 'linkedin', 'researchgate'].includes(field) ? 'url' : 'text'}
            value={form[field]} maxLength={field === 'profile_name' ? 150 : 255} required={field === 'profile_name'} onChange={event => setForm({ ...form, [field]: event.target.value })} />}
      </FormField>)}
      <FormField label="Profile photo"><input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setPhoto(event.target.files[0] || null)} /></FormField>
      <p className="text-sm text-gray-600 dark:text-gray-300">Use a JPEG, PNG, or WebP image up to 5 MB. Uploaded photos appear on your public profile.</p>
      <button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
    </form>
  </div>;
}
