import { useState } from "react";
import { toast } from "sonner";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import {
  venueFormSchema,
  venueUpdateFormSchema,
  type VenueFormValues,
} from "@/schemas/venue.schema";
import {
  createVenue,
  deleteVenue,
  getVenues,
  updateVenue,
} from "@/services/venueService";
import type { Venue } from "@/types/venue.types";
import { errorMessage } from "@/utils/errorHandler";
import { PageContainer } from "@/components/layout/PageContainer";

export function VenuesPage() {
  return (
    <AdminRoute>
      <VenuesBody />
    </AdminRoute>
  );
}
function VenuesBody() {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Venue | null | undefined>(undefined);
  const [status, setStatus] = useState<"active" | "inactive" | "all">("all");
  const [saving, setSaving] = useState(false);
  const venues = useServiceQuery(() => getVenues(status), [status]);
  const form = useForm<VenueFormValues>({
    resolver: zodResolver(venueFormSchema) as Resolver<VenueFormValues>,
    defaultValues: { name: "", location: "", notes: "" },
  });
  const open = (record: Venue | null) => {
    setEditing(record);
    form.reset({
      name: record?.name ?? "",
      location: record?.location ?? "",
      notes: record?.notes ?? "",
    });
  };
  const save = async (values: VenueFormValues) => {
    setSaving(true);
    try {
      if (editing) {
        await updateVenue(editing._id, values);
        toast.success("Venue updated");
      } else {
        await createVenue(values);
        toast.success("Venue created");
      }
      setEditing(undefined);
      venues.reload();
    } catch (error) {
      const apiError = error as { fieldErrors?: Record<string, string> };
      for (const [field, message] of Object.entries(
        apiError.fieldErrors ?? {},
      )) {
        if (field === "name" || field === "location" || field === "notes")
          form.setError(field, { type: "server", message });
      }
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (record: Venue) => {
    const yes = await confirm({
      title: `Delete ${record.name}?`,
      description:
        "A venue referenced by a fixture cannot be deleted. Deactivate it instead.",
      confirmLabel: "Delete venue",
      danger: true,
    });
    if (!yes) return;
    try {
      await deleteVenue(record._id);
      toast.success("Venue deleted");
      venues.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const toggleStatus = async (record: Venue) => {
    const parsed = venueUpdateFormSchema.safeParse({
      status: record.status === "active" ? "inactive" : "active",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid venue status");
      return;
    }
    try {
      await updateVenue(record._id, parsed.data);
      toast.success("Venue status updated");
      venues.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <PageContainer>
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              Tournament master data
            </p>
            <h1 className="mt-1 font-display text-4xl text-fg">
              Venues & Grounds
            </h1>
            <p className="mt-2 text-sm text-muted">
              Maintain the approved match locations used by every fixture.
            </p>
          </div>
          <Button onClick={() => open(null)}>Add venue</Button>
        </div>
        <div className="mb-4 max-w-xs">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            aria-label="Filter venue status"
          >
            <option value="all">All venues</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        {venues.loading ? <Skeleton className="h-36" /> : null}
        {venues.error ? (
          <ErrorState message={venues.error} onRetry={venues.reload} />
        ) : null}
        {venues.data?.data.length === 0 ? (
          <EmptyState
            title="No venues yet"
            description="Add a venue or ground before creating fixtures."
          />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {venues.data?.data.map((record) => (
            <GlassCard key={record._id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-fg">{record.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {record.location || "Location not specified"}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {record.status === "active"
                      ? "Available for fixtures"
                      : "Inactive · unavailable for new fixtures"}
                  </p>
                </div>
              </div>
              {record.notes ? (
                <p className="mt-3 text-sm text-muted">{record.notes}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="sm" variant="surface" onClick={() => open(record)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="surface"
                  onClick={() => void toggleStatus(record)}
                >
                  {record.status === "active" ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void remove(record)}
                >
                  Delete
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
        <Drawer
          open={editing !== undefined}
          title={editing ? "Edit venue" : "Add venue"}
          onClose={() => setEditing(undefined)}
        >
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit(save)}
            noValidate
          >
            <FormField
              label="Venue / Ground name"
              required
              error={form.formState.errors.name?.message}
            >
              <Input
                {...form.register("name")}
                aria-invalid={Boolean(form.formState.errors.name)}
                placeholder="Cherukunnu Municipal Ground"
              />
            </FormField>
            <FormField
              label="Location"
              error={form.formState.errors.location?.message}
            >
              <Input
                {...form.register("location")}
                aria-invalid={Boolean(form.formState.errors.location)}
                placeholder="Cherukunnu, Kerala"
              />
            </FormField>
            <FormField label="Notes" error={form.formState.errors.notes?.message}>
              <Textarea
                {...form.register("notes")}
                aria-invalid={Boolean(form.formState.errors.notes)}
                maxLength={500}
                placeholder="Optional details"
              />
            </FormField>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save venue" : "Create venue"}
            </Button>
          </form>
        </Drawer>
      </section>
    </PageContainer>
  );
}
