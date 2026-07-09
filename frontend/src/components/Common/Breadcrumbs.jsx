import { Link } from 'react-router-dom';

export default function Breadcrumbs({ items }) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-400 mb-6">
      <Link to="/" className="hover:text-accent transition">Home</Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center space-x-2">
          <span>/</span>
          {item.href ? (
            <Link to={item.href} className="hover:text-accent transition">{item.label}</Link>
          ) : (
            <span className="text-gray-600 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
