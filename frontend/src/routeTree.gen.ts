/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// Generated TanStack Router route tree with public and administrator layouts.

import { createRoute } from '@tanstack/react-router'
import { Route as rootRouteImport } from './routes/__root'
import { UserLayout } from './components/layout/UserLayout'
import { AdminRouteLayout } from './components/layout/AdminRouteLayout'
import { Route as IndexRouteImport } from './routes/index'
import { Route as LoginRouteImport } from './routes/login'
import { Route as NewsIndexRouteImport } from './routes/news/index'
import { Route as NewsSlugRouteImport } from './routes/news/$slug'
import { Route as AdminDashboardRouteImport } from './routes/admin/dashboard'
import { Route as AdminLoginRouteImport } from './routes/admin/login'
import { Route as AdminSettingsRouteImport } from './routes/admin/settings'
import { Route as AdminAuctionsRouteImport } from './routes/admin/auctions'
import { Route as AdminManagersRouteImport } from './routes/admin/managers'
import { Route as AdminMatchesIndexRouteImport } from './routes/admin/matches/index'
import { Route as AdminMatchesMatchIdRouteImport } from './routes/admin/matches/$matchId'
import { Route as AdminNewsRouteImport } from './routes/admin/news'
import { Route as AdminOrganizersRouteImport } from './routes/admin/organizers'
import { Route as AdminPlayersIndexRouteImport } from './routes/admin/players/index'
import { Route as AdminPlayersPlayerIdRouteImport } from './routes/admin/players/$playerId'
import { Route as AdminSeasonsIndexRouteImport } from './routes/admin/seasons/index'
import { Route as AdminSeasonsSeasonIdRouteImport } from './routes/admin/seasons/$seasonId'
import { Route as AdminSponsorsRouteImport } from './routes/admin/sponsors'
import { Route as AdminUsersRouteImport } from './routes/admin/users'
import { Route as AdminTeamsIndexRouteImport } from './routes/admin/teams/index'
import { Route as AdminTeamsTeamIdRouteImport } from './routes/admin/teams/$teamId'
import { Route as AdminVenuesRouteImport } from './routes/admin/venues'
import { Route as LogoutRouteImport } from './routes/logout'
import { Route as MatchesIndexRouteImport } from './routes/matches/index'
import { Route as MatchesMatchIdRouteImport } from './routes/matches/$matchId'
import { Route as StandingsIndexRouteImport } from './routes/standings/index'

const UserLayoutRoute = createRoute({
  getParentRoute: () => rootRouteImport,
  id: '/_user',
  component: UserLayout,
})
const AdminLayoutRoute = createRoute({
  getParentRoute: () => rootRouteImport,
  id: '/_admin',
  component: AdminRouteLayout,
})

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => UserLayoutRoute } as any)
const LoginRoute = LoginRouteImport.update({ id: '/login', path: '/login', getParentRoute: () => UserLayoutRoute } as any)
const NewsIndexRoute = NewsIndexRouteImport.update({ id: '/news/', path: '/news/', getParentRoute: () => UserLayoutRoute } as any)
const NewsSlugRoute = NewsSlugRouteImport.update({ id: '/news/$slug', path: '/news/$slug', getParentRoute: () => UserLayoutRoute } as any)
const AdminLoginRoute = AdminLoginRouteImport.update({ id: '/admin/login', path: '/admin/login', getParentRoute: () => UserLayoutRoute } as any)
const MatchesIndexRoute = MatchesIndexRouteImport.update({ id: '/matches/', path: '/matches/', getParentRoute: () => UserLayoutRoute } as any)
const MatchesMatchIdRoute = MatchesMatchIdRouteImport.update({ id: '/matches/$matchId', path: '/matches/$matchId', getParentRoute: () => UserLayoutRoute } as any)
const StandingsIndexRoute = StandingsIndexRouteImport.update({ id: '/standings/', path: '/standings/', getParentRoute: () => UserLayoutRoute } as any)

const AdminDashboardRoute = AdminDashboardRouteImport.update({ id: '/admin/dashboard', path: '/admin/dashboard', getParentRoute: () => AdminLayoutRoute } as any)
const AdminAuctionsRoute = AdminAuctionsRouteImport.update({ id: '/admin/auctions', path: '/admin/auctions', getParentRoute: () => AdminLayoutRoute } as any)
const AdminManagersRoute = AdminManagersRouteImport.update({ id: '/admin/managers', path: '/admin/managers', getParentRoute: () => AdminLayoutRoute } as any)
const AdminMatchesIndexRoute = AdminMatchesIndexRouteImport.update({ id: '/admin/matches/', path: '/admin/matches/', getParentRoute: () => AdminLayoutRoute } as any)
const AdminMatchesMatchIdRoute = AdminMatchesMatchIdRouteImport.update({ id: '/admin/matches/$matchId', path: '/admin/matches/$matchId', getParentRoute: () => AdminLayoutRoute } as any)
const AdminNewsRoute = AdminNewsRouteImport.update({ id: '/admin/news', path: '/admin/news', getParentRoute: () => AdminLayoutRoute } as any)
const AdminOrganizersRoute = AdminOrganizersRouteImport.update({ id: '/admin/organizers', path: '/admin/organizers', getParentRoute: () => AdminLayoutRoute } as any)
const AdminPlayersIndexRoute = AdminPlayersIndexRouteImport.update({ id: '/admin/players/', path: '/admin/players/', getParentRoute: () => AdminLayoutRoute } as any)
const AdminPlayersPlayerIdRoute = AdminPlayersPlayerIdRouteImport.update({ id: '/admin/players/$playerId', path: '/admin/players/$playerId', getParentRoute: () => AdminLayoutRoute } as any)
const AdminSeasonsIndexRoute = AdminSeasonsIndexRouteImport.update({ id: '/admin/seasons/', path: '/admin/seasons/', getParentRoute: () => AdminLayoutRoute } as any)
const AdminSeasonsSeasonIdRoute = AdminSeasonsSeasonIdRouteImport.update({ id: '/admin/seasons/$seasonId', path: '/admin/seasons/$seasonId', getParentRoute: () => AdminLayoutRoute } as any)
const AdminSponsorsRoute = AdminSponsorsRouteImport.update({ id: '/admin/sponsors', path: '/admin/sponsors', getParentRoute: () => AdminLayoutRoute } as any)
const AdminUsersRoute = AdminUsersRouteImport.update({ id: '/admin/users', path: '/admin/users', getParentRoute: () => AdminLayoutRoute } as any)
const AdminTeamsIndexRoute = AdminTeamsIndexRouteImport.update({ id: '/admin/teams/', path: '/admin/teams/', getParentRoute: () => AdminLayoutRoute } as any)
const AdminTeamsTeamIdRoute = AdminTeamsTeamIdRouteImport.update({ id: '/admin/teams/$teamId', path: '/admin/teams/$teamId', getParentRoute: () => AdminLayoutRoute } as any)
const AdminVenuesRoute = AdminVenuesRouteImport.update({ id: '/admin/venues', path: '/admin/venues', getParentRoute: () => AdminLayoutRoute } as any)
const AdminSettingsRoute = AdminSettingsRouteImport.update({ id: '/admin/settings', path: '/admin/settings', getParentRoute: () => AdminLayoutRoute } as any)
const LogoutRoute = LogoutRouteImport.update({ id: '/logout', path: '/logout', getParentRoute: () => UserLayoutRoute } as any)

  '/login': typeof LoginRoute
  '/news/': typeof NewsIndexRoute
  '/news/$slug': typeof NewsSlugRoute
export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/admin/login': typeof AdminLoginRoute
  '/matches/': typeof MatchesIndexRoute
  '/matches/$matchId': typeof MatchesMatchIdRoute
  '/standings/': typeof StandingsIndexRoute
  '/admin/dashboard': typeof AdminDashboardRoute
  '/admin/auctions': typeof AdminAuctionsRoute
  '/admin/managers': typeof AdminManagersRoute
  '/admin/matches/': typeof AdminMatchesIndexRoute
  '/admin/matches/$matchId': typeof AdminMatchesMatchIdRoute
  '/admin/news': typeof AdminNewsRoute
  '/admin/organizers': typeof AdminOrganizersRoute
  '/admin/players/': typeof AdminPlayersIndexRoute
  '/admin/players/$playerId': typeof AdminPlayersPlayerIdRoute
  '/admin/seasons/': typeof AdminSeasonsIndexRoute
  '/admin/seasons/$seasonId': typeof AdminSeasonsSeasonIdRoute
  '/admin/sponsors': typeof AdminSponsorsRoute
  '/admin/users': typeof AdminUsersRoute
  '/admin/teams/': typeof AdminTeamsIndexRoute
  '/admin/teams/$teamId': typeof AdminTeamsTeamIdRoute
  '/admin/venues': typeof AdminVenuesRoute
  '/admin/settings': typeof AdminSettingsRoute
  '/logout': typeof LogoutRoute
}

  '/login': typeof LoginRoute
  '/news': typeof NewsIndexRoute
  '/news/$slug': typeof NewsSlugRoute
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/admin/login': typeof AdminLoginRoute
  '/matches': typeof MatchesIndexRoute
  '/matches/$matchId': typeof MatchesMatchIdRoute
  '/standings': typeof StandingsIndexRoute
  '/admin/dashboard': typeof AdminDashboardRoute
  '/admin/auctions': typeof AdminAuctionsRoute
  '/admin/managers': typeof AdminManagersRoute
  '/admin/matches': typeof AdminMatchesIndexRoute
  '/admin/matches/$matchId': typeof AdminMatchesMatchIdRoute
  '/admin/news': typeof AdminNewsRoute
  '/admin/organizers': typeof AdminOrganizersRoute
  '/admin/players': typeof AdminPlayersIndexRoute
  '/admin/players/$playerId': typeof AdminPlayersPlayerIdRoute
  '/admin/seasons': typeof AdminSeasonsIndexRoute
  '/admin/seasons/$seasonId': typeof AdminSeasonsSeasonIdRoute
  '/admin/sponsors': typeof AdminSponsorsRoute
  '/admin/users': typeof AdminUsersRoute
  '/admin/teams': typeof AdminTeamsIndexRoute
  '/admin/teams/$teamId': typeof AdminTeamsTeamIdRoute
  '/admin/venues': typeof AdminVenuesRoute
  '/admin/settings': typeof AdminSettingsRoute
  '/logout': typeof LogoutRoute
}

  '/login': typeof LoginRoute
  '/news/': typeof NewsIndexRoute
  '/news/$slug': typeof NewsSlugRoute
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/_user': typeof UserLayoutRoute
  '/_admin': typeof AdminLayoutRoute
  '/': typeof IndexRoute
  '/admin/login': typeof AdminLoginRoute
  '/matches/': typeof MatchesIndexRoute
  '/matches/$matchId': typeof MatchesMatchIdRoute
  '/standings/': typeof StandingsIndexRoute
  '/admin/dashboard': typeof AdminDashboardRoute
  '/admin/auctions': typeof AdminAuctionsRoute
  '/admin/managers': typeof AdminManagersRoute
  '/admin/matches/': typeof AdminMatchesIndexRoute
  '/admin/news': typeof AdminNewsRoute
  '/admin/organizers': typeof AdminOrganizersRoute
  '/admin/players/': typeof AdminPlayersIndexRoute
  '/admin/players/$playerId': typeof AdminPlayersPlayerIdRoute
  '/admin/seasons/': typeof AdminSeasonsIndexRoute
  '/admin/seasons/$seasonId': typeof AdminSeasonsSeasonIdRoute
  '/admin/sponsors': typeof AdminSponsorsRoute
  '/admin/users': typeof AdminUsersRoute
  '/admin/teams/': typeof AdminTeamsIndexRoute
  '/admin/teams/$teamId': typeof AdminTeamsTeamIdRoute
  '/admin/venues': typeof AdminVenuesRoute
  '/admin/settings': typeof AdminSettingsRoute
  '/logout': typeof LogoutRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
    | '/login'
    | '/news/'
    | '/news/$slug'
  fullPaths:
    | '/'
    | '/admin/login'
    | '/matches/'
    | '/matches/$matchId'
    | '/standings/'
    | '/admin/dashboard'
    | '/admin/auctions'
    | '/admin/managers'
    | '/admin/matches/'
    | '/admin/matches/$matchId'
    | '/admin/news'
    | '/admin/organizers'
    | '/admin/players/'
    | '/admin/players/$playerId'
    | '/admin/seasons/'
    | '/admin/seasons/$seasonId'
    | '/admin/sponsors'
    | '/admin/users'
    | '/admin/teams/'
    | '/admin/teams/$teamId'
    | '/admin/venues'
    | '/admin/settings'
    | '/logout'
  fileRoutesByTo: FileRoutesByTo
    | '/login'
    | '/news'
    | '/news/$slug'
  to:
    | '/'
    | '/admin/login'
    | '/matches'
    | '/matches/$matchId'
    | '/standings'
    | '/admin/dashboard'
    | '/admin/auctions'
    | '/admin/managers'
    | '/admin/matches'
    | '/admin/matches/$matchId'
    | '/admin/news'
    | '/admin/organizers'
    | '/admin/players'
    | '/admin/players/$playerId'
    | '/admin/seasons'
    | '/admin/seasons/$seasonId'
    | '/admin/sponsors'
    | '/admin/users'
    | '/admin/teams'
    | '/admin/teams/$teamId'
    | '/admin/venues'
    | '/admin/settings'
    | '/logout'
    | '/login'
    | '/news/'
    | '/news/$slug'
  id:
    | '__root__'
    | '/_user'
    | '/_admin'
    | '/'
    | '/admin/login'
    | '/matches/'
    | '/matches/$matchId'
    | '/standings/'
    | '/admin/dashboard'
    | '/admin/auctions'
    | '/admin/managers'
    | '/admin/matches/'
    | '/admin/news'
    | '/admin/organizers'
    | '/admin/players/'
    | '/admin/players/$playerId'
    | '/admin/seasons/'
    | '/admin/seasons/$seasonId'
    | '/admin/sponsors'
    | '/admin/users'
    | '/admin/teams/'
    | '/admin/teams/$teamId'
    | '/admin/venues'
    | '/admin/settings'
    | '/logout'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  UserLayoutRoute: typeof UserLayoutRoute
  AdminLayoutRoute: typeof AdminLayoutRoute
}
  LoginRoute: typeof LoginRoute
  NewsIndexRoute: typeof NewsIndexRoute
  NewsSlugRoute: typeof NewsSlugRoute
  LogoutRoute: typeof LogoutRoute
export interface UserLayoutRouteChildren {
  IndexRoute: typeof IndexRoute
  AdminLoginRoute: typeof AdminLoginRoute
  MatchesIndexRoute: typeof MatchesIndexRoute
  MatchesMatchIdRoute: typeof MatchesMatchIdRoute
  StandingsIndexRoute: typeof StandingsIndexRoute
}
export interface AdminLayoutRouteChildren {
  AdminDashboardRoute: typeof AdminDashboardRoute
  AdminAuctionsRoute: typeof AdminAuctionsRoute
  AdminManagersRoute: typeof AdminManagersRoute
  AdminMatchesIndexRoute: typeof AdminMatchesIndexRoute
  AdminMatchesMatchIdRoute: typeof AdminMatchesMatchIdRoute
  AdminNewsRoute: typeof AdminNewsRoute
  AdminOrganizersRoute: typeof AdminOrganizersRoute
  AdminPlayersIndexRoute: typeof AdminPlayersIndexRoute
  AdminPlayersPlayerIdRoute: typeof AdminPlayersPlayerIdRoute
  AdminSeasonsIndexRoute: typeof AdminSeasonsIndexRoute
  AdminSeasonsSeasonIdRoute: typeof AdminSeasonsSeasonIdRoute
  AdminSponsorsRoute: typeof AdminSponsorsRoute
  AdminUsersRoute: typeof AdminUsersRoute
  AdminTeamsIndexRoute: typeof AdminTeamsIndexRoute
  AdminTeamsTeamIdRoute: typeof AdminTeamsTeamIdRoute
  AdminVenuesRoute: typeof AdminVenuesRoute
  AdminSettingsRoute: typeof AdminSettingsRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/login': { id: '/login'; path: '/login'; fullPath: '/login'; preLoaderRoute: typeof LoginRouteImport; parentRoute: typeof UserLayoutRoute }
    '/news/': { id: '/news/'; path: '/news'; fullPath: '/news/'; preLoaderRoute: typeof NewsIndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/news/$slug': { id: '/news/$slug'; path: '/news/$slug'; fullPath: '/news/$slug'; preLoaderRoute: typeof NewsSlugRouteImport; parentRoute: typeof UserLayoutRoute }
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/admin/login': { id: '/admin/login'; path: '/admin/login'; fullPath: '/admin/login'; preLoaderRoute: typeof AdminLoginRouteImport; parentRoute: typeof UserLayoutRoute }
    '/matches/': { id: '/matches/'; path: '/matches'; fullPath: '/matches/'; preLoaderRoute: typeof MatchesIndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/matches/$matchId': { id: '/matches/$matchId'; path: '/matches/$matchId'; fullPath: '/matches/$matchId'; preLoaderRoute: typeof MatchesMatchIdRouteImport; parentRoute: typeof UserLayoutRoute }
    '/logout': { id: '/logout'; path: '/logout'; fullPath: '/logout'; preLoaderRoute: typeof LogoutRouteImport; parentRoute: typeof UserLayoutRoute }
    '/standings/': { id: '/standings/'; path: '/standings'; fullPath: '/standings/'; preLoaderRoute: typeof StandingsIndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/admin/dashboard': { id: '/admin/dashboard'; path: '/admin/dashboard'; fullPath: '/admin/dashboard'; preLoaderRoute: typeof AdminDashboardRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/auctions': { id: '/admin/auctions'; path: '/admin/auctions'; fullPath: '/admin/auctions'; preLoaderRoute: typeof AdminAuctionsRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/managers': { id: '/admin/managers'; path: '/admin/managers'; fullPath: '/admin/managers'; preLoaderRoute: typeof AdminManagersRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/matches/': { id: '/admin/matches/'; path: '/admin/matches'; fullPath: '/admin/matches/'; preLoaderRoute: typeof AdminMatchesIndexRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/matches/$matchId': { id: '/admin/matches/$matchId'; path: '/admin/matches/$matchId'; fullPath: '/admin/matches/$matchId'; preLoaderRoute: typeof AdminMatchesMatchIdRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/news': { id: '/admin/news'; path: '/admin/news'; fullPath: '/admin/news'; preLoaderRoute: typeof AdminNewsRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/organizers': { id: '/admin/organizers'; path: '/admin/organizers'; fullPath: '/admin/organizers'; preLoaderRoute: typeof AdminOrganizersRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/players/': { id: '/admin/players/'; path: '/admin/players'; fullPath: '/admin/players/'; preLoaderRoute: typeof AdminPlayersIndexRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/players/$playerId': { id: '/admin/players/$playerId'; path: '/admin/players/$playerId'; fullPath: '/admin/players/$playerId'; preLoaderRoute: typeof AdminPlayersPlayerIdRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/seasons/': { id: '/admin/seasons/'; path: '/admin/seasons'; fullPath: '/admin/seasons/'; preLoaderRoute: typeof AdminSeasonsIndexRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/seasons/$seasonId': { id: '/admin/seasons/$seasonId'; path: '/admin/seasons/$seasonId'; fullPath: '/admin/seasons/$seasonId'; preLoaderRoute: typeof AdminSeasonsSeasonIdRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/sponsors': { id: '/admin/sponsors'; path: '/admin/sponsors'; fullPath: '/admin/sponsors'; preLoaderRoute: typeof AdminSponsorsRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/users': { id: '/admin/users'; path: '/admin/users'; fullPath: '/admin/users'; preLoaderRoute: typeof AdminUsersRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/teams/': { id: '/admin/teams/'; path: '/admin/teams'; fullPath: '/admin/teams/'; preLoaderRoute: typeof AdminTeamsIndexRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/teams/$teamId': { id: '/admin/teams/$teamId'; path: '/admin/teams/$teamId'; fullPath: '/admin/teams/$teamId'; preLoaderRoute: typeof AdminTeamsTeamIdRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/venues': { id: '/admin/venues'; path: '/admin/venues'; fullPath: '/admin/venues'; preLoaderRoute: typeof AdminVenuesRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/settings': { id: '/admin/settings'; path: '/admin/settings'; fullPath: '/admin/settings'; preLoaderRoute: typeof AdminSettingsRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/logout': { id: '/logout'; path: '/logout'; fullPath: '/logout'; preLoaderRoute: typeof LogoutRouteImport; parentRoute: typeof AdminLayoutRoute }
  }
}

const userLayoutRouteChildren: UserLayoutRouteChildren = {
  IndexRoute,
  LoginRoute,
  NewsIndexRoute,
  NewsSlugRoute,
  LogoutRoute,
  AdminLoginRoute,
  MatchesIndexRoute,
  MatchesMatchIdRoute,
  StandingsIndexRoute,
}
const adminLayoutRouteChildren: AdminLayoutRouteChildren = {
  AdminDashboardRoute,
  AdminAuctionsRoute,
  AdminManagersRoute,
  AdminMatchesIndexRoute,
  AdminMatchesMatchIdRoute,
  AdminNewsRoute,
  AdminOrganizersRoute,
  AdminPlayersIndexRoute,
  AdminPlayersPlayerIdRoute,
  AdminSeasonsIndexRoute,
  AdminSeasonsSeasonIdRoute,
  AdminSponsorsRoute,
  AdminUsersRoute,
  AdminTeamsIndexRoute,
  AdminTeamsTeamIdRoute,
  AdminVenuesRoute,
  AdminSettingsRoute,
}
const rootRouteChildren: RootRouteChildren = {
  UserLayoutRoute: UserLayoutRoute._addFileChildren(userLayoutRouteChildren),
  AdminLayoutRoute: AdminLayoutRoute._addFileChildren(adminLayoutRouteChildren),
}

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
