import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ip = process.env.MC_SERVER || 'mc.ogcraft-rpg.com';

async function checkMinecraft() {
  try {
    const response = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(ip)}`);
    if (!response.ok) throw new Error(`Status API HTTP ${response.status}`);
    const data = await response.json();
    return {
      ip,
      online: data.online === true,
      players: data.players?.online ?? 0,
      maxPlayers: data.players?.max ?? null,
      version: data.version || null,
      motd: data.motd?.clean?.join(' ') || null,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ip,
      online: false,
      players: 0,
      maxPlayers: null,
      version: null,
      motd: null,
      checkedAt: new Date().toISOString(),
      error: error.message,
    };
  }
}

const minecraft = await checkMinecraft();
const status = { minecraft, discord: { online: null, note: 'Heartbeat Discord este furnizat de panoul Node local.' } };
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
await fs.writeFile(path.join(scriptDirectory, 'status.json'), JSON.stringify(status, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(status, null, 2));
