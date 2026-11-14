# Frontend mock database

The mock database is intended for testing the season-based tournament experience without connecting to MongoDB.

## Enable mock mode

In `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_MOCK_API=true
VITE_UPLOAD_PATH=/uploads
```

Restart the Vite development server after changing environment variables:

```bash
npm run dev
```

Set `VITE_USE_MOCK_API=false` to use the Express API again.

## Sample data

The canonical, deterministic MongoDB-style sample documents are defined in:

- `seasonSeed.ts` — users, players, managers, teams, organizers, sponsors, seasons, seasonTeams, auctionLots, groups and season-based matches.
- `seasonStore.ts` — localStorage persistence for the season mock database.
- `seasonRepository.ts` — mock season, team registration, auction, team dashboard, player history, standings and scorer operations.
- `organizerRepository.ts` and `userRepository.ts` — mock CRUD for the current Organizer and User models.

The seed contains Seasons 9, 10 and 11 (2024–2026), six permanent teams, reusable player and manager master records, organizer and sponsor profiles, historical season participation, auction outcomes and season-linked fixtures/goals. Season 11 includes a registered team with no purchased players so the empty-squad/full-budget state can be previewed. All references use stable 24-character hexadecimal IDs so they can be copied into MongoDB seed scripts or Postman examples. Seed creation runs integrity assertions for unique season/team and season/player pairs, valid cross-season references, and goal/shootout team membership.

Image fields use remote sample image URLs and store only the same `url` + `publicId` asset shape expected by the current Mongoose asset subdocuments. No image binary data is stored.

## Preview admin login

- Email: `admin@csl.local`
- Password: `Admin@12345`

This credential is handled by the existing browser mock-auth adapter. The sample `passwordHash` in User documents is placeholder seed data and is not used for preview authentication. Newly created mock users also receive a placeholder hash; real password hashing is only performed by the backend.

## Reset sample data

The mock database is initialized in browser localStorage. Clear the site's local storage or call the existing `resetPreviewData()` helper to restore the seed. The legacy preview adapter is derived from the canonical season database; it exists only for frontend pages that still consume the older response DTOs.

## Schema alignment notes

The sample document shapes follow the Mongoose models currently present in `backend/src/modules`. A few backend models have not yet completed the architecture migration described in the 14 November project plan:

- `Player` still declares legacy team/auction fields; the seed sets neutral defaults and stores actual season position, jersey number and purchase price in `AuctionLot`.
- `Manager` still declares `teamRef` and `role`; the seed leaves those permanent fields null and assigns managers through `SeasonTeam.managerRefs`.
- `Team` still declares `poster` and `groupName`; group participation is represented by `SeasonTeam.groupRef`.
- The new match data uses the `SeasonMatch` model. The old `Match` and `Settings` data are exposed only through a compatibility projection for legacy frontend services.
- `Organizer` is a current Mongoose model and is represented in the canonical seed. `SeasonSponsor` and `TournamentContent` remain excluded because the plan describes them as optional future collections and no corresponding current models exist.

When those backend models are migrated, update the seed interfaces and documents in the same change so the mock and persisted schema remain identical.
