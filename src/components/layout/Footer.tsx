import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo className="footer-logo" />
            <p className="footer-intro">Electronics and everyday essentials for work, play and everything in between.</p>
          </div>
          <nav className="footer-nav" aria-label="Shop">
            <h2>Shop</h2>
            <ul>
              <li>
                <Link to="/shop">All products</Link>
              </li>
              <li>
                <Link to="/categories">Departments</Link>
              </li>
              <li>
                <Link to="/deals">Deals & offers</Link>
              </li>
              <li>
                <Link to="/about">About IntelliMart</Link>
              </li>
            </ul>
          </nav>
          <nav className="footer-nav" aria-label="Your account">
            <h2>Your account</h2>
            <ul>
              <li>
                <Link to="/account">My account</Link>
              </li>
              <li>
                <Link to="/account" hash="wishlist">
                  My wishlist
                </Link>
              </li>
              <li>
                <Link to="/cart">Shopping bag</Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} IntelliMart</p>
          <p>India · INR ₹</p>
        </div>
      </div>
    </footer>
  );
}
