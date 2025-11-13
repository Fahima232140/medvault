const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
require("dotenv").config();

// In-memory user store for demo
const users = new Map(); // email -> { email, passwordHash, role, zkpPublicKey }

function createToken(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      zkpPublicKey: user.zkpPublicKey || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

router.post("/register", async (req, res) => {
  const { email, password, role, zkpPublicKey } = req.body; // role: "patient" | "doctor"

  if (!email || !password || !role) {
    return res.status(400).json({ message: "email, password, role required" });
  }
  if (users.has(email)) {
    return res.status(409).json({ message: "User exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { email, passwordHash, role, zkpPublicKey: zkpPublicKey || null };
  users.set(email, user);

  const token = createToken(user);
  res.json({ token, user: { email, role, zkpPublicKey } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = createToken(user);
  res.json({ token, user: { email: user.email, role: user.role, zkpPublicKey: user.zkpPublicKey } });
});

// Guest login – no password, limited role
router.post("/guest", (req, res) => {
  const email = `guest-${Date.now()}@medvault.local`;
  const user = { email, role: "guest", passwordHash: null, zkpPublicKey: null };
  users.set(email, user);
  const token = createToken(user);
  res.json({ token, user: { email, role: "guest" } });
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "Missing token" });
  const [, token] = auth.split(" ");
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = { router, authMiddleware, users };
