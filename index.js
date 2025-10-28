const { Telegraf, session } = require('telegraf');
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion
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

// Start WhatsApp session (creates socket) — uses latest wa-web version
async function startSesi({ printQRInTerminal = false } = {}) {
  if (sock && sock.user) return sock;

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  // fetch latest WA Web version (Baileys new util)
  const { version, isLatest } = await fetchLatestWaWebVersion();
  console.log('Using wa-web version', version, 'isLatest:', isLatest);

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

// Bot commands
bot.start((ctx) => {
  const isPrem = premiumUsers.includes(String(ctx.from.id));
  const text = `Halo!\nStatus premium: ${isPrem ? 'Yes' : 'No'}\nGunakan /addpairing untuk pairing WhatsApp (owner).`;
  return ctx.reply(text);
});

bot.command('addpairing', requireOwner, async (ctx) => {
  try {
    await startSesi();
    if (isConnected && sock && sock.user) return ctx.reply('WhatsApp sudah terhubung.');

    const sent = await ctx.reply('Menunggu QR. Akan dikirimkan jika tersedia...');

    if (sock && sock.latestQR) {
      const buffer = await QR.toBuffer(sock.latestQR, { width: 400 });
      await ctx.telegram.sendPhoto(ctx.chat.id, { source: buffer }, { caption: 'Scan QR di atas dengan akun WhatsApp yang akan dipair.' });
    }

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
    setTimeout(() => { try { sock.ev.off('connection.update', onUpdate); } catch(e){} }, 2 * 60 * 1000);

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