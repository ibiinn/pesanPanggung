const express = require("express");
const path = require("path");
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const app = express();

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/send", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/send.html"));
});

io.on('connection', (socket) => {
    console.log('User connected');
    socket.emit('init_messages', messageHistory);

    socket.on('new_message', (data) => {
        // Sanitasi input biar gak kena hack XSS
        const safeUser = (data.username || 'Anonim').replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeText = data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        const messageData = {
            username: safeUser,
            text: safeText,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        messageHistory.push(messageData);
        // Simpan 5 pesan terakhir
        if (messageHistory.length > 7) messageHistory.shift();
        
        io.emit('update_messages', messageHistory);
    });
});

http.listen(PORT, () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
});

module.exports = app;
