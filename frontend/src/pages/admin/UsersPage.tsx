import { useState } from "react";
import { toast } from "sonner";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { FormField } from "@/components/forms/FormField";
import { SearchBar } from "@/components/forms/SearchBar";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { userFormSchema, type UserFormValues } from "@/schemas/user.schema";
import { createUser, deleteUser, getUsers, updateUser, updateUserStatus } from "@/services/userService";
import type { Asset } from "@/types/api.types";
import type { User, UserWrite } from "@/types/user.types";
import { errorMessage } from "@/utils/errorHandler";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";

export function UsersPage() {
  return <AdminRoute><UsersBody /></AdminRoute>;
}

function UsersBody() {
  const { user: currentUser } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"user" | "admin" | "">("");
  const [status, setStatus] = useState<"active" | "blocked" | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(search);
  const users = useServiceQuery(
    () => getUsers({ page, limit: 12, search: debounced, role, status }),
    [page, debounced, role, status],
  );

  const save = async (values: UserFormValues, profilePic: Asset | null) => {
    setSaving(true);
    try {
      const payload: UserWrite = {
        name: values.name, email: values.email, mobile: values.mobile, username: values.username,
        role: values.role, status: values.status, profilePic,
        ...(values.password?.trim() ? { password: values.password.trim() } : {}),
      };
      if (editing) {
        await updateUser(editing._id, payload);
        toast.success("User updated");
      } else {
        if (!values.password || values.password.length < 10) {
          toast.error("Set an initial password with at least 10 characters");
          return;
        }
        await createUser(payload);
        toast.success("User account created");
      }
      setEditing(undefined);
      users.reload();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (record: User) => {
    const next = record.status === "active" ? "blocked" : "active";
    const confirmed = await confirm({
      title: `${next === "blocked" ? "Block" : "Unblock"} ${record.name}?`,
      description: next === "blocked"
        ? "This account will no longer be able to sign in. Existing sessions will be rejected on their next request."
        : "This account will be allowed to sign in again.",
      confirmLabel: next === "blocked" ? "Block account" : "Unblock account",
      danger: next === "blocked",
    });
    if (!confirmed) return;
    try {
      await updateUserStatus(record._id, next);
      toast.success(next === "blocked" ? "User blocked" : "User unblocked");
      users.reload();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const remove = async (record: User) => {
    const confirmed = await confirm({
      title: `Delete ${record.name}?`,
      description: "This permanently removes the account. You cannot delete your own account or the last active administrator.",
      confirmLabel: "Delete user",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteUser(record._id);
      toast.success("User deleted");
      users.reload();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Admin management</p>
          <h1 className="mt-1 font-display text-4xl text-fg">Users</h1>
          <p className="mt-2 text-sm text-muted">Create accounts, assign roles and control access. Public self-registration is disabled.</p>
        </div>
        <Button onClick={() => setEditing(null)}>Create user</Button>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search name, email, mobile or username" />
        <Select value={role} onChange={(event) => { setRole(event.target.value as typeof role); setPage(1); }} aria-label="Filter by role">
          <option value="">All roles</option><option value="admin">Administrator</option><option value="user">User</option>
        </Select>
        <Select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} aria-label="Filter by status">
          <option value="">All statuses</option><option value="active">Active</option><option value="blocked">Blocked</option>
        </Select>
      </div>

      {users.loading ? <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-32" /><Skeleton className="h-32" /></div> : null}
      {users.error ? <ErrorState message={users.error} onRetry={users.reload} /> : null}
      {users.data && users.data.data.length === 0 ? <EmptyState title="No users found" description="Try changing the search or filters, or create a new account." /> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {users.data?.data.map((record) => {
          const isCurrent = record._id === currentUser?._id;
          return (
            <GlassCard key={record._id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <Avatar name={record.name} asset={record.profilePic} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-fg">{record.name}</h2>
                    <Badge tone={record.role === "admin" ? "gold" : "neutral"}>{record.role === "admin" ? "Administrator" : "User"}</Badge>
                    <Badge tone={record.status === "active" ? "accent" : "danger"}>{record.status}</Badge>
                    {isCurrent ? <Badge>Current account</Badge> : null}
                  </div>
                  <p className="mt-1 break-all text-sm text-muted">{record.email}</p>
                  <p className="mt-1 text-xs text-muted">
                    {record.username ? `@${record.username}` : "No username"} · {record.mobile ?? "No mobile number"}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {record.lastLoginAt ? `Last sign in: ${new Date(record.lastLoginAt).toLocaleString()}` : "Never signed in"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="sm" variant="surface" onClick={() => setEditing(record)}>Edit</Button>
                <Button size="sm" variant="surface" disabled={isCurrent} onClick={() => void changeStatus(record)}>
                  {record.status === "active" ? "Block" : "Unblock"}
                </Button>
                <Button size="sm" variant="danger" disabled={isCurrent} onClick={() => void remove(record)}>Delete</Button>
              </div>
            </GlassCard>
          );
        })}
      </div>
      <Pagination pagination={users.data?.pagination} onPage={setPage} />
      <Drawer open={editing !== undefined} title={editing ? "Edit user" : "Create user"} onClose={() => setEditing(undefined)}>
        <UserForm key={editing?._id ?? "new-user"} user={editing} submitting={saving} onSubmit={save} />
      </Drawer>
    </section>
  );
}

function UserForm({ user, submitting, onSubmit }: {
  user?: User | null;
  submitting: boolean;
  onSubmit: (values: UserFormValues, photo: Asset | null) => Promise<void>;
}) {
  const [photo, setPhoto] = useState<Asset | null>(user?.profilePic ?? null);
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema) as Resolver<UserFormValues>,
    defaultValues: {
      name: user?.name ?? "", email: user?.email ?? "", mobile: user?.mobile ?? "",
      username: user?.username ?? "", password: "", role: user?.role ?? "user", status: user?.status ?? "active",
    },
  });
  return (
    <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
      try { await onSubmit(values, photo); }
      catch (error) { throw error; }
    })}>
      <FormField label="Full name" required error={form.formState.errors.name?.message}><Input {...form.register("name")} /></FormField>
      <FormField label="Email" required error={form.formState.errors.email?.message}><Input type="email" autoComplete="email" {...form.register("email")} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Mobile number" error={form.formState.errors.mobile?.message}><Input {...form.register("mobile")} placeholder="Optional" /></FormField>
        <FormField label="Username" error={form.formState.errors.username?.message}><Input {...form.register("username")} placeholder="Optional" /></FormField>
      </div>
      <FormField label={user ? "New password (optional)" : "Initial password"} required={!user} error={form.formState.errors.password?.message}>
        <Input type="password" autoComplete="new-password" {...form.register("password")} placeholder={user ? "Leave blank to keep current password" : "At least 10 characters"} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Role" required><Select {...form.register("role")}><option value="user">User</option><option value="admin">Administrator</option></Select></FormField>
        <FormField label="Status" required><Select {...form.register("status")}><option value="active">Active</option><option value="blocked">Blocked</option></Select></FormField>
      </div>
      <ImageUploader label="Profile image" purpose="user-profile" value={photo} onChange={setPhoto} />
      <p className="text-xs text-muted">Only an administrator can create accounts or assign the administrator role. Passwords are hashed by the server.</p>
      <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : user ? "Save changes" : "Create account"}</Button>
    </form>
  );
}
