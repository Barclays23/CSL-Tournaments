import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PLAYER_STATUSES } from "@/constants/football.constants";
import { playerFormSchema, type PlayerFormValues } from "@/schemas/player.schema";
import type { Asset } from "@/types/api.types";
import type { AdminPlayer, PublicPlayer } from "@/types/player.types";
import { applyFieldErrors, isAdminRecord } from "@/utils/forms";

export function PlayerForm({ player, submitting, onSubmit }: {
  player?: PublicPlayer | AdminPlayer | null;
  submitting: boolean;
  onSubmit: (values: PlayerFormValues, photo: Asset | null) => Promise<void>;
}) {
  const admin = player && isAdminRecord(player) ? player : null;
  const [photo, setPhoto] = useState<Asset | null>(player?.profilePic ?? null);
  const form = useForm<PlayerFormValues>({
    resolver: zodResolver(playerFormSchema) as Resolver<PlayerFormValues>,
    mode: "onTouched",
    defaultValues: {
      name: player?.name ?? "",
      mobile: admin?.mobile ?? "",
      email: admin?.email ?? "",
      dateOfBirth: admin?.dateOfBirth?.slice(0, 10) ?? "",
      status: player?.status ?? "active",
      notes: admin?.notes ?? "",
    },
  });
  const { register, handleSubmit, setError, formState } = form;
  return (
    <form className="grid gap-4" onSubmit={handleSubmit(async (values) => {
      try { await onSubmit(values, photo); }
      catch (error) { applyFieldErrors(error, setError); throw error; }
    })}>
      <ImageUploader label="Profile picture" purpose="player-profile" value={photo} onChange={setPhoto} />
      <FormField label="Name" required error={formState.errors.name?.message}>
        <Input placeholder="Enter player full name" {...register("name")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Mobile" error={formState.errors.mobile?.message}>
          <Input {...register("mobile")} inputMode="tel" placeholder="9847012345" />
        </FormField>
        <FormField label="Email" error={formState.errors.email?.message}>
          <Input {...register("email")} type="email" placeholder="player@example.com" />
        </FormField>
      </div>
      <FormField label="Date of birth" error={formState.errors.dateOfBirth?.message}>
        <Input type="date" {...register("dateOfBirth")} />
      </FormField>
      <FormField label="Player status" error={formState.errors.status?.message}>
        <Select {...register("status")}>
          {PLAYER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </FormField>
      <FormField label="Notes" error={formState.errors.notes?.message}>
        <textarea className="min-h-24 w-full rounded-xl border border-border bg-surface px-3 py-2 text-fg" placeholder="Optional player notes" {...register("notes")} />
      </FormField>
      <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save player"}</Button>
    </form>
  );
}
