import { USE_MOCK_API } from "@/config/env";
import { userPreviewRepository } from "@/mocks/userRepository";
import { api, run } from "@/services/api";
import type { ApiResponse } from "@/types/api.types";
import type { User, UserQuery, UserWrite } from "@/types/user.types";

export function getUsers(params: UserQuery = {}) {
  return run(() => USE_MOCK_API
    ? userPreviewRepository.getUsers(params)
    : api.get<ApiResponse<User[]>>("/users", { params }).then((response) => response.data));
}
export function createUser(data: UserWrite) {
  return run(() => USE_MOCK_API
    ? userPreviewRepository.createUser(data)
    : api.post<ApiResponse<User>>("/users", data).then((response) => response.data));
}
export function updateUser(id: string, data: Partial<UserWrite>) {
  return run(() => USE_MOCK_API
    ? userPreviewRepository.updateUser(id, data)
    : api.patch<ApiResponse<User>>(`/users/${id}`, data).then((response) => response.data));
}
export function updateUserStatus(id: string, status: "active" | "blocked") {
  return run(() => USE_MOCK_API
    ? userPreviewRepository.updateUserStatus(id, status)
    : api.patch<ApiResponse<User>>(`/users/${id}/status`, { status }).then((response) => response.data));
}
export function deleteUser(id: string) {
  return run(() => USE_MOCK_API
    ? userPreviewRepository.deleteUser(id)
    : api.delete<ApiResponse<null>>(`/users/${id}`).then((response) => response.data));
}
