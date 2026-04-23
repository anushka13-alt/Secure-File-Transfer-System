# 🔐 Secure Data Transfer System

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

**B.Tech CSE 6th Semester — Full Stack Development Project**  
**Team SECURESYNC | Team #T216 | Graphic Era Deemed to be University, Dehradun**

</div>

---

## 📌 Project Overview

**Secure Data Transfer System** is a full-stack web application that enables secure, real-time file and text transfer between two users over a shared session. The system uses **AES-256-CBC encryption** to protect file data at rest, **Redis** for session state management, and a clean **HTML/CSS/JS** frontend for an intuitive user experience.

> Built as part of the Full Stack Development course (B.Tech CSE, 6th Semester).

---

## 👥 Team Members

| # | Name | Roll No | Contribution |
|---|------|---------|--------------|
| 1 | **Ayushi Aswal** *(Team Lead)* | 23022979 | Server-side receiving, File reconstruction & validation |
| 2 | **Anushka Bisht** | 230221046 | Client-side file sending, Backend logic & data handling |
| 3 | **Kushagra Ojha** | 230211604 | Redis integration, Session management & active connections |
| 4 | **Suryansh Puri** | 230111545 | Frontend UI, Testing, Error handling |

---

## ✨ Features

- 🔒 **AES-256-CBC Encryption** — Files are encrypted before storage and decrypted only on download
- 📁 **Multi-format File Transfer** — Supports Text, Images, and PDF files
- 🧩 **Chunk-based Transmission** — Large files split into fixed-size chunks for reliable delivery
- 🗄️ **Redis Session Management** — Sessions auto-expire after 5 minutes (TTL)
- 🔗 **Shareable Session Links** — Receiver can join via `/join/:code`
- 📊 **Real-time Progress Bar** — Live upload/download progress feedback
- ⏱️ **Auto Session Extension** — Session TTL extends automatically during active transfer
- ⚡ **Instant Session Termination** — Both sender and receiver pages redirect on session end
- 🧹 **Auto File Cleanup** — Encrypted files deleted from server after successful download
- 🌐 **REST API Architecture** — Clean, well-structured HTTP endpoints

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, JavaScript, Font Awesome |
| **Backend** | Node.js, Express.js, Multer |
| **Database** | Redis (in-memory session store) |
| **Encryption** | Node.js `crypto` module — AES-256-CBC |
| **Communication** | HTTP / REST APIs |

---

## 🏗️ Project Structure

```
Secure-File-Transfer-System/
├── server.js               # Main backend server (Express + Redis + AES)
├── package.json            # Project dependencies
├── uploads/                # Temporary encrypted file storage
└── public/
    ├── index.html          # Landing page
    ├── sender.html         # Sender interface
    └── receiver.html       # Receiver interface
```

---

## ⚙️ Architecture

```
┌─────────────────┐         HTTP/REST          ┌─────────────────┐
│   Sender (Client)│ ─────── Upload ──────────► │  Express Server │
│   sender.html    │                             │   server.js     │
└─────────────────┘                             │                 │
                                                │  AES-256-CBC    │
┌─────────────────┐         HTTP/REST          │  Encrypt/Decrypt│
│ Receiver (Client)│ ◄────── Download ───────── │                 │
│  receiver.html   │                             │  Redis Session  │
└─────────────────┘                             │  Management     │
                                                └─────────────────┘
```

**Three-Layer Architecture:**
- **Client Layer** — Handles file selection, chunking, and UI interaction
- **Server Layer** — Manages connections, AES encryption/decryption, file reconstruction
- **Session Layer (Redis)** — Maintains session state, TTL, and active connection tracking

---

## 🔐 Encryption Flow

```
SENDER SIDE                        SERVER STORAGE             RECEIVER SIDE
───────────                        ──────────────             ─────────────
Original File                      Encrypted File             Original File
     │                                   │                          │
     │  Read binary                      │  IV + Ciphertext         │  Decrypted
     ▼                                   ▼                          ▼
  Raw Buffer  ──► AES-256-CBC ──►  [IV (16B) + Ciphertext]  ──► AES-256-CBC ──► Raw Buffer
                  Encrypt                                          Decrypt
                  Random IV                                    Extract IV from
                                                               first 16 bytes
```

- **Algorithm:** AES-256-CBC
- **Key Size:** 32 bytes (256-bit)
- **IV:** Randomly generated per file, prepended to ciphertext
- **Decryption:** Full payload received before decryption (CBC block alignment)

---

## 🌐 REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/session/create` | Create a new transfer session |
| `POST` | `/session/join/:code` | Join an existing session as receiver |
| `GET` | `/session/status/:code` | Get session connection status |
| `GET` | `/session/info/:code` | Get detailed session information |
| `POST` | `/session/send/:code` | Send a text message |
| `GET` | `/session/receive/:code` | Receive a text message |
| `POST` | `/session/upload/:code` | Upload and encrypt a file |
| `GET` | `/session/download/:code` | Download and decrypt a file |
| `GET` | `/session/file-info/:code` | Get uploaded file metadata |
| `POST` | `/session/terminate/:code` | Terminate the session |
| `GET` | `/join/:code` | Shareable session join link |

---

## 🚀 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v16 or higher
- Redis server running on `localhost:6379`

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/anushka13-alt/Secure-File-Transfer-System.git
cd Secure-File-Transfer-System
```

**2. Install dependencies**
```bash
npm install
```

**3. Start Redis** *(if not already running)*
```bash
# Windows (Memurai)
# Redis auto-starts as a Windows service after Memurai installation

# WSL / Linux
sudo service redis-server start
```

**4. Start the server**
```bash
node server.js
```

**5. Open in browser**
```
http://localhost:3000
```

---

## 📋 Usage

1. **Sender** opens `http://localhost:3000` → clicks **"Create Session"**
2. A **6-character session code** is generated
3. Sender shares the code or link with the Receiver
4. **Receiver** opens the link → enters the session code → clicks **"Join"**
5. Sender uploads a file or types a text message → clicks **"Send"**
6. Receiver sees the file/text appear → clicks **"Download"**
7. Session auto-terminates after download or after 5-minute TTL

---

## 🧪 Testing Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| Client-server connection | ✅ Pass | Stable TCP communication established |
| Text message transfer | ✅ Pass | Sent and received correctly |
| Image file transfer | ✅ Pass | Binary data preserved after encryption |
| PDF file transfer | ✅ Pass | File integrity maintained after decryption |
| Large file chunk-based transfer | ✅ Pass | No data loss with chunked transmission |
| File reconstruction at receiver | ✅ Pass | Downloaded file matches original |
| AES encryption/decryption | ✅ Pass | Stored file unreadable; downloaded file intact |
| Error handling & recovery | ✅ Pass | Handles failures and incomplete transfers |

---

## ⚡ Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Socket connection instability | Improved error handling and reconnection logic |
| Data loss in large file transfers | Implemented chunk-based transmission |
| Redis setup complexity | Proper session key-value design with TTL |
| Binary file reconstruction errors | Strict binary buffer formatting and validation |
| Image upload failures | Better data handling and MIME type validation |

---

## 📦 Deliverables

- [x] Secure data transfer system — **Completed**
- [x] Client-server architecture — **Completed**
- [x] Text, Image, PDF file transfer — **Completed**
- [x] Redis-based session management — **Completed**
- [x] AES-256 encryption — **Completed**
- [x] User interface — **Completed**
- [x] Testing & validation — **Completed**
- [x] Documentation — **Completed**

---

## 🔮 Future Enhancements

- [ ] User authentication with JWT tokens
- [ ] End-to-end encryption with asymmetric keys (RSA key exchange)
- [ ] Multi-user session support
- [ ] File transfer progress via WebSockets
- [ ] Mobile responsive UI improvements
- [ ] Docker containerization for easy deployment

---

## 📁 Repository

🔗 **GitHub:** [https://github.com/anushka13-alt/Secure-File-Transfer-System](https://github.com/anushka13-alt/Secure-File-Transfer-System)  
🌿 **Branch:** `main`

### Key Commits
- `Initial project setup` — Basic client-server connection using Node.js
- `Chunk-based transfer` — Reliable file transmission implementation
- `Text file support` — Added text transfer functionality
- `Image & PDF support` — Extended to binary file types
- `Redis integration` — Session management and connection handling
- `AES-256 encryption` — File encryption before storage, decryption on download
- `Error handling` — Fixed incomplete uploads and connection failures
- `Final cleanup` — Testing, documentation, and code cleanup


<div align="center">

**Made  by Team SECURESYNC (T216)**  
*Graphic Era Deemed to be University, Dehradun*  
*B.Tech CSE — Full Stack Development, 6th Semester*

</div>
