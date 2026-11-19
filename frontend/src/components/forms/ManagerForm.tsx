import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { managerFormSchema, type ManagerFormValues } from "@/schemas/manager.schema";
import type { Asset } from "@/types/api.types";
import type { AdminManager, PublicManager } from "@/types/manager.types";
import { applyFieldErrors, isAdminRecord } from "@/utils/forms";

export function ManagerForm({
  manager,
  submitting,
  onSubmit,
}: {
  manager?: PublicManager | AdminManager | null;
  submitting: boolean;
  onSubmit: (values: ManagerFormValues, photo: Asset | null) => Promise<void>;
}) {
  const admin = manager && isAdminRecord(manager) ? manager : null;
  const [photo, setPhoto] = useState<Asset | null>(manager?.profilePic ?? null);

  const form = useForm<ManagerFormValues>({
    resolver: zodResolver(managerFormSchema) as Resolver<ManagerFormValues>,
    mode: "onTouched",
    defaultValues: {
      name: manager?.name ?? "",
      mobile: admin?.mobile ?? "",
      email: admin?.email ?? "",
      dateOfBirth: admin?.dateOfBirth ? admin.dateOfBirth.slice(0, 10) : "",
      role: manager?.role ?? "Manager",
      status: manager?.status ?? "active",
    },
  });

  const { register, handleSubmit, setError, formState } = form;

  return (
    <form
      className="grid gap-4"
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values, photo);
        } catch (error) {
          applyFieldErrors(error, setError);
          throw error;
        }
      })}
    >
      <ImageUploader
        label="Profile picture"
        purpose="manager-profile"
        value={photo}
        onChange={setPhoto}
      />

      <FormField label="Name" required error={formState.errors.name?.message}>
        <Input placeholder="Enter manager full name" {...register("name")} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Mobile" required error={formState.errors.mobile?.message}>
          <Input {...register("mobile")} inputMode="tel" placeholder="9847012345" />
        </FormField>
        <FormField label="Email" error={formState.errors.email?.message}>
          <Input type="email" placeholder="manager@example.com" {...register("email")} />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date of birth" error={formState.errors.dateOfBirth?.message}>
          <Input type="date" {...register("dateOfBirth")} />
        </FormField>
        <FormField label="Role" error={formState.errors.role?.message}>
          <Input {...register("role")} placeholder="Manager" />
        </FormField>
      </div>

      <FormField label="Status" error={formState.errors.status?.message}>
        <Select {...register("status")}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </FormField>

      <p className="text-xs text-muted">
        Assign this manager to a participating team from the relevant Season settings.
      </p>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save manager"}
      </Button>
    </form>
  );
}
