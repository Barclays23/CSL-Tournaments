import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { appConfig } from "../config/env.config.js";
import { UserRepository } from "../modules/users/user.repository.js";
import { AppError } from "../shared/errors/appError.js";
import type { JwtAdminPayload } from "../modules/auth/auth.types.js";

const userRepository = new UserRepository();

function isAuthenticatedTokenPayload(payload: string | jwt.JwtPayload): payload is jwt.JwtPayload & JwtAdminPayload {
  return typeof payload !== "string"
    && typeof payload.sub === "string"
    && typeof payload.email === "string"
    && (payload.role === "admin" || payload.role === "user");
}

export const authenticate: RequestHandler = async (request, _response, next) => {
  const token: unknown = request.cookies?.csl_token;
  if (typeof token !== "string" || token.length === 0) {
    next(new AppError("Authentication required", 401, "UNAUTHENTICATED"));
    return;
  }
  let decodedToken: string | jwt.JwtPayload;
  try { decodedToken = jwt.verify(token, appConfig.JWT_SECRET); }
  catch { next(new AppError("Invalid or expired session", 401, "INVALID_TOKEN")); return; }

  if (!isAuthenticatedTokenPayload(decodedToken)) {
    next(new AppError("Invalid session token", 401, "INVALID_TOKEN"));
    return;
  }
  try {
    const user = await userRepository.findUserById(decodedToken.sub);
    if (!user || user.status !== "active" || user.role !== decodedToken.role) {
      next(new AppError("User account is blocked or unavailable", 403, "ACCOUNT_INACTIVE"));
      return;
    }
    request.user = { id: String(user._id), role: user.role, email: user.email };
    next();
  } catch (error: unknown) { next(error); }
};
