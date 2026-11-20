# BananShop Discord Bot

Bot oparty na Discord.js v14. Po wdrożeniu udostępnia:
- `/setup` — tworzy kanały i kategorie serwera oraz publikuje panel ticketów;
- prywatne tickety: zakup, pomoc, reklamacja;
- automatyczne powitania;
- prosty anty-flood (6 wiadomości w 7 sekund);
- `/ogloszenie` — publikuje ogłoszenie;
- `/ai` — opcjonalny asystent OpenAI (wymaga klucza API).

## Ważne

GitHub Pages nie uruchamia botów Discord. Kod musi działać na hostingu obsługującym proces w tle, np. Render Worker. Konfiguracja Render jest w `render.yaml`; wybrany plan Worker może być płatny. Nie podawaj danych płatniczych bez zgody rodzica/opiekuna.

## 1. Discord Developer Portal

1. Otwórz https://discord.com/developers/applications i wybierz aplikację bota.
2. W zakładce **Bot** zresetuj token, jeśli stary był kiedykolwiek udostępniony. Token jest sekretem — nie wklejaj go do GitHuba ani czatu.
3. Włącz **Server Members Intent** i **Message Content Intent**.
4. W **OAuth2 → URL Generator** zaznacz scopes: `bot`, `applications.commands`.
5. Nadaj tylko potrzebne uprawnienia: View Channels, Send Messages, Embed Links, Read Message History, Manage Channels, Manage Messages, Moderate Members. Nie zaznaczaj Administrator.
6. Otwórz wygenerowany link i dodaj bota na swój serwer.

## 2. Sekrety hostingu

Ustaw w Render → Environment:
- `DISCORD_TOKEN` — nowy token bota;
- `CLIENT_ID` — Application ID;
- `GUILD_ID` — ID serwera (opcjonalnie, przyspiesza rejestrację komend na jednym serwerze);
- `STAFF_ROLE_ID` — ID roli obsługi (opcjonalnie);
- `OPENAI_API_KEY` — opcjonalnie, tylko jeśli chcesz używać `/ai`;
- `OPENAI_MODEL` — opcjonalnie, domyślnie `gpt-4.1-mini`.

Nie zapisuj sekretów w plikach repozytorium. Jeśli klucz OpenAI nie jest ustawiony, reszta bota nadal działa, a `/ai` wyświetli informację o braku konfiguracji.

## 3. Wdrożenie

1. W Render wybierz **New → Blueprint** i połącz repozytorium `karas123ksa-dotcom/BananaShop`.
2. Wskaż plik Blueprint: `discord-bot/render.yaml`.
3. Dodaj sekrety w panelu Render i uruchom wdrożenie.
4. Po uruchomieniu wpisz na serwerze `/setup` jako administrator.

## 4. Po /setup

- Sprawdź kanały i kategorie.
- Bot tworzy prywatne kanały ticketów dla autora, bota i opcjonalnej roli `STAFF_ROLE_ID`.
- Kategoria ekipy jest prywatna; administratorzy serwera nadal mogą ją zobaczyć.
- Ustaw `STAFF_ROLE_ID` na identyfikator roli obsługi i zrestartuj usługę, aby personel miał dostęp do ticketów.
- Nadaj ręcznie dostęp do kategorii ekipy właściwej roli staff.

## Ograniczenia i bezpieczeństwo

To pierwszy, podstawowy zestaw funkcji, nie pełny system sklepu. Nie obsługuje płatności, zamówień, historii zakupów ani automatycznego potwierdzania wpłat. Anty-flood jest prostą ochroną i wymaga testów. Nie używaj bota jako jedynego zabezpieczenia serwera. Przed wdrożeniem produkcyjnym przetestuj go na prywatnym serwerze testowym.
