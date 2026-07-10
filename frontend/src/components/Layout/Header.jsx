import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function Header() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AQ</span>
            </div>
            <span className="font-semibold text-lg text-navy-900 dark:text-white">Al-Qwal Publications</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white transition text-sm font-medium">
              Home
            </Link>
            <Link to="/about" className="text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white transition text-sm font-medium">
              About
            </Link>
            <Link to="/browse" className="text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white transition text-sm font-medium">
              Browse
            </Link>
            <Link to="/browse?type=blogs" className="text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white transition text-sm font-medium">
              Blogs
            </Link>
            {user ? (
              <>
                {(user.role === 'author' || user.role === 'admin') && (
                  <Link to="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white transition text-sm font-medium">
                    Dashboard
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link to="/admin" className="text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white transition text-sm font-medium">
                    Admin Panel
                  </Link>
                )}
                <div className="flex items-center space-x-3">
                  <Link to={`/profile/${user.id}`} className="text-sm text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white">
                    {user.profile_name}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-red-500 hover:text-red-700 transition"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition"
              >
                Sign In
              </Link>
            )}
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </nav>

          <div className="flex items-center space-x-2 md:hidden">
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <MobileMenu user={user} logout={handleLogout} />
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ user, logout }) {
  return (
    <div className="md:hidden">
      <details className="group">
        <summary className="flex items-center cursor-pointer list-none">
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </summary>
        <div className="absolute top-16 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg p-4 space-y-3">
          <Link to="/" className="block text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white text-sm font-medium">
            Home
          </Link>
          <Link to="/about" className="block text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white text-sm font-medium">
            About
          </Link>
          <Link to="/browse" className="block text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white text-sm font-medium">
            Browse
          </Link>
          <Link to="/browse?type=blogs" className="block text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white text-sm font-medium">
            Blogs
          </Link>
          {user ? (
            <>
              {(user.role === 'author' || user.role === 'admin') && (
                <Link to="/dashboard" className="block text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white text-sm font-medium">
                  Dashboard
                </Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className="block text-gray-600 dark:text-gray-300 hover:text-navy-900 dark:hover:text-white text-sm font-medium">
                  Admin Panel
                </Link>
              )}
              <Link to={`/profile/${user.id}`} className="block text-sm text-gray-600 dark:text-gray-300">
                {user.profile_name}
              </Link>
              <button onClick={logout} className="block text-sm text-red-500">
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="block text-sm font-medium bg-accent text-white px-4 py-2 rounded-lg text-center">
              Sign In
            </Link>
          )}
        </div>
      </details>
    </div>
  );
}
