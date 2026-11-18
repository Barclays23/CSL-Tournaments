import { api, run } from "@/services/api";
import { USE_MOCK_API } from "@/config/env";
import { seasonPreviewRepository } from "@/mocks/seasonRepository";
import type { ApiResponse } from "@/types/api.types";
import type { Venue, VenueWrite } from "@/types/venue.types";
export function getVenue(id:string) { return run(() => USE_MOCK_API ? seasonPreviewRepository.getVenue(id) : api.get<ApiResponse<Venue>>("/venues/"+id).then(r=>r.data)); }
export function getVenues(status:"active"|"inactive"|"all"="active") { return run(() => USE_MOCK_API ? seasonPreviewRepository.getVenues(status) : api.get<ApiResponse<Venue[]>>("/venues",{params:{status}}).then(r=>r.data)); }
export function createVenue(data:VenueWrite) { return run(() => USE_MOCK_API ? seasonPreviewRepository.createVenue(data) : api.post<ApiResponse<Venue>>("/venues",data).then(r=>r.data)); }
export function updateVenue(id:string,data:Partial<VenueWrite>&{status?:"active"|"inactive"}) { return run(() => USE_MOCK_API ? seasonPreviewRepository.updateVenue(id,data) : api.patch<ApiResponse<Venue>>("/venues/"+id,data).then(r=>r.data)); }
export function deleteVenue(id:string) { return run(() => USE_MOCK_API ? seasonPreviewRepository.deleteVenue(id) : api.delete<ApiResponse<null>>("/venues/"+id).then(r=>r.data)); }
