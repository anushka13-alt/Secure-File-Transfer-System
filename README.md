# Secure-File-Transfer-System 🚀
A modern, end-to-end encrypted local file-sharing platform designed with speed, security, and beautiful aesthetics in mind.

## ✨ Key Features
- **Simultaneous Multi-File Sharing:** Easily select or drag-and-drop multiple documents, photos, or videos to encrypt and distribute them flawlessly in one batch.
- **QR Code Mobile Pairing:** Instantly bridge mobile devices using a dynamically generated QR Code that links directly to your local Wi-Fi IPv4 address.
- **Zero-Config HTTPS Security:** Natively generates self-signed cryptographic certificates so your connection stays encrypted across the network (`https://localhost:3000`).
- **Glassmorphism UI:** A fully redesigned interface built heavily on translucent blurring, dynamic custom gradients, and auto-fading toast notifications safely encapsulating UX. 
- **Automated Session Destruction:** File buffers and symmetric cryptographic keys (AES-256) are safely purged from the active Redis session immediately upon successful receiver download or timer expiration to enforce zero-knowledge caching.

## 🛠️ Architecture Stack
- **Backend Protocol**: Node.js, Express, HTTPS, Crypto (AES-256-CBC)
- **Database Tracking**: Redis (Memurai logic for rapid local caching)
- **Frontend Assets**: Vanilla JS, Glassmorphism Custom CSS, FontAwesome, QRCode.js
- **Upload Parsing**: Multer middleware (handling `.array` loop formatting)

## 💻 Installation & Setup

1. **Install Dependencies:**
```bash
npm install
```

2. **Ensure Redis is Active:**
For local environments (like Windows), verify the Redis or Memurai engine is running in the background on port `6379`.

3. **Start the Secure Server:**
```bash
node server.js
```
*Note: The server will automatically construct necessary `certs` directories and temporary `uploads` buffers accurately during startup if they are missing.*

4. **Launch Application:**
Navigate your web browser directly to `https://localhost:3000` (Ensure it is `https`). Since the certificates are securely machine-generated locally, click **Advanced -> Proceed to localhost** if your browser prompts a certificate warning.
