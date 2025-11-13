const crypto = require("crypto");

// Same parameters as in frontend
const p = BigInt("0xfffffffffffffffffffffffffffffffeffffac73"); // example prime
const g = 5n;

function modPow(base, exp, mod) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

function hashToBigInt(rBuf, message) {
  const h = crypto.createHash("sha256");
  h.update(rBuf);
  h.update(Buffer.from(message, "utf8"));
  const hex = h.digest("hex");
  return BigInt("0x" + hex);
}

/**
 * Verify Schnorr ZK proof of knowledge of secret x:
 *   public key y = g^x mod p
 *   proof {r, s} with challenge c = H(r || message)
 *   g^s == r * y^c  (mod p)
 */
function verifyProof(publicKeyHex, message, proof) {
  const y = BigInt("0x" + publicKeyHex);
  const r = BigInt("0x" + proof.r);
  const s = BigInt("0x" + proof.s);

  const rBuf = Buffer.from(r.toString(16), "hex");
  const c = hashToBigInt(rBuf, message) % (p - 1n);

  const left = modPow(g, s, p);
  const right = (r * modPow(y, c, p)) % p;

  return left === right;
}

module.exports = { verifyProof };
