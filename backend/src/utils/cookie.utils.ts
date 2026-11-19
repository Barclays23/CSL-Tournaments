
import { appConfig } from "../config/env.config.js";



const expirationToMilliseconds: Record<
  typeof appConfig.JWT_EXPIRES_IN,
  number
> = {
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export const getCookieMaxAge = (): number => {
  return expirationToMilliseconds[appConfig.JWT_EXPIRES_IN];
};
