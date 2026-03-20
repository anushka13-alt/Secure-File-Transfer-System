
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("redis");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, "uploads");

// ensure uploads folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  if (fs.existsSync(UPLOAD_DIR)) {
  const stat = fs.statSync(UPLOAD_DIR);
  if (!stat.isDirectory()) {
    fs.unlinkSync(UPLOAD_DIR);
    fs.mkdirSync(UPLOAD_DIR);
  }
} else {
  fs.mkdirSync(UPLOAD_DIR);
}
}

// Redis setup
const redisClient = createClient();

redisClient.on("error", (err) => console.log("Redis Error:", err));

async function connectRedis() {
  await redisClient.connect();
  console.log("Redis Connected");
}
connectRedis();

// secure key
function generateKey() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + crypto.randomBytes(4).toString("hex") + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// helper: get session
async function getSession(key) {
  const data = await redisClient.get(key);
  if (!data) return null;
  return JSON.parse(data);
}

// helper: save session with TTL 5 min
async function saveSession(key, session) {
  await redisClient.set(key, JSON.stringify(session), { EX: 300 });
}

// CREATE SESSION
app.post("/session/create", async (req, res) => {
  const key = generateKey();

  const session = {
    senderConnected: true,
    receiverConnected: false,
    textData: null,
    file: null, // { storedName, originalName, mimeType, size }
    createdAt: Date.now(),
  };

  await saveSession(key, session);

  res.json({ sessionKey: key });
});

// JOIN SESSION
app.post("/session/join/:key", async (req, res) => {
  const key = req.params.key;

  const session = await getSession(key);
  if (!session) {
    return res.json({ message: "Invalid key" });
  }

  session.receiverConnected = true;
  await saveSession(key, session);

  res.json({ message: "Receiver connected" });
});

// STATUS
app.get("/session/status/:key", async (req, res) => {
  const key = req.params.key;

  const session = await getSession(key);
  if (!session) {
    return res.json({ status: "invalid" });
  }

  res.json({
    receiverConnected: session.receiverConnected,
    hasText: !!session.textData,
    hasFile: !!session.file,
  });
});

// SEND TEXT
app.post("/session/send/:key", async (req, res) => {
  const key = req.params.key;
  const { message } = req.body;

  const session = await getSession(key);
  if (!session) {
    return res.json({ message: "Invalid key" });
  }

  if (!session.receiverConnected) {
    return res.json({ message: "Receiver not connected" });
  }

  session.textData = message || "";
  await saveSession(key, session);

  res.json({ message: "Text sent successfully" });
});

// RECEIVE TEXT
app.get("/session/receive/:key", async (req, res) => {
  const key = req.params.key;

  const session = await getSession(key);
  if (!session) {
    return res.json({ message: "Invalid key" });
  }

  if (!session.textData) {
    return res.json({ message: "Waiting for text" });
  }

  const text = session.textData;
  session.textData = null;
  await saveSession(key, session);

  res.json({ data: text });
});

// UPLOAD FILE
app.post("/session/upload/:key", upload.single("file"), async (req, res) => {
  const key = req.params.key;

  const session = await getSession(key);
  if (!session) {
    // uploaded file delete if session invalid
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.json({ message: "Invalid key" });
  }

  if (!session.receiverConnected) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.json({ message: "Receiver not connected" });
  }

  if (!req.file) {
    return res.json({ message: "No file uploaded" });
  }

  // if old file exists, remove it
  if (session.file && session.file.storedName) {
    const oldPath = path.join(UPLOAD_DIR, session.file.storedName);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  session.file = {
    storedName: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  };

  await saveSession(key, session);

  res.json({
    message: "File uploaded successfully",
    fileName: req.file.originalname,
  });
});

// FILE INFO FOR RECEIVER
app.get("/session/file-info/:key", async (req, res) => {
  const key = req.params.key;

  const session = await getSession(key);
  if (!session) {
    return res.json({ message: "Invalid key" });
  }

  if (!session.file) {
    return res.json({ message: "No file available" });
  }

  res.json({
    fileName: session.file.originalName,
    mimeType: session.file.mimeType,
    size: session.file.size,
  });
});

// DOWNLOAD FILE
app.get("/session/download/:key", async (req, res) => {
  const key = req.params.key;

  const session = await getSession(key);
  if (!session) {
    return res.status(404).send("Invalid key");
  }

  if (!session.file) {
    return res.status(404).send("No file available");
  }

  const filePath = path.join(UPLOAD_DIR, session.file.storedName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  const originalName = session.file.originalName;

  res.download(filePath, originalName, async (err) => {
    if (!err) {
      // after successful download, cleanup file metadata + file
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        session.file = null;
        await saveSession(key, session);
      } catch (e) {
        console.log("Cleanup error:", e.message);
      }
    }
  });
});

// optional manual end session
app.delete("/session/end/:key", async (req, res) => {
  const key = req.params.key;
  const session = await getSession(key);

  if (session && session.file && session.file.storedName) {
    const filePath = path.join(UPLOAD_DIR, session.file.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await redisClient.del(key);
  res.json({ message: "Session ended" });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});