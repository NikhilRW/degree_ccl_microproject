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
<<<<<<< HEAD
    <header className="site-header">
      <div className="site-container nav-main">
=======
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-smooth",
        scrolled
          ? "border-border bg-background/85 shadow-soft backdrop-blur-xl"
          : "border-transparent bg-background",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
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
<<<<<<< HEAD
=======

>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
<<<<<<< HEAD
            aria-label="My account"
=======
            aria-label="Account"
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
          >
            <Link to={user ? "/account" : "/login"}>
              <User strokeWidth={1.5} aria-hidden />
            </Link>
          </Button>
<<<<<<< HEAD
=======

>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
          <Button
            asChild
            variant="ghost"
            size="icon"
<<<<<<< HEAD
            className="hidden sm:inline-flex"
            aria-label={`Wishlist, ${wishlist.items.length} saved products`}
=======
            className="relative hidden sm:inline-flex"
            aria-label="Wishlist"
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
          >
            <Link to="/account" hash="wishlist">
              <Heart strokeWidth={1.5} aria-hidden />
            </Link>
          </Button>
<<<<<<< HEAD
          <Button
            variant="ghost"
            className="gap-2 px-2"
            aria-label={`Open shopping bag, ${count} items`}
            onClick={() => setDrawerOpen(true)}
          >
            <ShoppingBag strokeWidth={1.5} aria-hidden />
            <span className="cart-counter">({count})</span>
=======

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Cart, ${count} items`}
            onClick={() => setDrawerOpen(true)}
          >
            <ShoppingBag aria-hidden />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
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
<<<<<<< HEAD
                <Link
                  to={user ? "/account" : "/login"}
                  onClick={() => setMobileOpen(false)}
                  className="mt-6 py-3 text-base"
=======
                <div className="my-2 h-px bg-border" />
                <Link
                  to={user ? "/account" : "/login"}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface"
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
                >
                  {user ? "My account" : "Sign in"}
                </Link>
                <Link
<<<<<<< HEAD
                  to="/account"
                  hash="wishlist"
                  onClick={() => setMobileOpen(false)}
                  className="py-3 text-base"
                >
                  Wishlist ({wishlist.items.length})
                </Link>
                <Link to="/cart" onClick={() => setMobileOpen(false)} className="py-3 text-base">
                  Shopping bag ({count})
=======
                  to="/cart"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface"
                >
                  Cart ({count})
                </Link>
                <Link
                  to="/aws-learning"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-primary hover:bg-surface"
                >
                  AWS Implementation Lab
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
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
