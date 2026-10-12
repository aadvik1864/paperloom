import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { useTheme } from '../../context/theme';
import Icon from '../Common/Icon';

export default function Header() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const headerRef = useRef(null);
  const isBlogs = new URLSearchParams(search).get('type') === 'blogs';
  const canPublish = user && ['author', 'admin'].includes(user.role);
  const links = [
    { to: '/browse', label: 'Papers', active: (pathname === '/browse' && !isBlogs) || pathname.startsWith('/papers/') },
    { to: '/browse?type=blogs', label: 'Blogs', active: (pathname === '/browse' && isBlogs) || pathname.startsWith('/blogs/') },
    { to: '/about', label: 'About', active: pathname === '/about' },
    ...(canPublish ? [{ to: '/dashboard', label: 'Dashboard', active: pathname.startsWith('/dashboard') }] : []),
    ...(user && !canPublish ? [{ to: '/dashboard', label: 'Bookmarks', active: pathname.startsWith('/dashboard') }] : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin', active: pathname.startsWith('/admin') }] : []),
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    const onPointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="site-header" ref={headerRef}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="page-container site-header__inner">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)} aria-label="Paperloom home">
          <span className="brand-mark"><Icon name="book" /></span>
          <span className="brand-wordmark">Paperloom<span>Publications</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className={`nav-link ${link.active ? 'nav-link--active' : ''}`} aria-current={link.active ? 'page' : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button onClick={toggle} className="icon-button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>
          {user ? (
            <div className="desktop-account">
              <Link to={`/profile/${user.id}`} className="profile-link" title={user.profile_name}>{user.profile_name}</Link>
              <button onClick={handleLogout} className="signout-button">Sign out</button>
            </div>
          ) : (
            <Link to="/login" className="button button--primary header-signin">Sign in<Icon name="arrow" /></Link>
          )}
          <button ref={menuButton} onClick={() => setMenuOpen((open) => !open)} className="icon-button mobile-menu-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation">
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile navigation">
          <div className="page-container">
            {links.map((link) => (
              <Link key={link.to} to={link.to} className={`nav-link ${link.active ? 'nav-link--active' : ''}`} aria-current={link.active ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            {user && (
              <div className="mobile-account">
                <Link to={`/profile/${user.id}`} onClick={() => setMenuOpen(false)}>{user.profile_name}</Link>
                <button onClick={handleLogout}>Sign out</button>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
