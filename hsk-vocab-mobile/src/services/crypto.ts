// Crypto helper for the local SQLite auth layer.
// Web app uses SHA-256 + salt via SubtleCrypto; we use expo-crypto so it
// works in the React Native runtime.

const SALT = 'hsk-vocab-mobile-v1';

export async function hashPassword(password: string): Promise<string> {
  const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, `${SALT}:${password}`);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}
