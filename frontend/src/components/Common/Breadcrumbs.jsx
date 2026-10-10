import { Link } from 'react-router-dom';

export default function Breadcrumbs({ items }) {
  const safeItems = items || [];
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/">Home</Link>
      {safeItems.map((item, index) => (
        <span key={index}>
          <span aria-hidden="true">/</span>
          {item?.href ? (
            <Link to={item.href}>{item.label}</Link>
          ) : (
            <span aria-current={index === safeItems.length - 1 ? 'page' : undefined}>{item?.label ?? ''}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
