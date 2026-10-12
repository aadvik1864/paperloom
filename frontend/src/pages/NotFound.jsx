import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page-container py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-4xl mb-4">Page not found</h1>
      <p className="mb-6">This page may have moved or no longer exists.</p>
      <Link to="/browse" className="button button--primary">Browse papers</Link>
    </div>
  );
}
