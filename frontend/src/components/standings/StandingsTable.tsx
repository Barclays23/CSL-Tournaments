import { Avatar } from "@/components/ui/Avatar";
import type { GroupStanding } from "@/types/statistics.types";

export function StandingsTable({ group }: { group: GroupStanding }) {
  return (
    <div
      className="standings-table-scroll w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain"
      role="region"
      aria-label={`Full standings table for ${group.groupName}. Scroll horizontally to view every column.`}
      tabIndex={0}
    >
      <table className="w-full min-w-[42rem] table-auto text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((column) => (
              <th key={column} className="whitespace-nowrap px-2 py-2 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <tr key={row.team._id} className={row.qualified ? "bg-primary/10" : undefined}>
              <td className="whitespace-nowrap px-2 py-3 tabular text-muted">{row.position}</td>
              <td className="min-w-44 px-2 py-3">
                <div className="flex items-center gap-2 font-semibold text-fg">
                  <Avatar name={row.team.name} asset={row.team.logo} className="h-8 w-8 shrink-0 rounded-lg" />
                  <span className="whitespace-nowrap">{row.team.name}</span>
                </div>
              </td>
              {[row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference].map((value, index) => (
                <td key={index} className="whitespace-nowrap px-2 py-3 tabular text-fg">
                  {value}
                </td>
              ))}
              <td className="whitespace-nowrap px-2 py-3 font-display text-xl tabular text-fg">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
