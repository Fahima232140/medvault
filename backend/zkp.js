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

module.exports = {
    // Основные хелперы:
    modPow,
    hashToBigInt, 
    
    // Основные ZKP функции:
    createProof, // <-- Теперь эта функция определена!
    verifyProof,
    generateKeys,
};


function generateKeys() {
  const p = BigInt("0xfffffffffffffffffffffffffffffffeffffac73");
  const g = 5n;
  const rand = require('crypto').getRandomValues(new Uint8Array(32));
  const secretHex = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const x = BigInt("0x" + secretHex);
  const y = modPow(g, x, p);
  return { secretHex: x.toString(16), publicHex: y.toString(16) };
}


async function createProof(secretKeyHex, message) {
    // 1. Convert secret key x (BigInt)
    const x = BigInt("0x" + secretKeyHex);

    // 2. Choose random secret k (nonce)
    const rand = crypto.getRandomValues(new Uint8Array(32));
    const kHex = Array.from(rand).map(b => b.toString(16).padStart(2, "0")).join("");
    const k = BigInt("0x" + kHex);

    // 3. Compute r = g^k mod p
    const r = modPow(g, k, p);
    const rBuf = Buffer.from(r.toString(16), "hex");

    // 4. Compute challenge c = H(r || message) mod (p - 1)
    const c = hashToBigInt(rBuf, message) % (p - 1n);

    // 5. Compute response s = k + c * x mod (p - 1)
    const s = (k + c * x) % (p - 1n);

    return { r: r.toString(16), s: s.toString(16) };
}


