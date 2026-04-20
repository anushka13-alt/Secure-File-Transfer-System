const express = require("express");
const https = require("https");
const selfsigned = require("selfsigned");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const redis = require("redis");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 3000;
const STORE_FOLDER = path.join(__dirname, "uploads");

if (!fs.existsSync(STORE_FOLDER)) {
  fs.mkdirSync(STORE_FOLDER);
}

const CERT_DIR = path.join(__dirname, "certs");
if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR);
}
const KEY_PATH = path.join(CERT_DIR, "server.key");
const CERT_PATH = path.join(CERT_DIR, "server.cert");

if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
  const key = fs.readFileSync(KEY_PATH, "utf8");
  const cert = fs.readFileSync(CERT_PATH, "utf8");
  startServer(key, cert);
} else {
  console.log("Generating new self-signed certificates (this may take a moment)...");
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  selfsigned.generate(attrs, { days: 365, keySize: 2048 }).then(pems => {
    fs.writeFileSync(KEY_PATH, pems.private, "utf8");
    fs.writeFileSync(CERT_PATH, pems.cert, "utf8");
    startServer(pems.private, pems.cert);
  }).catch(err => {
    console.error("Certificate generation error", err);
  });
}

// Local Redis connection (for Memurai)
const redisClient = redis.createClient({
  socket: {
    host: '127.0.0.1',
    port: 6379
  }
});

redisClient.on('error', (err) => console.log('Redis Error:', err));
redisClient.on('connect', () => console.log('✅ Redis (Memurai) Connected'));

redisClient.connect();

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// Encryption
const KEY = Buffer.from("12345678901234567890123456789012");

function encrypt(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decrypt(data) {
  const iv = data.slice(0, 16);
  const encrypted = data.slice(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// Multer
const upload = multer({ dest: STORE_FOLDER });

async function saveSession(code, data, ttl) {
  await redisClient.setEx(code, ttl, JSON.stringify(data));
  console.log(`✅ Saved ${code}`);
}

async function loadSession(code) {
  const val = await redisClient.get(code);
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch(e) {
    console.log(`❌ Parse error ${code}`);
    return null;
  }
}

async function deleteSession(code) {
  await redisClient.del(code);
  console.log(`🗑️ Deleted ${code}`);
}

app.post("/session/create", async (req, res) => {
  const code = makeCode();
  const ttl = req.body.timeout || 300;
  
  const session = {
    id: code,
    active: true,
    receiverOnline: false,
    text: null,
    file: null,
    lastSeen: Date.now(),
    ttl: ttl
  };
  
  await saveSession(code, session, ttl);
  res.json({ sessionKey: code, timeout: ttl });
});

app.post("/session/join/:code", async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  if (!session) return res.json({ msg: "session not found" });
  
  session.receiverOnline = true;
  session.lastSeen = Date.now();
  await saveSession(code, session, session.ttl);
  res.json({ msg: "receiver joined" });
});

app.get("/session/status/:code", async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  if (!session) return res.json({ status: "gone" });
  
  res.json({
    receiverOnline: session.receiverOnline,
    hasText: !!session.text,
    hasFile: !!session.file || (session.files && session.files.length > 0)
  });
});

app.post("/session/send/:code", async (req, res) => {
  const code = req.params.code;
  const { message } = req.body;
  const session = await loadSession(code);
  if (!session) return res.json({ msg: "session not found" });
  
  session.text = message;
  session.lastSeen = Date.now();
  await saveSession(code, session, session.ttl);
  res.json({ msg: "sent" });
});

app.get("/session/receive/:code", async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  if (!session) return res.json({ msg: "session not found" });
  
  const text = session.text;
  session.text = null;
  await saveSession(code, session, session.ttl);
  res.json({ data: text });
});

app.post("/session/upload/:code", upload.array("files"), async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  if (!session) return res.json({ msg: "session not found" });
  
  if (!req.files || req.files.length === 0) return res.json({ msg: "no file" });
  
  if (!session.files) session.files = [];
  
  for(let file of req.files) {
    const raw = fs.readFileSync(file.path);
    const encrypted = encrypt(raw);
    fs.writeFileSync(file.path, encrypted);
    
    session.files.push({
      name: file.filename,
      original: file.originalname,
      type: file.mimetype,
      size: file.size
    });
  }
  
  session.lastSeen = Date.now();
  await saveSession(code, session, session.ttl);
  res.json({ msg: "uploaded", count: req.files.length });
});

app.get("/session/file-info/:code", async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  
  const filesList = [];
  if (session && session.file) {
    filesList.push({ fileName: session.file.original, fileSize: session.file.size, id: session.file.name });
  }
  if (session && session.files) {
    session.files.forEach(f => filesList.push({ fileName: f.original, fileSize: f.size, id: f.name }));
  }
  
  if (filesList.length === 0) return res.json({ msg: "no file" });
  res.json({ files: filesList });
});

app.get("/session/download/:code", async (req, res) => {
  const code = req.params.code;
  const fileId = req.query.fileId;
  const session = await loadSession(code);
  if (!session) return res.status(404).send("no session");
  
  let fileMeta = null;
  if(session.files && fileId) fileMeta = session.files.find(f => f.name === fileId);
  else if (session.file && (!fileId || session.file.name === fileId)) fileMeta = session.file;
  else if (!fileId && session.files && session.files.length > 0) fileMeta = session.files[0];
  
  if (!fileMeta) return res.status(404).send("file not found");
  
  const filePath = path.join(STORE_FOLDER, fileMeta.name);
  if (!fs.existsSync(filePath)) return res.status(404).send("missing");
  
  const encrypted = fs.readFileSync(filePath);
  const decrypted = decrypt(encrypted);
  const temp = filePath + ".dec";
  fs.writeFileSync(temp, decrypted);
  
  res.download(temp, fileMeta.original, async () => {
    if(fs.existsSync(temp)) fs.unlinkSync(temp);
    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
    
    if(session.files) {
      session.files = session.files.filter(f => f.name !== fileMeta.name);
      await saveSession(code, session, session.ttl);
    } else {
      await deleteSession(code);
    }
  });
});

app.post("/session/terminate/:code", async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  if (session) {
    if (session.file) {
      const p = path.join(STORE_FOLDER, session.file.name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (session.files) {
      session.files.forEach(f => {
        const p = path.join(STORE_FOLDER, f.name);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    }
  }
  await deleteSession(code);
  res.json({ msg: "terminated", terminated: true });
});

app.get("/session/info/:code", async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  if (!session) return res.json({ exists: false });
  
  const remaining = session.ttl - ((Date.now() - session.lastSeen) / 1000);
  res.json({
    exists: true,
    remainingTime: Math.max(0, remaining),
    hasFile: !!session.file || (session.files && session.files.length > 0),
    receiverOnline: session.receiverOnline
  });
});

app.get("/join/:code", (req, res) => {
  res.redirect(`/receiver.html?code=${req.params.code}`);
});

function startServer(k, c) {
  const credentials = { key: k, cert: c };
  https.createServer(credentials, app).listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Secure Server (HTTPS) running on https://localhost:${PORT}\n`);
  });
}