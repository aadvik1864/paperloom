import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { LoadingPage } from '../components/Common/Loading';

const SOCIAL_LINKS = [
  ['website', 'Website'],
  ['google_scholar', 'Google Scholar'],
  ['linkedin', 'LinkedIn'],
  ['researchgate', 'ResearchGate'],
];

export default function Profile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [papers, setPapers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setProfile(null);
    setPapers([]);
    setBlogs([]);
    const fetchProfile = async () => {
      try {
        const [userRes, papersRes, blogsRes] = await Promise.all([
          api.get(`/users/${id}`, { signal: controller.signal }),
          api.get(`/users/${id}/papers?per_page=50`, { signal: controller.signal }),
          api.get(`/users/${id}/blogs?per_page=50`, { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setProfile(userRes.data.user);
        setPapers(papersRes.data.papers || []);
        setBlogs(blogsRes.data.blogs || []);
      } catch {
        if (!controller.signal.aborted) setProfile(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchProfile();
    return () => controller.abort();
  }, [id]);

  if (loading) return <LoadingPage />;
  if (!profile) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-500 dark:text-gray-400">
      User not found.
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
          <div className="w-20 h-20 bg-navy-100 dark:bg-navy-800 rounded-full flex items-center justify-center flex-shrink-0">
            {profile.profile_photo_url ? <img src={`${api.defaults.baseURL}/users/${profile.id}/avatar`} alt="" className="w-20 h-20 rounded-full object-cover" /> : <span className="text-2xl font-bold text-navy-600 dark:text-navy-300">
              {profile.profile_name?.charAt(0).toUpperCase()}
            </span>}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-navy-900 dark:text-white">{profile.profile_name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-light text-accent capitalize">
                {profile.role}
              </span>
              {profile.institution && <span>{profile.institution}</span>}
              {profile.department && <span>&middot; {profile.department}</span>}
            </div>
            {profile.bio && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">{profile.bio}</p>
            )}
            <div className="flex flex-wrap gap-3 mt-3">
              {SOCIAL_LINKS.map(([field, label]) => profile[field] && (
                <a key={field} href={profile[field]} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">Published Papers ({papers.length})</h2>
        {papers.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No papers published yet.</p>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => (
              <Link
                key={paper.id}
                to={`/papers/${paper.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition"
              >
                <h3 className="font-medium text-navy-900 dark:text-white">{paper.title}</h3>
                <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400 dark:text-gray-500">
                  <span>{paper.published_at?.slice(0, 10)}</span>
                  <span>{paper.view_count} views</span>
                  <span>{paper.download_count} downloads</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">Blog Posts ({blogs.length})</h2>
        {blogs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No blog posts yet.</p>
        ) : (
          <div className="space-y-3">
            {blogs.map((blog) => (
              <Link
                key={blog.id}
                to={`/blogs/${blog.slug}`}
                className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition"
              >
                <h3 className="font-medium text-navy-900 dark:text-white">{blog.title}</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {blog.published_at?.slice(0, 10)} &middot; {blog.view_count} views
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
