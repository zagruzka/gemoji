const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-undercover-guest-secret-change-in-prod";

function signPlayerId(playerId: string): string {
  const hasher = new Bun.CryptoHasher("sha256", SESSION_SECRET);
  hasher.update(playerId);
  return hasher.digest("hex").slice(0, 32);
}

export function createGuestToken(existingPlayerId?: string): { playerId: string; sessionToken: string } {
  const playerId = existingPlayerId ?? `p_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const sig = signPlayerId(playerId);
  return {
    playerId,
    sessionToken: `${playerId}.${sig}`,
  };
}

export function verifyGuestToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [playerId, sig] = parts;
  if (!playerId || !sig) return null;
  const expected = signPlayerId(playerId);
  return sig === expected ? playerId : null;
}
