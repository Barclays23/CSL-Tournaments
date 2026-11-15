# Season Management database migration and legacy Settings cutover

Before applying any migration, take a MongoDB backup and verify restore capability.

## Migration commands
Run the following from the backend directory. Every migration supports a dry-run (default) and only modifies records when explicitly passed `--apply`.

1. `npm run migrate:season-dates` — normalize legacy `startDateTime`/`endDateTime` into date-only `startDate`/`endDate` using the Asia/Kolkata calendar day. Resolve reported old/new value conflicts manually.
2. `npm run migrate:team-groups` — export every old permanent Team.groupName assignment into a timestamped JSON backup. Review and reconcile memberships against verified season records before applying the unset. This script does not guess a SeasonTeam group assignment because the former field was global.
3. `npm run migrate:season-identities` — populate normalized season and season-scoped Group names. Resolve duplicate names reported by the dry-run before applying; colliding records are skipped rather than renamed.

## Runtime requirements and data cutover
- Transactional workflows require MongoDB to run as a replica set or sharded cluster.
- New operational seasons must have full configuration; historical records may be metadata_only or partial and must not be fabricated.
- Register verified teams into SeasonTeams; create season Groups and assign each participant using SeasonTeam.groupRef; only then create group-stage fixtures.
- Validate old auction/player values against each Season before transferring lots. Do not copy singleton Settings into multiple seasons without verified source data.
- Check fixtures, goals, penalty shootouts, sold lots, players, team budgets, standings, statistics and public views against a verified backup before routing users to the new season-scoped flows.

## Legacy Settings handling
The public Settings administration workflow is retired: no Settings navigation entry or write route is mounted, and `/admin/settings` redirects to Season Management. The Settings collection and internal read service are deliberately retained as a temporary compatibility adapter because legacy Player/Auction/global Statistics endpoints still read singleton tournament values. Removing that data/model before those endpoints are migrated would break legacy runtime behavior and could discard source values. New Season, AuctionLot, SeasonTeam, Group, SeasonMatch and SeasonStatistics workflows use Season data and do not fall back to singleton Settings. Remove the old Settings model/service only in a later cutover after all remaining legacy endpoints and stored Player/Team auction data have been migrated or retired.

## Retention
- Only an empty Draft Season can be physically deleted. Dependencies are never cascade-deleted.
- A SeasonTeam with history is withdrawn, never deleted.
- Withdrawal is blocked by live, scheduled or postponed fixtures. Explicitly resolve fixtures before withdrawal.
- Completed and Archived seasons remain queryable and read-only.
