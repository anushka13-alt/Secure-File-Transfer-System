# 🔒 Secure Data Transfer System - Full Stack Project

> A complete full-stack secure file transfer system with Node.js/Express backend, Redis database, AES-256 encryption, and modern frontend UI.

**Course:** B.Tech CSE 6th Semester - Full Stack Development  
**Team Name:** Team #SECURESYNC (T216)

---

## 👥 Team Members & Roles

| Name | Roll No | Role |
|------|---------|------|
| Ayushi Aswal | 23022979 | Team Lead, Server-side receiving, File reconstruction |
| Kushagra Ojha | 230211604 | Redis Integration, Session Management |
| Suryansh Puri | 230111545 | Frontend UI, Testing, Error handling |
| Anushka Bisht | 230221046 | Client-side sending, Backend logic |

---

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | HTML5, CSS3, JavaScript | User interfaces, real-time updates |
| **Backend** | Node.js, Express.js | REST APIs, encryption, file handling |
| **Database** | Redis | Session storage, TTL management |
| **Communication** | HTTP/REST APIs | Frontend-backend data exchange |

---

## 🏗️ Architecture
┌─────────────┐ HTTP ┌─────────────┐ Redis ┌─────────────┐
│ FRONTEND │ ◄───────────► │ BACKEND │ ◄───────────► │ DATABASE │
│ HTML/CSS/JS│ REST APIs │ Node.js │ Sessions │ Redis │
└─────────────┘ └─────────────┘ └─────────────┘

---

## ✨ Features

| Feature | Status |
|---------|--------|
| Client-Server architecture | ✅ Complete |
| Text, Image, PDF file transfer | ✅ Complete |
| Chunk-based transmission | ✅ Complete |
| Redis session management | ✅ Complete |
| AES-256 encryption | ✅ Complete |
| Shareable session links | ✅ Complete |
| Real-time progress bar | ✅ Complete |
| Session timeout (5 min) | ✅ Complete |
| Auto-extend during transfer | ✅ Complete |
| Instant session termination | ✅ Complete |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, JavaScript, Font Awesome |
| Backend | Node.js, Express.js, Multer |
| Database | Redis |
| Encryption | Crypto (AES-256-CBC) |

---

## 📁 Project Structure
Secure-File-Transfer-System/
├── server.js # Backend (APIs + Redis + Encryption)
├── package.json # Dependencies
├── uploads/ # Encrypted file storage
└── public/
├── index.html # Landing page
├── sender.html # Sender dashboard
└── receiver.html # Receiver dashboard

---

## 📡 REST APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/session/create` | Create session |
| POST | `/session/join/:code` | Join session |
| POST | `/session/send/:code` | Send text |
| GET | `/session/receive/:code` | Receive text |
| POST | `/session/upload/:code` | Upload file |
| GET | `/session/download/:code` | Download file |
| POST | `/session/terminate/:code` | End session |
| GET | `/join/:code` | Shareable link |

---

## 🔧 Installation

# Clone repository
git clone https://github.com/anushka13-alt/Secure-File-Transfer-System.git
cd Secure-File-Transfer-System

# Install dependencies
npm install

# Start Redis
sudo service redis-server start

# Run server
node server.js

# Open browser
http://localhost:3000

**How to Use**
Sender:

Click "Continue as Sender" → Create Session

Copy shareable link or session code

Share with receiver

Send text or upload file

Receiver:

Click "Continue as Receiver"

Paste code or click shareable link

Click Connect

Check text or download file

Click End Session when done

**Security**
AES-256-CBC encryption for files

Random IV per encryption

Redis TTL for session expiry (300 seconds)

Auto file cleanup after download

**Testing Results**
Test	Status
Client-server connection	✅ Pass
Text file transfer	✅ Pass
Image file transfer	✅ Pass
PDF file transfer	✅ Pass
Chunk-based large file	✅ Pass
File reconstruction	✅ Pass
Error handling	✅ Pass

**⚠️ Challenges Solved**
Challenge	Solution
Connection issues	Improved error handling
Large file data loss	Chunk-based transmission
Redis integration	Proper session handling
File reconstruction	Binary formatting

** Deliverables**
Deliverable	Status
Secure transfer system	✅ Complete
Client-server architecture	✅ Complete
File transfer (text/image/PDF)	✅ Complete
Redis session management	✅ Complete
UI improvements	✅ Complete
Testing	✅ Complete
🔗 Repository
GitHub: https://github.com/anushka13-alt/Secure-File-Transfer-System

 Contact
Team Lead: Ayushi Aswal - ayushiaswal216@gmail.com

Made  by Team #SECURESYNC (T216)
