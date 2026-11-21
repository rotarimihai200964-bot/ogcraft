// Anti-spam pentru OGCraft.
// Necesită "Message Content Intent" (Developer Portal -> Bot) și permisiunile
// Manage Messages + Moderate Members pentru bot.
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const num = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
const CFG = {
  maxMessages: num(process.env.SPAM_MAX_MESSAGES, 5),     // mesaje permise...
  windowMs: num(process.env.SPAM_WINDOW_SEC, 5) * 1000,   // ...în intervalul acesta
  maxDuplicates: num(process.env.SPAM_MAX_DUPLICATES, 3), // același mesaj de atâtea ori
  duplicateWindowMs: 15000,
  maxMentions: num(process.env.SPAM_MAX_MENTIONS, 5),     // mențiuni într-un mesaj
  blockInvites: process.env.SPAM_BLOCK_INVITES !== 'false',
  timeoutMs: num(process.env.SPAM_TIMEOUT_MIN, 5) * 60 * 1000,
  strikeWindowMs: 2 * 60 * 1000, // a doua abatere în acest interval = timeout
  logChannelId: process.env.LOG_CHANNEL_ID,
};

const KEEP_MS = Math.max(CFG.windowMs, CFG.duplicateWindowMs);
const INVITE_RE = /(discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;
const history = new Map(); // "guild:user" -> [{ id, channelId, content, at }]
const strikes = new Map(); // "guild:user" -> [timestamps]

// Curăță periodic memoria
setInterval(() => {
  const now = Date.now();
  for (const [k, l] of history) if (!l.length || now - l[l.length - 1].at > KEEP_MS) history.delete(k);
  for (const [k, l] of strikes) if (!l.some((t) => now - t < CFG.strikeWindowMs)) strikes.delete(k);
}, 60000).unref();

function detect(message, list, now) {
  const recent = list.filter((m) => now - m.at < CFG.windowMs).length;
  if (recent > CFG.maxMessages) return 'prea multe mesaje într-un timp scurt';

  if (message.content) {
    const same = list.filter((m) => m.content === message.content && now - m.at < CFG.duplicateWindowMs).length;
    if (same >= CFG.maxDuplicates) return 'mesaje repetate';
  }
  if (message.mentions.users.size + message.mentions.roles.size > CFG.maxMentions) return 'prea multe mențiuni';
  if (CFG.blockInvites && INVITE_RE.test(message.content)) return 'link de invitație Discord';
  return null;
}

async function punish(message, list, reason, key, now) {
  // Șterge mesajele recente ale utilizatorului din canalul curent
  const ids = list.filter((m) => m.channelId === message.channelId).map((m) => m.id);
  history.delete(key);
  try { await message.channel.bulkDelete(ids, true); }
  catch { await message.delete().catch(() => {}); }

  // Prima abatere = avertisment, a doua (în 2 minute) = timeout
  const hits = (strikes.get(key) || []).filter((t) => now - t < CFG.strikeWindowMs);
  hits.push(now);
  strikes.set(key, hits);

  let action = 'avertisment';
  let note = 'Data viitoare vei primi timeout.';
  if (hits.length >= 2) {
    strikes.delete(key);
    const min = Math.round(CFG.timeoutMs / 60000);
    try {
      await message.member.timeout(CFG.timeoutMs, 'Anti-spam: ' + reason);
      action = 'timeout ' + min + ' min';
      note = 'Ai primit timeout de ' + min + ' min.';
    } catch {
      action = 'avertisment (timeout eșuat: verifică permisiunile și rolul botului)';
      note = '';
    }
  }

  const warn = await message.channel
    .send({
      content: `${message.author}, anti-spam: ${reason}. ${note}`.trim(),
      allowedMentions: { users: [message.author.id] },
    })
    .catch(() => null);
  if (warn) setTimeout(() => warn.delete().catch(() => {}), 8000);

  if (CFG.logChannelId) {
    const ch = await message.client.channels.fetch(CFG.logChannelId).catch(() => null);
    if (ch && ch.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xff5555)
        .setTitle('Anti-spam')
        .addFields(
          { name: 'Utilizator', value: `${message.author.tag} (${message.author.id})` },
          { name: 'Motiv', value: reason, inline: true },
          { name: 'Acțiune', value: action, inline: true },
          { name: 'Canal', value: `<#${message.channelId}>`, inline: true }
        );
      ch.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
    }
  }
}

async function check(message) {
  if (!message.guild || message.author.bot || message.system || !message.member) return;
  // Moderatorii sunt exceptați
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const key = message.guild.id + ':' + message.author.id;
  const now = Date.now();
  const list = (history.get(key) || []).filter((m) => now - m.at < KEEP_MS);
  list.push({ id: message.id, channelId: message.channelId, content: message.content, at: now });
  history.set(key, list);

  const reason = detect(message, list, now);
  if (reason) await punish(message, list, reason, key, now);
}

module.exports = { check };
