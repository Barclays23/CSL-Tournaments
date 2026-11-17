import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Trophy } from "lucide-react";
import { CslMark } from "@/components/brand/CslMark";
import { NAV_ITEMS } from "@/components/layout/Navbar";
import { getSponsors } from "@/services/sponsorService";
import type { PublicSponsor } from "@/types/sponsor.types";

export function Footer() {
  const [sponsors, setSponsors] = useState<PublicSponsor[]>([]);
  const [sponsorsLoading, setSponsorsLoading] = useState(true);
  const [sponsorsFailed, setSponsorsFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getSponsors({ limit: 8 })
      .then((response) => {
        if (active) setSponsors(response.data.filter((sponsor) => sponsor.status === "active"));
      })
      .catch(() => {
        if (active) {
          setSponsors([]);
          setSponsorsFailed(true);
        }
      })
      .finally(() => {
        if (active) setSponsorsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const year = new Date().getFullYear();
  const quickLinks = NAV_ITEMS.filter((item) =>
    ["/", "/matches", "/standings", "/teams", "/players"].includes(item.to),
  );

  return (
    <footer className="mt-16 border-t border-line bg-glass">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.9fr_1.1fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <CslMark className="h-11 w-11" />
              <span className="font-display text-2xl tracking-wide text-fg">CSL Football</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
              The home of CSL Cherukunnu football — bringing teams, players, fixtures and season standings together.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted">
              <Trophy className="h-4 w-4 text-accent" />
              Community football. One tournament.
            </div>
          </div>

          <nav aria-label="Footer quick links">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Quick links</h2>
            <ul className="mt-4 space-y-3">
              {quickLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="inline-flex items-center gap-1 text-sm text-fg transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    {item.label}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Tournament</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link to="/matches" className="text-fg transition-colors hover:text-accent">Fixtures & results</Link></li>
              <li><Link to="/standings" className="text-fg transition-colors hover:text-accent">Season standings</Link></li>
              <li><Link to="/teams" className="text-fg transition-colors hover:text-accent">Participating teams</Link></li>
              <li><Link to="/players" className="text-fg transition-colors hover:text-accent">Player directory</Link></li>
            </ul>
          </div>

          <section aria-labelledby="footer-sponsors">
            <h2 id="footer-sponsors" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Our sponsors</h2>
            {sponsorsLoading ? (
              <p className="mt-4 text-sm text-muted" role="status">Loading sponsors…</p>
            ) : sponsorsFailed ? (
              <p className="mt-4 text-sm text-muted">Sponsor information is temporarily unavailable.</p>
            ) : sponsors.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Our sponsor community will be featured here.</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                {sponsors.map((sponsor) => (
                  <div key={sponsor._id} className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2" title={sponsor.name}>
                    {sponsor.logo ? (
                      <img src={sponsor.logo.url} alt={sponsor.name} loading="lazy" className="h-8 w-8 rounded-lg object-contain" />
                    ) : null}
                    <span className="max-w-28 text-xs font-medium text-fg">{sponsor.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} CSL Football Tournament. All rights reserved.</p>
          <p>Built for the CSL Cherukunnu football community.</p>
        </div>
      </div>
    </footer>
  );
}
