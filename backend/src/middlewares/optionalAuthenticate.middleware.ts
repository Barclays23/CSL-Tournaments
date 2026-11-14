import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { appConfig } from "../config/env.config.js";
import { UserRepository } from "../modules/users/user.repository.js";
import type { JwtAdminPayload } from "../modules/auth/auth.types.js";

const userRepository = new UserRepository();

function isAuthenticatedTokenPayload(payload: string | jwt.JwtPayload): payload is jwt.JwtPayload & JwtAdminPayload {
  return typeof payload !== "string"
    && typeof payload.sub === "string"
    && typeof payload.email === "string"
    && (payload.role === "admin" || payload.role === "user");
}

export const optionalAuthenticate: RequestHandler = async (request, _response, next) => {
  const token: unknown = request.cookies?.csl_token;
  if (typeof token !== "string" || token.length === 0) { next(); return; }
  let decodedToken: string | jwt.JwtPayload;
  try { decodedToken = jwt.verify(token, appConfig.JWT_SECRET); }
  catch { next(); return; }
  if (!isAuthenticatedTokenPayload(decodedToken)) { next(); return; }
  try {
    const user = await userRepository.findUserById(decodedToken.sub);
    if (user && user.status === "active" && user.role === decodedToken.role) {
      request.user = { id: String(user._id), role: user.role, email: user.email };
    }
    next();
  } catch (error: unknown) { next(error); }
};
