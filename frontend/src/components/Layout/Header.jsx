import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AQ</span>
            </div>
            <span className="font-semibold text-lg text-navy-900">Al-Qwal Publications</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-gray-600 hover:text-navy-900 transition text-sm font-medium">
              Home
            </Link>
            <Link to="/about" className="text-gray-600 hover:text-navy-900 transition text-sm font-medium">
              About
            </Link>
            <Link to="/browse" className="text-gray-600 hover:text-navy-900 transition text-sm font-medium">
              Browse
            </Link>
            <Link to="/browse?type=blogs" className="text-gray-600 hover:text-navy-900 transition text-sm font-medium">
              Blogs
            </Link>
            {user ? (
              <>
                {(user.role === 'author' || user.role === 'admin') && (
                  <Link to="/dashboard" className="text-gray-600 hover:text-navy-900 transition text-sm font-medium">
                    Dashboard
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link to="/admin" className="text-gray-600 hover:text-navy-900 transition text-sm font-medium">
                    Admin Panel
                  </Link>
                )}
                <div className="flex items-center space-x-3">
                  <Link to={`/profile/${user.id}`} className="text-sm text-gray-600 hover:text-navy-900">
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
          </nav>

          {/* Mobile menu toggle */}
          <MobileMenu user={user} logout={handleLogout} />
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
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </summary>
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg p-4 space-y-3">
          <Link to="/" className="block text-gray-600 hover:text-navy-900 text-sm font-medium">
            Home
          </Link>
          <Link to="/about" className="block text-gray-600 hover:text-navy-900 text-sm font-medium">
            About
          </Link>
          <Link to="/browse" className="block text-gray-600 hover:text-navy-900 text-sm font-medium">
            Browse
          </Link>
          <Link to="/browse?type=blogs" className="block text-gray-600 hover:text-navy-900 text-sm font-medium">
            Blogs
          </Link>
          {user ? (
            <>
              {(user.role === 'author' || user.role === 'admin') && (
                <Link to="/dashboard" className="block text-gray-600 hover:text-navy-900 text-sm font-medium">
                  Dashboard
                </Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className="block text-gray-600 hover:text-navy-900 text-sm font-medium">
                  Admin Panel
                </Link>
              )}
              <Link to={`/profile/${user.id}`} className="block text-sm text-gray-600">
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
