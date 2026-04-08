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
const STORE_FOLDER = path.join(__dirname, "uploads");

// make sure the folder is there before we use it
if (!fs.existsSync(STORE_FOLDER)) {
  fs.mkdirSync(STORE_FOLDER);
}

// setup our redis database connection
const redisConnection = createClient();

redisConnection.on("error", (err) => console.log("Redis issue:", err));

async function startRedis() {
  await redisConnection.connect();
  console.log("Redis is ready");
}
startRedis();

// this creates a short unique code for each session
function makeSessionCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// ENCRYPTION PART this is the secret key for encryption - same on both sides
const SECRET_KEY = Buffer.from("12345678901234567890123456789012");

// function to lock the file data
function lockData(info) {
  const initVector = crypto.randomBytes(16);
  const cipherLock = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, initVector);
  const lockedData = Buffer.concat([cipherLock.update(info), cipherLock.final()]);
  return Buffer.concat([initVector, lockedData]);
}

// function to unlock the file data
function unlockData(lockedInfo) {
  const initVector = lockedInfo.slice(0, 16);
  const lockedData = lockedInfo.slice(16);
  const cipherUnlock = crypto.createDecipheriv("aes-256-cbc", SECRET_KEY, initVector);
  return Buffer.concat([cipherUnlock.update(lockedData), cipherUnlock.final()]);
}

// FILE UPLOAD SETUP 
const fileStore = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, STORE_FOLDER);
  },
  filename: function (req, file, cb) {
    const uniqueFileName = Date.now() + "-" + crypto.randomBytes(4).toString("hex") + path.extname(file.originalname);
    cb(null, uniqueFileName);
  },
});

const uploadFile = multer({ storage: fileStore });

// SESSION WITH TIMEOUT making a new session - if no timeout given, use 300 seconds (5 minutes)
async function makeNewSession(customTimeout = null) {
  const sessionCode = makeSessionCode();
  const timeToLive = customTimeout || 300;
  
  const sessionInfo = {
    id: sessionCode,
    currentState: "alive",
    senderOnline: true,
    receiverOnline: false,
    textMsg: null,
    uploadedFile: null,
    startTime: Date.now(),
    lastSeen: Date.now(),
    expireAfter: timeToLive,
    bytesDone: 0,
    fileStatus: "waiting"
  };
  await redisConnection.set(sessionCode, JSON.stringify(sessionInfo), { EX: timeToLive });
  
  console.log(`new session made: ${sessionCode}`);
  console.log(`will expire in: ${timeToLive} seconds`);
  return sessionCode;
}

// this keeps the session alive while someone is using it
async function keepSessionAlive(sessionCode) {
  const sessionInfo = await fetchSession(sessionCode);
  if (sessionInfo && sessionInfo.currentState === "alive") {
    sessionInfo.lastSeen = Date.now();
    const timeToLive = sessionInfo.expireAfter;
    await redisConnection.set(sessionCode, JSON.stringify(sessionInfo), { EX: timeToLive });
    console.log(`session ${sessionCode} is still active`);
    return true;
  }
  return false;
}

// track how much data has been sent
async function trackProgress(sessionCode, bytesDone, totalBytes = null) {
  const sessionInfo = await fetchSession(sessionCode);
  if (sessionInfo && sessionInfo.currentState === "alive") {
    sessionInfo.bytesDone = bytesDone;
    if (totalBytes) {
      sessionInfo.fileStatus = "sending";
    }
    const timeToLive = sessionInfo.expireAfter;
    await redisConnection.set(sessionCode, JSON.stringify(sessionInfo), { EX: timeToLive });
    const percentDone = totalBytes ? ((bytesDone / totalBytes) * 100).toFixed(2) : 0;
    console.log(`transfer: ${percentDone}% done (${bytesDone}/${totalBytes} bytes)`);
    return true;
  }
  return false;
}

// clean up session when transfer finishes
async function finishSession(sessionCode) {
  const sessionInfo = await fetchSession(sessionCode);
  if (sessionInfo) {
    sessionInfo.currentState = "done";
    sessionInfo.fileStatus = "done";
    sessionInfo.completedAt = Date.now();
    await redisConnection.del(sessionCode);
    console.log(`session ${sessionCode} is done and removed`);
    return true;
  }
  return false;
}

// check if session has expired
function checkIfExpired(sessionInfo) {
  if (!sessionInfo) return true;
  const rightNow = Date.now();
  const lastActive = sessionInfo.lastSeen || sessionInfo.startTime;
  const maxTime = (sessionInfo.expireAfter || 300) * 1000;
  return (rightNow - lastActive) > maxTime;
}

// get session data from redis
async function fetchSession(sessionCode) {
  const rawData = await redisConnection.get(sessionCode);
  if (!rawData) return null;
  
  const sessionInfo = JSON.parse(rawData);
  if (sessionInfo.currentState === "alive" && checkIfExpired(sessionInfo)) {
    console.log(`session ${sessionCode} expired from no activity`);
    await redisConnection.del(sessionCode);
    return null;
  }
  return sessionInfo;
}

// save session back to redis
async function storeSession(sessionCode, sessionInfo, customTTL = null) {
  const timeToLive = customTTL || sessionInfo.expireAfter || 300;
  await redisConnection.set(sessionCode, JSON.stringify(sessionInfo), { EX: timeToLive });
}

// API ENDPOINTS-> make a new session - frontend calls this first
app.post("/session/create", async (req, res) => {
  const { timeout } = req.body;
  const sessionCode = await makeNewSession(timeout);
  
  res.json({ 
    sessionKey: sessionCode,
    timeout: timeout || 300,
    msg: `session ready - will expire in ${timeout || 300} seconds`
  });
});

// receiver joins using the session code
app.post("/session/join/:code", async (req, res) => {
  const sessionCode = req.params.code;
  const sessionInfo = await fetchSession(sessionCode);
  if (!sessionInfo) {
    return res.json({ msg: "session not found or already expired" });
  }

  sessionInfo.receiverOnline = true;
  await keepSessionAlive(sessionCode);
  await storeSession(sessionCode, sessionInfo);
  res.json({ msg: "receiver joined the session" });
});

// check what's happening in the session
app.get("/session/status/:code", async (req, res) => {
  const sessionCode = req.params.code;
  const sessionInfo = await fetchSession(sessionCode);
  if (!sessionInfo) {
    return res.json({ 
      status: "gone",
      msg: "session is not there anymore"
    });
  }

  res.json({
    status: sessionInfo.currentState,
    receiverOnline: sessionInfo.receiverOnline,
    hasText: !!sessionInfo.textMsg,
    hasFile: !!sessionInfo.uploadedFile,
    fileStatus: sessionInfo.fileStatus,
    timeout: sessionInfo.expireAfter,
    lastSeen: sessionInfo.lastSeen
  });
});

// sender sends a text message
app.post("/session/send/:code", async (req, res) => {
  const sessionCode = req.params.code;
  const { message } = req.body;
  const sessionInfo = await fetchSession(sessionCode);
  if (!sessionInfo) {
    return res.json({ msg: "session not found" });
  }
  if (!sessionInfo.receiverOnline) {
    return res.json({ msg: "receiver not connected yet" });
  }
  sessionInfo.textMsg = message || "";
  await keepSessionAlive(sessionCode);
  await storeSession(sessionCode, sessionInfo);

  res.json({ msg: "text message sent" });
});

// receiver gets the text message
app.get("/session/receive/:code", async (req, res) => {
  const sessionCode = req.params.code;
  const sessionInfo = await fetchSession(sessionCode);
  if (!sessionInfo) {
    return res.json({ msg: "session not found" });
  }
  if (!sessionInfo.textMsg) {
    return res.json({ msg: "nothing to receive yet" });
  }
  
  const messageText = sessionInfo.textMsg;
  sessionInfo.textMsg = null;
  await keepSessionAlive(sessionCode);
  await storeSession(sessionCode, sessionInfo);
  
  res.json({ data: messageText });
});

// terminate session immediately after receiving content
app.post("/session/terminate/:code", async (req, res) => {
  const sessionCode = req.params.code;
  const sessionInfo = await fetchSession(sessionCode);
  
  if (!sessionInfo) {
    return res.json({ msg: "session not found" });
  }
  
  if (sessionInfo.uploadedFile && sessionInfo.uploadedFile.storedName) {
    const filePath = path.join(STORE_FOLDER, sessionInfo.uploadedFile.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  
  await redisConnection.del(sessionCode);
  console.log(`session ${sessionCode} terminated`);
  
  res.json({ 
    msg: "session terminated successfully",
    terminated: true 
  });
});

// upload a file - with encryption
app.post("/session/upload/:code", uploadFile.single("file"), async (req, res) => {
  const sessionCode = req.params.code;
  const sessionInfo = await fetchSession(sessionCode);
  if (!sessionInfo) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.json({ msg: "session not found" });
  }
  if (!sessionInfo.receiverOnline) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.json({ msg: "receiver not there" });
  }
  if (!req.file) {
    return res.json({ msg: "no file selected" });
  }
  // remove old file if present
  if (sessionInfo.uploadedFile && sessionInfo.uploadedFile.storedName) {
    const oldFilePath = path.join(STORE_FOLDER, sessionInfo.uploadedFile.storedName);
    if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
  }
  await keepSessionAlive(sessionCode);
  await trackProgress(sessionCode, 0, req.file.size);
  
  // lock the file with encryption
  const originalData = fs.readFileSync(req.file.path);
  const lockedData = lockData(originalData);
  fs.writeFileSync(req.file.path, lockedData);
  console.log(`file locked and saved: ${req.file.filename}`);
  await trackProgress(sessionCode, req.file.size, req.file.size);
  
  sessionInfo.uploadedFile = {
    storedName: req.file.filename,
    originalName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
  };
  sessionInfo.fileStatus = "done";
  await storeSession(sessionCode, sessionInfo);
  
  res.json({
    msg: "file uploaded and locked",
    fileName: req.file.originalname,
    fileSize: req.file.size
  });
});

// get file information for receiver
app.get("/session/file-info/:code", async (req, res) => {
  const sessionCode = req.params.code;
  const sessionInfo = await fetchSession(sessionCode);
  if (!sessionInfo) {
    return res.json({ msg: "session not found" });
  }
  if (!sessionInfo.uploadedFile) {
    return res.json({ msg: "no file ready yet" });
  }
  res.json({
    fileName: sessionInfo.uploadedFile.originalName,
    fileType: sessionInfo.uploadedFile.fileType,
    fileSize: sessionInfo.uploadedFile.fileSize,
  });
});

// download the file - with decryption
app.get("/session/download/:code", async (req, res) => {
  const sessionCode = req.params.code;
  const sessionInfo = await fetchSession(sessionCode);

  if (!sessionInfo) {
    return res.status(404).send("session not found");
  }
  if (!sessionInfo.uploadedFile) {
    return res.status(404).send("no file to download");
  }
  const filePath = path.join(STORE_FOLDER, sessionInfo.uploadedFile.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("file missing");
  }
  const originalName = sessionInfo.uploadedFile.originalName;
  await keepSessionAlive(sessionCode);
  // unlocking the file before sending
  const lockedData = fs.readFileSync(filePath);
  const unlockedData = unlockData(lockedData);
  const tempFilePath = filePath + ".temp";
  fs.writeFileSync(tempFilePath, unlockedData);
  console.log(`file unlocked for download: ${originalName}`);
  res.download(tempFilePath, originalName, async (err) => {
    if (!err) {
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await finishSession(sessionCode);
      } catch (e) {
        console.log("cleanup had an issue:", e.message);
      }
    }
  });
});

// get detailed session information
app.get("/session/info/:code", async (req, res) => {
  const sessionCode = req.params.code;
  const sessionInfo = await fetchSession(sessionCode);
  
  if (!sessionInfo) {
    return res.json({ 
      exists: false, 
      msg: "session not found" 
    });
  }
  
  const timeRemaining = sessionInfo.expireAfter - ((Date.now() - (sessionInfo.lastSeen || sessionInfo.startTime)) / 1000);
  res.json({
    exists: true,
    sessionKey: sessionCode,
    status: sessionInfo.currentState,
    fileStatus: sessionInfo.fileStatus,
    timeout: sessionInfo.expireAfter,
    remainingTime: Math.max(0, timeRemaining),
    hasFile: !!sessionInfo.uploadedFile,
    receiverOnline: sessionInfo.receiverOnline
  });
});

// manually close a session
app.delete("/session/end/:code", async (req, res) => {
  const sessionCode = req.params.code;
  const sessionInfo = await fetchSession(sessionCode);
  if (sessionInfo && sessionInfo.uploadedFile && sessionInfo.uploadedFile.storedName) {
    const filePath = path.join(STORE_FOLDER, sessionInfo.uploadedFile.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await redisConnection.del(sessionCode);
  console.log(`session ${sessionCode} was closed manually`);
  res.json({ msg: "session closed" });
});

// ============================================
// SHAREABLE SESSION LINK - NEW ENDPOINT
// ============================================
app.get("/join/:code", (req, res) => {
  const sessionCode = req.params.code;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="0;url=/receiver.html?code=${sessionCode}">
      <title>Joining SecureFileSync...</title>
      <style>
        body {
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #0f0c29, #1a1a3e, #0f0c29);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          text-align: center;
          color: white;
          margin: 0;
        }
        .loader {
          width: 50px;
          height: 50px;
          border: 3px solid rgba(102,126,234,0.3);
          border-radius: 50%;
          border-top-color: #667eea;
          animation: spin 1s ease-in-out infinite;
          margin: 20px auto;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .code-box {
          background: rgba(0,0,0,0.5);
          padding: 10px 20px;
          border-radius: 30px;
          font-family: monospace;
          font-size: 1.2rem;
          letter-spacing: 2px;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div>
        <div class="loader"></div>
        <h2>Redirecting to secure session...</h2>
        <div class="code-box">Session: ${sessionCode}</div>
        <p style="margin-top:20px; font-size:0.8rem; color:#a0a0c0;">If not redirected, <a href="/receiver.html?code=${sessionCode}" style="color:#667eea;">click here</a></p>
      </div>
    </body>
    </html>
  `);
});

setInterval(async () => {
  console.log(`checking sessions at ${new Date().toLocaleTimeString()}`);// just a background check - runs every minute
}, 60000);

// start the server
app.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
  console.log(`features that are working:`);
  console.log(`   session timeout is 300 seconds (5 minutes) by default`);
  console.log(`   auto-extend while transferring`);
  console.log(`   redis handles inactive sessions`);
  console.log(`   auto cleanup after download`);
  console.log(`   instant session termination after receiving content`);
  console.log(`   shareable session links (/join/:code)`);
  console.log(`   aes encryption is on`);
  console.log(`   progress tracking is active`);
});