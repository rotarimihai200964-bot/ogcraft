# OGCraft Forum

Forum static cu o singură pagină, pregătit pentru GitHub Pages.

## Temă NamelessMC

Pachetul instalabil pentru NamelessMC 2.2.5 este în [namelessmc-dropin/](./namelessmc-dropin/). Instrucțiunile de instalare sunt în [README-ul pachetului](./namelessmc-dropin/README.md). Tema se încarcă în fișierele site-ului NamelessMC, nu în folderul de pluginuri al serverului Minecraft.

## Utilizare
- Alege „Discută” la o categorie pentru a intra direct în chatul acelei categorii.
- Chatul și câmpul de scriere apar direct pentru categoria aleasă; restul paginii se ascunde până revii la categorii.
- Bara de scriere este compactă: plus pentru imagini, câmp „Message @nume”, cadou, GIF, emoji, utilizatori și trimite.
- Alege gravitatea: informativă (albastru deschis), normală (albastru), importantă (galben) sau urgentă (roșu).
- Scrie un mesaj și, opțional, atașează până la 3 imagini, de maximum 400 KB fiecare.
- Numele și rangul din profil, precum și mesajele, sunt salvate în `localStorage` pe dispozitivul și browserul curent.
- Cursorul are o aură și particule discrete la mișcare; particulele sunt dezactivate dacă sistemul preferă mișcare redusă.

**Limitare importantă:** aceasta este o versiune locală pentru acel browser. Postările și imaginile nu sunt sincronizate cu ceilalți vizitatori, nu apar în browsere diferite și se pot pierde dacă se șterge stocarea browserului. Rangul este introdus de utilizator și nu este verificat. Pentru un forum comun tuturor jucătorilor va fi necesar un backend sau un serviciu de găzduire a postărilor și imaginilor. Pentru publicare publică, pozele trebuie tratate ca vizibile altor utilizatori; această versiune nu le încarcă pe internet.

## Publicare pe GitHub Pages
1. Încarcă fișierele proiectului într-un repository GitHub.
2. În Settings → Pages selectează Deploy from branch → `main` / root.
3. Pagina forumului va fi disponibilă la URL-ul GitHub Pages al repository-ului.

## Chat comun MySQL
1. Creează tabelul importând `api/schema.sql` în phpMyAdmin-ul bazei `s48008_ogcraft`.
2. Copiază `api/.env.example` pe hosting ca `api/.env`, completează DB_USER și DB_PASS și setează ALLOWED_ORIGINS la domeniul GitHub Pages.
3. Încarcă folderul `api/` pe hosting PHP și setează `chatApiUrl` în `config.js` la URL-ul public al fișierului `chat.php`.
4. Nu pune parola MySQL în `config.js`, în HTML sau într-un commit GitHub; păstrează-o numai în `.env` pe hosting.

Interfața este în `index.html`, logica forumului în `forum.js`, iar stilurile în `style.css` și `theme.css`.
Imaginea de fundal optimizată este `assets/background.jpg`.
