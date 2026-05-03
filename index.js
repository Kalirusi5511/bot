require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField,
    ChannelType,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// =========================
// ROLES
// =========================
const hasMemberRole = (member) => {
    return member?.roles?.cache?.has(process.env.MEMBER_ROLE_ID);
};

const isStaff = (member) => {
    if (!member) return false;

    return (
        member.roles.cache.has(process.env.SUPPORT_ROLE_ID) ||
        member.roles.cache.has(process.env.ADMIN_ROLE_ID) ||
        member.permissions.has(PermissionsBitField.Flags.Administrator)
    );
};

// =========================
// VERIFIED OWNER SYSTEM
// =========================
const verifiedOwners = new Map();

const isOwner = (interaction) => {
    return interaction.channel?.topic === interaction.user.id;
};

// =========================
// READY
// =========================
client.once(Events.ClientReady, () => {
    console.log(`Online als ${client.user.tag}`);
});

// =========================
// INTERACTIONS
// =========================
client.on(Events.InteractionCreate, async (interaction) => {

    try {

        // =========================
        // SLASH COMMANDS
        // =========================
        if (interaction.isChatInputCommand()) {

            // =========================
            // VERIFY COMMAND
            // =========================
            if (interaction.commandName === 'verify') {

                const name = interaction.options.getString('name');

                if (!name) {
                    return interaction.reply({
                        content: "❌ Bitte gib einen Namen ein",
                        flags: 64
                    });
                }

                verifiedOwners.set(interaction.user.id, name);

                interaction.member.setNickname(name).catch(() => {});

                return interaction.reply({
                    content: `✅ Verifiziert als **${name}**`,
                    flags: 64
                });
            }

            // 🎫 TICKET PANEL
            if (interaction.commandName === 'ticket') {

                const embed = new EmbedBuilder()
                    .setTitle('🎫 Support Ticket')
                    .setDescription('Klicke unten, um ein Ticket zu erstellen')
                    .setColor('Blue');

                const button = new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Ticket erstellen')
                    .setStyle(ButtonStyle.Success);

                return interaction.reply({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(button)],
                    flags: 64
                });
            }

            // 🧭 PANEL
            if (interaction.commandName === 'panel') {

                if (!interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
                    return interaction.reply({ content: "❌ Kein Zugriff", flags: 64 });
                }

                const embed = new EmbedBuilder()
                    .setTitle("🧭 Ticket Panel")
                    .setColor("Blue");

                return interaction.reply({
                    embeds: [embed],
                    flags: 64
                });
            }
        }

        // =========================
        // BUTTONS
        // =========================
        if (interaction.isButton()) {

            // =========================
            // MEMBER CHECK
            // =========================
            if (interaction.customId.startsWith('create_') && !hasMemberRole(interaction.member)) {
                return interaction.reply({
                    content: "❌ Du brauchst die Member-Rolle",
                    flags: 64
                });
            }

            // =========================
            // CREATE TICKET
            // =========================
            if (interaction.customId === 'create_ticket') {

                const ownerName = verifiedOwners.get(interaction.user.id) || interaction.user.username;

                const channel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,

                    topic: interaction.user.id, // 👈 OWNER SPEICHER

                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        },
                        {
                            id: process.env.SUPPORT_ROLE_ID,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        }
                    ]
                });

                const embed = new EmbedBuilder()
                    .setTitle('🎫 Ticket erstellt')
                    .setDescription(`Owner: **${ownerName}**`)
                    .setColor('Green');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('Claim')
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Close')
                        .setStyle(ButtonStyle.Danger)
                );

                await channel.send({
                    content: `<@${interaction.user.id}>`,
                    embeds: [embed],
                    components: [row]
                });

                return interaction.reply({
                    content: `✅ Ticket erstellt: ${channel}`,
                    flags: 64
                });
            }

            // =========================
            // CLAIM
            // =========================
            if (interaction.customId === 'claim_ticket') {

                if (!isStaff(interaction.member) && !isOwner(interaction)) {
                    return interaction.reply({
                        content: "❌ Nur Staff oder Owner",
                        flags: 64
                    });
                }

                await interaction.channel.setName(`claimed-${interaction.user.username}`);

                return interaction.reply({
                    content: `👤 übernommen von ${interaction.user}`
                });
            }

            // =========================
            // CLOSE
            // =========================
            if (interaction.customId === 'close_ticket') {

                if (!isStaff(interaction.member) && !isOwner(interaction)) {
                    return interaction.reply({
                        content: "❌ Kein Zugriff",
                        flags: 64
                    });
                }

                await interaction.reply({
                    content: "🔒 Ticket wird geschlossen...",
                    flags: 64
                });

                setTimeout(async () => {
                    try {
                        await interaction.channel.delete();
                    } catch (e) {
                        console.log(e);
                    }
                }, 2500);
            }
        }

    } catch (err) {
        console.error(err);

        if (!interaction.replied) {
            interaction.reply({
                content: "❌ Fehler im Bot",
                flags: 64
            }).catch(() => {});
        }
    }
});

client.login(process.env.TOKEN);