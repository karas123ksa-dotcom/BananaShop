# BananaAI — bot Discord BananaShop

Bot AI BananaShop z komendami administracyjnymi do rang.

## Komendy
- `/ai pytanie` — rozmowa z AI.
- `/strona` — oficjalny adres strony ustawiony przez `BANANASHOP_URL`.
- `/oferta` — link do strony i Discorda.
- `/pomoc` — lista komend.
- `/ranga stworz` — tworzy rangę bez dodatkowych uprawnień (kolory: zielony, złoty, niebieski, różowy, fioletowy, czerwony, biały).
- `/ranga nadaj` — nadaje istniejącą rangę użytkownikowi.
- `/ranga zabierz` — odbiera rangę użytkownikowi.

## Wymagania
Node.js 20+, aplikacja bota w Discord Developer Portal oraz klucz OpenAI API. Dostęp do ChatGPT nie oznacza automatycznie darmowego dostępu do API.

## Konfiguracja
1. Skopiuj `.env.example` do `.env` (lokalnie) lub dodaj zmienne w panelu hostingu.
2. Ustaw `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `OPENAI_API_KEY`.
3. Ustaw `BANANASHOP_URL` na aktualny, prawidłowy adres strony — bez tego `/strona` wyświetli informację o braku konfiguracji.
4. Opcjonalnie ustaw `DISCORD_GUILD_ID` dla szybkiego rejestrowania komend na jednym serwerze.
5. W folderze `bananaai-bot` uruchom `npm install`, `npm run register`, a następnie `npm start`.

## Uprawnienia Discord
- Bot potrzebuje uprawnienia **Zarządzanie rolami** (Manage Roles).
- W ustawieniach serwera przesuń najwyższą rolę bota ponad role, którymi ma zarządzać.
- Osoby używające `/ranga` muszą mieć uprawnienie **Zarządzanie rolami**.
- Nowe role są tworzone bez dodatkowych uprawnień; nie przyznawaj botowi Administratora.
- Discord nie pozwoli botowi zmieniać ról znajdujących się wyżej od jego najwyższej roli.

## Hosting
GitHub przechowuje kod i uruchamia testy. GitHub Pages nie uruchomi bota, a GitHub Actions nie jest hostingiem procesu online 24/7. Potrzebny jest hosting procesu Node.js. Ustaw tam zmienne z `.env.example`, instalację `npm install`, start `npm start` i jednorazowo `npm run register`.

## Bezpieczeństwo
Nigdy nie zapisuj tokenu Discord ani klucza API w repozytorium ani nie wysyłaj ich na czat. Jeśli token był wcześniej ujawniony, unieważnij go i wygeneruj nowy. Ta wersja nie ma ticketów ani automatycznej moderacji.
