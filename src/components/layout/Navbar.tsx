import { Link } from "@tanstack/react-router";
import { Heart, Menu, Search, ShoppingBag, User } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SearchBar } from "./SearchBar";
import { Logo } from "./Logo";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";

const links = [
  { to: "/shop", label: "Shop all" },
  { to: "/categories", label: "Departments" },
  { to: "/deals", label: "The good deals" },
  { to: "/about", label: "Our store" },
] as const;

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const { count, setDrawerOpen } = useCart();
  const { user } = useAuth();
  const wishlist = useWishlist();

  return (
    <header className="site-header">
      <div className="site-container nav-main">
        <Logo />
        <nav aria-label="Main" className="nav-links">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="nav-search">
          <SearchBar />
        </div>
        <div className="nav-actions">
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            aria-label="Search products"
            aria-expanded={mobileSearch}
            aria-controls="mobile-search"
            onClick={() => setMobileSearch(!mobileSearch)}
          >
            <Search strokeWidth={1.5} aria-hidden />
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
            aria-label="My account"
          >
            <Link to={user ? "/account" : "/login"}>
              <User strokeWidth={1.5} aria-hidden />
            </Link>
          </Button>

          <Button
            variant="ghost"
            className="gap-2 px-2"
            aria-label={`Open shopping bag, ${count} items`}
            onClick={() => setDrawerOpen(true)}
          >
            <ShoppingBag strokeWidth={1.5} aria-hidden />
            <span className="cart-counter">({count})</span>
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-[1100px]:hidden"
                aria-label="Open menu"
              >
                <Menu strokeWidth={1.5} aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 max-w-[90vw]">
              <SheetHeader>
                <SheetTitle>Explore IntelliMart</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-2 px-6 pb-8">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 text-xl tracking-tight hover:underline"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to={user ? "/account" : "/login"}
                  onClick={() => setMobileOpen(false)}
                  className="mt-6 py-3 text-base"
                >
                  {user ? "My account" : "Sign in"}
                </Link>
                <Link
                  to="/account"
                  hash="wishlist"
                  onClick={() => setMobileOpen(false)}
                  className="py-3 text-base"
                >
                  Wishlist ({wishlist.items.length})
                </Link>
                <Link to="/cart" onClick={() => setMobileOpen(false)} className="py-3 text-base">
                  Shopping bag ({count})
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {mobileSearch && (
        <div id="mobile-search" className="site-container pb-5 sm:hidden">
          <SearchBar autoFocus />
        </div>
      )}
    </header>
  );
}
