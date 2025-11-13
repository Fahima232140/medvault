const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const { encryptAES256, decryptAES256, sha256Hex } = require("./cryptoService");
const { verifyProof } = require("./zkp");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory "database"
const users = new Map();   // email -> { name, email, phone, iin, password }
const records = new Map(); // recordId -> { ownerEmail, encrypted, hashHex, status, blockchainTx }

/* ---------- BASIC ROUTES ---------- */

app.get("/", (req, res) => {
  res.send("MedVault backend is running");
});

/* ---------- AUTH (very simple for demo) ---------- */

app.post("/api/signup", (req, res) => {
  const { name, email, phone, password, confirmPassword, iin } = req.body;

  if (!name || !email || !phone || !password || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  if (users.has(email)) {
    return res.status(409).json({ message: "User already exists" });
  }

  const user = { name, email, phone, iin: iin || "", password };
  users.set(email, user);

  res.status(201).json({ message: "Signup successful" });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);

  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.json({
    message: "Login successful",
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      iin: user.iin,
    },
  });
});

/* ---------- PROFILE ---------- */

app.put("/api/profile", (req, res) => {
  const { email, name, phone, iin } = req.body;
  const user = users.get(email);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.name = name;
  user.phone = phone;
  user.iin = iin || "";

  res.json({
    message: "Profile updated",
    user: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      iin: user.iin,
    },
  });
});

/* ---------- RECORDS: UPLOAD / LIST / VERIFY / ACCESS (ZKP) ---------- */

// Upload record: encrypt + hash
app.post("/api/records", (req, res) => {
  const { email, data } = req.body;
  const user = users.get(email);
  if (!user) {
    return res.status(401).json({ message: "Invalid user" });
  }
  if (!data) {
    return res.status(400).json({ message: "Record data is required" });
  }

  const encrypted = encryptAES256(data);
  const hashHex = sha256Hex(encrypted);
  const recordId = uuidv4();
  const blockchainTx = sha256Hex(hashHex + Date.now().toString()); // fake tx id

  records.set(recordId, {
    ownerEmail: email,
    encrypted,
    hashHex,
    status: "Pending",
    blockchainTx,
  });

  res.status(201).json({
    message: "Record encrypted & stored",
    recordId,
    hashHex,
    blockchainTx,
  });
});

// List records for a user (owner)
app.get("/api/records", (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ message: "Email query param required" });
  }

  const list = [];
  for (const [id, rec] of records.entries()) {
    if (rec.ownerEmail === email) {
      list.push({
        recordId: id,
        name: `Record ${id.slice(0, 8)}`,
        status: rec.status,
        hashHex: rec.hashHex,
        blockchainTx: rec.blockchainTx,
      });
    }
  }
  res.json(list);
});

// Verify record (e.g. patient or system verifying on blockchain)
app.post("/api/records/:id/verify", (req, res) => {
  const { id } = req.params;
  const rec = records.get(id);
  if (!rec) {
    return res.status(404).json({ message: "Record not found" });
  }

  rec.status = "Verified";
  rec.blockchainTx = sha256Hex(rec.hashHex + Date.now().toString());

  res.json({
    message: "Record verified",
    status: rec.status,
    blockchainTx: rec.blockchainTx,
  });
});

// Request access to record using Zero-Knowledge Proof
app.post("/api/records/:id/access-request", (req, res) => {
  const { id } = req.params;
  const { publicKeyHex, proof } = req.body;

  const rec = records.get(id);
  if (!rec) {
    return res.status(404).json({ message: "Record not found" });
  }

  if (!publicKeyHex || !proof || !proof.r || !proof.s) {
    return res.status(400).json({ message: "ZKP publicKeyHex and proof required" });
  }

  const ok = verifyProof(publicKeyHex, rec.hashHex, proof);
  if (!ok) {
    return res.status(401).json({ message: "Zero-knowledge proof verification failed" });
  }

  const plaintext = decryptAES256(rec.encrypted);
  const blockchainTx = sha256Hex(rec.hashHex + "ACCESS" + Date.now().toString());

  res.json({
    message: "Access granted via ZKP",
    blockchainTx,
    recordPlaintext: plaintext,
  });
});

app.listen(PORT, () => {
  console.log(`MedVault backend listening on http://localhost:${PORT}`);
});
