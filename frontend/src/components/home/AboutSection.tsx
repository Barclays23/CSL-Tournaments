import { ArrowUpRight, MapPin, Trophy, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { Avatar } from "@/components/ui/Avatar";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getOrganizers } from "@/services/organizerService";

const highlights = [
  {
    icon: Trophy,
    title: "The competition",
    description: "Follow the fixtures, match results and standings throughout the season.",
  },
  {
    icon: Users,
    title: "The community",
    description: "A place to celebrate the teams, players and people behind CSL.",
  },
];

export function AboutSection() {
  const organizers = useServiceQuery(() => getOrganizers({ limit: 8, status: "active" }), []);
  return (
    <section aria-labelledby="about-csl-heading" className="relative mt-12 overflow-hidden border-y border-line bg-glass">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <PageContainer className="relative py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              <MapPin className="h-3.5 w-3.5" />
              Cherukunnu, Kerala
            </div>
            <h2 id="about-csl-heading" className="max-w-xl font-display text-4xl leading-tight text-fg sm:text-5xl">
              More than a tournament. <span className="text-accent">A community.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted sm:text-base">
              CSL Cherukunnu brings the local football community together through the excitement of competition,
              teamwork and the love of the game. This platform keeps the season connected in one place — from
              teams and players to fixtures, results and standings.
            </p>
            <Link
              to="/matches"
              className="mt-7 inline-flex items-center gap-2 rounded-control bg-accent px-5 py-3 text-sm font-bold text-accent-fg transition hover:brightness-110"
            >
              Explore the fixtures
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {highlights.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4 rounded-card border border-line bg-surface/65 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-fg">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {organizers.data?.data.length ? (
          <section className="mt-10 border-t border-line pt-8" aria-labelledby="organizers-heading">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">The people behind CSL</p>
              <h3 id="organizers-heading" className="mt-1 font-display text-3xl text-fg">Tournament organizers</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {organizers.data.data.map((organizer) => (
                <div key={organizer._id} className="flex items-center gap-3 rounded-card border border-line bg-surface/65 p-4">
                  <Avatar name={organizer.name} asset={organizer.profilePic} className="h-12 w-12" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">{organizer.name}</p>
                    <p className="text-sm text-muted">{organizer.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </PageContainer>
    </section>
  );
}
