const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const MAX_WORDS = 20;


//ban kata kasar
const bannedWords = [
  "anjing", "kontol", "memek", "tolol", "goblok", "ngentot"
];


function containsBadWord(text) {
    const lower = text.toLowerCase();
    return bannedWords.some(word => lower.includes(word));
}

function countWords(text) {
    return text.trim().split(/\s+/).length;
}

const PORT = process.env.PORT || 3000;

const activeUsers = new Map();
let messageHistory = [];

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/send", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "send.html"));
});

io.on('connection', (socket) => {
    console.log('User connected');
    socket.emit('init_messages', messageHistory);
    
    socket.on('new_message', (data) => {
        const rawUser = (data.username || 'Anonim').trim();
        const deviceId = data.deviceId;
        const text = data.text || "";
        
        if (!data.agree) {
            socket.emit("must_check_agree");
            return;
        }

        if (!deviceId) {
            socket.emit("username_taken");
            return;
        }

        // 1 device = 1 username (nggak boleh ganti)
        if (socket.username && socket.username !== rawUser) {
            socket.emit("username_locked");
            return;
        }

        // username unik kecuali device yang sama
        if (activeUsers.has(rawUser)) {
            const usedByDevice = activeUsers.get(rawUser);
            if (usedByDevice !== deviceId) {
                socket.emit("username_taken");
                return;
            }
        
        if (countWords(text) > MAX_WORDS) {
                socket.emit("max_word_exceeded");
                return;
            }

        if (containsBadWord(text)) {
                socket.emit("bad_word");
                return;
            }
        }

        // simpan username ke socket + set user aktif
        socket.username = rawUser;
        socket.deviceId = deviceId;
        activeUsers.set(rawUser, deviceId);

        // Sanitasi input biar gak kena hack XSS
        const safeUser = (data.username || 'Anonim').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeText = data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        const messageData = {
            username: safeUser,
            text: safeText,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        messageHistory.push(messageData);

        // Simpan 7 pesan terakhir
        if (messageHistory.length > 7) messageHistory.shift();
        
        io.emit('update_messages', messageHistory);

        socket.emit("send_success");
    });

    socket.on("disconnect", () => {
        if (socket.username) {
            activeUsers.delete(socket.username);
        }
    });
});

http.listen(PORT, () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
});

