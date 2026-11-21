import "dotenv/config";
import OpenAI from "openai";
import {
  Client, Events, GatewayIntentBits, MessageFlags,
  PermissionFlagsBits
} from "discord.js";

for (const key of ["DISCORD_TOKEN", "OPENAI_API_KEY"]) {
  if (!process.env[key]) {
    console.error("Missing environment variable: " + key);
    process.exit(1);
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const history = new Map();
const cooldowns = new Map();
const SITE_URL = (process.env.BANANASHOP_URL || "").trim();
const INVITE_URL = process.env.DISCORD_INVITE || "https://discord.gg/9T4tF55jd";
const SYSTEM = "Jesteś BananaAI, pomocnym polskojęzycznym asystentem serwera Discord BananaShop. Odpowiadaj krótko, przyjaźnie i jasno. Pomagaj w pytaniach o Minecraft, BananaShop i problemy techniczne. Nie wymyślaj cen, dostępności, statusu zamówień ani funkcji sklepu. W razie wątpliwości odeślij do obsługi. Nigdy nie proś o hasła, tokeny botów ani klucze API. Nie twierdź, że wykonałeś działania moderacyjne.";

const roleColors = {
  zielony: 0x57f287,
  zlote: 0xf1c40f,
  niebieski: 0x3498db,
  rozowy: 0xeb459e,
  fioletowy: 0x9b59b6,
  czerwony: 0xed4245,
  bialy: 0xffffff
};

function chunks(value, limit = 1850) {
  const result = [];
  let rest = String(value || "").trim();
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.5) cut = limit;
    result.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) result.push(rest);
  return result.length ? result : ["Nie udało się wygenerować odpowiedzi."];
}

function siteReply() {
  if (!SITE_URL) {
    return "🍌 Adres strony nie został jeszcze ustawiony. Administrator musi dodać poprawny BANANASHOP_URL w konfiguracji hostingu.";
  }
  try {
    const url = new URL(SITE_URL);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid protocol");
    return "🍌 Oficjalna strona BananaShop: " + url.toString();
  } catch {
    return "🍌 Adres strony w konfiguracji jest nieprawidłowy. Administrator musi poprawić BANANASHOP_URL.";
  }
}

async function ensureRoleManager(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "Ta komenda działa tylko na serwerze.", flags: MessageFlags.Ephemeral });
    return false;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: "Do zarządzania rangami potrzebujesz uprawnienia **Zarządzanie rolami**.", flags: MessageFlags.Ephemeral });
    return false;
  }
  const me = await interaction.guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: "Bot nie ma uprawnienia **Zarządzanie rolami**. Nadaj mu je w ustawieniach ról.", flags: MessageFlags.Ephemeral });
    return false;
  }
  return true;
}

client.once(Events.ClientReady, ready => console.log("BananaAI online: " + ready.user.tag));

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "pomoc") {
    return interaction.reply({
      content: "🍌 **BananaAI — komendy**\n/ai pytanie — rozmowa z AI\n/strona — oficjalna strona BananaShop\n/oferta — strona i Discord\n/ranga — tworzenie i nadawanie rang (dla osób z Zarządzaniem rolami)\n/pomoc — pomoc",
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.commandName === "strona") {
    return interaction.reply({ content: siteReply(), flags: MessageFlags.Ephemeral });
  }

  if (interaction.commandName === "oferta") {
    return interaction.reply({
      content: "🍌 **BananaShop**\n" + siteReply() + "\nDiscord: " + INVITE_URL + "\nAktualne warunki potwierdź z obsługą.",
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.commandName === "ranga") {
    if (!(await ensureRoleManager(interaction))) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "stworz") {
      const name = interaction.options.getString("nazwa", true).trim();
      const colorName = interaction.options.getString("kolor", true);
      if (!name || name.length > 90) {
        return interaction.reply({ content: "Nazwa rangi musi mieć od 1 do 90 znaków.", flags: MessageFlags.Ephemeral });
      }
      try {
        const role = await interaction.guild.roles.create({
          name,
          color: roleColors[colorName],
          permissions: [],
          mentionable: false,
          reason: "Utworzenie rangi przez /ranga stworz"
        });
        return interaction.reply({ content: "✅ Utworzono rangę " + role.toString() + " (" + colorName + "). Nie ma ona żadnych dodatkowych uprawnień.", flags: MessageFlags.Ephemeral });
      } catch (error) {
        console.error("Role create failed:", error?.message || error);
        return interaction.reply({ content: "Nie udało się utworzyć rangi. Sprawdź uprawnienie Zarządzanie rolami i hierarchię ról bota.", flags: MessageFlags.Ephemeral });
      }
    }

    const role = interaction.options.getRole("ranga", true);
    const targetUser = interaction.options.getUser("uzytkownik", true);
    let member;
    try { member = await interaction.guild.members.fetch(targetUser.id); } catch { member = null; }
    if (!member) {
      return interaction.reply({ content: "Nie udało się znaleźć użytkownika na tym serwerze.", flags: MessageFlags.Ephemeral });
    }
    if (role.managed || !role.editable) {
      return interaction.reply({ content: "Nie mogę zarządzać tą rangą. Przenieś najwyższą rangę bota ponad nią w ustawieniach serwera.", flags: MessageFlags.Ephemeral });
    }
    try {
      if (sub === "nadaj") {
        await member.roles.add(role, "Nadanie rangi przez /ranga nadaj");
        return interaction.reply({ content: "✅ Nadano rangę " + role.toString() + " użytkownikowi " + member.toString() + ".", flags: MessageFlags.Ephemeral });
      }
      await member.roles.remove(role, "Odebranie rangi przez /ranga zabierz");
      return interaction.reply({ content: "✅ Odebrano rangę " + role.toString() + " użytkownikowi " + member.toString() + ".", flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error("Role assignment failed:", error?.message || error);
      return interaction.reply({ content: "Nie udało się zmienić rangi. Sprawdź hierarchię ról i uprawnienia bota.", flags: MessageFlags.Ephemeral });
    }
  }

  if (interaction.commandName !== "ai") return;
  const now = Date.now();
  const last = cooldowns.get(interaction.user.id) || 0;
  if (now - last < 7000) {
    return interaction.reply({ content: "Daj mi kilka sekund na złapanie oddechu 🍌", flags: MessageFlags.Ephemeral });
  }
  cooldowns.set(interaction.user.id, now);
  const question = interaction.options.getString("pytanie", true).trim();
  await interaction.deferReply();
  const key = (interaction.guildId || "dm") + ":" + interaction.user.id;
  const previous = history.get(key) || [];
  try {
    const response = await openai.responses.create({
      model,
      instructions: SYSTEM,
      input: [...previous, { role: "user", content: question }],
      max_output_tokens: 500
    });
    const answer = response.output_text?.trim() || "Nie mam teraz odpowiedzi. Spróbuj ponownie.";
    history.set(key, [...previous, { role: "user", content: question }, { role: "assistant", content: answer }].slice(-8));
    const parts = chunks(answer);
    await interaction.editReply(parts[0]);
    for (const part of parts.slice(1)) await interaction.followUp(part);
  } catch (error) {
    console.error("OpenAI request failed:", error?.status || error?.message || error);
    await interaction.editReply("Nie udało mi się połączyć z AI. Sprawdź klucz API, dostępność modelu i limity projektu OpenAI.");
  }
});

client.login(process.env.DISCORD_TOKEN);
