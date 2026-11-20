require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  PermissionsBitField
} = require("discord.js");
const OpenAI = require("openai");

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  OPENAI_API_KEY
} = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error("Brakuje DISCORD_TOKEN lub DISCORD_CLIENT_ID w zmiennych środowiskowych.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const ai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Tworzy podstawowy układ kanałów i role BananaShop")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Zadaj pytanie BananaAI")
    .addStringOption(option =>
      option.setName("pytanie")
        .setDescription("O co chcesz zapytać?")
        .setRequired(true)
        .setMaxLength(1000)
    ),
  new SlashCommandBuilder()
    .setName("zarzadzaj")
    .setDescription("Poproś BananaAI o utworzenie rang lub kanałów")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName("polecenie")
        .setDescription("Np. utwórz kategorię Sklep i kanał oferta")
        .setRequired(true)
        .setMaxLength(700)
    )
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const route = DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
    : Routes.applicationCommands(DISCORD_CLIENT_ID);

  await rest.put(route, { body: commands });
  console.log("Zarejestrowano komendy /setup i /ai.");
}

async function ensureRole(guild, name, color) {
  let role = guild.roles.cache.find(item => item.name === name);
  if (!role) {
    role = await guild.roles.create({
      name,
      color,
      reason: "Konfiguracja BananaShop"
    });
  }
  return role;
}

async function ensureCategory(guild, name, overwrites = []) {
  let category = guild.channels.cache.find(
    channel => channel.type === ChannelType.GuildCategory && channel.name === name
  );
  if (!category) {
    category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      reason: "Konfiguracja BananaShop"
    });
  }
  return category;
}

async function ensureTextChannel(guild, name, parent) {
  const exists = guild.channels.cache.find(
    channel => channel.type === ChannelType.GuildText &&
      channel.name === name &&
      channel.parentId === parent.id
  );
  if (!exists) {
    await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parent.id,
      reason: "Konfiguracja BananaShop"
    });
  }
}

async function setupServer(interaction) {
  const guild = interaction.guild;
  await interaction.deferReply({ ephemeral: true });

  try {
    const ownerRole = await ensureRole(guild, "Właściciel", "#f1c40f");
    const adminRole = await ensureRole(guild, "Administrator", "#e74c3c");
    const modRole = await ensureRole(guild, "Moderator", "#3498db");
    await ensureRole(guild, "Użytkownik", "#95a5a6");

    const staffOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: guild.members.me.id, allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels
      ] },
      ...[ownerRole, adminRole, modRole].map(role => ({
        id: role.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }))
    ];

    const info = await ensureCategory(guild, "📌 INFORMACJE");
    const community = await ensureCategory(guild, "💬 SPOŁECZNOŚĆ");
    const games = await ensureCategory(guild, "⛏️ MINECRAFT");
    const staff = await ensureCategory(guild, "🔒 EKIPA", staffOverwrites);

    const channelPlan = [
      [info, ["📢・ogłoszenia", "📜・regulamin", "👋・powitania"]],
      [community, ["💬・chat", "🤖・bot-ai", "📸・media"]],
      [games, ["🎮・minecraft", "⚔️・pvp", "🛏️・bedwars"]],
      [staff, ["👑・właściciele", "🛠️・administracja", "🔐・staff-chat"]]
    ];

    for (const [category, names] of channelPlan) {
      for (const name of names) {
        await ensureTextChannel(guild, name, category);
      }
    }

    await interaction.editReply(
      "🍌 Gotowe! Utworzyłem brakujące kategorie, kanały i role BananaShop. Istniejące kanały zostawiłem bez zmian. Role możesz teraz ręcznie przypisać odpowiednim osobom."
    );
  } catch (error) {
    console.error("Błąd /setup:", error);
    await interaction.editReply(
      "Nie udało się dokończyć konfiguracji. Sprawdź, czy bot ma uprawnienia **Zarządzanie kanałami** i **Zarządzanie rolami**, a jego najwyższa rola znajduje się odpowiednio wysoko."
    );
  }
}

async function manageWithAI(interaction) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: "Ta komenda jest tylko dla osób z uprawnieniem Zarządzanie serwerem.", ephemeral: true });
  }
  if (!ai) {
    return interaction.reply({ content: "BananaAI potrzebuje OPENAI_API_KEY w prywatnych zmiennych środowiskowych hostingu. Nie wklejaj klucza na Discordzie ani GitHubie.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  const instruction = interaction.options.getString("polecenie", true);
  try {
    const result = await ai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: 'Jesteś planerem konfiguracji Discorda. Zwróć wyłącznie JSON w formacie {"actions":[...]}. Dozwolone akcje: {"type":"create_category","name":"..."}; {"type":"create_text_channel","name":"...","category":"..."}; {"type":"create_role","name":"...","color":"#RRGGBB"}. Maksymalnie 6 akcji. Nazwy krótkie, bez @everyone/@here. Nie twórz ról o nazwach sugerujących właściciela lub administratora, chyba że polecenie pochodzi od administratora (zawsze pochodzi). Nie twórz żadnych uprawnień dla ról. Nie usuwaj ani nie zmieniaj istniejących elementów. Jeśli prośba jest niejasna lub wykracza poza zakres, zwróć {"actions":[],"message":"krótkie wyjaśnienie"}.'
        },
        { role: "user", content: instruction }
      ],
      max_tokens: 500
    });
    const raw = result.choices[0]?.message?.content || '{"actions":[]}';
    const plan = JSON.parse(raw);
    const actions = Array.isArray(plan.actions) ? plan.actions.slice(0, 6) : [];
    const guild = interaction.guild;
    const outcomes = [];

    for (const action of actions) {
      if (action.type === "create_category" && typeof action.name === "string") {
        const name = action.name.trim().slice(0, 90);
        if (!name) continue;
        let channel = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name);
        if (!channel) channel = await guild.channels.create({ name, type: ChannelType.GuildCategory, reason: "Polecenie BananaAI od administratora" });
        outcomes.push("📁 Kategoria: " + name);
      } else if (action.type === "create_text_channel" && typeof action.name === "string") {
        const name = action.name.trim().toLowerCase().replace(/[^a-z0-9ąćęłńóśźż_-]/g, "-").slice(0, 90);
        if (!name) continue;
        const categoryName = typeof action.category === "string" ? action.category.trim().slice(0, 90) : "";
        let parent = categoryName ? guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === categoryName) : null;
        if (!parent && categoryName) {
          parent = await guild.channels.create({ name: categoryName, type: ChannelType.GuildCategory, reason: "Polecenie BananaAI od administratora" });
        }
        let channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === name && c.parentId === (parent?.id || null));
        if (!channel) await guild.channels.create({ name, type: ChannelType.GuildText, ...(parent ? { parent: parent.id } : {}), reason: "Polecenie BananaAI od administratora" });
        outcomes.push("💬 Kanał: #" + name);
      } else if (action.type === "create_role" && typeof action.name === "string") {
        const name = action.name.trim().slice(0, 90);
        if (!name || name === "@everyone") continue;
        let role = guild.roles.cache.find(r => r.name === name);
        if (!role) {
          const color = /^#[0-9A-Fa-f]{6}$/.test(action.color || "") ? action.color : "#F1C40F";
          role = await guild.roles.create({ name, color, reason: "Polecenie BananaAI od administratora" });
        }
        outcomes.push("🏷️ Ranga: " + name);
      }
    }

    const message = outcomes.length ? "🍌 Wykonałem polecenie:\n" + outcomes.join("\n") : (plan.message || "Nie znalazłem bezpiecznych działań do wykonania. Spróbuj opisać dokładniej, co mam utworzyć.");
    await interaction.editReply(message);
  } catch (error) {
    console.error("Błąd /zarzadzaj:", error);
    await interaction.editReply("Nie udało się wykonać polecenia. Sprawdź uprawnienia Zarządzanie kanałami i Zarządzanie rolami oraz ustawienie OPENAI_API_KEY.");
  }
}

async function answerWithAI(interaction) {
  const question = interaction.options.getString("pytanie", true);

  if (!ai) {
    return interaction.reply({
      content: "🍌 Funkcja AI nie jest jeszcze aktywna. Właściciel bota musi dodać OPENAI_API_KEY w ustawieniach hostingu. Klucz API jest osobny od subskrypcji ChatGPT.",
      ephemeral: true
    });
  }

  await interaction.deferReply();
  try {
    const response = await ai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Jesteś BananaAI, pomocnym botem społeczności BananaShop na Discordzie. Odpowiadaj po polsku, przyjaźnie, konkretnie i bez obrażania użytkowników. Jeśli nie znasz odpowiedzi, powiedz to wprost."
        },
        { role: "user", content: question }
      ],
      max_tokens: 500
    });

    const answer = response.choices[0]?.message?.content?.trim() || "Nie udało mi się przygotować odpowiedzi.";
    await interaction.editReply(answer.slice(0, 1900));
  } catch (error) {
    console.error("Błąd AI:", error);
    await interaction.editReply("Coś nie pykło przy odpowiedzi AI. Spróbuj ponownie za chwilę.");
  }
}

client.once("ready", () => {
  console.log(`BananaAI zalogowany jako ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setup") {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "Ta komenda działa tylko na serwerze.", ephemeral: true });
    }
    return setupServer(interaction);
  }

  if (interaction.commandName === "ai") {
    return answerWithAI(interaction);
  }

  if (interaction.commandName === "zarzadzaj") {
    return manageWithAI(interaction);
  }
});

(async () => {
  try {
    await registerCommands();
    await client.login(DISCORD_TOKEN);
  } catch (error) {
    console.error("Nie udało się uruchomić BananaAI:", error);
    process.exit(1);
  }
})();
