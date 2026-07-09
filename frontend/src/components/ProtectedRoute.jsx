import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  const cachedUser = (() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  })();

  const effectiveUser = user || cachedUser;

  if (loading && !effectiveUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!effectiveUser) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(effectiveUser.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
