require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

// ======================
// AYARLAR
// ======================
const SUPPORT_ROLE_ID = "1542872257276149860"; // Destek Rol ID
const VOICE_CHANNEL_ID = "1542872463870922814"; // 7/24 Duracağı Yeni Ses Kanalı ID

// Ticket Kategorileri
const TICKET_CATEGORIES = {
  'ticket_anticheat': { name: 'ANTICHEAT | Güvenlik', categoryName: 'ANTICHEAT TICKETLARI' },
  'ticket_teknik': { name: 'TEKNIK | Destek', categoryName: 'TEKNİK DESTEK TICKETLARI' },
  'ticket_oyunici': { name: 'OYUN-ICI | Destek', categoryName: 'OYUN İÇİ TICKETLARI' }
};

// ======================
// BOT HAZIR & SLASH KOMUTLARI
// ======================
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} olarak giriş yapıldı!`);

  // Slash Komutlarını Kaydetme
  const commands = [
    new SlashCommandBuilder()
      .setName('komutlar')
      .setDescription('Botun tüm komutlarını ve özelliklerini gösterir.'),
    new SlashCommandBuilder()
      .setName('reklam')
      .setDescription('Everyone atarak bot sipariş duyurusunu gönderir. (Yönetici Özel)')
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('✨ Slash komutları başarıyla yüklendi!');
  } catch (error) {
    console.error(error);
  }

  // Yeni Ses kanalına bağlan
  if (VOICE_CHANNEL_ID) {
    const channel = await client.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
    if (channel && channel.isVoiceBased()) {
      const { joinVoiceChannel } = require('@discordjs/voice');
      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true
      });
      console.log("🔊 Yeni ses kanalına giriş yapıldı!");
    }
  }
});

// ======================
// MESAJ VE SLASH KOMUTLARI YÖNETİMİ
// ======================
client.on('messageCreate', async (message) => {
  if (message.content === '!ticketpanel' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    
    const embed = new EmbedBuilder()
      .setColor('#00b4d8')
      .setTitle('FEST GUN | Destek Sistemi')
      .setDescription('Destek talebi oluşturmak için aşağıdaki menüden **konu seçimi** yapın.')
      .setImage('https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1200&auto=format&fit=crop')
      .setFooter({ text: 'FEST GUN Ticket Sistemi' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select_menu')
      .setPlaceholder('Destek Kategorisi Seçin...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('AntiCheat')
          .setDescription('AntiCheat ve güvenlik konuları için açın.')
          .setValue('ticket_anticheat')
          .setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Teknik Destek')
          .setDescription('Teknik sorunlar ve buglar için açın.')
          .setValue('ticket_teknik')
          .setEmoji('💻'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Oyun İçi Destek')
          .setDescription('Oyun içi yaşanan durumlar için açın.')
          .setValue('ticket_oyunici')
          .setEmoji('🎮')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }
});

// ======================
// ETKİLEŞİM VE SLASH KOMUT İŞLEMCİSİ
// ======================
client.on('interactionCreate', async (interaction) => {
  // Slash Komutları
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'komutlar') {
      const embed = new EmbedBuilder()
        .setColor('#00b4d8')
        .setTitle('⚡ FEST GUN | Bot Komutları')
        .setDescription('Sunucumuzda kullanılan aktif komutlar aşağıdadır:')
        .addFields(
          { name: '`/komutlar`', value: 'Botun komut listesini gösterir.', inline: false },
          { name: '`/reklam`', value: '@everyone atarak bot sipariş duyurusunu gönderir. (Yönetici Özel)', inline: false },
          { name: '`!ticketpanel`', value: 'Destek panelini kurar. (Yönetici Özel)', inline: false }
        )
        .setFooter({ text: 'FEST GUN' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === 'reklam') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'Bu komutu kullanmak için Yönetici yetkin olmalı!', ephemeral: true });
      }

      await interaction.reply({ content: 'Reklam mesajı gönderiliyor...', ephemeral: true });
      
      const reklamMetni = `@everyone HERTÜRLÜ BOT YAPILIR ALMAK İÇİN https://discord.com/channels/1529478234352128030/1543014485881528372`;
      await interaction.channel.send({ content: reklamMetni });
    }
  }

  // Seçim Menüsü (Ticket Oluşturma)
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
    const guild = interaction.guild;
    const member = interaction.member;
    const selectedValue = interaction.values[0];
    const categoryInfo = TICKET_CATEGORIES[selectedValue];

    if (!categoryInfo) return;

    const channelName = `${categoryInfo.name.split(' ')[0].toLowerCase()}-${member.user.username.toLowerCase()}`;
    const existing = guild.channels.cache.find(c => c.name === channelName);
    if (existing) {
      return interaction.reply({ content: `Zaten bu kategoride açık bir ticketin var: ${existing}`, ephemeral: true });
    }

    let discordCategory = guild.channels.cache.find(c => c.name === categoryInfo.categoryName && c.type === ChannelType.GuildCategory);
    if (!discordCategory) {
      discordCategory = await guild.channels.create({
        name: categoryInfo.categoryName,
        type: ChannelType.GuildCategory
      });
    }

    let permissionOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
    ];

    if (SUPPORT_ROLE_ID) {
      permissionOverwrites.push({
        id: SUPPORT_ROLE_ID,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      });
    }

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: discordCategory.id,
      permissionOverwrites: permissionOverwrites
    });

    const embed = new EmbedBuilder()
      .setColor('#00b4d8')
      .setTitle(`${categoryInfo.name} - Ticket`)
      .setDescription(`Merhaba ${member},\n\nSeçtiğin Kategori: **${categoryInfo.name}**\nYetkililer en kısa sürede sizinle ilgilenecektir.\nTicketı kapatmak için aşağıdaki butonu kullanabilirsiniz.`)
      .setFooter({ text: 'FEST GUN' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Ticketı Kapat')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔒')
    );

    await channel.send({ content: `${member} ${SUPPORT_ROLE_ID ? `<@&${SUPPORT_ROLE_ID}>` : ''}`, embeds: [embed], components: [row] });
    await interaction.reply({ content: `Ticket kanalın oluşturuldu: ${channel}`, ephemeral: true });
  }

  // Buton (Ticket Kapatma)
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    await interaction.reply({ content: 'Ticket 3 saniye içinde kapatılacak...', ephemeral: true });
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 3000);
  }
});

// Botu başlat
client.login(process.env.TOKEN);