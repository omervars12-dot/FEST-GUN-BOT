require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, UserSelectMenuBuilder, ChannelType, PermissionFlagsBits, OverwriteType, AttachmentBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
const LOG_CHANNEL_ID = "1557480455228498055";   // Ticket Log Kanalı ID
const GUVENLI_HESAP_GUN = 7; // Hesap bu günden eskiyse "Güvenli" yazar

// Ticket rolleri
const ANTICHEAT_ROLE_ID = "1557449903872155770"; // AntiCheat ticketlarında etiketlenir
const GENEL_ROLE_ID = "1557449922347929771";     // Diğer tüm ticketlarda etiketlenir

// Bu roller TÜM ticket kanallarını görür, yazabilir ve ticketı kapatabilir
const YETKILI_ROLLER = [...new Set([SUPPORT_ROLE_ID, ANTICHEAT_ROLE_ID, GENEL_ROLE_ID].filter(Boolean))];

// Ticket paneli arka plan görseli
const TICKET_GORSEL = "https://media.discordapp.net/attachments/1529424223037161533/1556448842910670949/image.png?backend=b2&ex=6ac77f31&is=6ac62db1&hm=3b3deb0cd51c0ce018b51c484f00418dafd4802e1aff446fc5049c7b9ae7bc31&=&format=webp&quality=lossless&width=1536&height=864";

// Panel görseli: önce klasördeki ticket.png / ticket.jpg / ticket.webp kullanılır (link süresi dolmaz).
// Dosya yoksa link sunucudan indirilip mesaja dosya olarak eklenir, o da olmazsa direkt link denenir.
async function ticketGorselDosyasi() {
  for (const ad of ['ticket.png', 'ticket.jpg', 'ticket.jpeg', 'ticket.webp']) {
    const yol = path.join(__dirname, ad);
    try { if (fs.existsSync(yol)) return new AttachmentBuilder(yol, { name: ad }); } catch {}
  }
  try {
    const r = await fetch(TICKET_GORSEL);
    if (r.ok) {
      const tip = r.headers.get('content-type') || '';
      const ad = tip.includes('webp') ? 'ticket.webp' : tip.includes('jpeg') ? 'ticket.jpg' : 'ticket.png';
      return new AttachmentBuilder(Buffer.from(await r.arrayBuffer()), { name: ad });
    }
    console.warn(`⚠️ Panel görseli indirilemedi (HTTP ${r.status}). Linkin süresi dolmuş olabilir, görseli ticket.png olarak bota ekle.`);
  } catch (e) {
    console.warn('⚠️ Panel görseli indirilemedi:', e.message);
  }
  return null;
}

// Ticket Kategorileri (roleId = o kategoride etiketlenecek rol)
const TICKET_CATEGORIES = {
  'ticket_anticheat': { name: 'ANTICHEAT | Güvenlik', categoryName: 'ANTICHEAT TICKETLARI', roleId: ANTICHEAT_ROLE_ID },
  'ticket_teknik': { name: 'TEKNIK | Destek', categoryName: 'TEKNİK DESTEK TICKETLARI', roleId: GENEL_ROLE_ID },
  'ticket_oyunici': { name: 'OYUN-ICI | Destek', categoryName: 'OYUN İÇİ TICKETLARI', roleId: GENEL_ROLE_ID },
  'ticket_satis': { name: 'SATIN-ALIM | Destek', categoryName: 'SATIN ALIM TICKETLARI', roleId: GENEL_ROLE_ID },
  'ticket_donate': { name: 'DONATE-BILGI | Destek', categoryName: 'DONATE BİLGİ TICKETLARI', roleId: GENEL_ROLE_ID },
  'ticket_streamer': { name: 'STREAMER | Destek', categoryName: 'STREAMER BİLGİ TICKETLARI', roleId: GENEL_ROLE_ID }
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
// SUNUCUYA GİRENE DM KARŞILAMA
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
  if (!message.guild) return;

  // Ticket Panel Kurma Komutu
  if (message.content === '!ticketpanel' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {

    const embed = new EmbedBuilder()
      .setColor('#3a86ff')
      .setTitle('FEST GUN | Destek Sistemi')
      .setDescription('Destek talebi oluşturmak için aşağıdaki menüden **konu seçimi** yapın.')
      .setFooter({ text: 'FEST GUN Ticket Sistemi' });

    const gorsel = await ticketGorselDosyasi();
    embed.setImage(gorsel ? `attachment://${gorsel.name}` : TICKET_GORSEL);

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

    await message.channel.send({ embeds: [embed], components: [row], files: gorsel ? [gorsel] : [] });
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
        { name: '`!ticketpanel`', value: 'Destek panelini kurar. (Yönetici Özel)', inline: false },
        { name: '`!ekipbasvuru`', value: 'Ekip başvuru panelini kurar. (Yönetici Özel)', inline: false }
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
  try {
    // ---------- Seçim Menüsü (Ticket Oluşturma) ----------
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
      const guild = interaction.guild;
      const member = interaction.member;
      const selectedValue = interaction.values[0];
      const categoryInfo = TICKET_CATEGORIES[selectedValue];

      if (!categoryInfo) return;

      // Discord 3 saniyede yanıt bekler, kanal açmadan önce hemen yanıt ver
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Kişi başı TEK aktif ticket (kategori fark etmez). Sahibi kanal konusunda (topic) tutulur.
      const ownerTag = `ticket-owner:${member.id}`;
      const existing = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.topic === ownerTag);
      if (existing) {
        return interaction.editReply({ content: `❌ Zaten açık bir ticketin var: ${existing}\nYeni ticket açmak için önce mevcut ticketın kapatılmasını bekle.` });
      }

      const channelName = `${categoryInfo.name.split(' ')[0].toLowerCase()}-${member.user.username.toLowerCase()}`;

      let discordCategory = guild.channels.cache.find(c => c.name === categoryInfo.categoryName && c.type === ChannelType.GuildCategory);
      if (!discordCategory) {
        discordCategory = await guild.channels.create({
          name: categoryInfo.categoryName,
          type: ChannelType.GuildCategory
        });
      }

      const permissionOverwrites = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
      ];

      // Yetkili roller (her biri tüm ticketları görür). Sunucuda yoksa atla ("not a cached User or Role" hatasını önler)
      for (const rid of YETKILI_ROLLER) {
        const rol = await guild.roles.fetch(rid).catch(() => null);
        if (rol) {
          permissionOverwrites.push({
            id: rol.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          });
        } else {
          console.error(`❌ Rol (${rid}) bu sunucuda bulunamadı! ID'yi kontrol et.`);
        }
      }

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: discordCategory.id,
        topic: ownerTag,
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

      await channel.send({
        content: `${member} <@&${categoryInfo.roleId}>`,
        embeds: [embed],
        components: [row],
        allowedMentions: { users: [member.id], roles: [categoryInfo.roleId] }
      });
      await interaction.editReply({ content: `Ticket kanalın oluşturuldu: ${channel}` });

      // Log Kanalına Açılış Bildirimi
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

    // ---------- Buton (Ticket Kapatma - Sadece Yetkililer) ----------
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      const yetkiliMi = YETKILI_ROLLER.some(id => interaction.member.roles.cache.has(id));
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!yetkiliMi && !isAdmin) {
        return interaction.reply({ content: '❌ Bu ticketı sadece yetkililer kapatabilir!', flags: MessageFlags.Ephemeral });
      }

      // Kimin kapattığı kanalda herkese görünür
      await interaction.reply({
        content: `🔒 Bu ticket ${interaction.user} (**${interaction.user.tag}**) tarafından kapatıldı. Kanal 3 saniye içinde silinecek...`,
        allowedMentions: { parse: [] }
      });

      // Kanalın mesaj geçmişini çek
      try {
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const sortedMessages = Array.from(messages.values()).reverse();

        let transcript = `--- ${interaction.channel.name} TICKET GEÇMİŞİ ---\n\n`;
        sortedMessages.forEach(m => {
          transcript += `[${new Date(m.createdTimestamp).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}] ${m.author.tag}: ${m.content}\n`;
        });

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
  } catch (e) {
    console.error('Etkileşim hatası:', e);
    const mesaj = `❌ Bir hata oluştu: ${e.message || 'Bilinmeyen hata'}\n(Botun Kanalları Yönet yetkisi var mı kontrol et.)`;
    if (interaction.deferred || interaction.replied) interaction.editReply({ content: mesaj }).catch(() => {});
    else interaction.reply({ content: mesaj, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

// ============================================================
// EKİP BAŞVURU SİSTEMİ
// ============================================================
// ======================
// AYARLAR
// ======================
const TEAM_ROLE_ID = "1542872257276149860";     // Fest Gun Team rol ID (etiketlenecek + ticketları görecek + yönetecek)
const EKIP_LOG_CHANNEL_ID = "1557513082777895053";   // Ekip başvuru log kanalı
const LOG_ROL_ETIKET = true;                    // Log kanalında açılış bildiriminde de rol etiketlensin mi?
const PANEL_GORSEL = '';                        // İstersen panel altına büyük görsel linki koy (boş = yok)
const START_NUMBER = 0;                         // İlk ticket #1 olur. (örn. 150 yaparsan ilk ticket #151)
const RENK = '#3a86ff';
const EKIP_YETKILI_ROLLER = [TEAM_ROLE_ID].filter(Boolean);

const TYPES = {
  legal:   { label: 'Legal Ekip',   prefix: 'legal',   categoryName: 'LEGAL EKİP BAŞVURULARI' },
  illegal: { label: 'Illegal Ekip', prefix: 'illegal', categoryName: 'ILLEGAL EKİP BAŞVURULARI' }
};
// Eski kayıtlar bozulmasın diye eski anahtarlar yeni türlere bağlı
TYPES.ekip = TYPES.legal;
TYPES.yetkili = TYPES.illegal;

const STATUS = {
  bekliyor:    { emoji: 'ℹ️', text: 'Yetkili bekleniyor.', color: '#3a86ff' },
  beklemede:   { emoji: '🕒', text: 'Beklemede.',          color: '#f1c40f' },
  inceleniyor: { emoji: '🔎', text: 'İnceleniyor.',        color: '#e67e22' },
  cozuldu:     { emoji: '✅', text: 'Çözüldü.',            color: '#2ecc71' }
};

const STATUS_BUTTONS = {
  eb_st_beklemede: 'beklemede',
  eb_st_inceleniyor: 'inceleniyor',
  eb_st_cozuldu: 'cozuldu'
};

// ======================
// KALICI VERİ (bot kapanıp açılsa da ticket numarası ve kayıtlar kaybolmaz)
// ======================
const DATA_FILE = path.join(__dirname, 'ekip_data.json');
let data = { counter: START_NUMBER, tickets: {}, responseTimes: [] };

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    data = {
      counter: Number.isFinite(Number(raw.counter)) ? Number(raw.counter) : START_NUMBER,
      tickets: raw.tickets && typeof raw.tickets === 'object' ? raw.tickets : {},
      responseTimes: Array.isArray(raw.responseTimes) ? raw.responseTimes : []
    };
  } catch (e) {
    console.error('❌ ekip_data.json okunamadı, yedeği alınıyor:', e.message);
    try { fs.copyFileSync(DATA_FILE, DATA_FILE + '.bozuk'); } catch {}
  }
}

function saveData() {
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.error('❌ ekip_data.json kaydedilemedi:', e.message);
  }
}

// ======================
// YARDIMCILAR
// ======================
const trTarih = (ms) => new Date(ms).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });

function fmtSure(ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s} saniye`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dakika`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} saat ${m % 60} dakika` : `${h} saat`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} gün ${h % 24} saat` : `${d} gün`;
}

function yanitSuresiMetni() {
  const arr = data.responseTimes;
  if (!arr.length) return 'Henüz veri yok';
  const min = Math.min(...arr), max = Math.max(...arr);
  return fmtSure(min) === fmtSure(max) ? fmtSure(min) : `${fmtSure(min)} - ${fmtSure(max)}`;
}

function isStaff(member) {
  if (!member || !member.roles || !member.permissions) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return EKIP_YETKILI_ROLLER.some(id => member.roles.cache.has(id));
}

function ilkYanitKaydet(t) {
  if (t.firstResponseAt) return;
  t.firstResponseAt = Date.now();
  data.responseTimes.push(Math.max(0, t.firstResponseAt - t.createdAt));
  if (data.responseTimes.length > 50) data.responseTimes.shift();
  saveData();
}

// Ekip paneli / ticket kartı için büyük arka plan görseli.
// Önce klasördeki ekip.png / ekip.jpg / ekip.webp aranır, yoksa ticket görseli (ticket.png veya TICKET_GORSEL linki) kullanılır.
let gorselOnbellek = null;
async function ekipGorselDosyasi() {
  if (!gorselOnbellek) {
    for (const ad of ['ekip.png', 'ekip.jpg', 'ekip.jpeg', 'ekip.webp']) {
      const yol = path.join(__dirname, ad);
      try { if (fs.existsSync(yol)) { gorselOnbellek = { name: ad, buf: fs.readFileSync(yol) }; break; } } catch {}
    }
  }
  if (!gorselOnbellek) {
    try {
      const g = await ticketGorselDosyasi();
      if (g) gorselOnbellek = { name: g.name, buf: g.attachment };
    } catch {}
  }
  return gorselOnbellek ? new AttachmentBuilder(gorselOnbellek.buf, { name: gorselOnbellek.name }) : null;
}

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

// ======================
// MESAJ / EMBED OLUŞTURUCULAR
// ======================
function ticketPayload(t, owner) {
  const type = TYPES[t.type] || TYPES.legal;
  const st = STATUS[t.status] || STATUS.bekliyor;
  const ts = Math.floor(t.createdAt / 1000);

  const embed = new EmbedBuilder()
    .setColor(st.color)
    .setTitle(`🛡️ Destek Talebi #${t.number}`)
    .setDescription(
      `> <@${t.ownerId}> tarafından ticket talebi <t:${ts}:F> tarihinde oluşturuldu. <@&${TEAM_ROLE_ID}> rolüne sahip yetkililer sizinle ilgilenecek.\n\n` +
      `• Destek ID: **#${t.number}**\n` +
      `• Destek Kategorisi: **${type.label}**\n\n` +
      `• Ortalama Yanıt Süresi: **${yanitSuresiMetni()}**\n` +
      `• Destek Durumu: ${st.emoji} **${st.text}**` + (t.claimedBy ? ` (Üstlenen: <@${t.claimedBy}>)` : '')
    )
    .setFooter({ text: 'FEST GUN' });
  if (owner) embed.setThumbnail(owner.displayAvatarURL({ extension: 'png', size: 256 }));
  if (t.gorsel) embed.setImage(`attachment://${t.gorsel}`);

  const aktif = (key) => (t.status === key ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_claim').setLabel(t.claimedBy ? 'Claim Bırak' : 'Ticket Claim').setEmoji('🙋').setStyle(t.claimedBy ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_st_beklemede').setLabel('Beklemede').setEmoji('🕒').setStyle(aktif('beklemede')),
    new ButtonBuilder().setCustomId('eb_st_inceleniyor').setLabel('İnceleniyor').setEmoji('🔎').setStyle(aktif('inceleniyor')),
    new ButtonBuilder().setCustomId('eb_st_cozuldu').setLabel('Çözüldü').setEmoji('✅').setStyle(aktif('cozuldu')),
    new ButtonBuilder().setCustomId('eb_refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_close').setLabel('Talebi Kapat').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('eb_notify').setLabel('Bildirim Al').setEmoji('🔔').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_members').setLabel('Üyeleri Yönet').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_transcript').setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_video').setLabel('Video Kanıt Yükle').setEmoji('🎥').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

function panelPayload(guild, gorsel) {
  const embed = new EmbedBuilder()
    .setColor(RENK)
    .setTitle('🛡️ Festgun Ekip Başvurusu')
    .setDescription('Festgun bünyesinde ekip kurmak veya mevcut ekibinizle sunucumuza katılmak için aşağıdaki kuralları ve bilgilendirmeleri inceleyiniz.')
    .addFields(
      {
        name: '📋 Ekip Başvuru Bilgileri',
        value: [
          '• Ekip başvurularında doğru ve eksiksiz bilgi verilmesi zorunludur.',
          '• Ekip açmak isteyen ekip liderlerine öncelik tanınacaktır.',
          '• Ekip liderlerinin başvuruları değerlendirilirken aktiflik, ekip sayısı ve geçmiş tecrübe dikkate alınacaktır.',
          '• Yeterli ve düzenli bir ekip kadrosuna sahip olan ekip liderleri mülakat sürecine tabi tutulmadan değerlendirmeye alınabilir.',
          '• Festgun yönetimi gerekli gördüğü durumlarda ekip liderleriyle ayrıca görüşme yapabilir.',
          '• Birden fazla ekip başvurusu yapılması yasaktır.'
        ].join('\n')
      },
      {
        name: '⭐ Ekip Liderlerine Özel',
        value: [
          "• Ekip kurarak Festgun'a katılan ekipler için özel destek ve ayrıcalıklar sağlanacaktır.",
          '• Aktif ve düzenli ekipler, sunucu içerisindeki etkinliklerde ve organizasyonlarda öncelikli olarak değerlendirilecektir.',
          '• Ekip büyüklüğüne ve aktifliğine göre çeşitli ekip ödülleri ve destekleri sunulabilir.'
        ].join('\n')
      },
      {
        name: '⚠️ Önemli',
        value: [
          '• Ekip kuralları ve sunucu kurallarına uymak zorunludur.',
          '• Başvuru gönderen herkes, ekip kurallarını kabul etmiş sayılır.',
          '• Yönetim, başvuruları değerlendirme ve gerekli gördüğü durumlarda başvuruyu reddetme hakkına sahiptir.'
        ].join('\n')
      },
      { name: '\u200b', value: "**Festgun'da ekibini kur, ekibinle birlikte yerini al!** 🚀" }
    )
    .setFooter({ text: 'FEST GUN' });

  if (guild && guild.iconURL()) embed.setThumbnail(guild.iconURL());
  if (gorsel) embed.setImage(`attachment://${gorsel.name}`);
  else if (PANEL_GORSEL) embed.setImage(PANEL_GORSEL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_open_legal').setLabel('Legal Ekip Başvurusu').setEmoji('🛡️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('eb_open_illegal').setLabel('Illegal Ekip Başvurusu').setEmoji('🛡️').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row], files: gorsel ? [gorsel] : [] };
}

// ======================
// TRANSCRIPT
// ======================
async function tumMesajlar(channel, max = 1000) {
  const all = [];
  let before;
  while (all.length < max) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return all.reverse(); // eskiden yeniye
}

async function transcriptOlustur(channel, t) {
  const msgs = await tumMesajlar(channel);
  const type = TYPES[t.type] || TYPES.legal;
  let txt = `--- ${channel.name} | Destek Talebi #${t.number} GEÇMİŞİ ---\n`;
  txt += `Kategori: ${type.label}\nAçan (ID): ${t.ownerId}\nAçılış: ${trTarih(t.createdAt)}\n`;
  txt += `Üstlenen (ID): ${t.claimedBy || '-'}\nMesaj sayısı: ${msgs.length}\n\n`;
  for (const m of msgs) {
    let satir = `[${trTarih(m.createdTimestamp)}] ${m.author.tag} (${m.author.id}): ${m.content || ''}`;
    if (m.attachments.size) satir += ' ' + m.attachments.map(a => `📎 ${a.url}`).join(' ');
    if (m.embeds.length && !m.content) satir += ` [Embed${m.embeds[0].title ? ': ' + m.embeds[0].title : ''}]`;
    txt += satir + '\n';
  }
  return new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `${channel.name}-gecmis.txt` });
}

// ======================
// ANA KURULUM
// ======================
function ekipBasvuruKur(client) {
  loadData();

  const creating = new Set(); // aynı kişi çift tıklarsa iki kanal açılmasın
  const closing = new Set();  // çift kapatma engeli

  async function logGonder(guild, payload) {
    try {
      const ch = guild.channels.cache.get(EKIP_LOG_CHANNEL_ID) || await guild.channels.fetch(EKIP_LOG_CHANNEL_ID).catch(() => null);
      if (!ch || !ch.isTextBased()) return console.warn(`⚠️ Ekip log kanalı bulunamadı (${EKIP_LOG_CHANNEL_ID}).`);
      await ch.send(payload);
    } catch (e) {
      console.error('Ekip log gönderilemedi:', e.message);
    }
  }

  async function bildirimGonder(t, actorId, text) {
    for (const uid of t.notify || []) {
      if (uid === actorId) continue;
      try {
        const u = await client.users.fetch(uid);
        await u.send({
          embeds: [new EmbedBuilder()
            .setColor(RENK)
            .setTitle(`🔔 Destek Talebi #${t.number}`)
            .setDescription(`${text}\n\n[Talebe git](https://discord.com/channels/${t.guildId}/${t.channelId})`)
            .setFooter({ text: 'FEST GUN' })]
        });
      } catch {}
    }
  }

  async function ticketGuncelle(interaction, t) {
    const owner = await client.users.fetch(t.ownerId).catch(() => null);
    await interaction.editReply(ticketPayload(t, owner));
  }

  // ---------- Açılışta: silinmiş kanalların kayıtlarını temizle ----------
  client.once('ready', async () => {
    try {
      let degisti = false;
      for (const [cid, t] of Object.entries(data.tickets)) {
        const g = client.guilds.cache.get(t.guildId);
        if (!g) continue;
        const ch = await g.channels.fetch(cid).catch(() => null);
        if (!ch) { delete data.tickets[cid]; degisti = true; }
      }
      if (degisti) saveData();
      console.log('🛡️ Ekip başvuru sistemi hazır.');
    } catch (e) {
      console.error('Ekip kayıt temizliği hatası:', e.message);
    }
  });

  client.on('channelDelete', (ch) => {
    if (data.tickets[ch.id]) { delete data.tickets[ch.id]; saveData(); }
  });

  // ---------- Komut + ilk yetkili yanıtı ölçümü ----------
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot || !message.guild) return;

      if (message.content.trim() === '!ekipbasvuru') {
        if (!message.member || !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return message.reply({ content: 'Bu komutu kullanmak için Yönetici yetkin olmalı!' }).catch(() => {});
        }
        const gorsel = await ekipGorselDosyasi();
        await message.channel.send(panelPayload(message.guild, gorsel));
        await message.delete().catch(() => {});
        return;
      }

      const t = data.tickets[message.channelId];
      if (t && !t.firstResponseAt && message.author.id !== t.ownerId && isStaff(message.member)) {
        ilkYanitKaydet(t);
      }
    } catch (e) {
      console.error('Ekip messageCreate hatası:', e);
    }
  });

  // ---------- Ticket açma ----------
  async function ticketAc(interaction, typeKey) {
    const guild = interaction.guild;
    const member = interaction.member;
    const type = TYPES[typeKey];
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (creating.has(member.id)) {
      return interaction.editReply({ content: '⏳ Talebin zaten oluşturuluyor, lütfen bekle.' });
    }
    creating.add(member.id);

    let number = null;
    let channel = null;
    try {
      // Kişi başı tek aktif başvuru (iki tür birlikte sayılır)
      const mevcut = Object.entries(data.tickets).find(([, t]) => t.ownerId === member.id && t.guildId === guild.id);
      if (mevcut) {
        const [cid] = mevcut;
        const ch = guild.channels.cache.get(cid) || await guild.channels.fetch(cid).catch(() => null);
        if (ch) {
          return interaction.editReply({ content: `❌ Zaten açık bir başvuru talebin var: ${ch}\nYeni başvuru açmak için mevcut talebin kapatılmasını bekle.` });
        }
        delete data.tickets[cid];
        saveData();
      }

      number = ++data.counter;
      saveData();

      let kategori = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === type.categoryName);
      if (!kategori) {
        kategori = await guild.channels.create({ name: type.categoryName, type: ChannelType.GuildCategory });
      }

      const izinler = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: member.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
        },
        {
          id: client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageChannels]
        }
      ];
      for (const rid of EKIP_YETKILI_ROLLER) {
        const rol = await guild.roles.fetch(rid).catch(() => null);
        if (rol) {
          izinler.push({
            id: rol.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
          });
        } else {
          console.error(`❌ Rol (${rid}) bu sunucuda bulunamadı! TEAM_ROLE_ID'yi kontrol et.`);
        }
      }

      const guvenliIsim = member.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60) || member.id.slice(-6);
      const kanalAdi = `${type.prefix}・${guvenliIsim}`;

      const kanalAyar = {
        name: kanalAdi,
        type: ChannelType.GuildText,
        topic: `Destek Talebi #${number} | ${type.label} | Açan: ${member.user.tag} (${member.id})`,
        permissionOverwrites: izinler
      };
      try {
        channel = await guild.channels.create({ ...kanalAyar, parent: kategori.id });
      } catch (e) {
        // Kategori doluysa (50 kanal) kategorisiz aç
        if (/maximum number of channels in category/i.test(e.message || '')) {
          channel = await guild.channels.create(kanalAyar);
        } else {
          throw e;
        }
      }

      const gorsel = await ekipGorselDosyasi();

      const t = {
        number,
        guildId: guild.id,
        channelId: channel.id,
        ownerId: member.id,
        type: typeKey,
        status: 'bekliyor',
        claimedBy: null,
        createdAt: Date.now(),
        firstResponseAt: null,
        notify: [],
        gorsel: gorsel ? gorsel.name : null
      };
      data.tickets[channel.id] = t;
      saveData();

      try {
        await channel.send({
          content: `${member} <@&${TEAM_ROLE_ID}>`,
          ...ticketPayload(t, member.user),
          files: gorsel ? [gorsel] : [],
          allowedMentions: { users: [member.id], roles: [TEAM_ROLE_ID] }
        });
      } catch (e) {
        // Mesaj gönderilemediyse yarım kalan ticketı temizle
        delete data.tickets[channel.id];
        saveData();
        await channel.delete().catch(() => {});
        channel = null;
        throw e;
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('🟩 Talep Oluşturuldu!')
          .setDescription(`Ticket talebiniz **#${number}** bilet numarasıyla **${type.label}** kategorisinde oluşturuldu.\n\n• Destek Talebiniz: ${channel}`)],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('Talebe git').setStyle(ButtonStyle.Link).setURL(channel.url)
        )]
      });

      await logGonder(guild, {
        content: LOG_ROL_ETIKET ? `<@&${TEAM_ROLE_ID}>` : undefined,
        allowedMentions: { roles: LOG_ROL_ETIKET ? [TEAM_ROLE_ID] : [] },
        embeds: [new EmbedBuilder()
          .setColor('#ffaa00')
          .setTitle('📂 Yeni Ekip Başvurusu')
          .addFields(
            { name: 'Başvuran', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
            { name: 'Kategori', value: type.label, inline: true },
            { name: 'Talep No', value: `#${number}`, inline: true },
            { name: 'Kanal', value: `${channel}`, inline: false }
          )
          .setTimestamp()]
      });
    } catch (e) {
      // Numarayı geri al (kanal açılamadıysa)
      if (number !== null && !channel && data.counter === number) { data.counter--; saveData(); }
      throw e;
    } finally {
      creating.delete(member.id);
    }
  }

  // ---------- Ticket kapatma ----------
  async function ticketKapat(interaction, t) {
    const channel = interaction.channel;
    const guild = interaction.guild;
    if (closing.has(channel.id)) {
      return interaction.update({ content: '⏳ Bu ticket zaten kapatılıyor.', components: [] });
    }
    closing.add(channel.id);

    try {
      await interaction.update({ content: '🔒 Ticket kapatılıyor...', components: [] });

      await channel.send({
        content: `🔒 Bu ticket ${interaction.user} (**${interaction.user.tag}**) tarafından kapatıldı. Kanal 5 saniye içinde silinecek...`,
        allowedMentions: { parse: [] }
      }).catch(() => {});

      let dosya = null;
      try { dosya = await transcriptOlustur(channel, t); }
      catch (e) { console.error('Transcript alınamadı:', e); }

      const type = TYPES[t.type] || TYPES.legal;
      const st = STATUS[t.status] || STATUS.bekliyor;
      await logGonder(guild, {
        embeds: [new EmbedBuilder()
          .setColor('#ff3333')
          .setTitle('🔒 Ekip Başvurusu Kapatıldı')
          .addFields(
            { name: 'Talep No', value: `#${t.number}`, inline: true },
            { name: 'Kategori', value: type.label, inline: true },
            { name: 'Durum', value: `${st.emoji} ${st.text}`, inline: true },
            { name: 'Başvuran', value: `<@${t.ownerId}> (${t.ownerId})`, inline: true },
            { name: 'Kapatan Yetkili', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
            { name: 'Üstlenen', value: t.claimedBy ? `<@${t.claimedBy}>` : 'Yok', inline: true },
            { name: 'Açık Kalma Süresi', value: fmtSure(Date.now() - t.createdAt), inline: true },
            { name: 'Kanal Adı', value: channel.name, inline: true }
          )
          .setTimestamp()],
        files: dosya ? [dosya] : [],
        allowedMentions: { parse: [] }
      });

      await bildirimGonder(t, interaction.user.id, `Bu talep **${interaction.user.tag}** tarafından kapatıldı.`);

      delete data.tickets[channel.id];
      saveData();

      setTimeout(() => {
        channel.delete().catch(() => {});
        closing.delete(channel.id);
      }, 5000);
    } catch (e) {
      closing.delete(channel.id);
      throw e;
    }
  }

  // ---------- Etkileşimler ----------
  client.on('interactionCreate', async (interaction) => {
    const id = interaction.customId;
    if (!id || !id.startsWith('eb_')) return;

    try {
      if (!interaction.guild) return;

      // ---- Panel butonları ----
      if (interaction.isButton() && (id === 'eb_open_legal' || id === 'eb_open_illegal' || id === 'eb_open_ekip' || id === 'eb_open_yetkili')) {
        return await ticketAc(interaction, (id === 'eb_open_legal' || id === 'eb_open_ekip') ? 'legal' : 'illegal');
      }

      // Buradan sonrası ticket kanalı içindeki bileşenler
      const t = data.tickets[interaction.channelId];
      if (!t) {
        return interaction.reply(ephemeral('❌ Bu ticketın kaydı bulunamadı (zaten kapatılmış olabilir).'));
      }
      const staff = isStaff(interaction.member);
      const sahip = interaction.user.id === t.ownerId;

      // ---- Claim ----
      if (interaction.isButton() && id === 'eb_claim') {
        if (!staff) return interaction.reply(ephemeral('❌ Bu butonu sadece yetkililer kullanabilir!'));
        const admin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (t.claimedBy && t.claimedBy !== interaction.user.id && !admin) {
          return interaction.reply(ephemeral(`❌ Bu ticket zaten <@${t.claimedBy}> tarafından üstlenilmiş.`));
        }
        await interaction.deferUpdate();
        if (t.claimedBy) {
          t.claimedBy = null;
          if (t.status === 'inceleniyor') t.status = 'bekliyor';
          await bildirimGonder(t, interaction.user.id, `**${interaction.user.tag}** talebi bıraktı.`);
        } else {
          t.claimedBy = interaction.user.id;
          if (t.status === 'bekliyor') t.status = 'inceleniyor';
          ilkYanitKaydet(t);
          await bildirimGonder(t, interaction.user.id, `Talep **${interaction.user.tag}** tarafından üstlenildi.`);
        }
        saveData();
        return await ticketGuncelle(interaction, t);
      }

      // ---- Durum butonları ----
      if (interaction.isButton() && STATUS_BUTTONS[id]) {
        if (!staff) return interaction.reply(ephemeral('❌ Bu butonu sadece yetkililer kullanabilir!'));
        await interaction.deferUpdate();
        t.status = STATUS_BUTTONS[id];
        ilkYanitKaydet(t);
        saveData();
        await ticketGuncelle(interaction, t);
        await bildirimGonder(t, interaction.user.id, `Talep durumu **${STATUS[t.status].text}** olarak güncellendi (${interaction.user.tag}).`);
        return;
      }

      // ---- Yenile ----
      if (interaction.isButton() && id === 'eb_refresh') {
        await interaction.deferUpdate();
        return await ticketGuncelle(interaction, t);
      }

      // ---- Bildirim Al (aç/kapat) ----
      if (interaction.isButton() && id === 'eb_notify') {
        t.notify = Array.isArray(t.notify) ? t.notify : [];
        const i = t.notify.indexOf(interaction.user.id);
        if (i === -1) {
          t.notify.push(interaction.user.id);
          saveData();
          return interaction.reply(ephemeral('🔔 Bu talepteki gelişmeler (durum, üstlenme, kapanma) artık **DM** olarak sana gelecek. DM\'lerin açık olduğundan emin ol.'));
        }
        t.notify.splice(i, 1);
        saveData();
        return interaction.reply(ephemeral('🔕 Bu talep için bildirimler kapatıldı.'));
      }

      // ---- Video Kanıt ----
      if (interaction.isButton() && id === 'eb_video') {
        return interaction.reply(ephemeral(
          '🎥 **Video kanıt yükleme**\n' +
          '• Videoyu doğrudan bu kanala dosya olarak yükleyebilirsin.\n' +
          '• Dosya büyükse **YouTube / Medal / Streamable** gibi bir linki bu kanala yazman yeterli.\n' +
          '• Link açıkken (herkese açık / bağlantıya sahip olanlar) paylaş, yetkililer erişebilsin.'
        ));
      }

      // ---- Transcript ----
      if (interaction.isButton() && id === 'eb_transcript') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const dosya = await transcriptOlustur(interaction.channel, t);
        return await interaction.editReply({ content: '📄 Ticket mesaj geçmişi hazır:', files: [dosya] });
      }

      // ---- Üyeleri Yönet ----
      if (interaction.isButton() && id === 'eb_members') {
        if (!staff && !sahip) return interaction.reply(ephemeral('❌ Bu butonu sadece yetkililer ve ticket sahibi kullanabilir!'));

        const satirlar = [
          new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
              .setCustomId('eb_add_select')
              .setPlaceholder('Ticketa eklenecek üyeleri seç...')
              .setMinValues(1)
              .setMaxValues(10)
          )
        ];

        const ekli = interaction.channel.permissionOverwrites.cache
          .filter(o => o.type === OverwriteType.Member && o.id !== t.ownerId && o.id !== client.user.id)
          .map(o => o.id)
          .slice(0, 25);

        if (ekli.length) {
          const secenekler = [];
          for (const uid of ekli) {
            const m = await interaction.guild.members.fetch(uid).catch(() => null);
            secenekler.push({ label: (m ? m.displayName : uid).slice(0, 100), value: uid, description: m ? `@${m.user.username}`.slice(0, 100) : undefined });
          }
          satirlar.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('eb_remove_select')
              .setPlaceholder('Ticketdan çıkarılacak üyeleri seç...')
              .setMinValues(1)
              .setMaxValues(secenekler.length)
              .addOptions(secenekler)
          ));
        }

        return interaction.reply({
          content: '👥 **Üye Yönetimi**\nEklemek için üstteki menüyü, çıkarmak için alttaki menüyü kullan.',
          components: satirlar,
          flags: MessageFlags.Ephemeral
        });
      }

      // ---- Üye ekle ----
      if (interaction.isUserSelectMenu() && id === 'eb_add_select') {
        if (!staff && !sahip) return interaction.reply(ephemeral('❌ Yetkin yok!'));
        const eklenen = [], basarisiz = [];
        for (const uid of interaction.values) {
          if (uid === t.ownerId || uid === client.user.id) continue;
          try {
            await interaction.channel.permissionOverwrites.edit(uid, {
              ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true
            });
            eklenen.push(uid);
          } catch { basarisiz.push(uid); }
        }
        let cevap = eklenen.length ? `✅ Eklendi: ${eklenen.map(u => `<@${u}>`).join(', ')}` : 'ℹ️ Eklenecek yeni üye yok.';
        if (basarisiz.length) cevap += `\n❌ Eklenemedi: ${basarisiz.map(u => `<@${u}>`).join(', ')} (Botun **Rolleri Yönet** yetkisi olduğundan emin ol.)`;
        await interaction.update({ content: cevap, components: [], allowedMentions: { parse: [] } });
        if (eklenen.length) {
          await interaction.channel.send({
            content: `➕ ${eklenen.map(u => `<@${u}>`).join(', ')} ticketa **${interaction.user.tag}** tarafından eklendi.`,
            allowedMentions: { users: eklenen }
          }).catch(() => {});
        }
        return;
      }

      // ---- Üye çıkar ----
      if (interaction.isStringSelectMenu() && id === 'eb_remove_select') {
        if (!staff && !sahip) return interaction.reply(ephemeral('❌ Yetkin yok!'));
        const cikan = [], basarisiz = [];
        for (const uid of interaction.values) {
          if (uid === t.ownerId) continue;
          try { await interaction.channel.permissionOverwrites.delete(uid); cikan.push(uid); }
          catch { basarisiz.push(uid); }
        }
        let cevap = cikan.length ? `✅ Çıkarıldı: ${cikan.map(u => `<@${u}>`).join(', ')}` : 'ℹ️ Çıkarılacak üye yok.';
        if (basarisiz.length) cevap += `\n❌ Çıkarılamadı: ${basarisiz.map(u => `<@${u}>`).join(', ')}`;
        await interaction.update({ content: cevap, components: [], allowedMentions: { parse: [] } });
        if (cikan.length) {
          await interaction.channel.send({
            content: `➖ ${cikan.map(u => `<@${u}>`).join(', ')} ticketdan **${interaction.user.tag}** tarafından çıkarıldı.`,
            allowedMentions: { parse: [] }
          }).catch(() => {});
        }
        return;
      }

      // ---- Talebi kapat (onay iste) ----
      if (interaction.isButton() && id === 'eb_close') {
        if (!staff) return interaction.reply(ephemeral('❌ Bu ticketı sadece yetkililer kapatabilir!'));
        return interaction.reply({
          content: '🗑️ Bu talebi kapatmak istediğine emin misin? Kanal silinecek ve mesaj geçmişi log kanalına gönderilecek.',
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('eb_close_confirm').setLabel('Evet, kapat').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('eb_close_cancel').setLabel('Vazgeç').setStyle(ButtonStyle.Secondary)
          )],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.isButton() && id === 'eb_close_cancel') {
        return interaction.update({ content: '✅ Kapatma işlemi iptal edildi.', components: [] });
      }

      if (interaction.isButton() && id === 'eb_close_confirm') {
        if (!staff) return interaction.reply(ephemeral('❌ Bu ticketı sadece yetkililer kapatabilir!'));
        return await ticketKapat(interaction, t);
      }
    } catch (e) {
      console.error('Ekip başvuru hatası:', e);
      const mesaj = `❌ Bir hata oluştu: ${e.message || 'Bilinmeyen hata'}\n(Botun Kanalları Yönet ve Rolleri Yönet yetkisi var mı kontrol et.)`;
      try {
        // editReply KULLANMA: deferUpdate sonrası ana ticket mesajını bozar. followUp her durumda güvenli.
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: mesaj, flags: MessageFlags.Ephemeral });
        else await interaction.reply({ content: mesaj, flags: MessageFlags.Ephemeral });
      } catch {}
    }
  });
}

ekipBasvuruKur(client);

// Botu başlat
client.login(process.env.DISCORD_TOKEN);
