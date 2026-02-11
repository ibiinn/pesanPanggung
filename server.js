const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 4000;

http.listen(PORT, () => {
    console.log(`Server jalan di http://localhost:${PORT}`);
});

