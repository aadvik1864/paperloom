import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/auth';
import api from '../services/api';
import { LoadingPage } from '../components/Common/Loading';
import Breadcrumbs from '../components/Common/Breadcrumbs';
import ReactMarkdown from 'react-markdown';

export default function BlogDetails() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setBlog(null);
    setCommentText('');
    setFeedback(null);
    const fetchBlog = async () => {
      try {
        const res = await api.get(`/blogs/${slug}`, { signal: controller.signal });
        if (!controller.signal.aborted) setBlog(res.data.blog);
      } catch {
        if (!controller.signal.aborted) setBlog(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchBlog();
    return () => controller.abort();
  }, [slug]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await api.post(`/blogs/${blog.id}/comments`, { content: commentText });
      setBlog((prev) => prev?.id === blog.id ? ({
        ...prev,
        comments: [...(prev.comments || []), res.data?.comment].filter(Boolean),
      }) : prev);
      setCommentText('');
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Comment could not be posted. Try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/blogs/comments/${commentId}`);
      setBlog((prev) => prev?.id === blog.id ? ({
        ...prev,
        comments: prev.comments.filter((c) => c.id !== commentId),
      }) : prev);
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Comment could not be deleted. Try again.');
    }
  };

  if (loading) return <LoadingPage />;
  if (!blog) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-500 dark:text-gray-400">
      Blog not found.
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { href: '/browse?type=blogs', label: 'Blogs' },
        { label: blog.title.length > 50 ? blog.title.substring(0, 50) + '...' : blog.title },
      ]} />
      <article className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {blog.cover_image_url && (
          <img src={blog.cover_image_url} alt={blog.title} className="w-full h-64 md:h-80 object-cover" />
        )}
        <div className="p-6 md:p-8">
          {blog.category && (
            <span className="text-xs font-medium text-accent bg-accent-light px-2 py-1 rounded-full">
              {blog.category}
            </span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-navy-900 dark:text-white mt-3 mb-4 leading-snug">
            {blog.title}
          </h1>
          <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400 mb-6">
            <span>By {blog.author_name}</span>
            <span>&middot;</span>
            <span>{blog.published_at?.slice(0, 10)}</span>
            <span>&middot;</span>
            <span>{blog.view_count} views</span>
          </div>
          {blog.tags && (
            <div className="flex flex-wrap gap-2 mb-6">
              {blog.tags.split(',').map((tag) => (
                <span key={tag.trim()} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
          <div className="markdown-content max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
            <ReactMarkdown skipHtml components={{
              a: ({ href, children }) => <a href={href} rel="noopener noreferrer" className="text-link">{children}</a>,
              img: ({ src, alt }) => <img src={src} alt={alt || ''} loading="lazy" referrerPolicy="no-referrer" />,
            }}>{blog.content}</ReactMarkdown>
          </div>
        </div>
      </article>

      <section className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-6">
          Comments ({blog.comments?.length || 0})
        </h2>
        {feedback && <p role="alert" className="action-feedback action-feedback--error mb-4">{feedback}</p>}

        {user ? (
          <form onSubmit={handleComment} className="mb-8">
            <textarea
              aria-label="Comment"
              maxLength={5000}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none text-sm resize-none"
              rows={3}
              placeholder="Write a comment..."
              required
            />
            <button
              type="submit"
              disabled={sending || !commentText.trim()}
              className="mt-3 bg-accent text-white px-6 py-2 rounded-lg hover:bg-accent-hover transition font-medium text-sm disabled:opacity-50"
            >
              {sending ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center mb-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <Link to="/login" className="text-accent hover:underline">Sign in</Link> to leave a comment.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {(blog.comments || []).length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No comments yet.</p>
          )}
          {blog.comments?.map((comment) => (
            <div key={comment.id} className="flex space-x-3">
              <div className="w-8 h-8 bg-navy-100 dark:bg-navy-800 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-navy-600 dark:text-navy-300">
                  {comment.user_name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-navy-900 dark:text-white">{comment.user_name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{comment.content}</p>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{comment.created_at?.slice(0, 10)}</span>
                  {(user?.id === comment.user_id || user?.role === 'admin') && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
