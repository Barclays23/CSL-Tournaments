import { useState, type FormEvent } from "react";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { SeasonTeam } from "@/types/season.types";
import type { SeasonGroup, SeasonMatchStage, SeasonMatchWrite } from "@/types/seasonMatch.types";
import { fromDateTimeInput } from "@/utils/formatDate";

const STAGES: Array<{ value: SeasonMatchStage; label: string }> = [
  { value: "group", label: "Group stage" },
  { value: "round_of_16", label: "Round of 16" },
  { value: "quarter_final", label: "Quarter-final" },
  { value: "semi_final", label: "Semi-final" },
  { value: "third_place", label: "Third-place playoff" },
  { value: "final", label: "Final" },
];

export function SeasonMatchForm({
  seasonTeams,
  groups,
  submitting,
  onSubmit,
}: {
  seasonTeams: SeasonTeam[];
  groups: SeasonGroup[];
  submitting: boolean;
  onSubmit: (values: SeasonMatchWrite) => Promise<void>;
}) {
  const [stage, setStage] = useState<SeasonMatchStage>("group");
  const participants = seasonTeams.filter((team) => ["registered", "active"].includes(team.status));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const home = String(data.get("homeSeasonTeamRef") ?? "");
    const away = String(data.get("awaySeasonTeamRef") ?? "");
    if (!home || !away) {
      form.reportValidity();
      return;
    }
    if (home === away) {
      const awaySelect = form.elements.namedItem("awaySeasonTeamRef") as HTMLSelectElement | null;
      awaySelect?.setCustomValidity("Choose a different away team");
      awaySelect?.reportValidity();
      awaySelect?.setCustomValidity("");
      return;
    }
    const kickoffAt = String(data.get("kickoffAt") ?? "");
    await onSubmit({
      matchNumber: Number(data.get("matchNumber")),
      stage,
      groupRef: stage === "group" ? String(data.get("groupRef") ?? "") : null,
      kickoffAt: fromDateTimeInput(kickoffAt),
      venue: String(data.get("venue") ?? "").trim() || null,
      homeSeasonTeamRef: home,
      awaySeasonTeamRef: away,
      status: "scheduled",
      notes: String(data.get("notes") ?? "").trim() || null,
    });
    form.reset();
    setStage("group");
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Match number" required>
          <Input name="matchNumber" type="number" min={1} max={9999} required placeholder="1" />
        </FormField>
        <FormField label="Stage" required>
          <Select
            name="stage"
            value={stage}
            onChange={(event) => setStage(event.target.value as SeasonMatchStage)}
          >
            {STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </FormField>
      </div>
      {stage === "group" ? (
        <FormField label="Group" required>
          <Select name="groupRef" required defaultValue="">
            <option value="" disabled>Choose a group</option>
            {groups.map((group) => <option key={group._id} value={group._id}>{group.groupName}</option>)}
          </Select>
        </FormField>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Kick-off" required>
          <Input name="kickoffAt" type="datetime-local" required />
        </FormField>
        <FormField label="Venue">
          <Input name="venue" placeholder="Cherukunnu Municipal Ground" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Home team" required>
          <Select name="homeSeasonTeamRef" required defaultValue="">
            <option value="" disabled>Choose home team</option>
            {participants.map((team) => <option key={team._id} value={team._id}>{team.displayName}</option>)}
          </Select>
        </FormField>
        <FormField label="Away team" required>
          <Select name="awaySeasonTeamRef" required defaultValue="">
            <option value="" disabled>Choose away team</option>
            {participants.map((team) => <option key={team._id} value={team._id}>{team.displayName}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="Notes">
        <Textarea name="notes" placeholder="Optional fixture notes" />
      </FormField>
      <p className="text-xs text-muted">The fixture is created as scheduled. Record goals and update its status from its match page.</p>
      <Button type="submit" disabled={submitting || participants.length < 2 || (stage === "group" && groups.length === 0)}>
        {submitting ? "Saving…" : "Save fixture"}
      </Button>
    </form>
  );
}
