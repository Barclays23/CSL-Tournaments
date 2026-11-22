/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is the generated TanStack Router route tree. Keep it in sync with
// the file routes and their pathless public/admin layout parents.

import { createRoute } from '@tanstack/react-router'
import { Route as rootRouteImport } from './routes/__root'
import { UserLayout } from './components/layout/UserLayout'
import { AdminRouteLayout } from './components/layout/AdminRouteLayout'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AuctionsRouteImport } from './routes/auctions'
import { Route as AdminDashboardRouteImport } from './routes/admin/dashboard'
import { Route as AdminLoginRouteImport } from './routes/admin/login'
import { Route as AdminSettingsRouteImport } from './routes/admin/settings'
import { Route as AdminSeasonsRouteImport } from './routes/admin/seasons'
import { Route as AdminUsersRouteImport } from './routes/admin/users'
import { Route as AdminOrganizersRouteImport } from './routes/admin/organizers'
import { Route as AdminVenuesRouteImport } from './routes/admin/venues'
import { Route as LogoutRouteImport } from './routes/logout'
import { Route as ManagersIndexRouteImport } from './routes/managers/index'
import { Route as MatchesIndexRouteImport } from './routes/matches/index'
import { Route as MatchesMatchIdRouteImport } from './routes/matches/$matchId'
import { Route as PlayersIndexRouteImport } from './routes/players/index'
import { Route as PlayersPlayerIdRouteImport } from './routes/players/$playerId'
import { Route as SponsorsIndexRouteImport } from './routes/sponsors/index'
import { Route as StandingsIndexRouteImport } from './routes/standings/index'
import { Route as TeamsIndexRouteImport } from './routes/teams/index'
import { Route as TeamsTeamIdRouteImport } from './routes/teams/$teamId'

// Pathless layout routes keep all existing public and protected admin URLs intact.
const UserLayoutRoute = createRoute({
  getParentRoute: () => rootRouteImport,
  id: '_user',
  component: UserLayout,
})
const AdminLayoutRoute = createRoute({
  getParentRoute: () => rootRouteImport,
  id: '_admin',
  component: AdminRouteLayout,
})

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => UserLayoutRoute,
} as any)
const AuctionsRoute = AuctionsRouteImport.update({
  id: '/auctions',
  path: '/auctions',
  getParentRoute: () => UserLayoutRoute,
} as any)
const AdminDashboardRoute = AdminDashboardRouteImport.update({
  id: '/admin/dashboard',
  path: '/admin/dashboard',
  getParentRoute: () => AdminLayoutRoute,
} as any)
const AdminLoginRoute = AdminLoginRouteImport.update({
  id: '/admin/login',
  path: '/admin/login',
  getParentRoute: () => UserLayoutRoute,
} as any)
const AdminSettingsRoute = AdminSettingsRouteImport.update({
  id: '/admin/settings',
  path: '/admin/settings',
  getParentRoute: () => AdminLayoutRoute,
} as any)
const AdminSeasonsRoute = AdminSeasonsRouteImport.update({
  id: '/admin/seasons',
  path: '/admin/seasons',
  getParentRoute: () => AdminLayoutRoute,
} as any)
const AdminUsersRoute = AdminUsersRouteImport.update({
  id: '/admin/users',
  path: '/admin/users',
  getParentRoute: () => AdminLayoutRoute,
} as any)
const AdminOrganizersRoute = AdminOrganizersRouteImport.update({
  id: '/admin/organizers',
  path: '/admin/organizers',
  getParentRoute: () => AdminLayoutRoute,
} as any)
const AdminVenuesRoute = AdminVenuesRouteImport.update({
  id: '/admin/venues',
  path: '/admin/venues',
  getParentRoute: () => AdminLayoutRoute,
} as any)
const LogoutRoute = LogoutRouteImport.update({
  id: '/logout',
  path: '/logout',
  getParentRoute: () => AdminLayoutRoute,
} as any)
const ManagersIndexRoute = ManagersIndexRouteImport.update({
  id: '/managers/',
  path: '/managers/',
  getParentRoute: () => UserLayoutRoute,
} as any)
const MatchesIndexRoute = MatchesIndexRouteImport.update({
  id: '/matches/',
  path: '/matches/',
  getParentRoute: () => UserLayoutRoute,
} as any)
const MatchesMatchIdRoute = MatchesMatchIdRouteImport.update({
  id: '/matches/$matchId',
  path: '/matches/$matchId',
  getParentRoute: () => UserLayoutRoute,
} as any)
const PlayersIndexRoute = PlayersIndexRouteImport.update({
  id: '/players/',
  path: '/players/',
  getParentRoute: () => UserLayoutRoute,
} as any)
const PlayersPlayerIdRoute = PlayersPlayerIdRouteImport.update({
  id: '/players/$playerId',
  path: '/players/$playerId',
  getParentRoute: () => UserLayoutRoute,
} as any)
const SponsorsIndexRoute = SponsorsIndexRouteImport.update({
  id: '/sponsors/',
  path: '/sponsors/',
  getParentRoute: () => UserLayoutRoute,
} as any)
const StandingsIndexRoute = StandingsIndexRouteImport.update({
  id: '/standings/',
  path: '/standings/',
  getParentRoute: () => UserLayoutRoute,
} as any)
const TeamsIndexRoute = TeamsIndexRouteImport.update({
  id: '/teams/',
  path: '/teams/',
  getParentRoute: () => UserLayoutRoute,
} as any)
const TeamsTeamIdRoute = TeamsTeamIdRouteImport.update({
  id: '/teams/$teamId',
  path: '/teams/$teamId',
  getParentRoute: () => UserLayoutRoute,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/auctions': typeof AuctionsRoute
  '/admin/dashboard': typeof AdminDashboardRoute
  '/admin/login': typeof AdminLoginRoute
  '/admin/settings': typeof AdminSettingsRoute
  '/admin/seasons': typeof AdminSeasonsRoute
  '/admin/users': typeof AdminUsersRoute
  '/admin/organizers': typeof AdminOrganizersRoute
  '/admin/venues': typeof AdminVenuesRoute
  '/logout': typeof LogoutRoute
  '/matches/$matchId': typeof MatchesMatchIdRoute
  '/players/$playerId': typeof PlayersPlayerIdRoute
  '/teams/$teamId': typeof TeamsTeamIdRoute
  '/managers/': typeof ManagersIndexRoute
  '/matches/': typeof MatchesIndexRoute
  '/players/': typeof PlayersIndexRoute
  '/sponsors/': typeof SponsorsIndexRoute
  '/standings/': typeof StandingsIndexRoute
  '/teams/': typeof TeamsIndexRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/auctions': typeof AuctionsRoute
  '/admin/dashboard': typeof AdminDashboardRoute
  '/admin/login': typeof AdminLoginRoute
  '/admin/settings': typeof AdminSettingsRoute
  '/admin/seasons': typeof AdminSeasonsRoute
  '/admin/users': typeof AdminUsersRoute
  '/admin/organizers': typeof AdminOrganizersRoute
  '/admin/venues': typeof AdminVenuesRoute
  '/logout': typeof LogoutRoute
  '/matches/$matchId': typeof MatchesMatchIdRoute
  '/players/$playerId': typeof PlayersPlayerIdRoute
  '/teams/$teamId': typeof TeamsTeamIdRoute
  '/managers': typeof ManagersIndexRoute
  '/matches': typeof MatchesIndexRoute
  '/players': typeof PlayersIndexRoute
  '/sponsors': typeof SponsorsIndexRoute
  '/standings': typeof StandingsIndexRoute
  '/teams': typeof TeamsIndexRoute
}

export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/_user': typeof UserLayoutRoute
  '/_admin': typeof AdminLayoutRoute
  '/': typeof IndexRoute
  '/auctions': typeof AuctionsRoute
  '/admin/dashboard': typeof AdminDashboardRoute
  '/admin/login': typeof AdminLoginRoute
  '/admin/settings': typeof AdminSettingsRoute
  '/admin/seasons': typeof AdminSeasonsRoute
  '/admin/users': typeof AdminUsersRoute
  '/admin/organizers': typeof AdminOrganizersRoute
  '/admin/venues': typeof AdminVenuesRoute
  '/logout': typeof LogoutRoute
  '/matches/$matchId': typeof MatchesMatchIdRoute
  '/players/$playerId': typeof PlayersPlayerIdRoute
  '/teams/$teamId': typeof TeamsTeamIdRoute
  '/managers/': typeof ManagersIndexRoute
  '/matches/': typeof MatchesIndexRoute
  '/players/': typeof PlayersIndexRoute
  '/sponsors/': typeof SponsorsIndexRoute
  '/standings/': typeof StandingsIndexRoute
  '/teams/': typeof TeamsIndexRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/auctions'
    | '/admin/dashboard'
    | '/admin/login'
    | '/admin/settings'
    | '/admin/seasons'
    | '/admin/users'
    | '/admin/organizers'
    | '/admin/venues'
    | '/logout'
    | '/matches/$matchId'
    | '/players/$playerId'
    | '/teams/$teamId'
    | '/managers/'
    | '/matches/'
    | '/players/'
    | '/sponsors/'
    | '/standings/'
    | '/teams/'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/auctions'
    | '/admin/dashboard'
    | '/admin/login'
    | '/admin/settings'
    | '/admin/seasons'
    | '/admin/users'
    | '/admin/organizers'
    | '/admin/venues'
    | '/logout'
    | '/matches/$matchId'
    | '/players/$playerId'
    | '/teams/$teamId'
    | '/managers'
    | '/matches'
    | '/players'
    | '/sponsors'
    | '/standings'
    | '/teams'
  id:
    | '__root__'
    | '/_user'
    | '/_admin'
    | '/'
    | '/auctions'
    | '/admin/dashboard'
    | '/admin/login'
    | '/admin/settings'
    | '/admin/seasons'
    | '/admin/users'
    | '/admin/organizers'
    | '/admin/venues'
    | '/logout'
    | '/matches/$matchId'
    | '/players/$playerId'
    | '/teams/$teamId'
    | '/managers/'
    | '/matches/'
    | '/players/'
    | '/sponsors/'
    | '/standings/'
    | '/teams/'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  UserLayoutRoute: typeof UserLayoutRoute
  AdminLayoutRoute: typeof AdminLayoutRoute
}

export interface UserLayoutRouteChildren {
  IndexRoute: typeof IndexRoute
  AuctionsRoute: typeof AuctionsRoute
  AdminLoginRoute: typeof AdminLoginRoute
  ManagersIndexRoute: typeof ManagersIndexRoute
  MatchesIndexRoute: typeof MatchesIndexRoute
  MatchesMatchIdRoute: typeof MatchesMatchIdRoute
  PlayersIndexRoute: typeof PlayersIndexRoute
  PlayersPlayerIdRoute: typeof PlayersPlayerIdRoute
  SponsorsIndexRoute: typeof SponsorsIndexRoute
  StandingsIndexRoute: typeof StandingsIndexRoute
  TeamsIndexRoute: typeof TeamsIndexRoute
  TeamsTeamIdRoute: typeof TeamsTeamIdRoute
}

export interface AdminLayoutRouteChildren {
  AdminDashboardRoute: typeof AdminDashboardRoute
  AdminSettingsRoute: typeof AdminSettingsRoute
  AdminSeasonsRoute: typeof AdminSeasonsRoute
  AdminUsersRoute: typeof AdminUsersRoute
  AdminOrganizersRoute: typeof AdminOrganizersRoute
  AdminVenuesRoute: typeof AdminVenuesRoute
  LogoutRoute: typeof LogoutRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/auctions': { id: '/auctions'; path: '/auctions'; fullPath: '/auctions'; preLoaderRoute: typeof AuctionsRouteImport; parentRoute: typeof UserLayoutRoute }
    '/admin/dashboard': { id: '/admin/dashboard'; path: '/admin/dashboard'; fullPath: '/admin/dashboard'; preLoaderRoute: typeof AdminDashboardRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/login': { id: '/admin/login'; path: '/admin/login'; fullPath: '/admin/login'; preLoaderRoute: typeof AdminLoginRouteImport; parentRoute: typeof UserLayoutRoute }
    '/admin/settings': { id: '/admin/settings'; path: '/admin/settings'; fullPath: '/admin/settings'; preLoaderRoute: typeof AdminSettingsRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/seasons': { id: '/admin/seasons'; path: '/admin/seasons'; fullPath: '/admin/seasons'; preLoaderRoute: typeof AdminSeasonsRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/users': { id: '/admin/users'; path: '/admin/users'; fullPath: '/admin/users'; preLoaderRoute: typeof AdminUsersRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/organizers': { id: '/admin/organizers'; path: '/admin/organizers'; fullPath: '/admin/organizers'; preLoaderRoute: typeof AdminOrganizersRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/admin/venues': { id: '/admin/venues'; path: '/admin/venues'; fullPath: '/admin/venues'; preLoaderRoute: typeof AdminVenuesRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/logout': { id: '/logout'; path: '/logout'; fullPath: '/logout'; preLoaderRoute: typeof LogoutRouteImport; parentRoute: typeof AdminLayoutRoute }
    '/managers/': { id: '/managers/'; path: '/managers'; fullPath: '/managers/'; preLoaderRoute: typeof ManagersIndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/matches/': { id: '/matches/'; path: '/matches'; fullPath: '/matches/'; preLoaderRoute: typeof MatchesIndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/matches/$matchId': { id: '/matches/$matchId'; path: '/matches/$matchId'; fullPath: '/matches/$matchId'; preLoaderRoute: typeof MatchesMatchIdRouteImport; parentRoute: typeof UserLayoutRoute }
    '/players/': { id: '/players/'; path: '/players'; fullPath: '/players/'; preLoaderRoute: typeof PlayersIndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/players/$playerId': { id: '/players/$playerId'; path: '/players/$playerId'; fullPath: '/players/$playerId'; preLoaderRoute: typeof PlayersPlayerIdRouteImport; parentRoute: typeof UserLayoutRoute }
    '/sponsors/': { id: '/sponsors/'; path: '/sponsors'; fullPath: '/sponsors/'; preLoaderRoute: typeof SponsorsIndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/standings/': { id: '/standings/'; path: '/standings'; fullPath: '/standings/'; preLoaderRoute: typeof StandingsIndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/teams/': { id: '/teams/'; path: '/teams'; fullPath: '/teams/'; preLoaderRoute: typeof TeamsIndexRouteImport; parentRoute: typeof UserLayoutRoute }
    '/teams/$teamId': { id: '/teams/$teamId'; path: '/teams/$teamId'; fullPath: '/teams/$teamId'; preLoaderRoute: typeof TeamsTeamIdRouteImport; parentRoute: typeof UserLayoutRoute }
  }
}

const userLayoutRouteChildren: UserLayoutRouteChildren = {
  IndexRoute,
  AuctionsRoute,
  AdminLoginRoute,
  ManagersIndexRoute,
  MatchesIndexRoute,
  MatchesMatchIdRoute,
  PlayersIndexRoute,
  PlayersPlayerIdRoute,
  SponsorsIndexRoute,
  StandingsIndexRoute,
  TeamsIndexRoute,
  TeamsTeamIdRoute,
}

const adminLayoutRouteChildren: AdminLayoutRouteChildren = {
  AdminDashboardRoute,
  AdminSettingsRoute,
  AdminSeasonsRoute,
  AdminUsersRoute,
  AdminOrganizersRoute,
  AdminVenuesRoute,
  LogoutRoute,
}

const rootRouteChildren: RootRouteChildren = {
  UserLayoutRoute: UserLayoutRoute._addFileChildren(userLayoutRouteChildren),
  AdminLayoutRoute: AdminLayoutRoute._addFileChildren(adminLayoutRouteChildren),
}

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
