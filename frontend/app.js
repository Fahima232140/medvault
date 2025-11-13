const BACKEND_URL = "http://localhost:3000";

const screens = {
  splash: document.getElementById("screen-splash"),
  login: document.getElementById("screen-login"),
  signup: document.getElementById("screen-signup"),
  home: document.getElementById("screen-home"),
  upload: document.getElementById("screen-upload"),
  verification: document.getElementById("screen-verification"),
  access: document.getElementById("screen-access"),
  activity: document.getElementById("screen-activity"),
  notifications: document.getElementById("screen-notifications"),
  profile: document.getElementById("screen-profile"),
};

let currentUser = null;
let recordsCache = [];
let recordsLoaded = false;
let activityLogCache = [];
let notificationsCache = [];

/* -------- Helpers -------- */

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("screen--active"));
  if (screens[name]) screens[name].classList.add("screen--active");

  if (name === "verification" || name === "access") {
    ensureRecordsLoaded().then(() => {
      if (name === "verification") renderVerificationTable();
      if (name === "access") renderAccessTable();
    });
  } else if (name === "activity") {
    renderActivityTable();
  } else if (name === "notifications") {
    renderNotifications();
  }
}

const toastEl = document.getElementById("toast");
function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle("error", isError);
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}

function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem("medvaultUser", JSON.stringify(user));
  } else {
    localStorage.removeItem("medvaultUser");
  }
  fillProfileForm();
}

function fillProfileForm() {
  if (!currentUser) return;
  document.getElementById("profileName").value = currentUser.name || "";
  document.getElementById("profileEmail").value = currentUser.email || "";
  document.getElementById("profilePhone").value = currentUser.phone || "";
  document.getElementById("profileIIN").value = currentUser.iin || "";
}

/* bottom nav */
const bottomNavButtons = document.querySelectorAll(".bottom-nav-btn");
function setActiveTab(tabName) {
  bottomNavButtons.forEach((btn) =>
    btn.dataset.tab === tabName
      ? btn.classList.add("active")
      : btn.classList.remove("active")
  );
}
bottomNavButtons.forEach((btn) =>
  btn.addEventListener("click", async () => {
    const tab = btn.dataset.tab;
    if (tab === "home") showScreen("home");
    if (tab === "records") {
      await ensureRecordsLoaded();
      showScreen("verification");
    }
    if (tab === "notifications") showScreen("notifications");
    if (tab === "profile") showScreen("profile");
    setActiveTab(tab);
  })
);

/* ------- navigation ------- */

document.getElementById("btnStart").addEventListener("click", () => {
  if (currentUser) {
    showScreen("home");
    setActiveTab("home");
  } else {
    showScreen("login");
  }
});
document
  .getElementById("goToSignupFromLogin")
  .addEventListener("click", () => showScreen("signup"));
document
  .getElementById("goToLoginFromSignup")
  .addEventListener("click", () => showScreen("login"));
document
  .getElementById("btnBackToLogin")
  .addEventListener("click", () => showScreen("login"));

/* home cards */

document
  .getElementById("cardPatientList")
  .addEventListener("click", async () => {
    await ensureRecordsLoaded();
    showScreen("verification");
    setActiveTab("records");
  });

document
  .getElementById("cardMyRecords")
  .addEventListener("click", async () => {
    await ensureRecordsLoaded();
    showScreen("verification");
    setActiveTab("records");
  });

document
  .getElementById("cardUploadRecords")
  .addEventListener("click", () => {
    showScreen("upload");
    setActiveTab("records");
  });

document
  .getElementById("cardShareAccess")
  .addEventListener("click", async () => {
    await ensureRecordsLoaded();
    showScreen("access");
    setActiveTab("records");
  });

document
  .getElementById("cardSystemLog")
  .addEventListener("click", () => {
    showScreen("activity");
    setActiveTab("records");
  });

/* ------- auth ------- */

// login
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  try {
    const res = await fetch(`${BACKEND_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.message || "Login failed", true);

    setCurrentUser(data.user);
    recordsLoaded = false;
    showToast("Logged in");
    showScreen("home");
    setActiveTab("home");
  } catch {
    showToast("Network error", true);
  }
});

// signup
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const iin = document.getElementById("signupIIN").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const confirmPassword = document
    .getElementById("signupConfirmPassword")
    .value.trim();

  try {
    const res = await fetch(`${BACKEND_URL}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, iin, password, confirmPassword }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.message || "Signup failed", true);

    showToast("Signup successful, please login");
    showScreen("login");
  } catch {
    showToast("Network error", true);
  }
});

// profile
document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return showToast("You must be logged in", true);

  const name = document.getElementById("profileName").value.trim();
  const phone = document.getElementById("profilePhone").value.trim();
  const iin = document.getElementById("profileIIN").value.trim();

  try {
    const res = await fetch(`${BACKEND_URL}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentUser.email, name, phone, iin }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.message || "Profile update failed", true);

    setCurrentUser(data.user);
    showToast("Profile updated");
  } catch {
    showToast("Network error", true);
  }
});

/* ------- upload ------- */

const recordInput = document.getElementById("recordInput");
const uploadStatusText = document.getElementById("uploadStatusText");

document
  .getElementById("btnEncryptUpload")
  .addEventListener("click", async () => {
    if (!currentUser) return showToast("You must be logged in", true);
    const data = recordInput.value.trim();
    if (!data) return showToast("Enter record data", true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email, data }),
      });
      const json = await res.json();
      if (!res.ok) return showToast(json.message || "Upload failed", true);

      uploadStatusText.textContent =
        "Record securely added! ID: " + json.recordId;
      recordInput.value = "";
      recordsLoaded = false;

      activityLogCache.unshift({
        userId: currentUser.email,
        action: "Uploaded record",
        date: new Date().toISOString(),
        txId: json.blockchainTx || "-",
      });
      notificationsCache.unshift({
        id: Date.now().toString(),
        title: "Record uploaded",
        body: `Encrypted record uploaded (ID ${json.recordId}).`,
        time: "Just now",
      });

      showToast("Record encrypted & uploaded");
    } catch {
      showToast("Network error", true);
    }
  });

document.getElementById("btnCancelUpload").addEventListener("click", () => {
  recordInput.value = "";
  uploadStatusText.textContent = "";
});

document.getElementById("btnUploadDummy").addEventListener("click", () => {
  showToast("Use 'Encrypt & Upload' button.");
});

document
  .getElementById("forgotPassword")
  .addEventListener("click", () =>
    showToast("Password reset not implemented", true)
  );

/* ------- records list ------- */

async function ensureRecordsLoaded(force = false) {
  if (!currentUser) return;
  if (recordsLoaded && !force) return;

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/records?email=${encodeURIComponent(
        currentUser.email
      )}`
    );
    const data = await res.json();
    if (!res.ok) return showToast(data.message || "Could not load records", true);

    recordsCache = Array.isArray(data) ? data : [];
    recordsLoaded = true;
  } catch {
    showToast("Network error loading records", true);
  }
}

/* ------- verification page ------- */

function renderVerificationTable() {
  const tbody = document.getElementById("verificationTableBody");
  tbody.innerHTML = "";

  if (!recordsCache.length) {
    tbody.innerHTML =
      '<tr><td colspan="3">No records yet. Upload one first.</td></tr>';
    return;
  }

  recordsCache.forEach((rec, index) => {
    const status = rec.status || "Pending";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.name || `Record ${index + 1}`}</td>
      <td><span class="status-pill ${
        status.toLowerCase() === "verified" ? "status-ok" : "status-pending"
      }">${status}</span></td>
      <td>
        <button class="action-btn btn-verify" data-id="${rec.recordId}">
          Verify via Blockchain
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-verify").forEach((btn) =>
    btn.addEventListener("click", () => verifyRecord(btn.dataset.id))
  );
}

async function verifyRecord(recordId) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/records/${encodeURIComponent(recordId)}/verify`,
      { method: "POST", headers: { "Content-Type": "application/json" } }
    );
    const data = await res.json();
    if (!res.ok) return showToast(data.message || "Verification failed", true);

    const rec = recordsCache.find((r) => r.recordId === recordId);
    if (rec) {
      rec.status = data.status || "Verified";
      rec.blockchainTx = data.blockchainTx || rec.blockchainTx;
    }

    activityLogCache.unshift({
      userId: currentUser.email,
      action: "Verified record",
      date: new Date().toISOString(),
      txId: data.blockchainTx || "-",
    });
    notificationsCache.unshift({
      id: Date.now().toString(),
      title: "Record verified",
      body: `Record ${recordId} verified on blockchain.`,
      time: "Just now",
    });

    renderVerificationTable();
    renderActivityTable();
    renderNotifications();
    showToast("Record verified on blockchain");
  } catch {
    showToast("Network error", true);
  }
}

/* ------- access page (ZKP) ------- */

function renderAccessTable() {
  const tbody = document.getElementById("accessTableBody");
  tbody.innerHTML = "";

  if (!recordsCache.length) {
    tbody.innerHTML =
      '<tr><td colspan="2">No records available for access.</td></tr>';
    return;
  }

  recordsCache.forEach((rec, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rec.name || `Record ${i + 1}`}</td>
      <td>
        <button class="action-btn btn-request-access" data-id="${rec.recordId}">
          Request Full Access
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".btn-request-access").forEach((btn) =>
    btn.addEventListener("click", () => requestAccessToRecord(btn.dataset.id))
  );
}

/* ---- ZKP (Schnorr) client side ---- */

const p = BigInt("0xfffffffffffffffffffffffffffffffeffffac73");
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

async function hashToBigInt(message, rHex) {
  const rBytes = Uint8Array.from(
    rHex.match(/.{1,2}/g).map((b) => parseInt(b, 16))
  );
  const msgBytes = new TextEncoder().encode(message);
  const concat = new Uint8Array(rBytes.length + msgBytes.length);
  concat.set(rBytes);
  concat.set(msgBytes, rBytes.length);
  const buf = await crypto.subtle.digest("SHA-256", concat);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return BigInt("0x" + hex);
}

function generateDoctorKeys() {
  const rand = crypto.getRandomValues(new Uint8Array(32));
  const secretHex = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const x = BigInt("0x" + secretHex);
  const y = modPow(g, x, p);
  return { secretHex: x.toString(16), publicHex: y.toString(16) };
}

async function createProof(secretHex, message) {
  const rand = crypto.getRandomValues(new Uint8Array(32));
  const kHex = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const x = BigInt("0x" + secretHex);
  const k = BigInt("0x" + kHex);
  const r = modPow(g, k, p);
  const rHex = r.toString(16);
  const c = (await hashToBigInt(message, rHex)) % (p - 1n);
  const s = (k + c * x) % (p - 1n);
  return { r: r.toString(16), s: s.toString(16) };
}

async function getDoctorKeys() {
  let secretHex = localStorage.getItem("zkpSecret");
  let publicHex = localStorage.getItem("zkpPublic");
  if (!secretHex || !publicHex) {
    const keys = generateDoctorKeys();
    secretHex = keys.secretHex;
    publicHex = keys.publicHex;
    localStorage.setItem("zkpSecret", secretHex);
    localStorage.setItem("zkpPublic", publicHex);
  }
  return { secretHex, publicHex };
}

async function requestAccessToRecord(recordId) {
  if (!currentUser) return showToast("You must be logged in", true);

  const rec = recordsCache.find((r) => r.recordId === recordId);
  if (!rec) return showToast("Record not found", true);

  const { secretHex, publicHex } = await getDoctorKeys();
  const proof = await createProof(secretHex, rec.hashHex);

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/records/${encodeURIComponent(
        recordId
      )}/access-request`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKeyHex: publicHex, proof }),
      }
    );
    const data = await res.json();
    if (!res.ok) return showToast(data.message || "Access denied", true);

    activityLogCache.unshift({
      userId: currentUser.email,
      action: "Requested full access (ZKP)",
      date: new Date().toISOString(),
      txId: data.blockchainTx || "-",
    });
    notificationsCache.unshift({
      id: Date.now().toString(),
      title: "Access granted via ZKP",
      body: `Decryption permitted for record ${recordId}.`,
      time: "Just now",
    });

    renderActivityTable();
    renderNotifications();

    if (data.recordPlaintext) {
      alert("Decrypted record data:\n\n" + data.recordPlaintext);
    } else {
      showToast("Access granted (no plaintext returned).");
    }
  } catch {
    showToast("Network error", true);
  }
}

/* ------- activity log ------- */

function renderActivityTable() {
  const tbody = document.getElementById("activityTableBody");
  tbody.innerHTML = "";

  if (!activityLogCache.length) {
    tbody.innerHTML = '<tr><td colspan="4">No activity yet.</td></tr>';
    return;
  }

  activityLogCache.forEach((log) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${log.userId}</td>
      <td>${log.action}</td>
      <td>${new Date(log.date).toLocaleString()}</td>
      <td>${log.txId}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ------- notifications ------- */

function renderNotifications() {
  const list = document.getElementById("notificationList");
  list.innerHTML = "";

  if (!notificationsCache.length) {
    list.innerHTML =
      '<p style="font-size:14px;color:#6b7280;">No notifications yet.</p>';
    return;
  }

  notificationsCache.forEach((n) => {
    const card = document.createElement("article");
    card.className = "notification-card";
    card.innerHTML = `
      <div class="notification-title">${n.title}</div>
      <div class="notification-body">${n.body}</div>
      <div class="notification-time">${n.time}</div>
    `;
    list.appendChild(card);
  });
}

/* ------- initial load ------- */

(function init() {
  const stored = localStorage.getItem("medvaultUser");
  if (stored) {
    try {
      const user = JSON.parse(stored);
      setCurrentUser(user);
      showScreen("home");
      setActiveTab("home");
      return;
    } catch {
      localStorage.removeItem("medvaultUser");
    }
  }
  showScreen("splash");
})();
