import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { LoadingPage } from '../components/Common/Loading';

export default function Profile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [papers, setPapers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [userRes, papersRes, blogsRes] = await Promise.all([
          api.get(`/users/${id}`),
          api.get(`/users/${id}/papers?per_page=50`),
          api.get(`/users/${id}/blogs?per_page=50`),
        ]);
        setProfile(userRes.data.user);
        setPapers(papersRes.data.papers || []);
        setBlogs(blogsRes.data.blogs || []);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  if (loading) return <LoadingPage />;
  if (!profile) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-500">
      User not found.
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
          <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-navy-600">
              {profile.profile_name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-navy-900">{profile.profile_name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-light text-accent capitalize">
                {profile.role}
              </span>
              {profile.institution && <span>{profile.institution}</span>}
              {profile.department && <span>&middot; {profile.department}</span>}
            </div>
            {profile.bio && (
              <p className="text-sm text-gray-600 mt-3">{profile.bio}</p>
            )}
            {/* Social links */}
            <div className="flex flex-wrap gap-3 mt-3">
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                  Website
                </a>
              )}
              {profile.google_scholar && (
                <a href={profile.google_scholar} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                  Google Scholar
                </a>
              )}
              {profile.linkedin && (
                <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                  LinkedIn
                </a>
              )}
              {profile.researchgate && (
                <a href={profile.researchgate} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                  ResearchGate
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Papers */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Published Papers ({papers.length})</h2>
        {papers.length === 0 ? (
          <p className="text-sm text-gray-400">No papers published yet.</p>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => (
              <Link
                key={paper.id}
                to={`/papers/${paper.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition"
              >
                <h3 className="font-medium text-navy-900">{paper.title}</h3>
                <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
                  <span>{paper.published_at?.slice(0, 10)}</span>
                  <span>{paper.view_count} views</span>
                  <span>{paper.download_count} downloads</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Blogs */}
      <div>
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Blog Posts ({blogs.length})</h2>
        {blogs.length === 0 ? (
          <p className="text-sm text-gray-400">No blog posts yet.</p>
        ) : (
          <div className="space-y-3">
            {blogs.map((blog) => (
              <Link
                key={blog.id}
                to={`/blogs/${blog.slug}`}
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition"
              >
                <h3 className="font-medium text-navy-900">{blog.title}</h3>
                <p className="text-xs text-gray-400 mt-1">
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
