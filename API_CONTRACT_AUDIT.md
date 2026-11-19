# CSL API Contract Audit

Reviewed against `CSL_Football_Tournament_Updated_Project_Plan.docx` and the current backend/frontend implementation.

## Result

The backend and frontend were already aligned for most of the active season-based workflows. The work in this branch addresses the concrete contract mismatches listed below while preserving existing response envelopes and keeping compatibility routes available.

## API route map

All routes below are mounted under the backend's `/api` prefix.

| Feature | Active backend route | Frontend service | Result |
|---|---|---|---|
| Seasons | `GET/POST /seasons`, `GET/PATCH/DELETE /seasons/:id`, `PATCH /seasons/:id/lifecycle`, `POST /seasons/:id/complete`, `POST /seasons/:id/archive` | `seasonService.ts` | Aligned |
| Season team registration | `POST /seasons/:seasonId/teams` | `seasonService.ts` | Aligned |
| Season team details/assignment | `GET/PATCH/DELETE /seasons/:seasonId/teams/:teamId`, plus withdraw/recall actions | `seasonService.ts` | Aligned |
| Season groups | `/seasons/:seasonId/groups` | `seasonMatchService.ts` | Aligned |
| Season awards | `/seasons/:seasonId/awards` | `seasonAwardService.ts` | Aligned |
| Season matches | `/seasons/:seasonId/matches`, including goals, reschedule, and corrections | `seasonMatchService.ts` | Aligned |
| Season standings/scorers | `GET /seasons/:seasonId/standings`, `GET /seasons/:seasonId/top-scorers` | `seasonStatisticsService.ts` | Aligned |
| Team season dashboard | `GET /teams/:teamId/dashboard?seasonId=...` | `seasonStatisticsService.ts` | Aligned |
| Player history | `GET /players/:playerId/history` | `seasonStatisticsService.ts` | Aligned |
| Auction reads | `GET /auctions`, `GET /auctions/summary` | `seasonService.ts` | Aligned |
| Auction mutations | `POST /auction-lots`, `PATCH /auction-lots/:id/sell`, `PATCH /auction-lots/:id/status`, `PATCH /auction-lots/:id` | `seasonService.ts` | Synchronized to canonical paths |
| Managers | `/managers` | `managerService.ts` | Synchronized to season-scoped assignment model |
| Sponsors | `/sponsors` | `sponsorService.ts` | Synchronized with email and display order |
| Legacy dashboard | `GET /dashboard/summary`, `GET /standings`, `GET /top-scorers` | `statisticsService.ts` | Kept for existing dashboard/legacy consumers |
| Legacy team statistics | `GET /teams/:teamId/statistics` | `statisticsService.ts` / `teamService.ts` | Route exists and remains available |

## Mismatches corrected

### 1. Manager ownership was attached to a permanent Team

The old Manager model, DTOs, manager filter and frontend form exposed `teamRef`. That conflicts with the plan: a manager can be assigned differently in different seasons.

- Removed `teamRef` from the permanent Manager model and manager request/response contracts.
- Removed the team filter and team selection from the manager screen.
- Kept seasonal assignments on `SeasonTeam.managerRefs`.
- Updated the mock API and seed projection to return the same public/admin manager shapes as the real API.
- Prevented hard deletion of a manager that is referenced by any SeasonTeam. Deactivate the manager instead to preserve season history.

### 2. Auction writes used the wrong route family

The frontend was posting and patching lots under `/auctions/lots`, while the plan defines lot mutations under `/auction-lots`.

- Frontend writes now use `/auction-lots`.
- Backend canonical routes now include generic lot update as well as nomination, sale and status update.
- Existing `/auctions/lots` backend routes remain as compatibility aliases; the read/list and summary endpoints remain under `/auctions`.

### 3. Sponsor contract omitted plan fields

The Sponsor model and frontend did not have contact email or display order.

- Added optional contact `email` and numeric `displayOrder` to the backend DTO, schema, model, and persistence flow.
- Contact email remains admin-only, like the other sponsor contact details.
- Public sponsor responses include display order, and sponsor lists sort by display order then name.
- Kept the existing `tier`, `contactMobile`, and `notes` fields for compatibility with current data and screens.
- Updated the sponsor form, frontend types and preview/mock API accordingly.

### 4. Match query types were narrower than the backend

The backend match-list query accepts `dateFrom`, `dateTo`, and `seasonTeamRef`; these were missing from the frontend `SeasonMatchQuery`. The frontend now declares all three fields.

### 5. Match correction response references were typed incorrectly

The correction-history mapper emits plain ID strings for team/player references inside the original and corrected goal snapshots. The backend DTO previously described those nested values using the populated match-goal response type. The DTO now reflects the actual serialized response. Asset fields in match/auction/season-statistics response DTOs and frontend types are also explicitly typed as `Asset | null` rather than `unknown`.

### 6. Player history exposed fields the endpoint does not return

The frontend expected mobile, email and date of birth inside `PlayerHistory.player`, but the backend deliberately returns only the public player identity, profile image and status. Those private contact fields were removed from the history response type rather than adding them to a public history endpoint. The normal player detail endpoint remains the place for authorized admin contact data.

### 7. Current-user success response was nullable only in the frontend

The backend's successful current-user endpoint returns an authenticated user or an error response. The frontend service now types the successful `data` as `AdminUser`, not `AdminUser | null`.

## Route conventions and legacy code

- The project plan shows a root `/matches?seasonId=...` style in its route examples, while the active implementation uses the nested REST route `/seasons/:seasonId/matches`. The backend router and active Fixtures UI both use the nested route consistently; it was retained to avoid changing a working API surface.
- `frontend/src/services/matchService.ts` still contains calls to root `/matches` routes. There is no root `/matches` router mounted in `backend/src/routes.ts`. The active Fixtures workflow uses `seasonMatchService.ts` and the nested routes above. Treat the old service as legacy; do not wire new screens to it without first migrating it to the season-scoped contract.
- `settings.routes.ts` exists in the backend tree but is not mounted in `routes.ts`; no current frontend service in the service directory calls it. It is not an active frontend/backend route mismatch in the current workflow.
- Legacy statistics endpoints are still mounted and should not be removed as part of this contract cleanup.

## Deliberate remaining differences / migration notes

1. **Asset key naming:** The plan describes the asset storage identifier as `storageKey`, while the existing upload and entity contract consistently uses Cloudinary's `publicId` together with `url`. This branch preserves the established storage contract. Renaming it requires a coordinated migration across upload responses, persisted Team/Player/Manager/Sponsor/SeasonTeam data, and frontend components; it should be treated as a separate data migration rather than silently renamed in types.
2. **Existing manager records:** Removing `teamRef` from the Manager schema/API does not infer historical season assignments. Review existing manager records with a legacy `teamRef` and backfill the appropriate `SeasonTeam.managerRefs` for each affected season before retiring the legacy field in production data. A manager-to-team association alone is not enough evidence to assign that manager to every historical season automatically.
3. **Old root match service:** `matchService.ts` is not made to call a non-season-aware API. The currently used season-scoped service remains authoritative.

## Validation

The repository's GitHub Actions workflow runs backend tests, backend typecheck/build, and frontend typecheck/build on pull requests targeting `main`. This branch is opened as a PR so those checks can validate the complete contract changes. Runtime API smoke tests still require the application's configured MongoDB and authentication environment; they are not claimed as completed by this static repository audit.
