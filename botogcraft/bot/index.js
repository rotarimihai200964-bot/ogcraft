require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActivityType,
  Events,
  MessageFlags,
} = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
const MC_SERVER = process.env.MC_SERVER || 'mc.ogcraft-rpg.com';
const COLOR = 0x55ff55;
const { ANTHROPIC_API_KEY } = process.env;
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-5-5';

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Lipsesc DISCORD_TOKEN sau CLIENT_ID din fișierul .env');
  process.exit(1);
}

const antispam = require('./antispam');

const ANTISPAM = process.env.ANTISPAM !== 'false';
const intents = [GatewayIntentBits.Guilds];
// Anti-spam citește mesajele: activează "Message Content Intent" în Developer Portal -> Bot
if (ANTISPAM) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
const client = new Client({ intents });

// ---------- Definiția comenzilor ----------
const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Vezi latența botului'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lista de comenzi OGCraft'),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Statusul unui server de Minecraft')
    .addStringOption((o) =>
      o.setName('ip').setDescription('IP-ul serverului (implicit: serverul tău)')
    ),
  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Avatarul unui utilizator')
    .addUserOption((o) => o.setName('user').setDescription('Utilizatorul')),
  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Informații despre serverul de Discord'),
  new SlashCommandBuilder()
    .setName('ip')
    .setDescription('IP-ul serverului de Minecraft'),
  new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Pune o întrebare asistentului AI')
    .addStringOption((o) =>
      o.setName('intrebare').setDescription('Întrebarea ta').setRequired(true).setMaxLength(1000)
    ),
];

// ---------- Logica comenzilor ----------
const handlers = {
  async ping(i) {
    await i.reply(`🏓 Pong! Latență API: ${Math.round(client.ws.ping)}ms`);
  },

  async help(i) {
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('⛏️ OGCraft - comenzi')
      .setDescription(
        [
          '`/ping` - latența botului',
          '`/status [ip]` - statusul unui server de Minecraft',
          '`/avatar [user]` - avatarul unui utilizator',
          '`/serverinfo` - informații despre acest server de Discord',
          '`/ip` - IP-ul serverului de Minecraft',
          '`/ai <întrebare>` - întreabă asistentul AI',
        ].join('\n')
      );
    await i.reply({ embeds: [embed] });
  },

  async status(i) {
    await i.deferReply();
    const ip = i.options.getString('ip') || MC_SERVER;
    try {
      const res = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(ip)}`);
      const data = await res.json();

      if (!data.online) {
        return i.editReply(`🔴 **${ip}** este offline sau nu a putut fi găsit.`);
      }

      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`🟢 ${ip}`)
        .setThumbnail(`https://api.mcsrvstat.us/icon/${encodeURIComponent(ip)}`)
        .addFields(
          {
            name: 'Jucători',
            value: `${data.players?.online ?? 0}/${data.players?.max ?? '?'}`,
            inline: true,
          },
          { name: 'Versiune', value: data.version || 'necunoscută', inline: true }
        );

      if (data.motd?.clean?.length) embed.setDescription(data.motd.clean.join('\n'));
      await i.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await i.editReply('⚠️ Nu am putut verifica serverul acum. Încearcă din nou.');
    }
  },

  async avatar(i) {
    const user = i.options.getUser('user') || i.user;
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(`Avatarul lui ${user.username}`)
      .setImage(user.displayAvatarURL({ size: 1024 }));
    await i.reply({ embeds: [embed] });
  },

  async serverinfo(i) {
    if (!i.guild) {
      return i.reply({
        content: 'Comanda merge doar pe un server.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const g = i.guild;
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(g.name)
      .setThumbnail(g.iconURL())
      .addFields(
        { name: 'Membri', value: String(g.memberCount), inline: true },
        {
          name: 'Creat la',
          value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`,
          inline: true,
        }
      );
    await i.reply({ embeds: [embed] });
  },
};

// ---------- /ip ----------
handlers.ip = async (i) => {
  await i.deferReply();
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('⛏️ IP-ul serverului')
    .setDescription('```\n' + MC_SERVER + '\n```');
  try {
    const res = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(MC_SERVER)}`);
    const d = await res.json();
    embed.addFields({ name: 'Status', value: d.online ? '🟢 Online' : '🔴 Offline', inline: true });
    if (d.online) {
      embed.addFields({
        name: 'Jucători',
        value: `${d.players?.online ?? 0}/${d.players?.max ?? '?'}`,
        inline: true,
      });
    }
  } catch (err) {
    console.error(err);
  }
  await i.editReply({ embeds: [embed] });
};

// ---------- /ai (Claude API) ----------
const AI_SYSTEM =
  'Ești OGCraft, asistentul unui server de Minecraft pe Discord. ' +
  'Răspunde scurt, prietenos și în limba în care ești întrebat. Nu depăși 1500 de caractere.';

async function askAI(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2026-10-21',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 600,
      system: AI_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

const aiCooldown = new Map();
handlers.ai = async (i) => {
  if (!ANTHROPIC_API_KEY) {
    return i.reply({
      content: '⚠️ /ai nu este configurat (lipsește ANTHROPIC_API_KEY din .env).',
      flags: MessageFlags.Ephemeral,
    });
  }
  const wait = (aiCooldown.get(i.user.id) || 0) + 10000 - Date.now();
  if (wait > 0) {
    return i.reply({ content: `⏳ Mai așteaptă ${Math.ceil(wait / 1000)}s.`, flags: MessageFlags.Ephemeral });
  }
  aiCooldown.set(i.user.id, Date.now());

  await i.deferReply();
  const q = i.options.getString('intrebare', true);
  try {
    const text = (await askAI(q)) || 'Nu am un răspuns.';
    await i.editReply({
      content: `> ${q.slice(0, 200).replace(/\n/g, ' ')}\n\n${text}`.slice(0, 1900),
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    console.error(err);
    await i.editReply('⚠️ AI-ul nu a putut răspunde acum. Încearcă din nou mai târziu.');
  }
};

// ---------- Evenimente ----------
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Conectat ca ${c.user.tag}`);
  c.user.setPresence({
    activities: [{ name: 'OGCraft ⛏️', type: ActivityType.Playing }],
    status: 'online',
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const handler = handlers[interaction.commandName];
  if (!handler) return;

  try {
    await handler(interaction);
  } catch (err) {
    console.error(err);
    const msg = { content: '⚠️ A apărut o eroare.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

if (ANTISPAM) {
  client.on(Events.MessageCreate, (message) => {
    antispam.check(message).catch((err) => console.error('anti-spam:', err));
  });
}

// ---------- Pornire ----------
(async () => {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  // Cu GUILD_ID comenzile apar instant; fără el, pot dura până la o oră.
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, { body: commands.map((c) => c.toJSON()) });
  console.log('Comenzi înregistrate.');
  await client.login(DISCORD_TOKEN);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
