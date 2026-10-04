require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');

// Karşılama kartı için (npm i @napi-rs/canvas). Yüklü değilse kart olmadan devam eder.
let createCanvas, loadImage;
try { ({ createCanvas, loadImage } = require('@napi-rs/canvas')); }
catch { console.warn('⚠️ @napi-rs/canvas yüklü değil, karşılama kartı görseli oluşturulmayacak.'); }

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
const VOICE_CHANNEL_ID = "1542872487715405976"; // 7/24 Duracağı Ses Kanalı ID
const LOG_CHANNEL_ID = "1543727426276692050";   // Ticket Log Kanalı ID
const GUVENLI_HESAP_GUN = 7; // Hesap bu günden eskiyse "Güvenli" yazar

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
// SUNUCUYA GİRENE DM KARŞILAMA (Wildgun tarzı, Fest Gun versiyonu)
// ======================
const trKisa = (t) => new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' });
const trUzun = (t) => new Date(t).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric' });

async function karsilamaKarti(member) {
  if (!createCanvas) return null;
  try {
    const W = 1024, H = 360;
    const c = createCanvas(W, H);
    const g = c.getContext('2d');

    // Arka plan (Fest Gun mavisi)
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a1738');
    bg.addColorStop(0.55, '#1d4ed8');
    bg.addColorStop(1, '#3a86ff');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, W, H);

    // Avatar
    const cx = 190, cy = 165, r = 105;
    try {
      const av = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
      g.save();
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); g.clip();
      g.drawImage(av, cx - r, cy - r, r * 2, r * 2);
      g.restore();
    } catch {}
    g.lineWidth = 8; g.strokeStyle = '#ffffff';
    g.beginPath(); g.arc(cx, cy, r + 4, 0, Math.PI * 2); g.stroke();

    // İsim (sığmazsa kısalt)
    let isim = member.displayName || member.user.username;
    g.fillStyle = '#ffffff';
    g.font = 'bold 66px sans-serif';
    while (g.measureText(isim).width > 640 && isim.length > 3) isim = isim.slice(0, -1);
    g.fillText(isim, 340, 150);

    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = '40px sans-serif';
    g.fillText(`@${member.user.username}`, 340, 205);

    // Alt şerit
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(340, 262, 640, 56);
    g.fillStyle = '#ffffff';
    g.font = 'bold 28px sans-serif';
    g.fillText('Fest Gun\'a Hoşgeldin!', 358, 301);
    g.font = '26px sans-serif';
    const tarih = trUzun(Date.now());
    g.fillText(tarih, 980 - g.measureText(tarih).width - 18, 301);

    return c.toBuffer('image/png');
  } catch (e) {
    console.error('Karşılama kartı oluşturulamadı:', e.message);
    return null;
  }
}

client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;
  try {
    const guild = member.guild;
    const hesapYasi = Date.now() - member.user.createdTimestamp;
    const guvenli = hesapYasi >= GUVENLI_HESAP_GUN * 86400000;

    const embed = new EmbedBuilder()
      .setColor('#3a86ff')
      .setTitle(`${trKisa(Date.now())} #FESTGUN - Giriş`)
      .setDescription(`<@${member.id}>\n\`ID: ${member.id}\``)
      .setFooter({ text: 'FEST GUN' })
      .setTimestamp();
    if (guild.iconURL()) embed.setThumbnail(guild.iconURL());

    const files = [];
    const kart = await karsilamaKarti(member);
    if (kart) {
      files.push(new AttachmentBuilder(kart, { name: 'karsilama.png' }));
      embed.setImage('attachment://karsilama.png');
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hg_kullanici').setLabel(`@${member.user.username}`.slice(0, 80)).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('hg_tarih').setLabel(trUzun(member.user.createdTimestamp)).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('hg_guven').setLabel(guvenli ? 'Güvenli' : 'Şüpheli').setEmoji(guvenli ? '✅' : '⚠️').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('hg_sira').setLabel(`Seninle ${guild.memberCount}!`).setStyle(ButtonStyle.Secondary).setDisabled(true)
    );

    await member.send({ embeds: [embed], components: [row], files });
  } catch (e) {
    // DM'leri kapalıysa mesaj gönderilemez, sessizce geç
    console.log(`Karşılama DM'i gönderilemedi (${member.user.tag}): ${e.message}`);
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
      .setImage('https://media.discordapp.net/attachments/1542872935809814688/1543803508547915786/ChatGPT_Image_31_Agu_2026_05_01_30.png?ex=6ac10b4e&is=6abfb9ce&hm=02fe519e74feb16ca8d9c8be9e763c647c3e9540e6e25d54e1ff315d8b4de867&=&format=webp&quality=lossless&width=1024&height=683')
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
client.login(process.env.DISCORD_TOKEN);
