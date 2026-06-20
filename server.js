const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const MAX_WORDS = 20;

const bannedWords = [
  "anjing", "kontol", "memek", "tolol", "goblok", "ngentot"
];

// ======================
// UTIL
// ======================
function containsBadWord(text) {
  const lower = text.toLowerCase();
  return bannedWords.some(word => lower.includes(word));
}

function countWords(text) {
  return text.trim().split(/\s+/).length;
}

// ======================
// STORAGE (STABLE VERSION)
// ======================

// socket.id -> username
const socketToUser = new Map();

// username -> socket.id
const userToSocket = new Map();

let messageHistory = [];

// ======================
// APP
// ======================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/send", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "send.html"));
});

// ======================
// SOCKET
// ======================
io.on('connection', (socket) => {
  console.log("CONNECT:", socket.id);

  socket.emit('init_messages', messageHistory);

  // ======================
  // NEW MESSAGE
  // ======================
  socket.on('new_message', (data) => {

    const username = (data.username || '').trim();
    const text = (data.text || '').trim();

    if (!data.agree) {
      return socket.emit("must_check_agree");
    }

    if (!username || !text) return;

    if (countWords(text) > MAX_WORDS) {
      return socket.emit("max_word_exceeded");
    }

    if (containsBadWord(text)) {
      return socket.emit("bad_word");
    }

    // ======================
    // USERNAME CHECK (FIX CORE BUG)
    // ======================

    const existingSocketId = userToSocket.get(username);

    // kalau username dipakai orang lain
    if (existingSocketId && existingSocketId !== socket.id) {
      return socket.emit("username_taken");
    }

    // ======================
    // ASSIGN USER
    // ======================
    socketToUser.set(socket.id, username);
    userToSocket.set(username, socket.id);

    // ======================
    // SAFE OUTPUT
    // ======================
    const safeUser = username.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const messageData = {
      username: safeUser,
      text: safeText,
      time: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    messageHistory.push(messageData);

    if (messageHistory.length > 5) {
      messageHistory.shift();
    }

    io.emit('update_messages', messageHistory);

    socket.emit("send_success");
  });

  // ======================
  // DISCONNECT (ANTI GHOST USER FIX)
  // ======================
  socket.on("disconnect", () => {
    const username = socketToUser.get(socket.id);

    if (username) {
      userToSocket.delete(username);
      socketToUser.delete(socket.id);
    }

    console.log("DISCONNECT:", socket.id);
  });

});

// ======================
// START SERVER
// ======================
http.listen(3000, () => {
  console.log("Server jalan di http://localhost:3000");
});