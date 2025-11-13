const crypto = require("crypto");
require("dotenv").config();

const AES_KEY = Buffer.from(process.env.AES_KEY, "utf8"); // 32 bytes
const AES_IV = Buffer.from(process.env.AES_IV, "utf8");   // 16 bytes

// AES-256-GCM encryption
function encryptAES256(plaintext) {
  const cipher = crypto.createCipheriv("aes-256-gcm", AES_KEY, AES_IV);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store ciphertext + tag together
  return Buffer.concat([enc, tag]).toString("base64");
}

// AES-256-GCM decryption
function decryptAES256(ciphertextB64) {
  const buf = Buffer.from(ciphertextB64, "base64");
  const tag = buf.slice(buf.length - 16);
  const encData = buf.slice(0, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, AES_IV);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(encData), decipher.final()]);
  return dec.toString("utf8");
}

// SHA-256 hash -> hex string
function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

module.exports = {
  encryptAES256,
  decryptAES256,
  sha256Hex,
};
