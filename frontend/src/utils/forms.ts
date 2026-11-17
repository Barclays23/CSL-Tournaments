import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/utils/errorHandler";

export function applyFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>) {
  if (!(error instanceof ApiError) || !error.fieldErrors) return;
  for (const [key, message] of Object.entries(error.fieldErrors)) {
    setError(key as Path<T>, { message });
  }
}

type AdminVariant<T> = Extract<T, { mobile: string | null }>;

export function isAdminRecord<T extends object>(record: T): record is AdminVariant<T> {
  // AdminPlayer.mobile is nullable. Presence of the field identifies the admin
  // response shape; its value must not determine whether the other profile
  // fields (email, dateOfBirth and notes) are displayed.
  return "mobile" in record;
}