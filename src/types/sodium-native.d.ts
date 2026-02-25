declare module 'sodium-native' {
  const crypto_secretbox_KEYBYTES: number;
  const crypto_secretbox_NONCEBYTES: number;
  const crypto_secretbox_MACBYTES: number;
  function randombytes_buf(buf: Buffer): void;
  function crypto_secretbox_easy(
    ciphertext: Buffer,
    plaintext: Buffer,
    nonce: Buffer,
    key: Buffer,
  ): void;
  function crypto_secretbox_open_easy(
    plaintext: Buffer,
    ciphertext: Buffer,
    nonce: Buffer,
    key: Buffer,
  ): boolean;

  // Argon2id key derivation
  const crypto_pwhash_OPSLIMIT_MODERATE: number;
  const crypto_pwhash_MEMLIMIT_MODERATE: number;
  const crypto_pwhash_ALG_ARGON2ID13: number;
  const crypto_pwhash_SALTBYTES: number;
  function crypto_pwhash(
    output: Buffer,
    password: Buffer,
    salt: Buffer,
    opslimit: number,
    memlimit: number,
    algorithm: number,
  ): void;
}
