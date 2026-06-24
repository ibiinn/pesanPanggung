const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const { randomUUID } = require('crypto');
require('dotenv').config({ override: true });

const { Xendit } = require('xendit-node');

const MAX_WORDS = 20;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'djamoan4ever';
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

// ======================
// Xendit Configuration
// ======================
// Dapatkan XENDIT_SECRET_KEY dari dashboard Xendit (Settings > API Keys)
// Mode Test / Sandbox: toggle ke "Test Mode" di dashboard
const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || '';
const XENDIT_WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN || '';
const hasXenditKey = XENDIT_SECRET_KEY.length > 0;

console.log('PUBLIC_URL:', PUBLIC_URL);
console.log('Has Xendit Key:', hasXenditKey);
console.log('Has Xendit Webhook Token:', XENDIT_WEBHOOK_TOKEN.length > 0);

let xenditInvoiceClient = null;

if (hasXenditKey) {
  try {
    const xenditClient = new Xendit({
      secretKey: XENDIT_SECRET_KEY
    });
    xenditInvoiceClient = xenditClient.Invoice;
    console.log('Xendit client initialized successfully');
  } catch (err) {
    console.error('Failed to initialize Xendit client:', err.message);
  }
}

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

// Set untuk banned users
const bannedUsers = new Set();
const songRequests = [];

// Helper untuk menambah pesan request lagu ke chat
function addSongRequestMessage(requestItem) {
  if (requestItem.messageAdded) return false;

  const safeUser = requestItem.username.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeSong = requestItem.song.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeNote = requestItem.note.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = `Request lagu: ${safeSong}${safeNote ? ' – ' + safeNote : ''}`;

  const messageData = {
    username: safeUser,
    text,
    time: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  messageHistory.push(messageData);
  requestItem.messageAdded = true;

  if (messageHistory.length > 5) {
    messageHistory.shift();
  }

  io.emit('update_messages', messageHistory);
  io.emit('admin_request_update', { song_requests: songRequests });
  return true;
}

// ======================
// APP
// ======================
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/send", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "send.html"));
});

app.get("/request", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "request.html"));
});

app.get("/request.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "request.html"));
});

app.get("/live-alert", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "live-alert.html"));
});

app.get("/xendit-return", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "xendit-return.html"));
});

app.get("/payment/checkout/:paymentId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "payment-checkout.html"));
});

app.get('/api/payment/:paymentId', (req, res) => {
  const requestItem = songRequests.find(i => i.id === req.params.paymentId);

  if (!requestItem) {
    return res.status(404).json({
      success: false,
      message: 'Request tidak ditemukan'
    });
  }

  return res.json({
    success: true,
    request: requestItem
  });
});

app.post('/api/payment/:paymentId/complete', (req, res) => {
  const requestItem = songRequests.find(i => i.id === req.params.paymentId);
  if (!requestItem) {
    return res.status(404).json({ success: false, message: 'Request tidak ditemukan' });
  }
  if (requestItem.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Request sudah dibayar atau diproses' });
  }

  requestItem.status = 'paid';
  requestItem.paidAt = new Date().toISOString();
  addSongRequestMessage(requestItem);

  return res.json({ success: true });
});

// ======================
// XENDIT: Poll invoice status directly from Xendit API
// ======================
// Endpoint ini dipanggil oleh xendit-return.html untuk ngecek status invoice
// langsung ke Xendit, tanpa harus menunggu webhook.
app.get('/api/payment/:paymentId/xendit-status', async (req, res) => {
  const requestItem = songRequests.find(i => i.id === req.params.paymentId);

  if (!requestItem) {
    return res.status(404).json({ success: false, message: 'Request tidak ditemukan' });
  }

  // Kalau status sudah berubah, balikin aja
  if (requestItem.status !== 'pending') {
    return res.json({ success: true, request: requestItem });
  }

  // Cek ke Xendit API langsung
  if (hasXenditKey && xenditInvoiceClient && requestItem.xenditInvoiceId) {
    try {
      const invoice = await xenditInvoiceClient.getInvoiceById({
        invoiceId: requestItem.xenditInvoiceId
      });

      console.log('Xendit status check:', invoice.id, 'status:', invoice.status);

      const xenditStatus = (invoice.status || '').toUpperCase();

      if (xenditStatus === 'PAID' || xenditStatus === 'SETTLED') {
      requestItem.status = 'paid';
      requestItem.paidAt = new Date().toISOString();
      addSongRequestMessage(requestItem);
      console.log('Xendit payment confirmed via API for', requestItem.externalId);
      } else if (xenditStatus === 'EXPIRED') {
        requestItem.status = 'failed';
        console.log('Xendit invoice expired for', requestItem.externalId);
      }
      // Selain PAID/SETTLED/EXPIRED, biarkan pending
    } catch (err) {
      console.error('Xendit getInvoiceById error:', err.message);
    }
  }

  return res.json({ success: true, request: requestItem });
});

// ======================
// XENDIT: Create Invoice
// ======================
app.post('/create-xendit-invoice', async (req, res) => {
  const username = (req.body.username || '').trim();
  const song = (req.body.song || '').trim();
  const note = (req.body.note || '').trim();
  const amount = Number(req.body.amount || 0);

  if (!username || !song || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Data request tidak lengkap' });
  }

  if (amount < 25000) {
    return res.status(400).json({ success: false, message: 'Minimal pembayaran Rp 25.000' });
  }

  const paymentId = randomUUID();
  const externalId = `song-request-${paymentId}`;

  const newRequest = {
    id: paymentId,
    externalId,
    username,
    song,
    note,
    amount,
    status: 'pending',
    createdAt: new Date().toISOString(),
    paidAt: null,
    processedAt: null,
    checkoutUrl: `/payment/checkout/${paymentId}`,
    xenditInvoiceUrl: null,
    xenditInvoiceId: null,
    xenditNote: null
  };

  songRequests.push(newRequest);

  // Jika Xendit key tersedia, buat invoice via Xendit API
  if (hasXenditKey && xenditInvoiceClient) {
    try {
      const invoice = await xenditInvoiceClient.createInvoice({
        data: {
          externalId: externalId,
          amount: amount,
          payerEmail: `${username.replace(/\s+/g, '')}@example.com`,
          description: `Request lagu: ${song} oleh ${username}`,
          successRedirectUrl: `${PUBLIC_URL}/xendit-return?paymentId=${paymentId}`,
          failureRedirectUrl: `${PUBLIC_URL}/xendit-return?paymentId=${paymentId}&status=failed`,
          currency: 'IDR',
          customer: {
            givenNames: username,
            email: `${username.replace(/\s+/g, '')}@example.com`
          },
          paymentMethods: ['QRIS'],
          customerNotificationPreference: {
            invoicePaid: ['email']
          },
          invoiceDuration: 360 // 6 jam
        }
      });

      console.log('Xendit invoice created:', invoice.id, invoice.invoiceUrl);

      newRequest.xenditInvoiceUrl = invoice.invoiceUrl || null;
      newRequest.xenditInvoiceId = invoice.id || null;
      newRequest.xenditNote = invoice.invoiceUrl ? 'Xendit invoice berhasil dibuat.' : 'Xendit tidak mengembalikan URL invoice.';

      return res.json({
        success: true,
        invoiceUrl: invoice.invoiceUrl || null,
        checkoutUrl: newRequest.checkoutUrl,
        xenditInvoiceId: invoice.id || null,
        note: newRequest.xenditNote
      });

    } catch (err) {
      console.error('Xendit create invoice error:', err.message);
      if (err.response?.data) {
        console.error('Xendit error details:', JSON.stringify(err.response.data));
      }

      newRequest.xenditNote = `Gagal membuat invoice Xendit: ${err.message}`;

      // Fallback: tetap return checkoutUrl untuk simulasi
      return res.json({
        success: true,
        invoiceUrl: null,
        checkoutUrl: newRequest.checkoutUrl,
        xenditInvoiceId: null,
        note: newRequest.xenditNote
      });
    }
  }

  // Fallback jika Xendit tidak dikonfigurasi
  return res.json({
    success: true,
    invoiceUrl: null,
    checkoutUrl: newRequest.checkoutUrl,
    xenditInvoiceId: null,
    note: 'Xendit API key belum dikonfigurasi. Gunakan tombol simulasi untuk testing.'
  });
});

// ======================
// XENDIT: Webhook Handler
// ======================
// Xendit akan mengirim callback ke URL ini saat status invoice berubah.
// Callback verification token bisa diatur di dashboard Xendit > Settings > Webhooks.
app.post('/api/xendit/webhook', (req, res) => {
  const body = req.body || {};

  console.log('Xendit webhook received:', JSON.stringify(body).slice(0, 500));

  // Verifikasi callback token untuk keamanan
  const callbackToken = req.headers['x-callback-token'] || '';
  if (XENDIT_WEBHOOK_TOKEN && callbackToken !== XENDIT_WEBHOOK_TOKEN) {
    console.warn('Xendit webhook: invalid callback token');
    return res.status(403).json({ success: false, message: 'Invalid callback token' });
  }

  // Xendit mengirim berbagai event. Yang penting: invoice.paid
  const event = body.event || '';
  const invoiceData = body.data || body;

  // Cari external_id dari berbagai kemungkinan format
  const externalId = invoiceData.external_id || invoiceData.externalId || '';

  if (!externalId) {
    console.warn('Xendit webhook: no external_id found');
    return res.status(200).json({ success: true, message: 'Ignored - no external_id' });
  }

  const requestItem = songRequests.find(i => i.externalId === externalId);
  if (!requestItem) {
    console.warn('Xendit webhook: request not found for external_id:', externalId);
    return res.status(200).json({ success: true, message: 'Ignored - request not found' });
  }

  if (requestItem.status === 'paid' || requestItem.status === 'processed') {
    // Idempotent: already handled
    return res.json({ success: true, message: 'Already processed' });
  }

  const invoiceStatus = (invoiceData.status || '').toLowerCase();
  console.log(`Xendit webhook: externalId=${externalId}, status=${invoiceStatus}, event=${event}`);

  if (invoiceStatus === 'paid' || invoiceStatus === 'settled') {
    requestItem.status = 'paid';
    requestItem.paidAt = new Date().toISOString();
    addSongRequestMessage(requestItem);
    console.log(`Xendit payment completed for ${externalId}`);
  } else if (invoiceStatus === 'expired') {
    requestItem.status = 'failed';
    console.log(`Xendit invoice expired for ${externalId}`);
  }

  return res.json({ success: true });
});

// ======================
// SOCKET
// ======================
io.on('connection', (socket) => {
  console.log("CONNECT:", socket.id);

  socket.emit('init_messages', messageHistory);
  socket.adminAuthenticated = false;

  socket.on('admin_login', (data) => {
    const password = (data.password || '').trim();
    if (password === ADMIN_PASSWORD) {
      socket.adminAuthenticated = true;
      socket.emit('admin_login_success');
      socket.emit('admin_data', {
        messages: messageHistory,
        users: Array.from(socketToUser.values()),
        banned_users: Array.from(bannedUsers),
        song_requests: songRequests
      });
    } else {
      socket.emit('admin_login_failed');
    }
  });

  // ======================
  // NEW MESSAGE
  // ======================
  socket.on('new_message', (data) => {

    const isAdminMessage = Boolean(data.admin);
    const text = (data.text || '').trim();
    let username = (data.username || '').trim();

    if (!data.agree) {
      return socket.emit("must_check_agree");
    }

    if (!text) return;

    if (isAdminMessage) {
      if (!socket.adminAuthenticated) {
        return socket.emit('admin_forbidden');
      }
      username = 'ADMIN';
    }

    if (!username) return;

    if (!isAdminMessage && bannedUsers.has(username)) {
      return socket.emit("user_banned");
    }

    if (countWords(text) > MAX_WORDS) {
      return socket.emit("max_word_exceeded");
    }

    if (containsBadWord(text)) {
      return socket.emit("bad_word");
    }

    if (!isAdminMessage) {
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
    }

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

  // ======================
  // ADMIN FEATURES
  // ======================
  socket.on('get_admin_data', (data) => {
    if (!socket.adminAuthenticated) {
      return socket.emit('admin_forbidden');
    }

    const users = Array.from(socketToUser.values());
    socket.emit('admin_data', {
      messages: messageHistory,
      users: users,
      banned_users: Array.from(bannedUsers),
      song_requests: songRequests
    });
  });

  socket.on('admin_delete_message', (data) => {
    if (!socket.adminAuthenticated) {
      return socket.emit('admin_forbidden');
    }

    const index = data.index;
    if (index >= 0 && index < messageHistory.length) {
      messageHistory.splice(index, 1);
      io.emit('update_messages', messageHistory);
      socket.emit('admin_data', {
        messages: messageHistory,
        users: Array.from(socketToUser.values()),
        banned_users: Array.from(bannedUsers),
        song_requests: songRequests
      });
      console.log(`Message di index ${index} dihapus oleh admin`);
    }
  });

  socket.on('admin_ban_user', (data) => {
    if (!socket.adminAuthenticated) {
      return socket.emit('admin_forbidden');
    }

    const username = (data.username || '').trim();
    if (username) {
      bannedUsers.add(username);
      console.log(`User "${username}" di-ban oleh admin`);
      socket.emit('admin_data', {
        messages: messageHistory,
        users: Array.from(socketToUser.values()),
        banned_users: Array.from(bannedUsers),
        song_requests: songRequests
      });
    }
  });

  socket.on('admin_mark_request_done', (data) => {
    if (!socket.adminAuthenticated) {
      return socket.emit('admin_forbidden');
    }

    const requestId = (data.id || '').trim();
    const requestItem = songRequests.find(i => i.id === requestId);
    if (requestItem && requestItem.status === 'paid') {
      requestItem.status = 'processed';
      requestItem.processedAt = new Date().toISOString();
      socket.emit('admin_data', {
        messages: messageHistory,
        users: Array.from(socketToUser.values()),
        banned_users: Array.from(bannedUsers),
        song_requests: songRequests
      });
      io.emit('admin_request_update', { song_requests: songRequests });
      console.log(`Request lagu ${requestId} ditandai selesai oleh admin`);
    }
  });

  socket.on('admin_unban_user', (data) => {
    if (!socket.adminAuthenticated) {
      return socket.emit('admin_forbidden');
    }

    const username = (data.username || '').trim();
    if (username) {
      bannedUsers.delete(username);
      console.log(`User "${username}" di-unban oleh admin`);
      socket.emit('admin_data', {
        messages: messageHistory,
        users: Array.from(socketToUser.values()),
        banned_users: Array.from(bannedUsers),
        song_requests: songRequests
      });
    }
  });

  socket.on('admin_clear_all_messages', (data) => {
    if (!socket.adminAuthenticated) {
      return socket.emit('admin_forbidden');
    }

    messageHistory = [];
    io.emit('update_messages', messageHistory);
    socket.emit('admin_data', {
      messages: messageHistory,
      users: Array.from(socketToUser.values()),
      banned_users: Array.from(bannedUsers),
      song_requests: songRequests
    });
    console.log('Semua pesan dihapus oleh admin');
  });

});

// ======================
// XENDIT: Periodic Background Checker
// ======================
// Server ngecek invoice pending langsung ke Xendit setiap 30 detik.
// Ini memastikan request lagu tetap terdeteksi meskipun user tidak pernah buka halaman xendit-return.
async function checkPendingInvoices() {
  if (!hasXenditKey || !xenditInvoiceClient) return;

  const pendingRequests = songRequests.filter(
    r => r.status === 'pending' && r.xenditInvoiceId
  );

  if (pendingRequests.length === 0) return;

  console.log(`[Background Check] Checking ${pendingRequests.length} pending invoice(s)...`);

  for (const requestItem of pendingRequests) {
    try {
      const invoice = await xenditInvoiceClient.getInvoiceById({
        invoiceId: requestItem.xenditInvoiceId
      });

      const xenditStatus = (invoice.status || '').toUpperCase();

      if (xenditStatus === 'PAID' || xenditStatus === 'SETTLED') {
        requestItem.status = 'paid';
        requestItem.paidAt = new Date().toISOString();
        addSongRequestMessage(requestItem);
        console.log(`[Background Check] Payment confirmed: ${requestItem.externalId}`);
      } else if (xenditStatus === 'EXPIRED') {
        requestItem.status = 'failed';
        console.log(`[Background Check] Invoice expired: ${requestItem.externalId}`);
      }
    } catch (err) {
      console.error(`[Background Check] Error checking ${requestItem.externalId}:`, err.message);
    }
  }
}

// Cek setiap 30 detik
setInterval(checkPendingInvoices, 30000);
console.log('Background invoice checker started (every 30s)');

// ======================
// START SERVER
// ======================
http.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} sudah dipakai. Gunakan PORT lain atau hentikan proses yang memakai port ini.`);
    process.exit(1);
  }
  throw err;
});

http.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
