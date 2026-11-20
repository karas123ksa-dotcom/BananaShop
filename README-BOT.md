# BananaAI — bot Discord dla BananaShop

## Funkcje
- `/setup` — tworzy kategorie, kanały i podstawowe role BananaShop. Komenda wymaga uprawnienia Zarządzanie serwerem.
- `/ai pytanie:` — odpowiada przez OpenAI API. Bez klucza API bot działa, ale funkcja AI pozostaje wyłączona.

## Wymagania
- Node.js 20 lub nowszy
- Aplikacja/bot utworzony w Discord Developer Portal
- Token bota, ID aplikacji oraz ID serwera
- Klucz OpenAI API (opcjonalny; API jest rozliczane oddzielnie od ChatGPT)

## Konfiguracja lokalna
1. Skopiuj `.env.example` do pliku `.env`.
2. Uzupełnij `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` i `DISCORD_GUILD_ID`.
3. Jeśli chcesz używać AI, dodaj `OPENAI_API_KEY`.
4. W terminalu uruchom:

```bash
npm install
npm start
```

## Uprawnienia bota
Podczas zapraszania przyznaj mu: View Channels, Send Messages, Read Message History, Use Slash Commands, Manage Channels i Manage Roles. Ustaw najwyższą rolę bota nad rolami, które ma tworzyć.

**Bezpieczeństwo:** nigdy nie wrzucaj prawdziwego tokena Discord ani klucza API do repozytorium. Dodawaj je wyłącznie jako zmienne środowiskowe hostingu lub w lokalnym pliku `.env` (jest ignorowany przez Git).
