# Multi-season migration guide

The multi-season collections are additive. Existing `Settings`, `Player`, `Team`, and `Match` documents are deliberately not modified or deleted by this feature.

## Before enabling season workflows

1. Take and verify a MongoDB backup.
2. Create the first Season using the legacy Settings values as a starting point:
   - `seasonNumber`: choose the historical season number.
   - `name` and `year`: use the tournament's actual name/year.
   - `auctionSettings.budgetPerTeam`: `Settings.auctionBudgetPerTeam`.
   - `auctionSettings.playersCount`: `Settings.maxActivePlayers`.
   - `auctionSettings.seasonTeamCount`: `Settings.maxActiveTeams`.
   - `auctionSettings.teamSquadSize`: `Settings.maxPlayersPerTeam`.
   - `auctionSettings.iconPlayerLimit`: `Settings.requiredIconPlayers` (review whether this is a cap or mandatory count).
   - `auctionSettings.goalkeeperLimit`: `Settings.requiredGoalkeepers` (review whether this is a cap or mandatory count).
3. Register the teams that actually participated in that season. SeasonTeam snapshots preserve their display name/logo.
4. Backfill one AuctionLot per player with a season auction record. Map old position codes GK/DF/MF/FW to goalkeeper/defender/midfielder/forward. Map old sold player teamRef to the matching SeasonTeam; preserve auction price, icon flag and jersey number. Do not backfill inactive players as auction lots unless they were nominated.
5. Backfill each old Match with the same Season reference and map home/away Team references to SeasonTeam references. Convert embedded goal references to season-team references, retaining own-goal semantics. Validate every match/goal team relationship before import.
6. Compare counts, budgets, roster membership, scores, standings and top scorers between the old and new views before switching frontend traffic.

## Important compatibility notes

- Legacy Settings and Player fields remain in place for old endpoints during migration. New season endpoints do not read or mutate those legacy auction fields.
- Do not run both legacy and season auction workflows for the same live season.
- The season workflow includes Season, SeasonTeam registration, AuctionLot nomination/sale/status, season-scoped fixtures and embedded goal events, standings, top scorers, team dashboards and player auction/goal history. Historical season analytics are only valid after the match and goal backfill has been verified.
- MongoDB transactions require a replica set or sharded deployment. If the deployment is standalone, configure a replica set before relying on transactional season creation and auction sales.
- The project plan describes role limits as limits. If the tournament intends exactly one Icon and one Goalkeeper, configure an explicit minimum/exact rule and enforce it at auction closure; do not infer a minimum from a maximum.
