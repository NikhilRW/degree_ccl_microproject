import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

const columns = [
  { title: "Shop", links: [{ to: "/shop", label: "All products" }, { to: "/categories", label: "Categories" }, { to: "/deals", label: "Deals" }] },
  { title: "Account", links: [{ to: "/account", label: "My account" }, { to: "/cart", label: "Cart" }, { to: "/login", label: "Sign in" }] },
  { title: "Company", links: [{ to: "/about", label: "About IntelliMart" }, { to: "/aws-learning", label: "AWS Implementation Lab" }] },
] as const;

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-surface/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Shop Smart. Learn AWS. Build the Cloud. A production-grade storefront built as a hands-on cloud engineering project.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-foreground/80 transition-smooth hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} IntelliMart. Educational project — no real transactions are processed.</p>
          <p className="font-mono">Backend status: integration pending</p>
        </div>
      </div>
    </footer>
  );
}
