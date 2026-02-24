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
}
