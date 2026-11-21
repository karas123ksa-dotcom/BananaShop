import "dotenv/config";
import OpenAI from "openai";
import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";

for (const key of ["DISCORD_TOKEN", "OPENAI_API_KEY"]) {
  if (!process.env[key]) { console.error("Missing environment variable: " + key); process.exit(1); }
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const model = process.env.OPENAI_MODEL || "gpt-6.2-sol";
const history = new Map();
const cooldowns = new Map();
const SYSTEM = "Jesteś BananaAI, pomocnym polskojęzycznym asystentem serwera Discord BananaShop. Odpowiadaj krótko, przyjaźnie i jasno. Pomagaj w pytaniach o Minecraft, BananaShop i problemy techniczne. Nie wymyślaj cen, dostępności, statusu zamówień ani funkcji sklepu. W razie wątpliwości odeślij do obsługi. Nigdy nie proś o hasła, tokeny botów ani klucze API. Nie twierdź, że wykonałeś działania moderacyjne.";

function chunks(text, limit = 1850) {
  const result = []; let rest = String(text || "").trim();
  while (rest.length > limit) { let cut = rest.lastIndexOf("\\n", limit); if (cut < limit * 0.5) cut = limit; result.push(rest.slice(0, cut)); rest = rest.slice(cut).trim(); }
  if (rest) result.push(rest);
  return result.length ? result : ["Nie udało się wygenerować odpowiedzi."];
}
client.once(Events.ClientReady, ready => console.log("BananaAI online: " + ready.user.tag));
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "pomoc") return interaction.reply({ content: "🍌 BananaAI\n/ai pytanie — rozmowa z AI\n/oferta — linki sklepu\n/pomoc — pomoc", flags: MessageFlags.Ephemeral });
  if (interaction.commandName === "oferta") {
    const site = process.env.BANANASHOP_URL || "https://karas123ksa-dotcom.github.io/BananaShop/";
    const invite = process.env.DISCORD_INVITE || "https://discord.gg/9T4tF55jd";
    return interaction.reply({ content: "🍌 BananaShop\nStrona: " + site + "\nDiscord: " + invite + "\nAktualne warunki potwierdź z obsługą.", flags: MessageFlags.Ephemeral });
  }
  if (interaction.commandName !== "ai") return;
  const now = Date.now(); const last = cooldowns.get(interaction.user.id) || 0;
  if (now - last < 7000) return interaction.reply({ content: "Daj mi kilka sekund na złapanie oddechu 🍌", flags: MessageFlags.Ephemeral });
  cooldowns.set(interaction.user.id, now);
  const question = interaction.options.getString("pytanie", true).trim();
  await interaction.deferReply();
  const key = (interaction.guildId || "dm") + ":" + interaction.user.id;
  const previous = history.get(key) || [];
  try {
    const response = await openai.responses.create({ model, instructions: SYSTEM, input: [...previous, { role: "user", content: question }], max_output_tokens: 500 });
    const answer = response.output_text?.trim() || "Nie mam teraz odpowiedzi. Spróbuj ponownie.";
    history.set(key, [...previous, { role: "user", content: question }, { role: "assistant", content: answer }].slice(-8));
    const parts = chunks(answer); await interaction.editReply(parts[0]);
    for (const part of parts.slice(1)) await interaction.followUp(part);
  } catch (error) {
    console.error("OpenAI request failed:", error?.status || error?.message || error);
    await interaction.editReply("Nie udało mi się połączyć z AI. Sprawdź klucz API, dostępność modelu i limity projektu OpenAI.");
  }
});
client.login(process.env.DISCORD_TOKEN);
