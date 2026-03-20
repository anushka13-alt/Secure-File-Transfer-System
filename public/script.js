let currentKey = "";
let statusInterval = null;

async function createSession() {
  const res = await fetch("/session/create", { method: "POST" });
  const data = await res.json();

  currentKey = data.sessionKey;
  document.getElementById("key").innerText = "Session Key: " + currentKey;
  document.getElementById("senderMsg").innerText = "";

  if (statusInterval) clearInterval(statusInterval);

  statusInterval = setInterval(async () => {
    if (!currentKey) return;
    const res = await fetch("/session/status/" + currentKey);
    const data = await res.json();

    if (data.status === "invalid") {
      document.getElementById("status").innerText = "Session expired/invalid";
      clearInterval(statusInterval);
      return;
    }

    document.getElementById("status").innerText = data.receiverConnected
      ? "Receiver connected"
      : "Waiting for receiver...";
  }, 3000);
}

async function joinSession() {
  const key = document.getElementById("joinKey").value.trim();
  currentKey = key;

  const res = await fetch("/session/join/" + key, { method: "POST" });
  const data = await res.json();

  document.getElementById("joinStatus").innerText = data.message;
}

async function sendText() {
  const message = document.getElementById("message").value;

  const res = await fetch("/session/send/" + currentKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  const data = await res.json();
  document.getElementById("senderMsg").innerText = data.message;
}

async function receiveText() {
  const res = await fetch("/session/receive/" + currentKey);
  const data = await res.json();

  document.getElementById("receivedText").innerText = data.data || data.message;
}
async function uploadFile() {
  const input = document.getElementById("fileInput");
  const file = input.files[0];

  if (!currentKey) {
    document.getElementById("senderMsg").innerText = "Please generate session key first";
    return;
  }

  if (!file) {
    document.getElementById("senderMsg").innerText = "Please choose a file first";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/session/upload/" + currentKey, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    document.getElementById("senderMsg").innerText = data.message || "Upload response received";
  } catch (error) {
    document.getElementById("senderMsg").innerText = "Upload failed";
    console.log(error);
  }
}


async function checkFile() {
  const res = await fetch("/session/file-info/" + currentKey);
  const data = await res.json();

  if (data.fileName) {
    document.getElementById("fileInfo").innerText =
      "File available: " + data.fileName + " (" + data.mimeType + ")";
    const link = document.getElementById("downloadLink");
    link.href = "/session/download/" + currentKey;
    link.style.display = "inline-block";
  } else {
    document.getElementById("fileInfo").innerText = data.message;
    document.getElementById("downloadLink").style.display = "none";
  }
}