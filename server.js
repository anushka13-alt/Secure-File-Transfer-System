const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const os = require("os");
const bcrypt = require("bcrypt");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const STORE_FOLDER = path.join(__dirname, "uploads");
if (!fs.existsSync(STORE_FOLDER)) {
  fs.mkdirSync(STORE_FOLDER);
}

const memoryStore = new Map();

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// Use environment variable for encryption key (fallback for local dev only)
const RAW_KEY = process.env.ENCRYPTION_KEY || "12345678901234567890123456789012";
const KEY = Buffer.from(RAW_KEY.padEnd(32).slice(0, 32));

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

const upload = multer({ dest: STORE_FOLDER });

async function saveSession(code, data, ttl) {
  const expiresAt = Date.now() + ttl * 1000;
  memoryStore.set(code, { data, expiresAt });
}

async function loadSession(code) {
  const record = memoryStore.get(code);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    memoryStore.delete(code);
    return null;
  }
  return record.data;
}

async function deleteSession(code) {
  memoryStore.delete(code);
}

// Create HTTP server for Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active call rooms
const callRooms = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 New WebSocket connection: ${socket.id}`);

  // Join a call room
  socket.on('join-call', ({ sessionId, userId }) => {
    socket.join(`call-${sessionId}`);
    socket.callRoom = `call-${sessionId}`;
    
    const room = callRooms.get(sessionId) || { users: [] };
    if (!room.users.includes(socket.id)) {
      room.users.push(socket.id);
    }
    callRooms.set(sessionId, room);
    
    // Notify others in room
    socket.to(`call-${sessionId}`).emit('user-joined', { userId: socket.id });
    
    // If there are other users, send their info to the new user
    const otherUsers = room.users.filter(id => id !== socket.id);
    if (otherUsers.length > 0) {
      socket.emit('existing-users', { users: otherUsers });
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', ({ sessionId, offer, targetId }) => {
    socket.to(`call-${sessionId}`).emit('offer', { offer, fromId: socket.id, targetId });
  });

  socket.on('answer', ({ sessionId, answer, targetId }) => {
    socket.to(`call-${sessionId}`).emit('answer', { answer, fromId: socket.id, targetId });
  });

  socket.on('ice-candidate', ({ sessionId, candidate, targetId }) => {
    socket.to(`call-${sessionId}`).emit('ice-candidate', { candidate, fromId: socket.id, targetId });
  });

  // Toggle microphone
  socket.on('toggle-mic', ({ sessionId, enabled }) => {
    socket.to(`call-${sessionId}`).emit('mic-toggled', { userId: socket.id, enabled });
  });

  // Toggle camera
  socket.on('toggle-camera', ({ sessionId, enabled }) => {
    socket.to(`call-${sessionId}`).emit('camera-toggled', { userId: socket.id, enabled });
  });

  // Leave call
  socket.on('leave-call', ({ sessionId }) => {
    socket.to(`call-${sessionId}`).emit('user-left', { userId: socket.id });
    socket.leave(`call-${sessionId}`);
    
    const room = callRooms.get(sessionId);
    if (room) {
      room.users = room.users.filter(id => id !== socket.id);
      if (room.users.length === 0) {
        callRooms.delete(sessionId);
      } else {
        callRooms.set(sessionId, room);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 WebSocket disconnected: ${socket.id}`);
    if (socket.callRoom) {
      socket.to(socket.callRoom).emit('user-left', { userId: socket.id });
    }
  });
});

// ── Routes ──────────────────────────────────────────────────────────────────

// CREATE SESSION (with optional password)
app.post("/session/create", async (req, res) => {
  const code = makeCode();
  const ttl = req.body.timeout || 300;
  const { password } = req.body;
  
  // Hash password if provided
  let hashedPassword = null;
  if (password && password.trim()) {
    hashedPassword = await bcrypt.hash(password, 10);
  }
  
  const session = {
    id: code,
    active: true,
    receiverOnline: false,
    text: null,
    file: null,
    lastSeen: Date.now(),
    ttl,
    hashedPassword,  // Store hashed password for protected sessions
    oneTimeFiles: new Map() // Track which files have been downloaded
  };
  await saveSession(code, session, ttl);
  res.json({ 
    sessionKey: code, 
    timeout: ttl,
    requiresPassword: !!hashedPassword 
  });
});

// JOIN SESSION (with password validation)
app.post("/session/join/:code", async (req, res) => {
  const code = req.params.code;
  const { password } = req.body;
  const session = await loadSession(code);
  if (!session) return res.json({ msg: "session not found" });
  
  // Check password if session is password-protected
  if (session.hashedPassword) {
    if (!password) return res.json({ msg: "password required" });
    const isValid = await bcrypt.compare(password, session.hashedPassword);
    if (!isValid) return res.json({ msg: "incorrect password" });
  }
  
  session.receiverOnline = true;
  session.lastSeen = Date.now();
  await saveSession(code, session, session.ttl);
  res.json({ msg: "receiver joined" });
});

// GET SESSION INFO (includes password requirement status)
app.get("/session/info/:code", async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  if (!session) return res.json({ exists: false });
  const remaining = session.ttl - (Date.now() - session.lastSeen) / 1000;
  res.json({
    exists: true,
    remainingTime: Math.max(0, remaining),
    hasFile: !!session.file || (session.files && session.files.length > 0),
    receiverOnline: session.receiverOnline,
    requiresPassword: !!session.hashedPassword
  });
});

app.get("/session/status/:code", async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  if (!session) return res.json({ status: "gone" });
  res.json({
    receiverOnline: session.receiverOnline,
    hasText: !!session.text,
    hasFile: !!session.file || (session.files && session.files.length > 0),
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

// UPLOAD with one-time download tracking
app.post("/session/upload/:code", upload.array("files"), async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  if (!session) return res.json({ msg: "session not found" });
  if (!req.files || req.files.length === 0) return res.json({ msg: "no file" });
  if (!session.files) session.files = [];
  if (!session.oneTimeFiles) session.oneTimeFiles = new Map();
  
  for (let file of req.files) {
    const raw = fs.readFileSync(file.path);
    const encrypted = encrypt(raw);
    fs.writeFileSync(file.path, encrypted);
    
    const fileId = file.filename;
    session.files.push({
      name: fileId,
      original: file.originalname,
      type: file.mimetype,
      size: file.size,
    });
    
    // Track this file as NOT yet downloaded (one-time download)
    session.oneTimeFiles.set(fileId, false);
  }
  session.lastSeen = Date.now();
  await saveSession(code, session, session.ttl);
  res.json({ msg: "uploaded", count: req.files.length });
});

// FILE INFO with one-time download status
app.get("/session/file-info/:code", async (req, res) => {
  const code = req.params.code;
  const session = await loadSession(code);
  const filesList = [];
  
  if (session && session.files) {
    session.files.forEach((f) => {
      // Check if file already downloaded (one-time download feature)
      const isDownloaded = session.oneTimeFiles?.get(f.name) === true;
      filesList.push({ 
        fileName: f.original, 
        fileSize: f.size, 
        id: f.name,
        isAvailable: !isDownloaded  // Mark if file is still available
      });
    });
  }
  if (filesList.length === 0) return res.json({ msg: "no file" });
  res.json({ files: filesList });
});

// DOWNLOAD with one-time delete
app.get("/session/download/:code", async (req, res) => {
  const code = req.params.code;
  const fileId = req.query.fileId;
  const session = await loadSession(code);
  if (!session) return res.status(404).send("no session");
  
  // Check if file already downloaded (one-time protection)
  if (session.oneTimeFiles?.get(fileId) === true) {
    return res.status(410).send("File already downloaded. One-time download links expire after first use.");
  }
  
  let fileMeta = null;
  if (session.files && fileId) fileMeta = session.files.find((f) => f.name === fileId);
  else if (!fileId && session.files && session.files.length > 0) fileMeta = session.files[0];
  if (!fileMeta) return res.status(404).send("file not found");
  
  const filePath = path.join(STORE_FOLDER, fileMeta.name);
  if (!fs.existsSync(filePath)) return res.status(404).send("missing");
  
  const encrypted = fs.readFileSync(filePath);
  const decrypted = decrypt(encrypted);
  const temp = filePath + ".dec";
  fs.writeFileSync(temp, decrypted);
  
  res.download(temp, fileMeta.original, async () => {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    
    // Mark file as downloaded (one-time download feature)
    if (session.oneTimeFiles) {
      session.oneTimeFiles.set(fileId, true);
    }
    
    // Remove file from session
    if (session.files) {
      session.files = session.files.filter((f) => f.name !== fileMeta.name);
      await saveSession(code, session, session.ttl);
    }
    
    // If no files left, optionally end session
    if (session.files && session.files.length === 0) {
      console.log(`Session ${code} has no files left`);
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
      session.files.forEach((f) => {
        const p = path.join(STORE_FOLDER, f.name);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    }
  }
  await deleteSession(code);
  res.json({ msg: "terminated", terminated: true });
});

app.get("/join/:code", (req, res) => {
  res.redirect(`/receiver.html?code=${req.params.code}`);
});

// ── Start server with Socket.IO ──────────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket signaling server ready for WebRTC calls`);
});