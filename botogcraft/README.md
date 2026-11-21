# OGCraft

Bot de Discord pentru Minecraft (`bot/`) și site-ul lui (`site/`).

## Structură

```
bot/   discord.js v14: /ping /help /status /avatar /serverinfo /ip /ai + anti-spam
panel/ server local: servește site-ul + token și Start/Stop/Restart
site/  index.html (site cu animații) + portal.html (trimite în Discord Developer Portal)
```

## Monitor și panou online

- `mc.ogcraft-rpg.com` este monitorizat la fiecare 5 minute în [status.json](status.json).
- Workflow-ul `.github/workflows/ogcraft-status.yml` actualizează statusul Minecraft automat pe GitHub Actions.
- [panel/server.js](panel/server.js) expune `/api/public-status` pentru status fără token Discord și actualizează Minecraft la 5 minute.
- GitHub Pages poate publica UI-ul static, dar botul Discord și panoul Start/Stop/Restart necesită un Node.js server 24/7 (local, VPS sau hosting Node).

## Bot

1. Creează aplicația în [Discord Developer Portal](https://discord.com/developers/applications) (sau deschide `site/portal.html`).
2. În `bot/`: copiază `.env.example` ca `.env` și completează `DISCORD_TOKEN`, `CLIENT_ID` (opțional `GUILD_ID`, `MC_SERVER`).
3. Rulează:

```bash
cd bot
npm install
npm start
```

Tokenul nu se pune niciodată în git: `.env` este în `.gitignore`.

## Create bot (token, start / stop / restart)

`panel/server.js` servește site-ul și îi dă butonului **Create bot** un server cu care să vorbească. Nu are dependențe:

```bash
# Windows: dublu-click pe start-panel.bat
# Linux / macOS:
./start-panel.sh
```

Deschide http://localhost:3000 (este site-ul), apasă **Create bot** și intră cu parola afișată în consolă (se salvează și în `panel/.panel-password`). În fereastra care apare:

1. lipești tokenul botului (îl verifică la Discord și îl salvează în `bot/.env`; nu se trimite niciodată înapoi în browser),
2. apeși **Adaugă în Discord** pentru linkul de invitație (cu permisiunile pentru anti-spam),
3. folosești **Start / Stop / Restart** și vezi logurile botului.

Pe un link static (de exemplu pagina publicată), fereastra se deschide dar spune că nu e conectată la un server: tokenul se introduce doar pe un site servit de `server.js`. Serverul ascultă doar pe `127.0.0.1` și cere parolă la fiecare acțiune.

### Telefon Android (Termux)

Dacă ai doar telefon, instalează Termux din F-Droid, descarcă `ogcraft-repo.zip` și rulează în Termux:

```bash
pkg update -y && pkg install -y nodejs unzip
termux-setup-storage
unzip ~/storage/downloads/ogcraft-repo.zip -d ~
cd ~/ogcraft/bot && npm install
termux-wake-lock
cd ~/ogcraft/panel && node server.js
```

Apoi deschide http://localhost:3000 în browserul telefonului (este site-ul, cu Create bot). Botul rulează doar cât timp Termux rămâne pornit (oprește optimizarea bateriei pentru Termux). Pentru funcționare 24/7 ai nevoie de un calculator mereu pornit sau de un hosting.

## Anti-spam, /ip și /ai

- **Anti-spam** (`bot/antispam.js`): șterge mesajele trimise prea repede, repetate, cu prea multe mențiuni sau cu invitații Discord. Prima abatere = avertisment, a doua în 2 minute = timeout. Moderatorii (Manage Messages) sunt exceptați. Pragurile se schimbă din `.env`.
  - Activează **Message Content Intent** în Developer Portal → Bot → Privileged Gateway Intents. Fără el botul nu pornește, decât dacă pui `ANTISPAM=false`.
  - Botul are nevoie de permisiunile Manage Messages și Moderate Members, iar rolul lui trebuie să fie deasupra rolurilor membrilor. Linkul de invitație de pe site le cere deja.
- **/ip**: arată IP-ul serverului de Minecraft (`MC_SERVER`) și statusul lui.
- **/ai `<întrebare>`**: răspunde cu Claude API. Pune `ANTHROPIC_API_KEY` în `.env` (cheie de pe platform.claude.com/settings/keys). Modelul se schimbă cu `AI_MODEL`.

## Site

Deschide `site/index.html` în browser sau pornește un server local:

```bash
cd site
npm start
```

Setările (Application ID, IP-ul serverului de Minecraft) sunt în obiectul `CONFIG` de la finalul lui `index.html`.

## Git

```bash
git remote add origin https://github.com/NUMELE-TAU/ogcraft.git
git push -u origin main
```
