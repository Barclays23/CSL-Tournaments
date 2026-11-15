import { useState } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { FormField } from "@/components/forms/FormField";
import { SearchBar } from "@/components/forms/SearchBar";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { organizerFormSchema, type OrganizerFormValues } from "@/schemas/organizer.schema";
import { createOrganizer, deleteOrganizer, getOrganizers, updateOrganizer } from "@/services/organizerService";
import type { Asset } from "@/types/api.types";
import type { AdminOrganizer, Organizer, OrganizerWrite } from "@/types/organizer.types";
import { errorMessage } from "@/utils/errorHandler";

export function OrganizersPage() {
  return <AdminRoute><OrganizersBody /></AdminRoute>;
}

function OrganizersBody() {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Organizer | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(search);
  const organizers = useServiceQuery(() => getOrganizers({ page, limit: 12, search: debounced, status }), [page, debounced, status]);

  const save = async (values: OrganizerFormValues, photo: Asset | null) => {
    setSaving(true);
    try {
      const payload: OrganizerWrite = { ...values, profilePic: photo };
      if (editing) {
        await updateOrganizer(editing._id, payload);
        toast.success("Organizer updated");
      } else {
        await createOrganizer(payload);
        toast.success("Organizer created");
      }
      setEditing(undefined);
      organizers.reload();
    } catch (error) { toast.error(errorMessage(error)); throw error; }
    finally { setSaving(false); }
  };

  const remove = async (record: Organizer) => {
    const confirmed = await confirm({
      title: `Delete ${record.name}?`,
      description: "This removes the organizer profile from the tournament directory.",
      confirmLabel: "Delete organizer",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteOrganizer(record._id);
      toast.success("Organizer deleted");
      organizers.reload();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Committee directory</p>
          <h1 className="mt-1 font-display text-4xl text-fg">Organizers</h1>
          <p className="mt-2 text-sm text-muted">Manage tournament committee profiles separately from football team Managers.</p>
        </div>
        <Button onClick={() => setEditing(null)}>Add organizer</Button>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
        <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search organizer name or title" />
        <Select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} aria-label="Filter organizer status">
          <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </Select>
      </div>
      {organizers.loading ? <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-32" /><Skeleton className="h-32" /></div> : null}
      {organizers.error ? <ErrorState message={organizers.error} onRetry={organizers.reload} /> : null}
      {organizers.data && organizers.data.data.length === 0 ? <EmptyState title="No organizers found" description="Create a committee profile to show it in the public tournament information." /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {organizers.data?.data.map((record) => {
          const adminRecord = record as AdminOrganizer;
          return (
            <GlassCard key={record._id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Avatar name={record.name} asset={record.profilePic} className="h-16 w-16" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl text-fg">{record.name}</h2>
                    {adminRecord.status ? <Badge tone={adminRecord.status === "active" ? "accent" : "danger"}>{adminRecord.status}</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-accent">{record.title}</p>
                  <p className="mt-2 text-xs text-muted">{adminRecord.email ?? "No email"} · {adminRecord.mobile ?? "No mobile"}</p>
                  <p className="mt-1 text-xs text-muted">Display order: {record.displayOrder}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t border-line pt-3">
                <Button size="sm" variant="surface" onClick={() => setEditing(record)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => void remove(record)}>Delete</Button>
              </div>
            </GlassCard>
          );
        })}
      </div>
      <Pagination pagination={organizers.data?.pagination} onPage={setPage} />
      <Drawer open={editing !== undefined} title={editing ? "Edit organizer" : "Add organizer"} onClose={() => setEditing(undefined)}>
        <OrganizerForm key={editing?._id ?? "new-organizer"} organizer={editing} submitting={saving} onSubmit={save} />
      </Drawer>
    </section>
  );
}

function OrganizerForm({ organizer, submitting, onSubmit }: {
  organizer?: Organizer | null;
  submitting: boolean;
  onSubmit: (values: OrganizerFormValues, photo: Asset | null) => Promise<void>;
}) {
  const adminRecord = organizer as AdminOrganizer | null | undefined;
  const [photo, setPhoto] = useState<Asset | null>(organizer?.profilePic ?? null);
  const form = useForm<OrganizerFormValues>({
    resolver: zodResolver(organizerFormSchema) as Resolver<OrganizerFormValues>,
    defaultValues: {
      name: organizer?.name ?? "", title: organizer?.title ?? "",
      mobile: adminRecord?.mobile ?? "", email: adminRecord?.email ?? "",
      displayOrder: organizer?.displayOrder ?? 0, status: adminRecord?.status ?? "active",
      notes: adminRecord?.notes ?? "",
    },
  });
  return (
    <form className="grid gap-3" onSubmit={form.handleSubmit((values) => onSubmit(values, photo))}>
      <FormField label="Name" required error={form.formState.errors.name?.message}><Input {...form.register("name")} /></FormField>
      <FormField label="Title / role" required error={form.formState.errors.title?.message}><Input {...form.register("title")} placeholder="Tournament President" /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Mobile" error={form.formState.errors.mobile?.message}><Input {...form.register("mobile")} /></FormField>
        <FormField label="Email" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Display order"><Input type="number" min="0" max="10000" {...form.register("displayOrder", { valueAsNumber: true })} /></FormField>
        <FormField label="Status"><Select {...form.register("status")}><option value="active">Active</option><option value="inactive">Inactive</option></Select></FormField>
      </div>
      <FormField label="Notes"><Textarea rows={3} {...form.register("notes")} /></FormField>
      <ImageUploader label="Profile image" purpose="organizer-profile" value={photo} onChange={setPhoto} />
      <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save organizer"}</Button>
    </form>
  );
}
