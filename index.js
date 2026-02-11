const express = require("express");
const path = require("path");

const app = express();

// Serve static files (css, js, gambar, dll)
app.use(express.static(path.join(__dirname, "../public")));

// Route halaman
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/send", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/send.html"));
});

module.exports = app;
