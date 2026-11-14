import { api, run } from "@/services/api";
import type { ApiResponse } from "@/types/api.types";
import type { AdminOrganizer, Organizer, OrganizerQuery, OrganizerWrite, PublicOrganizer } from "@/types/organizer.types";

export function getOrganizers(params: OrganizerQuery = {}) {
  return run(() => api.get<ApiResponse<Organizer[]>>("/organizers", { params }).then((response) => response.data));
}
export function createOrganizer(data: OrganizerWrite) {
  return run(() => api.post<ApiResponse<AdminOrganizer>>("/organizers", data).then((response) => response.data));
}
export function updateOrganizer(id: string, data: Partial<OrganizerWrite>) {
  return run(() => api.patch<ApiResponse<AdminOrganizer>>(`/organizers/${id}`, data).then((response) => response.data));
}
export function deleteOrganizer(id: string) {
  return run(() => api.delete<ApiResponse<null>>(`/organizers/${id}`).then((response) => response.data));
}
export type { Organizer, AdminOrganizer, PublicOrganizer };
