import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Trophy } from "lucide-react";
import { CslMark } from "@/components/brand/CslMark";
import { NAV_ITEMS } from "@/components/layout/UserNavbar";

export function Footer() {
  const year = new Date().getFullYear();
  return <footer className="mt-16 border-t border-line bg-glass">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.9fr]">
        <div><Link to="/" className="inline-flex items-center gap-3 rounded-xl"><CslMark className="h-11 w-11" /><span className="font-display text-2xl tracking-wide text-fg">CSL Football</span></Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">The home of CSL Cherukunnu football — bringing fixtures, results, news and season standings together.</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted"><Trophy className="h-4 w-4 text-accent" />Community football. One tournament.</div>
        </div>
        <nav aria-label="Footer quick links"><h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Explore CSL</h2><ul className="mt-4 space-y-3">{NAV_ITEMS.map((item)=><li key={item.label}><Link to={item.to} hash={"hash" in item ? item.hash : undefined} className="inline-flex items-center gap-1 text-sm text-fg transition-colors hover:text-accent">{item.label}<ArrowUpRight className="h-3.5 w-3.5" /></Link></li>)}</ul></nav>
        <div><h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Tournament</h2><ul className="mt-4 space-y-3 text-sm"><li><Link to="/matches" className="text-fg hover:text-accent">Fixtures & results</Link></li><li><Link to="/standings" className="text-fg hover:text-accent">Season standings</Link></li><li><Link to="/news" className="text-fg hover:text-accent">Latest news</Link></li><li><Link to="/" hash="active-sponsors" className="text-fg hover:text-accent">Our sponsors</Link></li></ul></div>
      </div>
      <div className="mt-10 flex flex-col gap-3 border-t border-line pt-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between"><p>© {year} CSL Football Tournament. All rights reserved.</p><p>Built for the CSL Cherukunnu football community.</p></div>
    </div>
  </footer>;
}
