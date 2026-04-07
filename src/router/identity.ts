import { findUserByAddress } from "../db/users.js";

export async function resolveIdentity(senderAddress: string) {
  return findUserByAddress(senderAddress);
}
