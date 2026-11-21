import "dotenv/config";
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

for (const key of ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"]) {
  if (!process.env[key]) throw new Error("Missing environment variable: " + key);
}

const colors = [
  ["zielony", "Zielony"], ["zlote", "Złoty"], ["niebieski", "Niebieski"],
  ["rozowy", "Różowy"], ["fioletowy", "Fioletowy"], ["czerwony", "Czerwony"],
  ["bialy", "Biały"]
];

const commands = [
  new SlashCommandBuilder()
    .setName("ai").setDescription("Porozmawiaj z BananaAI")
    .addStringOption(o => o.setName("pytanie").setDescription("O co chcesz zapytać?").setRequired(true).setMaxLength(1500)),
  new SlashCommandBuilder().setName("strona").setDescription("Pokaż oficjalną stronę BananaShop"),
  new SlashCommandBuilder().setName("oferta").setDescription("Linki i informacje o BananaShop"),
  new SlashCommandBuilder().setName("pomoc").setDescription("Pokaż pomoc BananaAI"),
  new SlashCommandBuilder()
    .setName("ranga").setDescription("Zarządzaj rangami serwera")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName("stworz").setDescription("Utwórz nową rangę bez dodatkowych uprawnień")
      .addStringOption(o => o.setName("nazwa").setDescription("Nazwa nowej rangi").setRequired(true).setMaxLength(90))
      .addStringOption(o => {
        o.setName("kolor").setDescription("Kolor rangi").setRequired(true);
        for (const [value, label] of colors) o.addChoices({ name: label, value });
        return o;
      }))
    .addSubcommand(s => s.setName("nadaj").setDescription("Nadaj istniejącą rangę użytkownikowi")
      .addRoleOption(o => o.setName("ranga").setDescription("Ranga do nadania").setRequired(true))
      .addUserOption(o => o.setName("uzytkownik").setDescription("Użytkownik").setRequired(true)))
    .addSubcommand(s => s.setName("zabierz").setDescription("Odbierz rangę użytkownikowi")
      .addRoleOption(o => o.setName("ranga").setDescription("Ranga do odebrania").setRequired(true))
      .addUserOption(o => o.setName("uzytkownik").setDescription("Użytkownik").setRequired(true)))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
const route = process.env.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
  : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
await rest.put(route, { body: commands });
console.log("Registered " + commands.length + " BananaAI commands.");
