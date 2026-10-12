import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { apiOrigin, sameOriginApi } from '../services/api';

export default function Login() {
  const [profileName, setProfileName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(profileName, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Welcome</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Sign in to your profile</p>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {!sameOriginApi ? (
            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <p>Profiles are available on the main Paperloom website. Sign in there to keep your session secure.</p>
              <a href={`${apiOrigin}/login`} className="block text-center rounded-lg bg-accent px-4 py-2.5 font-medium text-white">Continue to Paperloom</a>
            </div>
          ) : <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-profile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profile Name</label>
              <input
                id="login-profile"
                autoComplete="username"
                maxLength={150}
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none transition text-sm"
                placeholder="Enter your profile name"
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <input
                id="login-password"
                autoComplete="current-password"
                minLength={12}
                maxLength={72}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none transition text-sm"
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-white py-2.5 rounded-lg hover:bg-accent-hover transition font-medium text-sm disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>}
        </div>
      </div>
    </div>
  );
}
