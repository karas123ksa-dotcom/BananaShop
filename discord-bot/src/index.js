const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");
const OpenAI = require("openai");

const required = ["DISCORD_TOKEN", "CLIENT_ID"];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;
const spamHistory = new Map();
const TICKET_CATEGORY = "🎫・TICKETY";
const WELCOME_CHANNEL = "👋・powitania";
const TICKET_PANEL_CHANNEL = "🎫・otwórz-ticket";
const LOG_CHANNEL = "📋・logi";

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Tworzy strukturę kanałów BananShop i panel ticketów.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Publikuje panel otwierania ticketów.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),
  new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Zadaj pytanie asystentowi BananAI.")
    .addStringOption(option =>
      option.setName("pytanie").setDescription("Co chcesz wiedzieć?").setRequired(true).setMaxLength(1500)
    ),
  new SlashCommandBuilder()
    .setName("ogloszenie")
    .setDescription("Publikuje ogłoszenie w kanale ogłoszeń.")
    .addStringOption(option =>
      option.setName("tresc").setDescription("Treść ogłoszenia").setRequired(true).setMaxLength(1800)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
].map(command => command.toJSON());

function isStaff(member) {
  return Boolean(
    member?.permissions?.has(PermissionsBitField.Flags.Administrator) ||
    member?.permissions?.has(PermissionsBitField.Flags.ManageChannels) ||
    (STAFF_ROLE_ID && member?.roles?.cache?.has(STAFF_ROLE_ID))
  );
}

async function ensureCategory(guild, name, privateToStaff = false) {
  let category = guild.channels.cache.find(
    channel => channel.type === ChannelType.GuildCategory && channel.name === name
  );
  if (category) return category;

  const permissionOverwrites = privateToStaff
    ? [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels
          ]
        }
      ]
    : [];

  category = await guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites
  });
  return category;
}

async function ensureText(guild, name, parent, options = {}) {
  let channel = guild.channels.cache.find(
    item => item.type === ChannelType.GuildText && item.name === name
  );
  if (channel) {
    if (parent && channel.parentId !== parent.id) {
      await channel.setParent(parent.id).catch(() => {});
    }
    return channel;
  }

  const permissionOverwrites = options.private
    ? [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels
          ]
        },
        ...(STAFF_ROLE_ID && guild.roles.cache.has(STAFF_ROLE_ID)
          ? [{
              id: STAFF_ROLE_ID,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory
              ]
            }]
          : [])
      ]
    : [];

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: parent?.id,
    topic: options.topic,
    permissionOverwrites
  });
}

async function logToGuild(guild, message) {
  const channel = guild.channels.cache.find(
    item => item.type === ChannelType.GuildText && item.name === LOG_CHANNEL
  );
  if (channel) await channel.send({ content: message }).catch(() => {});
}

function ticketPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0xC9F36B)
    .setTitle("🍌 Centrum pomocy BananShop")
    .setDescription(
      "Potrzebujesz pomocy? Wybierz temat poniżej, a utworzymy prywatny kanał dla Ciebie.\n\n" +
      "🛒 **Zakup** — pytania o ofertę i zamówienia\n" +
      "🆘 **Pomoc** — problemy i pytania\n" +
      "📦 **Reklamacja** — zgłoszenie sprawy do obsługi\n\n" +
      "Nie otwieraj kilku ticketów w tej samej sprawie."
    )
    .setFooter({ text: "BananShop.pl • Obsługa klienta" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket:zakup").setLabel("Zakup").setEmoji("🛒").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ticket:pomoc").setLabel("Pomoc").setEmoji("🆘").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ticket:reklamacja").setLabel("Reklamacja").setEmoji("📦").setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row] };
}

async function publishTicketPanel(guild) {
  const channel = guild.channels.cache.find(
    item => item.type === ChannelType.GuildText && item.name === TICKET_PANEL_CHANNEL
  );
  if (!channel) throw new Error("Nie znaleziono kanału panelu ticketów. Użyj najpierw /setup.");
  const recent = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  const alreadyPosted = recent?.some(message =>
    message.author.id === client.user.id &&
    message.embeds.some(embed => embed.title === "🍌 Centrum pomocy BananShop")
  );
  if (!alreadyPosted) await channel.send(ticketPanelPayload());
  return channel;
}

async function setupGuild(guild) {
  const info = await ensureCategory(guild, "📌・INFORMACJE");
  await ensureText(guild, "👋・powitania", info, { topic: "Automatyczne powitania nowych osób." });
  await ensureText(guild, "📜・regulamin", info);
  await ensureText(guild, "📢・ogłoszenia", info);
  await ensureText(guild, "🛍️・oferta", info);
  await ensureText(guild, "⭐・opinie", info);

  const support = await ensureCategory(guild, "🎫・OBSŁUGA KLIENTA");
  await ensureText(guild, "🎫・otwórz-ticket", support);
  await ensureText(guild, "❓・pomoc", support);
  await ensureText(guild, "📦・zamówienia", support);

  const community = await ensureCategory(guild, "💬・SPOŁECZNOŚĆ");
  await ensureText(guild, "💬・chat", community);
  await ensureText(guild, "🖼️・media", community);
  await ensureText(guild, "🤖・bot-komendy", community);

  const ticketCategory = await ensureCategory(guild, TICKET_CATEGORY, true);
  if (STAFF_ROLE_ID && guild.roles.cache.has(STAFF_ROLE_ID)) {
    await ticketCategory.permissionOverwrites.edit(STAFF_ROLE_ID, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  const staff = await ensureCategory(guild, "🔒・EKIPA", true);
  if (STAFF_ROLE_ID && guild.roles.cache.has(STAFF_ROLE_ID)) {
    await staff.permissionOverwrites.edit(STAFF_ROLE_ID, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }
  await ensureText(guild, "📋・logi", staff, { private: true });
  await ensureText(guild, "🔐・staff-chat", staff, { private: true });
  await ensureText(guild, "🚨・zgłoszenia", staff, { private: true });

  const panel = await publishTicketPanel(guild);
  return panel;
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`BananShop bot online as ${readyClient.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log("Slash commands registered.");
  } catch (error) {
    console.error("Could not register slash commands:", error.message);
  }
});

client.on(Events.GuildMemberAdd, async member => {
  const channel = member.guild.channels.cache.find(
    item => item.type === ChannelType.GuildText && item.name === WELCOME_CHANNEL
  );
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setColor(0xC9F36B)
    .setTitle("🍌 Witaj w BananShop!")
    .setDescription(
      `Hej ${member}! Miło, że jesteś z nami.\n\n` +
      "📜 Zapoznaj się z regulaminem.\n" +
      "🛍️ Sprawdź naszą ofertę.\n" +
      "🎫 Jeśli potrzebujesz pomocy, otwórz ticket."
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: "BananShop.pl • Fresh energy" });
  await channel.send({ embeds: [embed] }).catch(() => {});
});

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot || !message.member) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

  const now = Date.now();
  const history = (spamHistory.get(message.author.id) || []).filter(time => now - time < 7000);
  history.push(now);
  spamHistory.set(message.author.id, history);

  if (history.length >= 6) {
    await message.delete().catch(() => {});
    await message.member.timeout(60_000, "BananShop AutoMod: wykryto szybki flood").catch(() => {});
    await logToGuild(message.guild, `🛡️ AutoMod: timeout dla <@${message.author.id}> za szybki flood.`);
    spamHistory.delete(message.author.id);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: "Tylko administrator może uruchomić konfigurację.", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        const panel = await setupGuild(interaction.guild);
        return interaction.editReply(
          `Gotowe! Przygotowałem strukturę BananShop i panel ticketów w ${panel}. Sprawdź prywatne kanały ekipy i nadaj dostęp swojej roli staff.`
        );
      }

      if (interaction.commandName === "ticket-panel") {
        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: "Nie masz uprawnień do tej komendy.", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        const channel = await publishTicketPanel(interaction.guild);
        return interaction.editReply(`Panel ticketów opublikowany w ${channel}.`);
      }

      if (interaction.commandName === "ogloszenie") {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
          return interaction.reply({ content: "Potrzebujesz uprawnienia Zarządzanie serwerem.", ephemeral: true });
        }
        const channel = interaction.guild.channels.cache.find(
          item => item.type === ChannelType.GuildText && item.name === "📢・ogłoszenia"
        );
        if (!channel) return interaction.reply({ content: "Nie znaleziono kanału ogłoszeń. Uruchom /setup.", ephemeral: true });
        const text = interaction.options.getString("tresc", true);
        const embed = new EmbedBuilder().setColor(0xC9F36B).setTitle("📢 BananShop — ogłoszenie").setDescription(text).setTimestamp();
        await channel.send({ embeds: [embed] });
        return interaction.reply({ content: "Ogłoszenie opublikowane.", ephemeral: true });
      }

      if (interaction.commandName === "ai") {
        if (!openai) {
          return interaction.reply({ content: "Asystent AI nie jest jeszcze skonfigurowany. Administrator musi dodać OPENAI_API_KEY w sekretach hostingu.", ephemeral: true });
        }
        await interaction.deferReply();
        const question = interaction.options.getString("pytanie", true);
        const response = await openai.responses.create({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          instructions: "Jesteś BananaAI, pomocnym asystentem społeczności BananShop. Odpowiadaj po polsku, krótko, uprzejmie i bez wymyślania cen, produktów, zamówień ani statusów płatności. Nie wykonujesz działań administracyjnych; możesz jedynie wyjaśniać, jak z nich skorzystać.",
          input: question,
          max_output_tokens: 350
        });
        const answer = (response.output_text || "Nie udało się przygotować odpowiedzi.").slice(0, 1900);
        return interaction.editReply(answer);
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith("ticket:")) {
      const kind = interaction.customId.split(":")[1];
      const category = interaction.guild.channels.cache.find(
        item => item.type === ChannelType.GuildCategory && item.name === TICKET_CATEGORY
      );
      if (!category) {
        return interaction.reply({ content: "Brakuje kategorii ticketów. Administrator musi uruchomić /setup.", ephemeral: true });
      }

      const existing = interaction.guild.channels.cache.find(
        channel => channel.type === ChannelType.GuildText &&
          channel.parentId === category.id &&
          channel.topic === `ticket-owner:${interaction.user.id}`
      );
      if (existing) return interaction.reply({ content: `Masz już otwarty ticket: ${existing}`, ephemeral: true });

      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 18) || "klient";
      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels
          ]
        }
      ];
      if (STAFF_ROLE_ID && interaction.guild.roles.cache.has(STAFF_ROLE_ID)) {
        overwrites.push({
          id: STAFF_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        });
      }

      const channel = await interaction.guild.channels.create({
        name: `ticket-${safeName}`,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `ticket-owner:${interaction.user.id} | type:${kind}`,
        permissionOverwrites: overwrites
      });

      const labels = { zakup: "Zakup", pomoc: "Pomoc", reklamacja: "Reklamacja" };
      const embed = new EmbedBuilder()
        .setColor(0xC9F36B)
        .setTitle(`🎫 Ticket — ${labels[kind] || kind}`)
        .setDescription(`Witaj ${interaction.user}! Opisz dokładnie swoją sprawę. Obsługa BananShop odpowie tutaj.\n\nNie podawaj haseł, tokenów ani danych płatniczych.`)
        .setFooter({ text: "BananShop.pl • Aby zakończyć, użyj przycisku poniżej." });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket-close").setLabel("Zamknij ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger)
      );
      await channel.send({ content: `${interaction.user}${STAFF_ROLE_ID ? ` <@&${STAFF_ROLE_ID}>` : ""}`, embeds: [embed], components: [row] });
      await interaction.reply({ content: `Utworzyłem prywatny ticket: ${channel}`, ephemeral: true });
      await logToGuild(interaction.guild, `🎫 Nowy ticket ${channel} — ${labels[kind]} — <@${interaction.user.id}>.`);
    }

    if (interaction.isButton() && interaction.customId === "ticket-close") {
      const channel = interaction.channel;
      const ownerId = channel.topic?.match(/ticket-owner:(\d+)/)?.[1];
      const allowed = isStaff(interaction.member) || interaction.user.id === ownerId;
      if (!allowed) return interaction.reply({ content: "Ticket może zamknąć jego autor lub obsługa.", ephemeral: true });
      await interaction.reply({ content: "Ticket zostanie zamknięty za 5 sekund." });
      await logToGuild(interaction.guild, `🔒 Zamknięto ticket ${channel.name} przez <@${interaction.user.id}>.`);
      setTimeout(() => channel.delete("Ticket zamknięty").catch(() => {}), 5000);
    }
  } catch (error) {
    console.error("Interaction error:", error);
    const message = "Wystąpił błąd. Sprawdź uprawnienia bota i logi hostingu.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
