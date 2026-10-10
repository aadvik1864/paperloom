import { Link } from 'react-router-dom';
import Icon from '../Common/Icon';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="page-container">
        <div className="footer-layout">
          <div className="footer-about">
            <Link to="/" className="brand">
              <span className="brand-mark"><Icon name="book" /></span>
              <span className="brand-wordmark">Paperloom<span>Publications</span></span>
            </Link>
            <p>A home for scholarly work and the people behind it. Discover, contribute, and keep the conversation going.</p>
          </div>
          <nav aria-label="Explore">
            <h2>Explore</h2>
            <Link to="/browse">Research papers</Link>
            <Link to="/browse?type=blogs">Community blogs</Link>
            <Link to="/about">About Paperloom</Link>
          </nav>
          <nav aria-label="For contributors">
            <h2>For contributors</h2>
            <Link to="/login">Author sign in</Link>
            <Link to="/dashboard">Your dashboard</Link>
            <p>New to publishing here? Your administrator can help you get access.</p>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Paperloom. All rights reserved.</p>
          <span>Made for the exchange of ideas.</span>
        </div>
      </div>
    </footer>
  );
}
