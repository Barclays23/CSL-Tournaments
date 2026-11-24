import { Avatar } from "@/components/ui/Avatar";
import type { GroupStanding } from "@/types/statistics.types";

export function StandingsTable({ group }: { group: GroupStanding }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((column, index) => (
              <th
                key={column}
                className={`whitespace-nowrap px-1 py-2 font-semibold sm:px-2 ${index >= 5 && index <= 8 ? "hidden sm:table-cell" : ""}`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <tr key={row.team._id} className={row.qualified ? "bg-primary/10" : undefined}>
              <td className="w-7 px-1 py-3 tabular text-muted sm:px-2">{row.position}</td>
              <td className="min-w-0 px-1 py-3 sm:px-2">
                <div className="flex min-w-0 items-center gap-1.5 font-semibold text-fg sm:gap-2">
                  <Avatar name={row.team.name} asset={row.team.logo} className="h-7 w-7 shrink-0 rounded-lg sm:h-8 sm:w-8" />
                  <span className="min-w-0 truncate">{row.team.name}</span>
                </div>
              </td>
              {[row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference].map((value, index) => (
                <td
                  key={index}
                  className={`whitespace-nowrap px-1 py-3 tabular text-fg sm:px-2 ${index >= 3 ? "hidden sm:table-cell" : ""}`}
                >
                  {value}
                </td>
              ))}
              <td className="w-10 px-1 py-3 font-display text-lg tabular text-fg sm:px-2 sm:text-xl">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
