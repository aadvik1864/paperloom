import { useEffect, useState } from 'react';
import api from '../../services/api';
import FormField, { inputClass } from '../Common/FormField';

export function Feedback({ message }) {
  return message ? <p role="alert" className="action-feedback action-feedback--error mb-4">{message}</p> : null;
}

export function PaperForm({ paper, onSaved, onCancel }) {
  const [categories, setCategories] = useState([]);
  const [extensions, setExtensions] = useState(['.pdf']);
  const [form, setForm] = useState(() => Object.fromEntries(
    ['title', 'abstract', 'authors', 'keywords', 'institution', 'department', 'category_id'].map(key => [key, paper?.[key] || ''])
  ));
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/papers/categories', { signal: controller.signal }).then(res => setCategories(res.data.categories || []))
      .catch(() => { if (!controller.signal.aborted) setError('Categories could not load. Reopen this form to try again.'); });
    api.get('/papers/capabilities', { signal: controller.signal }).then(res => {
      if (!controller.signal.aborted) setExtensions(res.data.extensions || ['.pdf']);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const setField = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, value));
      if (file) data.append('file', file);
      if (paper) await api.put(`/papers/${paper.id}`, data);
      else await api.post('/papers', data);
      onSaved();
    } catch (failure) {
      setError(failure.response?.data?.message || 'Paper could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };
  return <div className="max-w-2xl">
    <h2 className="text-xl mb-4">{paper ? 'Edit Paper' : 'Upload Research Paper'}</h2>
    <Feedback message={error} />
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Title *"><input className={inputClass} value={form.title} onChange={setField('title')} maxLength={255} required /></FormField>
      <FormField label="Abstract *"><textarea className={inputClass} rows={5} value={form.abstract} onChange={setField('abstract')} maxLength={100000} required /></FormField>
      <FormField label="Authors *"><input className={inputClass} value={form.authors} onChange={setField('authors')} maxLength={5000} required /></FormField>
      <FormField label="Category *"><select className={inputClass} value={form.category_id} onChange={setField('category_id')} required>
        <option value="">Select category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select></FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {['keywords', 'institution', 'department'].map(key => <FormField key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
          <input className={inputClass} value={form[key]} onChange={setField(key)} maxLength={255} />
        </FormField>)}
      </div>
      <FormField label={paper ? 'Replace file (optional)' : 'Document *'}>
        <input className={inputClass} type="file" accept={extensions.join(',')} required={!paper} onChange={event => setFile(event.target.files[0] || null)} />
      </FormField>
      <p className="text-sm text-gray-600 dark:text-gray-300">Maximum 20 MB. {extensions.length > 1 ? 'PDF, DOCX, DOC, ODT, and RTF are supported.' : 'Upload a PDF. Secure Office conversion is unavailable on this host.'}</p>
      <div className="flex flex-wrap gap-3">
        <button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : paper ? 'Save Paper' : 'Publish Paper'}</button>
        {onCancel && <button type="button" className="button button--secondary" onClick={onCancel} disabled={saving}>Cancel</button>}
      </div>
    </form>
  </div>;
}

export function BlogForm({ blog, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({
    title: blog?.title || '', content: blog?.content || '', category: blog?.category || '', tags: blog?.tags || '',
    cover_image_url: blog?.cover_image_url || '', status: blog?.status || 'published',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const setField = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }));
  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (blog) await api.put(`/blogs/${blog.id}`, form);
      else await api.post('/blogs', form);
      onSaved();
    } catch (failure) {
      setError(failure.response?.data?.message || 'Blog could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };
  return <div className="max-w-3xl">
    <h2 className="text-xl mb-4">{blog ? 'Edit Blog Post' : 'Write Blog Post'}</h2>
    <Feedback message={error} />
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Title *"><input className={inputClass} value={form.title} onChange={setField('title')} maxLength={255} required /></FormField>
      <FormField label="Content (Markdown) *"><textarea className={`${inputClass} font-mono`} rows={12} value={form.content} onChange={setField('content')} maxLength={100000} required /></FormField>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Category"><input className={inputClass} value={form.category} onChange={setField('category')} maxLength={100} /></FormField>
        <FormField label="Tags (comma-separated)"><input className={inputClass} value={form.tags} onChange={setField('tags')} maxLength={255} /></FormField>
        <FormField label="Status"><select className={inputClass} value={form.status} onChange={setField('status')}>
          <option value="published">Published</option><option value="draft">Draft</option>
          {blog?.status === 'removed' && <option value="removed">Removed</option>}
        </select></FormField>
      </div>
      <FormField label="Cover Image URL"><input type="url" className={inputClass} value={form.cover_image_url} onChange={setField('cover_image_url')} maxLength={2048} /></FormField>
      <div className="flex flex-wrap gap-3">
        <button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : form.status === 'draft' ? 'Save Draft' : blog ? 'Save Blog' : 'Publish Blog'}</button>
        {onCancel && <button type="button" className="button button--secondary" onClick={onCancel} disabled={saving}>Cancel</button>}
      </div>
    </form>
  </div>;
}
