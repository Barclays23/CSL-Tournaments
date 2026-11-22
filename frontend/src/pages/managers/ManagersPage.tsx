import { useState } from "react";
import { toast } from "sonner";
import { ManagerForm } from "@/components/forms/ManagerForm";
import { SearchBar } from "@/components/forms/SearchBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { ManagerCard } from "@/components/managers/ManagerCard";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { CardSkeletonGrid } from "@/components/ui/Skeleton";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import type { ManagerFormValues } from "@/schemas/manager.schema";
import { createManager, deleteManager, getManagers, updateManager } from "@/services/managerService";
import type { Asset } from "@/types/api.types";
import type { PublicManager } from "@/types/manager.types";
import { errorMessage } from "@/utils/errorHandler";

export function ManagersPage() {
  const isAdmin = true;
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PublicManager | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(search);
  const managers = useServiceQuery(() => getManagers({ page, limit: 12, search: debounced }), [page, debounced]);

  const save = async (values: ManagerFormValues, photo: Asset | null) => {
    setSaving(true);
    try {
      const payload = { ...values, profilePic: photo };
      if (editing) await updateManager(editing._id, payload);
      else await createManager(payload);
      toast.success(editing ? "Manager updated" : "Manager created");
      setEditing(undefined);
      managers.reload();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <AdminPageBanner breadcrumb="Admin / Team directory" title="Managers" description="Manage team managers and their contact information." actions={<Button onClick={() => setEditing(null)}>Add manager</Button>} />
      <div className="mb-5 max-w-md">
        <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search managers" />
      </div>
      {managers.loading ? <CardSkeletonGrid /> : null}
      {managers.error ? <ErrorState message={managers.error} onRetry={managers.reload} /> : null}
      {managers.data?.data.length === 0 ? <EmptyState title="No managers" description="No managers match this search." /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {managers.data?.data.map((manager) => (
          <div key={manager._id} className="grid gap-2">
            <ManagerCard manager={manager} />
            {isAdmin ? (
              <div className="flex gap-2">
                <Button size="sm" variant="surface" onClick={() => setEditing(manager)}>Edit</Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    const yes = await confirm({
                      title: `Delete ${manager.name}?`,
                      description: "A manager with season assignments cannot be deleted. Deactivate the profile to preserve tournament history.",
                      confirmLabel: "Delete manager",
                      danger: true,
                    });
                    if (!yes) return;
                    try {
                      await deleteManager(manager._id);
                      toast.success("Manager deleted");
                      managers.reload();
                    } catch (error) {
                      toast.error(errorMessage(error));
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <Pagination pagination={managers.data?.pagination} onPage={setPage} />
      <Drawer open={editing !== undefined} title={editing ? "Edit manager" : "Add manager"} onClose={() => setEditing(undefined)}>
        <ManagerForm manager={editing} submitting={saving} onSubmit={save} />
      </Drawer>
    </PageContainer>
  );
}
