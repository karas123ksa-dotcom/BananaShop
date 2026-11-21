import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

for (const key of ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"]) {
  if (!process.env[key]) throw new Error("Missing environment variable: " + key);
}

const commands = [
  new SlashCommandBuilder().setName("ai").setDescription("Porozmawiaj z BananaAI")
    .addStringOption(o => o.setName("pytanie").setDescription("O co chcesz zapytać?").setRequired(true).setMaxLength(1500)),
  new SlashCommandBuilder().setName("oferta").setDescription("Linki i informacje o BananaShop"),
  new SlashCommandBuilder().setName("pomoc").setDescription("Pokaż pomoc BananaAI")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
const route = process.env.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
  : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
await rest.put(route, { body: commands });
console.log("Registered " + commands.length + " BananaAI commands.");
