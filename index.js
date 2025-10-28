const { Telegraf, Markup, session } = require('telegraf');
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const chalk = require('chalk');
const QR = require('qrcode');

const config = require('./config.js');
const { BOT_TOKEN } = config;

const sessionDir = path.join(__dirname, 'session');
const premiumFile = path.join(__dirname, 'premiumuser.json');
const adminFile = path.join(__dirname, 'adminuser.json');

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

let sock = null; // WhatsApp socket
let isConnected = false;

// Utility: load/save JSON
function loadJSON(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('loadJSON error', e);
    return defaultValue;
  }
}
function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('saveJSON error', e);
  }
}

let premiumUsers = loadJSON(premiumFile, []);
let adminUsers = loadJSON(adminFile, []);

function isOwner(id) {
  try {
    return Array.isArray(config.OWNER_ID) && config.OWNER_ID.includes(String(id));
  } catch (e) {
    return false;
  }
}

// Start WhatsApp session (creates socket)
async function startSesi({ printQRInTerminal = false } = {}) {
  if (sock && sock.user) return sock;

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    version,
    auth: state,
    printQRInTerminal,
    logger: pino({ level: 'silent' }),
    browser: ['Bot', 'Chrome', '1.0.0']
  });

  conn.ev.on('creds.update', saveCreds);

  conn.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // store latest qr on socket object for handlers to use
      conn.latestQR = qr;
    }

    if (connection === 'open') {
      isConnected = true;
      sock = conn;
      console.log(chalk.green('WhatsApp connected'));
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      isConnected = false;
      console.log(chalk.red('WhatsApp disconnected'), shouldReconnect ? 'will reconnect' : 'logged out');
      if (shouldReconnect) setTimeout(() => startSesi(), 1000);
    }
  });

  sock = conn;
  return conn;
}

function deleteSessionFolder() {
  if (!fs.existsSync(sessionDir)) return false;
  fs.rmSync(sessionDir, { recursive: true, force: true });
  return true;
}

// Middleware checks
const requireOwner = (ctx, next) => {
  if (!isOwner(ctx.from.id)) return ctx.reply('❌ Hanya owner yang bisa menjalankan perintah ini.');
  return next();
};
const requireAdmin = (ctx, next) => {
  if (!adminUsers.includes(String(ctx.from.id))) return ctx.reply('❌ Anda bukan admin.');
  return next();
};
const requirePremium = (ctx, next) => {
  if (!premiumUsers.includes(String(ctx.from.id))) return ctx.reply('❌ Hanya pengguna premium.');
  return next();
};

// Bot commands
bot.start((ctx) => {
  const isPrem = premiumUsers.includes(String(ctx.from.id));
  const text = `Halo!\nStatus premium: ${isPrem ? 'Yes' : 'No'}\nGunakan /addpairing untuk pairing WhatsApp (owner).`;
  return ctx.reply(text);
});

bot.command('addpairing', requireOwner, async (ctx) => {
  try {
    // start session and ensure sock exists
    await startSesi();
    // if already connected
    if (isConnected && sock && sock.user) return ctx.reply('WhatsApp sudah terhubung.');

    const sent = await ctx.reply('Menunggu QR. Akan dikirimkan jika tersedia...');

    // If we already have a QR (recent), send it
    if (sock && sock.latestQR) {
      const buffer = await QR.toBuffer(sock.latestQR, { width: 400 });
      await ctx.telegram.sendPhoto(ctx.chat.id, { source: buffer }, { caption: 'Scan QR di atas dengan akun WhatsApp yang akan dipair.' });
    }

    // temporary listener for qr and connection events
    const onUpdate = async (update) => {
      try {
        if (update.qr) {
          const buf = await QR.toBuffer(update.qr, { width: 400 });
          await ctx.telegram.sendPhoto(ctx.chat.id, { source: buf }, { caption: 'Scan QR di atas dengan akun WhatsApp yang akan dipair.' });
        }
        if (update.connection === 'open') {
          await ctx.telegram.sendMessage(ctx.chat.id, '✅ Pairing sukses — WhatsApp terhubung.');
          sock.ev.off('connection.update', onUpdate);
        }
        if (update.connection === 'close' && update.lastDisconnect) {
          const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          if (!shouldReconnect) {
            await ctx.telegram.sendMessage(ctx.chat.id, '❌ Pairing gagal / socket logged out.');
            sock.ev.off('connection.update', onUpdate);
          }
        }
      } catch (e) {
        console.error('onUpdate error', e);
      }
    };

    sock.ev.on('connection.update', onUpdate);

    // safety timeout: remove listener after 2 minutes
    setTimeout(() => {
      try { sock.ev.off('connection.update', onUpdate); } catch(e){}
    }, 2 * 60 * 1000);

  } catch (e) {
    console.error('addpairing error', e);
    ctx.reply('Gagal memulai pairing: ' + (e.message || e));
  }
});

bot.command('delsesi', requireOwner, async (ctx) => {
  const ok = deleteSessionFolder();
  if (ok) return ctx.reply('Session folder dihapus. Restart bot dan jalankan pairing lagi.');
  return ctx.reply('Folder session tidak ditemukan.');
});

bot.command('restart', requireOwner, async (ctx) => {
  await ctx.reply('Restarting...');
  setTimeout(() => process.exit(0), 1000);
});

// Admin / premium management
bot.command('addadmin', requireOwner, (ctx) => {
  const parts = ctx.message.text.split(/\s+/);
  if (parts.length < 2) return ctx.reply('Contoh: /addadmin 123456789');
  const id = parts[1].trim();
  if (!adminUsers.includes(id)) {
    adminUsers.push(id);
    saveJSON(adminFile, adminUsers);
    return ctx.reply(`✅ ${id} ditambahkan sebagai admin.`);
  }
  return ctx.reply('User sudah admin.');
});

bot.command('deladmin', requireOwner, (ctx) => {
  const parts = ctx.message.text.split(/\s+/);
  if (parts.length < 2) return ctx.reply('Contoh: /deladmin 123456789');
  const id = parts[1].trim();
  adminUsers = adminUsers.filter(x => x !== id);
  saveJSON(adminFile, adminUsers);
  return ctx.reply(`✅ ${id} dihapus dari admin.`);
});

bot.command('addprem', requireOwner, (ctx) => {
  const parts = ctx.message.text.split(/\s+/);
  if (parts.length < 2) return ctx.reply('Contoh: /addprem 123456789');
  const id = parts[1].trim();
  if (!premiumUsers.includes(id)) {
    premiumUsers.push(id);
    saveJSON(premiumFile, premiumUsers);
    return ctx.reply(`✅ ${id} ditambahkan sebagai premium.`);
  }
  return ctx.reply('User sudah premium.');
});

bot.command('delprem', requireOwner, (ctx) => {
  const parts = ctx.message.text.split(/\s+/);
  if (parts.length < 2) return ctx.reply('Contoh: /delprem 123456789');
  const id = parts[1].trim();
  premiumUsers = premiumUsers.filter(x => x !== id);
  saveJSON(premiumFile, premiumUsers);
  return ctx.reply(`✅ ${id} dihapus dari premium.`);
});

// Simple check commands
bot.command('cekprem', (ctx) => {
  const id = String(ctx.from.id);
  return ctx.reply(premiumUsers.includes(id) ? '✅ Anda premium.' : '❌ Anda bukan premium.');
});

// Launch bot
(async () => {
  try {
    await startSesi({ printQRInTerminal: false });
    await bot.launch();
    console.log('Telegram bot launched');
  } catch (e) {
    console.error('startup error', e);
  }
})();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));