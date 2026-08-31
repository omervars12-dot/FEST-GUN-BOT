require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');

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
const SUPPORT_ROLE_ID = "1542872257276149860"; // Yetkili Rol ID
const VOICE_CHANNEL_ID = "1542872463870922814"; // 7/24 Duracağı Ses Kanalı ID
const LOG_CHANNEL_ID = "1543727426276692050";   // Ticket Log Kanalı ID

// Ticket Kategorileri
const TICKET_CATEGORIES = {
  'ticket_anticheat': { name: 'ANTICHEAT | Güvenlik', categoryName: 'ANTICHEAT TICKETLARI' },
  'ticket_teknik': { name: 'TEKNIK | Destek', categoryName: 'TEKNİK DESTEK TICKETLARI' },
  'ticket_oyunici': { name: 'OYUN-ICI | Destek', categoryName: 'OYUN İÇİ TICKETLARI' },
  'ticket_satis': { name: 'SATIN-ALIM | Destek', categoryName: 'SATIN ALIM TICKETLARI' },
  'ticket_donate': { name: 'DONATE-BILGI | Destek', categoryName: 'DONATE BİLGİ TICKETLARI' },
  'ticket_streamer': { name: 'STREAMER | Destek', categoryName: 'STREAMER BİLGİ TICKETLARI' }
};

// ======================
// BOT HAZIR
// ======================
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} olarak giriş yapıldı!`);

  // Ses kanalına bağlan
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
      console.log("🔊 Ses kanalına giriş yapıldı!");
    }
  }
});

// ======================
// MESAJ VE KOMUT YÖNETİMİ (! İle Başlayanlar)
// ======================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Ticket Panel Kurma Komutu
  if (message.content === '!ticketpanel' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    
    const embed = new EmbedBuilder()
      .setColor('#3a86ff')
      .setTitle('FEST GUN | Destek Sistemi')
      .setDescription('Destek talebi oluşturmak için aşağıdaki menüden **konu seçimi** yapın.')
      .setImage('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop')
      .setFooter({ text: 'FEST GUN Ticket Sistemi' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select_menu')
      .setPlaceholder('Destek Kategorisi Seçin...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('AntiCheat')
          .setDescription('Güvenlik ve hile bildirimleri.')
          .setValue('ticket_anticheat')
          .setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Teknik Destek')
          .setDescription('Teknik sorunlar ve hatalar.')
          .setValue('ticket_teknik')
          .setEmoji('💻'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Oyun İçi Destek')
          .setDescription('Oyun içi yaşanan durumlar.')
          .setValue('ticket_oyunici')
          .setEmoji('🎮'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Satın Alım')
          .setDescription('Satın alım ve ödeme işlemleri.')
          .setValue('ticket_satis')
          .setEmoji('💳'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Donate Bilgi')
          .setDescription('Bağış ve destek bilgileri.')
          .setValue('ticket_donate')
          .setEmoji('💖'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Streamer Bilgi')
          .setDescription('Yayıncı ve içerik üretici bilgileri.')
          .setValue('ticket_streamer')
          .setEmoji('📺')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }

  // !komutlar Komutu
  if (message.content === '!komutlar') {
    const embed = new EmbedBuilder()
      .setColor('#3a86ff')
      .setTitle('⚡ FEST GUN | Bot Komutları')
      .setDescription('Sunucumuzda kullanılan aktif komutlar aşağıdadır:')
      .addFields(
        { name: '`!komutlar`', value: 'Botun komut listesini gösterir.', inline: false },
        { name: '`!reklam`', value: '@everyone atarak bot sipariş duyurusunu gönderir. (Yönetici Özel)', inline: false },
        { name: '`!ticketpanel`', value: 'Destek panelini kurar. (Yönetici Özel)', inline: false }
      )
      .setFooter({ text: 'FEST GUN' });

    await message.reply({ embeds: [embed] });
  }

  // !reklam Komutu
  if (message.content === '!reklam') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ content: 'Bu komutu kullanmak için Yönetici yetkin olmalı!' });
    }

    await message.delete().catch(() => {});
    const reklamMetni = `@everyone HERTÜRLÜ BOT YAPILIR ALMAK İÇİN https://discord.com/channels/1529478234352128030/1543014485881528372`;
    await message.channel.send({ content: reklamMetni });
  }
});

// ======================
// ETKİLEŞİM İŞLEMCİSİ (Menüler ve Butonlar)
// ======================
client.on('interactionCreate', async (interaction) => {
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
      .setColor('#3a86ff')
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

    // Log Kanalına Açılış Bildirimi Gönderme
    if (LOG_CHANNEL_ID) {
      const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#ffaa00')
          .setTitle('📂 Yeni Ticket Açıldı')
          .addFields(
            { name: 'Açan Üye', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
            { name: 'Kategori', value: categoryInfo.name, inline: true },
            { name: 'Kanal', value: `${channel.name}`, inline: false }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }
  }

  // Buton (Ticket Kapatma - Sadece Yetkililer Kapatabilir)
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    const isSupport = SUPPORT_ROLE_ID && interaction.member.roles.cache.has(SUPPORT_ROLE_ID);
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isSupport && !isAdmin) {
      return interaction.reply({ content: '❌ Bu ticketı sadece yetkililer kapatabilir!', ephemeral: true });
    }

    await interaction.reply({ content: 'Ticket kapatılıyor ve mesaj geçmişi loglanıyor...', ephemeral: true });

    // Kanalın mesaj geçmişini çek
    try {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const sortedMessages = Array.from(messages.values()).reverse();
      
      let transcript = `--- ${interaction.channel.name} TICKET GEÇMİŞİ ---\n\n`;
      sortedMessages.forEach(m => {
        transcript += `[${new Date(m.createdTimestamp).toLocaleString()}y] ${m.author.tag}: ${m.content}\n`;
      });

      // Metni dosya olarak hazırla
      const buffer = Buffer.from(transcript, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `${interaction.channel.name}-gecmis.txt` });

      // Log kanalına gönder
      if (LOG_CHANNEL_ID) {
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          const closeEmbed = new EmbedBuilder()
            .setColor('#ff3333')
            .setTitle('🔒 Ticket Kapatıldı')
            .addFields(
              { name: 'Kapatan Yetkili', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
              { name: 'Kanal Adı', value: interaction.channel.name, inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [closeEmbed], files: [attachment] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("Log dökümü alınamadı:", err);
    }

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 3000);
  }
});

// Botu başlat
client.login(process.env.TOKEN);
