# BananaAI — bot Discord BananaShop

Pierwsza wersja bota AI dla serwera Discord BananaShop.

## Funkcje
- /ai pytanie — rozmowa z AI i krótki kontekst per użytkownik.
- /oferta — linki do strony i Discorda.
- /pomoc — lista komend.
- Ograniczenie częstotliwości zapytań.
- Sekrety wyłącznie w zmiennych środowiskowych.

## Wymagania
Node.js 20+, aplikacja bota w Discord Developer Portal oraz klucz OpenAI API. Dostęp do ChatGPT nie oznacza automatycznie darmowego dostępu do API.

## Uruchomienie lokalne
1. Skopiuj .env.example do .env.
2. Wypełnij DISCORD_TOKEN, DISCORD_CLIENT_ID, OPENAI_API_KEY i opcjonalnie DISCORD_GUILD_ID.
3. W folderze bananaai-bot uruchom: npm install, npm run register, npm start.

## Discord Developer Portal
1. Utwórz aplikację i dodaj bota.
2. Wygeneruj token i ustaw DISCORD_TOKEN. Nie wysyłaj go na czat ani nie commituj.
3. Application ID ustaw jako DISCORD_CLIENT_ID.
4. Zaproś bota z zakresami bot i applications.commands; na początek daj tylko podstawowe uprawnienia do kanałów i wiadomości.
5. Opcjonalnie ustaw ID serwera jako DISCORD_GUILD_ID.

## Hosting
GitHub przechowuje kod i uruchamia testy. GitHub Pages nie uruchomi bota, a GitHub Actions nie jest hostingiem procesu online 24/7. Potrzebny jest hosting procesu Node.js. Ustaw tam zmienne z .env.example, instalację npm install, start npm start i jednorazowo npm run register.

## Bezpieczeństwo
Nigdy nie zapisuj tokenu Discord ani klucza API w repozytorium. Jeśli stary token bota był wcześniej ujawniony, unieważnij go i wygeneruj nowy. Nie dawaj botowi uprawnień administratora. Ta wersja nie ma ticketów, automatycznej moderacji ani dostępu do prywatnych wiadomości.

## Test
npm run check sprawdza składnię JavaScript.
