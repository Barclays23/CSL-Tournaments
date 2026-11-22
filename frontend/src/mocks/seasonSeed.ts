import type { Asset } from "@/types/api.types";

const oid = (value: number) => value.toString(16).padStart(24, "0");
const timestamp = (value: string) => new Date(value).toISOString();
const asset = (url: string, publicId: string): Asset => ({ url, publicId });

export interface MockSeason {
  _id: string; seasonNumber: number; name: string; year: number;
  startDate: string | null; endDate: string | null; timeZone: "Asia/Kolkata"; groupStageEnabled?: boolean; homeAndAwayFixtures?: boolean;
  status: "draft" | "upcoming" | "active" | "completed" | "archived";
  auctionLifecycleStatus: "not_started" | "in_progress" | "completed";
  auctionSettings: { currency: "INR"; budgetPerTeam: number; playersCount: number; seasonTeamCount: number; teamSquadSize: number; iconPlayerLimit: number; goalkeeperLimit: number };
  pointsRules: { win: number; draw: number; loss: number };
  standingsTieBreakers: Array<"points" | "goalDifference" | "goalsScored" | "teamNameAsc">;
  matchRules: { groupStageDrawAllowed: boolean; knockoutDrawRequiresShootout: boolean; shootoutCountsForMatchScore: false; shootoutCountsForPlayerGoals: false };
  auctionRevision: number; createdAt: string; updatedAt: string;
}
export interface MockTeam {
  _id: string; __v: number; name: string; shortName: string | null; description: string | null;
  logo: Asset | null; poster: Asset | null;
  status: "active" | "inactive"; createdAt: string; updatedAt: string;
}
export interface MockPlayer {
  _id: string; __v: number; name: string; mobile: string | null; email: string | null;
  dateOfBirth: string | null; profilePic: Asset | null; status: "active" | "inactive";
  notes: string | null; createdAt: string; updatedAt: string;
}
export interface MockManager {
  _id: string; __v: number; name: string; mobile: string; email: string | null; dateOfBirth: string | null;
  role: string | null; profilePic: Asset | null;
  status: "active" | "inactive"; createdAt: string; updatedAt: string;
}
export interface MockSponsor {
  _id: string; __v: number; name: string; logo: Asset | null; tier: string | null; website: string | null;
  contactPerson: string | null; contactMobile: string | null; email: string | null; displayOrder: number; status: "active" | "inactive";
  notes: string | null; createdAt: string; updatedAt: string;
}
export interface MockOrganizer {
  _id: string; name: string; title: string; mobile: string | null; email: string | null;
  profilePic: Asset | null; displayOrder: number; status: "active" | "inactive";
  notes: string | null; createdAt: string; updatedAt: string;
}
export interface MockGroup {
  _id: string; seasonRef: string; groupName: string; displayOrder: number; createdAt: string; updatedAt: string;
}
export interface MockSeasonTeam {
  _id: string; seasonRef: string; teamRef: string; displayName: string; logoSnapshot: Asset | null;
  groupRef: string | null; managerRefs: string[];
  status: "registered" | "active" | "withdrawn" | "eliminated" | "completed"; participationHistory?: Array<{fromStatus:string;toStatus:string;reason:string;changedAt:string}>;
  createdAt: string; updatedAt: string;
}
export interface MockAuctionLot {
  _id: string; seasonRef: string; seasonTeamRef: string | null; playerRef: string;
  lotNumber: number | null; auctionStatus: "pending" | "sold" | "unsold" | "withdrawn";
  purchasePrice: number | null; playerPosition: "goalkeeper" | "defender" | "midfielder" | "forward";
  isIconPlayer: boolean; isGoalkeeper: boolean; jerseyNo: number | null;
  nominatedAt: string | null; soldAt: string | null; createdAt: string; updatedAt: string;
}
export interface MockSeasonMatch {
  _id: string; seasonRef: string; matchNumber: number; roundNumber: number;
  stage: "group" | "round_of_16" | "quarter_final" | "semi_final" | "third_place" | "final";
  groupRef: string | null; kickoffAt: string; venueRef: string; venue: string | null;
  homeSeasonTeamRef: string; awaySeasonTeamRef: string;
  status: "scheduled" | "live" | "completed" | "postponed" | "cancelled" | "abandoned";
  goals: Array<{ _id: string; scoringSeasonTeamRef: string; scorerPlayerRef: string | null; playerSeasonTeamRef: string | null; goalType: "normal" | "own_goal"; createdAt: string }>;
  cards?: Array<{ _id: string; seasonTeamRef: string; playerRef: string; cardType: "yellow_card" | "red_card" | "second_yellow"; createdAt: string }>;
  penaltyShootout: null | { status: "pending" | "completed"; homeTeamScore: number; awayTeamScore: number; kicks: Array<{ seasonTeamRef: string; playerRef: string | null; result: "scored" | "missed" | "saved" }> };
  winnerSeasonTeamRef: string | null; notes: string | null; resolutionHistory?: Array<{ status: "cancelled" | "abandoned"; reason: string; decidedAt: string }>; statusHistory?: Array<{ fromStatus: MockSeasonMatch["status"]; toStatus: MockSeasonMatch["status"]; reason: string | null; changedBy: string; changedAt: string; fromKickoffAt: string | null; toKickoffAt: string | null }>; correctionHistory?: Array<{ reason: string; correctedBy: string; correctedAt: string; originalResult: { homeScore: number; awayScore: number; goals: MockSeasonMatch["goals"]; penaltyShootout: MockSeasonMatch["penaltyShootout"]; winnerSeasonTeamRef: string | null }; correctedResult: { homeScore: number; awayScore: number; goals: MockSeasonMatch["goals"]; penaltyShootout: MockSeasonMatch["penaltyShootout"]; winnerSeasonTeamRef: string | null } }>; createdAt: string; updatedAt: string;
}
export interface MockVenue { _id:string; name:string; location:string|null; notes:string|null; status:"active"|"inactive"; createdAt:string; updatedAt:string; }
export interface MockSeasonAwardRecipient { _id:string; recipientType:"season_team"|"player"; seasonTeamRef:string; playerRef:string|null; displayNameSnapshot:string; profileImageSnapshot:Asset|null; teamNameSnapshot:string; teamLogoSnapshot:Asset|null; }
export interface MockSeasonAward { _id:string; seasonRef:string; awardType:"champions"|"runner_up"|"golden_boot"|"golden_glove"|"player_of_the_season"|"best_young_player"|"best_defender"|"best_midfielder"|"special"; title:string; description:string|null; recipients:MockSeasonAwardRecipient[]; createdAt:string; updatedAt:string; }
export interface MockUser {
  _id: string; name: string; email: string; username?: string; mobile?: string;
  passwordHash: string; role: "user" | "admin"; profilePic: Asset | null;
  status: "active" | "blocked"; lastLoginAt: string | null; createdAt: string; updatedAt: string;
}
export interface SeasonMockDatabase {
  users: MockUser[]; teams: MockTeam[]; players: MockPlayer[]; managers: MockManager[];
  sponsors: MockSponsor[]; organizers: MockOrganizer[]; seasons: MockSeason[]; seasonTeams: MockSeasonTeam[];
  auctionLots: MockAuctionLot[]; matches: MockSeasonMatch[]; groups: MockGroup[]; venues: MockVenue[]; awards: MockSeasonAward[];
}

const now = timestamp("2026-11-14T08:00:00.000Z");
const teamInfo = [
  ["Alpha Stars", "CS", "A fast, attacking side from Cherukunnu", "#b43346"],
  ["Malabar United", "MU", "A disciplined team with a strong midfield", "#2a62d0"],
  ["Kozhikode Rangers", "KR", "A young side known for quick transitions", "#d4841a"],
  ["Calicut Kings", "CK", "A balanced team with experienced players", "#6d4ca8"],
  ["Green Valley FC", "GV", "A compact defensive unit", "#1c8a4d"],
  ["Riverside Athletic", "RA", "An energetic team with a direct style", "#147e86"],
] as const;
const teamIds = teamInfo.map((_, index) => oid(100 + index));
const teams: MockTeam[] = teamInfo.map(([name, shortName, description, color], index) => ({
  _id: teamIds[index], __v: 0, name, shortName, description,
  logo: asset(`https://placehold.co/256x256/${color.slice(1)}/ffffff?text=${shortName}`, `mock/teams/${shortName.toLowerCase()}-logo`),
  poster: asset(`https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&auto=format&fit=crop&q=80`, `mock/teams/${shortName.toLowerCase()}-poster`),
  status: "active", createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now,
}));

const playerNames = [
  "Amal Nair", "Vishnu Menon", "Arjun Kumar", "Faisal Rahman", "Jishnu Das", "Akhil Joseph",
  "Sreejith Pillai", "Midhun Varma", "Adarsh Khan", "Basil Thomas", "Farhan George", "Harish Ibrahim",
  "Ijas Reddy", "Jithin Shah", "Kiran Babu", "Lijo Krishnan", "Manoj Ali", "Nikhil John",
  "Pranav Mathew", "Riyas Hussain", "Sabir Nair", "Tony Menon", "Unni Kumar", "Vineeth Rahman",
];
const players: MockPlayer[] = playerNames.map((name, index) => ({
  _id: oid(200 + index), __v: 0, name, mobile: index % 7 === 0 ? null : `9847${String(100000 + index).slice(-6)}`,
  email: index % 5 === 0 ? `${name.toLowerCase().replaceAll(" ", ".")}@example.com` : null,
  dateOfBirth: index % 4 === 0 ? `199${index % 10}-0${(index % 8) + 1}-15T00:00:00.000Z` : null,
  status: "active", profilePic: asset(`https://i.pravatar.cc/240?img=${(index % 70) + 1}`, `mock/players/player-${index + 1}`),
  notes: index % 6 === 0 ? "Sample player profile note." : null,
  createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now,
}));

const managerNames = ["Suresh Menon", "Anwar Rahman", "Biju Thomas", "Shahid Khan", "Reji George", "Nazar Ali"];
const managers: MockManager[] = managerNames.map((name, index) => ({
  _id: oid(300 + index), __v: 0, name, mobile: `9895${String(300000 + index).slice(-6)}`,
  email: index % 2 === 0 ? `manager${index + 1}@example.com` : null,
  dateOfBirth: null, role: null,
  profilePic: asset(`https://i.pravatar.cc/240?img=${(index % 70) + 31}`, `mock/managers/manager-${index + 1}`),
  status: "active", createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now,
}));

const sponsors: MockSponsor[] = [
  { name: "Malabar Traders", tier: "Title", website: "https://example.com", contactPerson: "Leena Das", contactMobile: "9847001122", notes: "Main tournament partner." },
  { name: "GreenLeaf Sports", tier: "Gold", website: "https://example.org", contactPerson: "Rashid K", contactMobile: null, notes: null },
  { name: "Harbour Kitchen", tier: "Silver", website: null, contactPerson: null, contactMobile: null, notes: null },
  { name: "River Boats", tier: "Community", website: "https://example.net", contactPerson: null, contactMobile: null, notes: "Community supporter." },
].map((sponsor, index) => ({
  _id: oid(400 + index), __v: 0, ...sponsor,
  logo: asset(`https://placehold.co/360x180/173c32/ffffff?text=${encodeURIComponent(sponsor.name)}`, `mock/sponsors/sponsor-${index + 1}`),
  email: null, displayOrder: index + 1,
  status: index === 3 ? "inactive" : "active",
  createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now,
}));

const organizers: MockOrganizer[] = [
  { _id: oid(450), name: "Abdul Rahman", title: "Tournament President", mobile: "9847000450", email: "rahman@csl.local", profilePic: asset("https://i.pravatar.cc/240?img=11", "mock/organizers/organizer-1"), displayOrder: 1, status: "active", notes: "Oversees tournament planning and committee decisions.", createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now },
  { _id: oid(451), name: "Niyas K", title: "General Secretary", mobile: "9847000451", email: "niyas@csl.local", profilePic: asset("https://i.pravatar.cc/240?img=14", "mock/organizers/organizer-2"), displayOrder: 2, status: "active", notes: null, createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now },
  { _id: oid(452), name: "Shameer P", title: "Finance Coordinator", mobile: "9847000452", email: null, profilePic: asset("https://i.pravatar.cc/240?img=18", "mock/organizers/organizer-3"), displayOrder: 3, status: "active", notes: "Coordinates tournament accounts and sponsor contributions.", createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now },
  { _id: oid(453), name: "Fathima A", title: "Media Coordinator", mobile: null, email: "media@csl.local", profilePic: asset("https://i.pravatar.cc/240?img=23", "mock/organizers/organizer-4"), displayOrder: 4, status: "inactive", notes: null, createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now },
];

const seasonDefinitions: Array<Omit<MockSeason, "_id" | "createdAt" | "updatedAt" | "auctionLifecycleStatus">> = [
  { seasonNumber: 9, name: "CSL Football Tournament 2024", year: 2024, startDate: "2024-11-01T00:00:00.000Z", endDate: "2024-11-17T00:00:00.000Z", timeZone: "Asia/Kolkata", homeAndAwayFixtures: false, status: "completed", auctionSettings: { currency: "INR", budgetPerTeam: 8000, playersCount: 16, seasonTeamCount: 4, teamSquadSize: 8, iconPlayerLimit: 1, goalkeeperLimit: 1 }, pointsRules: { win: 3, draw: 1, loss: 0 }, standingsTieBreakers: ["points", "goalDifference", "goalsScored", "teamNameAsc"], matchRules: { groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true, shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false }, auctionRevision: 0 },
  { seasonNumber: 10, name: "CSL Football Tournament 2025", year: 2025, startDate: "2025-11-01T00:00:00.000Z", endDate: "2025-11-18T00:00:00.000Z", timeZone: "Asia/Kolkata", homeAndAwayFixtures: true, status: "completed", auctionSettings: { currency: "INR", budgetPerTeam: 9000, playersCount: 24, seasonTeamCount: 6, teamSquadSize: 9, iconPlayerLimit: 1, goalkeeperLimit: 1 }, pointsRules: { win: 3, draw: 1, loss: 0 }, standingsTieBreakers: ["points", "goalDifference", "goalsScored", "teamNameAsc"], matchRules: { groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true, shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false }, auctionRevision: 0 },
  { seasonNumber: 11, name: "CSL Football Tournament 2026", year: 2026, startDate: "2026-11-01T00:00:00.000Z", endDate: "2026-11-20T00:00:00.000Z", timeZone: "Asia/Kolkata", homeAndAwayFixtures: true, status: "active", auctionSettings: { currency: "INR", budgetPerTeam: 10000, playersCount: 24, seasonTeamCount: 6, teamSquadSize: 9, iconPlayerLimit: 1, goalkeeperLimit: 1 }, pointsRules: { win: 3, draw: 1, loss: 0 }, standingsTieBreakers: ["points", "goalDifference", "goalsScored", "teamNameAsc"], matchRules: { groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true, shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false }, auctionRevision: 0 },
];
const seasons: MockSeason[] = seasonDefinitions.map((season, index) => ({
  _id: oid(10 + index), ...season, auctionLifecycleStatus: season.status === "completed" || season.status === "active" ? "completed" : season.status === "upcoming" ? "in_progress" : "not_started", createdAt: timestamp(`${season.year}-01-01T08:00:00.000Z`), updatedAt: now,
}));

const venues: MockVenue[] = [
  { _id: oid(800), name: "Cherukunnu Municipal Ground", location: "Cherukunnu, Kerala", notes: "Main CSL tournament ground", status: "active", createdAt: now, updatedAt: now },
  { _id: oid(801), name: "Kottakkal Stadium", location: "Kottakkal, Kerala", notes: null, status: "active", createdAt: now, updatedAt: now },
  { _id: oid(802), name: "Malappuram District Stadium", location: "Malappuram, Kerala", notes: null, status: "active", createdAt: now, updatedAt: now },
];
const groups: MockGroup[] = [];
const seasonTeams: MockSeasonTeam[] = [];
const auctionLots: MockAuctionLot[] = [];
const matches: MockSeasonMatch[] = [];
const awards: MockSeasonAward[] = [];

function groupId(seasonIndex: number, groupIndex: number) { return oid(600 + seasonIndex * 10 + groupIndex); }
function seasonTeamId(seasonIndex: number, teamIndex: number) { return oid(700 + seasonIndex * 10 + teamIndex); }
function playerPosition(slot: number): MockAuctionLot["playerPosition"] {
  return (["goalkeeper", "defender", "midfielder", "forward"] as const)[slot % 4];
}
function makeGoal(matchNo: number, goalNo: number, scoringTeamRef: string, scorerPlayerRef: string | null, playerSeasonTeamRef: string | null, goalType: "normal" | "own_goal", createdAt: string) {
  return { _id: oid(3000 + matchNo * 10 + goalNo), scoringSeasonTeamRef: scoringTeamRef, scorerPlayerRef, playerSeasonTeamRef, goalType, createdAt: timestamp(createdAt) };
}

seasons.forEach((season, seasonIndex) => {
  const participatingCount = season.auctionSettings.seasonTeamCount;
  const teamsInSeason = teams.slice(0, participatingCount);
  const groupsInSeason = [
    { _id: groupId(seasonIndex, 0), seasonRef: season._id, groupName: "Group A", displayOrder: 1, createdAt: season.createdAt, updatedAt: now },
    { _id: groupId(seasonIndex, 1), seasonRef: season._id, groupName: "Group B", displayOrder: 2, createdAt: season.createdAt, updatedAt: now },
  ];
  groups.push(...groupsInSeason);
  teamsInSeason.forEach((team, teamIndex) => {
    const group = teamIndex < Math.ceil(participatingCount / 2) ? groupsInSeason[0] : groupsInSeason[1];
    const assignedManagers = [oid(300 + (teamIndex % managers.length))];
    seasonTeams.push({
      _id: seasonTeamId(seasonIndex, teamIndex), seasonRef: season._id, teamRef: team._id,
      displayName: team.name, logoSnapshot: team.logo, groupRef: group._id, managerRefs: assignedManagers,
      status: season.status === "completed" ? "completed" : "active",
      createdAt: season.createdAt, updatedAt: now,
    });
  });

  const soldPlayerIndexes = new Set<number>();
  let lotNo = 1;
  teamsInSeason.forEach((_team, teamIndex) => {
    // Keep one registered 2026 participant without purchases to exercise the empty-squad state.
    if (seasonIndex === 2 && teamIndex === 5) return;
    for (let slot = 0; slot < 3; slot += 1) {
      const playerIndex = (teamIndex * 3 + slot + seasonIndex * 5) % players.length;
      soldPlayerIndexes.add(playerIndex);
      const pos = playerPosition(slot);
      const isGoalkeeper = pos === "goalkeeper";
      const isIconPlayer = slot === 2;
      const nominatedAt = timestamp(`${season.year}-10-20T10:00:00.000Z`);
      auctionLots.push({
        _id: oid(1000 + seasonIndex * 100 + lotNo), seasonRef: season._id,
        seasonTeamRef: seasonTeamId(seasonIndex, teamIndex), playerRef: players[playerIndex]._id,
        lotNumber: lotNo++, auctionStatus: "sold", purchasePrice: 650 + teamIndex * 75 + slot * 120,
        playerPosition: pos, isIconPlayer, isGoalkeeper, jerseyNo: slot === 0 ? 1 : slot * 7 + teamIndex + 2,
        nominatedAt, soldAt: timestamp(`${season.year}-10-21T10:00:00.000Z`),
        createdAt: nominatedAt, updatedAt: timestamp(`${season.year}-10-21T10:00:00.000Z`),
      });
    }
  });

  const poolStatuses = ["pending", "unsold", "withdrawn", "pending"] as const;
  let poolAdded = 0;
  for (let playerIndex = 0; playerIndex < players.length && poolAdded < 4; playerIndex += 1) {
    if (soldPlayerIndexes.has(playerIndex)) continue;
    const nominatedAt = timestamp(`${season.year}-10-22T10:00:00.000Z`);
    auctionLots.push({
      _id: oid(1000 + seasonIndex * 100 + lotNo), seasonRef: season._id, seasonTeamRef: null,
      playerRef: players[playerIndex]._id, lotNumber: lotNo++, auctionStatus: poolStatuses[poolAdded],
      purchasePrice: null, playerPosition: playerPosition(poolAdded), isIconPlayer: false,
      isGoalkeeper: poolAdded === 0, jerseyNo: null, nominatedAt,
      soldAt: null, createdAt: nominatedAt, updatedAt: now,
    });
    poolAdded += 1;
  }

  const home = seasonTeamId(seasonIndex, 0);
  const away = seasonTeamId(seasonIndex, Math.min(1, participatingCount - 1));
  const fourthIndex = Math.min(3, participatingCount - 1);
  const fourth = seasonTeamId(seasonIndex, fourthIndex);
  const playerFor = (teamIndex: number, slot: number) => {
    const lotNumber = teamIndex * 3 + slot + 1;
    const lot = auctionLots.find((item) =>
      item.seasonRef === season._id &&
      item.seasonTeamRef === seasonTeamId(seasonIndex, teamIndex) &&
      item.auctionStatus === "sold" &&
      item.lotNumber === lotNumber
    );
    return lot?.playerRef ?? null;
  };
  const makeMatch = (
    matchNumber: number,
    stage: MockSeasonMatch["stage"],
    groupRef: string | null,
    homeRef: string,
    awayRef: string,
    status: MockSeasonMatch["status"],
    kickoff: string,
    goalSpecs: Array<{ scoring: string; scorer: string | null; playerTeam: string | null; type: "normal" | "own_goal" }>,
    shootout: MockSeasonMatch["penaltyShootout"] = null,
    winner: string | null = null,
  ): MockSeasonMatch => ({
    _id: oid(2000 + seasonIndex * 100 + matchNumber),
    seasonRef: season._id,
    matchNumber,
    roundNumber: stage === "group" ? ((groupFixtures.find((fixture) => fixture.groupRef === groupRef && seasonTeamId(seasonIndex, fixture.homeIndex) === homeRef && seasonTeamId(seasonIndex, fixture.awayIndex) === awayRef)?.fixtureIndex ?? 0) + 1) : stage === "final" ? 2 : 1,
    stage,
    groupRef,
    kickoffAt: timestamp(kickoff),
    venueRef: venues[0]._id,
    venue: venues[0].name,
    homeSeasonTeamRef: homeRef,
    awaySeasonTeamRef: awayRef,
    status,
    goals: goalSpecs.map((goal, index) =>
      makeGoal(seasonIndex * 100 + matchNumber, index + 1, goal.scoring, goal.scorer, goal.playerTeam, goal.type, kickoff),
    ),
    penaltyShootout: shootout,
    winnerSeasonTeamRef: winner,
    notes: null,
    createdAt: season.createdAt,
    updatedAt: now,
  });

  const seasonYear = season.year;
  const groupFixtures: Array<{ groupRef: string; homeIndex: number; awayIndex: number; groupIndex: number; fixtureIndex: number }> = [];
  groupsInSeason.forEach((group, groupIndex) => {
    const groupTeamIndexes = teamsInSeason
      .map((_, teamIndex) => teamIndex)
      .filter((teamIndex) => seasonTeams.find((item) =>
        item.seasonRef === season._id && item.teamRef === teamsInSeason[teamIndex]._id
      )?.groupRef === group._id);
    for (let homePosition = 0; homePosition < groupTeamIndexes.length; homePosition += 1) {
      for (let awayPosition = homePosition + 1; awayPosition < groupTeamIndexes.length; awayPosition += 1) {
        groupFixtures.push({
          groupRef: group._id,
          homeIndex: groupTeamIndexes[homePosition],
          awayIndex: groupTeamIndexes[awayPosition],
          groupIndex,
          fixtureIndex: groupFixtures.filter((fixture) => fixture.groupIndex === groupIndex).length,
        });
      }
    }
  });

  groupFixtures.forEach((fixture, index) => {
    const homeRef = seasonTeamId(seasonIndex, fixture.homeIndex);
    const awayRef = seasonTeamId(seasonIndex, fixture.awayIndex);
    const matchNumber = index + 1;
    const goalSpecs: Array<{ scoring: string; scorer: string | null; playerTeam: string | null; type: "normal" | "own_goal" }> = [];
    const outcome = matchNumber % 3;
    if (outcome === 1) {
      goalSpecs.push({ scoring: homeRef, scorer: playerFor(fixture.homeIndex, 1), playerTeam: homeRef, type: "normal" });
      goalSpecs.push({ scoring: awayRef, scorer: playerFor(fixture.awayIndex, 1), playerTeam: awayRef, type: "normal" });
    } else if (outcome === 2) {
      goalSpecs.push({ scoring: homeRef, scorer: playerFor(fixture.homeIndex, 1), playerTeam: homeRef, type: "normal" });
      goalSpecs.push({ scoring: homeRef, scorer: playerFor(fixture.homeIndex, 2), playerTeam: homeRef, type: "normal" });
      goalSpecs.push({ scoring: awayRef, scorer: playerFor(fixture.awayIndex, 1), playerTeam: awayRef, type: "normal" });
    } else {
      goalSpecs.push({ scoring: awayRef, scorer: playerFor(fixture.awayIndex, 1), playerTeam: awayRef, type: "normal" });
    }
    if (fixture.groupIndex === 1 && fixture.fixtureIndex === 0) {
      goalSpecs.push({ scoring: awayRef, scorer: null, playerTeam: homeRef, type: "own_goal" });
    }
    const day = String(2 + (index * 2)).padStart(2, "0");
    matches.push(makeMatch(
      matchNumber,
      "group",
      fixture.groupRef,
      homeRef,
      awayRef,
      "completed",
      `${seasonYear}-11-${day}T11:00:00.000Z`,
      goalSpecs,
    ));
  });

  if (seasonIndex === 1) {
    matches.push(makeMatch(7, "semi_final", null, home, fourth, "completed", `${seasonYear}-11-14T13:00:00.000Z`, [
      { scoring: home, scorer: playerFor(0, 1), playerTeam: home, type: "normal" },
      { scoring: fourth, scorer: playerFor(fourthIndex, 1), playerTeam: fourth, type: "normal" },
    ], { status: "completed", homeTeamScore: 4, awayTeamScore: 3, kicks: [
      { seasonTeamRef: home, playerRef: playerFor(0, 1), result: "scored" },
      { seasonTeamRef: fourth, playerRef: playerFor(fourthIndex, 1), result: "scored" },
      { seasonTeamRef: home, playerRef: playerFor(0, 2), result: "scored" },
      { seasonTeamRef: fourth, playerRef: playerFor(fourthIndex, 2), result: "scored" },
      { seasonTeamRef: home, playerRef: playerFor(0, 1), result: "scored" },
      { seasonTeamRef: fourth, playerRef: playerFor(fourthIndex, 1), result: "scored" },
      { seasonTeamRef: home, playerRef: playerFor(0, 2), result: "scored" },
      { seasonTeamRef: fourth, playerRef: playerFor(fourthIndex, 2), result: "missed" },
    ] }, home));
  } else {
    matches.push(makeMatch(
      7,
      "semi_final",
      null,
      home,
      fourth,
      season.status === "active" ? "scheduled" : "completed",
      `${seasonYear}-11-16T13:00:00.000Z`,
      season.status === "active" ? [] : [
        { scoring: home, scorer: playerFor(0, 1), playerTeam: home, type: "normal" },
      ],
      null,
      season.status === "active" ? null : home,
    ));
  }

  const finalDay = seasonIndex === 0 ? "17" : "18";
  matches.push(makeMatch(
    8,
    "final",
    null,
    home,
    away,
    season.status === "active" ? "scheduled" : "completed",
    `${seasonYear}-11-${finalDay}T13:00:00.000Z`,
    season.status === "active" ? [] : [
      { scoring: home, scorer: playerFor(0, 2), playerTeam: home, type: "normal" },
      { scoring: home, scorer: playerFor(0, 1), playerTeam: home, type: "normal" },
      { scoring: away, scorer: playerFor(1, 2), playerTeam: away, type: "normal" },
    ],
    null,
    season.status === "active" ? null : home,
  ));
});

// Historical award examples for the completed 2024 and 2025 seasons.
for (const [seasonIndex, championIndex, runnerIndex] of [[0, 0, 1], [1, 2, 3]] as const) {
  const season = seasons[seasonIndex];
  const champion = seasonTeams.find((item) => item.seasonRef === season._id && item._id === seasonTeamId(seasonIndex, championIndex))!;
  const runnerUp = seasonTeams.find((item) => item.seasonRef === season._id && item._id === seasonTeamId(seasonIndex, runnerIndex))!;
  const soldLot = auctionLots.find((lot) => lot.seasonRef === season._id && lot.auctionStatus === "sold" && lot.seasonTeamRef === champion._id)!;
  const player = players.find((item) => item._id === soldLot.playerRef)!;
  const createAward = (offset: number, awardType: MockSeasonAward["awardType"], title: string, st: MockSeasonTeam, recipientPlayer?: MockPlayer): MockSeasonAward => ({
    _id: oid(5000 + seasonIndex * 20 + offset), seasonRef: season._id, awardType, title, description: null,
    recipients: [{
      _id: oid(6000 + seasonIndex * 20 + offset), recipientType: recipientPlayer ? "player" : "season_team",
      seasonTeamRef: st._id, playerRef: recipientPlayer?._id ?? null,
      displayNameSnapshot: recipientPlayer?.name ?? st.displayName,
      profileImageSnapshot: recipientPlayer?.profilePic ?? st.logoSnapshot,
      teamNameSnapshot: st.displayName, teamLogoSnapshot: st.logoSnapshot,
    }],
    createdAt: season.updatedAt, updatedAt: season.updatedAt,
  });
  awards.push(
    createAward(0, "champions", "Champions", champion),
    createAward(1, "runner_up", "Runner-up", runnerUp),
    createAward(2, "golden_boot", "Golden Boot / Top Scorer", champion, player),
  );
}

function assertSeedIntegrity(db: SeasonMockDatabase): void {
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(`Invalid CSL mock seed: ${message}`); };
  const unique = (values: string[], label: string) => assert(new Set(values).size === values.length, `duplicate ${label}`);
  const validId = (value: string) => /^[a-f0-9]{24}$/i.test(value);
  for (const [label, docs] of Object.entries({
    users: db.users, teams: db.teams, players: db.players, managers: db.managers,
    sponsors: db.sponsors, organizers: db.organizers, seasons: db.seasons, seasonTeams: db.seasonTeams,
    auctionLots: db.auctionLots, matches: db.matches, groups: db.groups, venues: db.venues, awards: db.awards,
  })) {
    unique(docs.map((doc) => doc._id), `${label} _id`);
    assert(docs.every((doc) => validId(doc._id)), `${label} contains a non-ObjectId id`);
  }
  unique(db.seasons.map((s) => String(s.seasonNumber)), "season number");
  unique(db.seasonTeams.map((st) => `${st.seasonRef}:${st.teamRef}`), "season/team registration");
  unique(db.auctionLots.map((lot) => `${lot.seasonRef}:${lot.playerRef}`), "season/player auction lot");
  unique(db.matches.map((match) => `${match.seasonRef}:${match.matchNumber}`), "season/match number");
  unique(db.matches.map((match) => match._id), "match _id");
  for (const match of db.matches) {
    assert(match.status !== "scheduled" || match.goals.length === 0, `Scheduled fixture ${match._id} must not contain goal events`);
  }
  unique(db.groups.map((group) => `${group.seasonRef}:${group.groupName}`), "season/group name");
  unique(db.venues.map((venue) => venue.name.trim().toLowerCase()), "venue name");

  const seasonTeam = (id: string, seasonRef: string) => db.seasonTeams.find((st) => st._id === id && st.seasonRef === seasonRef);
  unique(db.awards.map((award) => `${award.seasonRef}:${award.awardType}`), "season award category");
  for (const award of db.awards) {
    assert(db.seasons.some((season) => season._id === award.seasonRef), `Award ${award._id} has no season`);
    assert(award.recipients.length > 0, `Award ${award._id} has no recipients`);
    for (const recipient of award.recipients) {
      const st = seasonTeam(recipient.seasonTeamRef, award.seasonRef);
      assert(Boolean(st), `Award ${award._id} references a SeasonTeam from another season`);
      if (recipient.recipientType === "player") {
        assert(Boolean(recipient.playerRef && db.players.some((player) => player._id === recipient.playerRef)), `Award ${award._id} references an unknown player`);
        assert(Boolean(db.auctionLots.some((lot) => lot.seasonRef === award.seasonRef && lot.seasonTeamRef === recipient.seasonTeamRef && lot.playerRef === recipient.playerRef && lot.auctionStatus === "sold")), `Award ${award._id} player is not rostered for that season team`);
      }
    }
  }
  for (const match of db.matches) {
    assert(Number.isInteger(match.roundNumber) && match.roundNumber > 0, `Fixture ${match._id} has an invalid round number`);
    assert(db.venues.some((venue) => venue._id === match.venueRef), `Fixture ${match._id} references an unknown venue`);
  }
  for (const st of db.seasonTeams) {
    assert(db.seasons.some((s) => s._id === st.seasonRef), `SeasonTeam ${st._id} has no season`);
    assert(db.teams.some((t) => t._id === st.teamRef), `SeasonTeam ${st._id} has no team`);
    assert(st.groupRef === null || db.groups.some((g) => g._id === st.groupRef && g.seasonRef === st.seasonRef), `SeasonTeam ${st._id} has an invalid group`);
    assert(st.managerRefs.every((id) => db.managers.some((m) => m._id === id)), `SeasonTeam ${st._id} has an invalid manager`);
  }
  for (const lot of db.auctionLots) {
    assert(db.seasons.some((s) => s._id === lot.seasonRef), `AuctionLot ${lot._id} has no season`);
    assert(db.players.some((p) => p._id === lot.playerRef), `AuctionLot ${lot._id} has no player`);
    assert(lot.seasonTeamRef === null || Boolean(seasonTeam(lot.seasonTeamRef, lot.seasonRef)), `AuctionLot ${lot._id} points to a team in another season`);
    assert(lot.auctionStatus !== "sold" || (lot.seasonTeamRef !== null && lot.purchasePrice !== null && lot.soldAt !== null), `sold AuctionLot ${lot._id} is incomplete`);
    assert(lot.auctionStatus === "sold" || lot.purchasePrice === null, `non-sold AuctionLot ${lot._id} has a purchase price`);
    assert(typeof lot.isGoalkeeper === "boolean", `AuctionLot ${lot._id} is missing its independent goalkeeper flag`);
    assert(lot.auctionStatus === "sold" || (lot.seasonTeamRef === null && lot.jerseyNo === null && lot.soldAt === null), `non-sold AuctionLot ${lot._id} retains sale details`);
  }
  for (const match of db.matches) {
    assert(db.seasons.some((s) => s._id === match.seasonRef), `Match ${match._id} has no season`);
    assert(Boolean(seasonTeam(match.homeSeasonTeamRef, match.seasonRef)), `Match ${match._id} home team is from another season`);
    assert(Boolean(seasonTeam(match.awaySeasonTeamRef, match.seasonRef)), `Match ${match._id} away team is from another season`);
    assert(match.groupRef === null || db.groups.some((g) => g._id === match.groupRef && g.seasonRef === match.seasonRef), `Match ${match._id} has an invalid group`);
    assert(match.homeSeasonTeamRef !== match.awaySeasonTeamRef, `Match ${match._id} has the same home and away team`);
    if (match.stage === "group") {
      const homeTeam = seasonTeam(match.homeSeasonTeamRef, match.seasonRef);
      const awayTeam = seasonTeam(match.awaySeasonTeamRef, match.seasonRef);
      assert(Boolean(match.groupRef && homeTeam?.groupRef === match.groupRef && awayTeam?.groupRef === match.groupRef), `Group match ${match._id} teams must belong to its group`);
      assert(match.penaltyShootout === null, `Group match ${match._id} cannot have a shootout`);
    }
    if (match.status === "completed" && match.stage !== "group") {
      const homeScore = match.goals.filter((goal) => goal.scoringSeasonTeamRef === match.homeSeasonTeamRef).length;
      const awayScore = match.goals.filter((goal) => goal.scoringSeasonTeamRef === match.awaySeasonTeamRef).length;
      if (homeScore === awayScore) assert(Boolean(match.penaltyShootout?.status === "completed" && match.winnerSeasonTeamRef), `Tied knockout match ${match._id} requires a completed shootout and winner`);
    }
    assert(match.winnerSeasonTeamRef === null || Boolean(seasonTeam(match.winnerSeasonTeamRef, match.seasonRef)), `Match ${match._id} winner is from another season`);
    for (const goal of match.goals) {
      assert(Boolean(seasonTeam(goal.scoringSeasonTeamRef, match.seasonRef)), `Goal ${goal._id} scoring team is from another season`);
      assert(goal.playerSeasonTeamRef === null || Boolean(seasonTeam(goal.playerSeasonTeamRef, match.seasonRef)), `Goal ${goal._id} player team is from another season`);
      assert(goal.scorerPlayerRef === null || db.players.some((p) => p._id === goal.scorerPlayerRef), `Goal ${goal._id} scorer does not exist`);
      if (goal.goalType === "normal" && goal.scorerPlayerRef) {
        const soldLot = db.auctionLots.find((lot) => lot.seasonRef === match.seasonRef && lot.playerRef === goal.scorerPlayerRef && lot.auctionStatus === "sold");
        assert(Boolean(soldLot && goal.playerSeasonTeamRef === soldLot.seasonTeamRef), `Goal ${goal._id} scorer is not assigned to its recorded season team`);
      }
      if (goal.goalType === "own_goal") assert(goal.scorerPlayerRef === null && goal.playerSeasonTeamRef !== goal.scoringSeasonTeamRef, `own goal ${goal._id} has inconsistent team references`);
    }
    for (const kick of match.penaltyShootout?.kicks ?? []) {
      assert(Boolean(seasonTeam(kick.seasonTeamRef, match.seasonRef)), `Shootout kick in ${match._id} references another season`);
      assert(kick.playerRef === null || db.players.some((p) => p._id === kick.playerRef), `Shootout kick in ${match._id} references an unknown player`);
    }
  }
}

export function createSeasonDatabase(): SeasonMockDatabase {
  const database: SeasonMockDatabase = {
    users: [{
      _id: oid(500), name: "CSL Administrator", email: "admin@csl.local", username: "csl-admin",
      mobile: "9847000000",
      // Sample-only bcrypt hash for the word "password"; preview login is handled by the mock auth adapter.
      passwordHash: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi",
      role: "admin", profilePic: asset("https://i.pravatar.cc/240?img=12", "mock/users/csl-admin"),
      status: "active", lastLoginAt: null, createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now,
    }, {
      _id: oid(501), name: "Tournament Viewer", email: "viewer@csl.local", username: "csl-viewer",
      passwordHash: "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi", role: "user", profilePic: null,
      status: "active", lastLoginAt: null, createdAt: timestamp("2024-01-01T08:00:00.000Z"), updatedAt: now,
    }],
    teams, players, managers, sponsors, organizers, seasons, seasonTeams, auctionLots, matches, groups, venues, awards,
  };
  assertSeedIntegrity(database);
  return database;
}
