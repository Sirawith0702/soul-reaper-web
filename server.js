require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ============================================================
//  SUPABASE INITIALIZATION & CONNECTION CHECK
// ============================================================
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '').trim();

const isSupabaseConfigured =
  SUPABASE_URL.startsWith('http://') || SUPABASE_URL.startsWith('https://');

let supabase = null;
if (isSupabaseConfigured && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('✅ Supabase Client initialized:', SUPABASE_URL);
} else {
  console.log(
    '⚠️  [Supabase Notice] SUPABASE_URL in .env is still a placeholder. Running with in-memory fallback until real URL/Key are set.'
  );
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Soul Reaper Web — Phase 6 & 7 Production Server',
    phase: 7,
    supabaseConnected: !!supabase,
  });
});

// ============================================================
//  SWORD CATALOG, GACHA POOL & REDEEM CODES
// ============================================================
const SWORD_CATALOG = {
  steel_blade: {
    id: 'steel_blade',
    name: 'ดาบเหล็กกล้า (Steel Blade)',
    rarity: 'Common',
    rarityColor: '#cccccc',
    atkBonus: 0,
    bladeColor: '#dddddd',
    waveColor: '#0088ff',
    weight: 50,
  },
  aqua_blade: {
    id: 'aqua_blade',
    name: 'ดาบวารีพิสุทธิ์ (Aqua Blade)',
    rarity: 'Rare',
    rarityColor: '#33ccff',
    atkBonus: 0.15,
    bladeColor: '#33ddff',
    waveColor: '#00eeff',
    weight: 20,
  },
  gale_blade: {
    id: 'gale_blade',
    name: 'ดาบวายุสลาตัน (Gale Blade)',
    rarity: 'Rare',
    rarityColor: '#33ccff',
    atkBonus: 0.15,
    bladeColor: '#55ff99',
    waveColor: '#22ff88',
    weight: 15,
  },
  hellfire_blade: {
    id: 'hellfire_blade',
    name: 'ดาบเพลิงโลกันตร์ (Hellfire)',
    rarity: 'Epic',
    rarityColor: '#bb55ff',
    atkBonus: 0.30,
    bladeColor: '#ff5522',
    waveColor: '#ff4400',
    weight: 6,
  },
  thunder_blade: {
    id: 'thunder_blade',
    name: 'ดาบสายฟ้าอัสนี (Thunderbolt)',
    rarity: 'Epic',
    rarityColor: '#bb55ff',
    atkBonus: 0.30,
    bladeColor: '#ffdd22',
    waveColor: '#ffcc00',
    weight: 6,
  },
  eclipse_blade: {
    id: 'eclipse_blade',
    name: 'ดาบจันทราทมิฬ (Dark Eclipse)',
    rarity: 'Legendary',
    rarityColor: '#ffaa00',
    atkBonus: 0.50,
    bladeColor: '#220033',
    waveColor: '#cc00ff',
    weight: 3,
  },
};

const DEFAULT_AURAS = ['#00aaff', '#ff3344', '#22dd66', '#bb55ff', '#ffbb00'];
const GACHA_COST = 100;

const REDEEM_CODES = {
  SOUL2026: { coins: 500, tickets: 0, desc: 'รับ 500 Soul Coins!' },
  VIP999:   { coins: 1000, tickets: 1, desc: 'รับ 1,000 Soul Coins + 1 ตั๋วกาชาฟรี!' },
  BLADE777: { coins: 300, tickets: 0, desc: 'รับ 300 Soul Coins!' },
};

function expForLevel(lvl) {
  return Math.floor(100 * lvl + (60 * (lvl - 1) * lvl) / 2);
}

function rollWeightedSword() {
  const items = Object.values(SWORD_CATALOG);
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of items) {
    if (r < item.weight) return item;
    r -= item.weight;
  }
  return SWORD_CATALOG.steel_blade;
}

// ============================================================
//  SUPABASE DATABASE LAYER (Table: `players`)
//  Columns: username, pin, level, exp, coins, swords,
//           equipped_sword, auras, equipped_aura, used_codes, gacha_tickets
// ============================================================
const memoryCache = {}; // Local session cache & fallback if .env has placeholder URL

function normalizeRowToAccount(row) {
  return {
    username: row.username,
    pin: row.pin,
    level: Number(row.level) || 1,
    exp: Number(row.exp) || 0,
    coins: Number(row.coins) ?? 200,
    gachaTickets: Number(row.gacha_tickets) ?? 1,
    unlockedSwords: Array.isArray(row.swords) && row.swords.length > 0 ? row.swords : ['steel_blade'],
    equippedSword: row.equipped_sword && SWORD_CATALOG[row.equipped_sword] ? row.equipped_sword : 'steel_blade',
    unlockedAuras: Array.isArray(row.auras) && row.auras.length > 0 ? row.auras : DEFAULT_AURAS,
    equippedAura: row.equipped_aura || '#00aaff',
    redeemedCodes: Array.isArray(row.used_codes) ? row.used_codes : [],
  };
}

function accountToSupabaseRow(acc) {
  return {
    username: acc.username,
    pin: acc.pin,
    level: acc.level,
    exp: acc.exp,
    coins: acc.coins,
    gacha_tickets: acc.gachaTickets ?? 0,
    swords: acc.unlockedSwords,
    equipped_sword: acc.equippedSword,
    auras: acc.unlockedAuras || DEFAULT_AURAS,
    equipped_aura: acc.equippedAura,
    used_codes: acc.redeemedCodes,
  };
}

async function createOrLoadPlayer(username, pin, preferredColor) {
  const key = username.toLowerCase();

  if (supabase) {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('players')
        .select('*')
        .ilike('username', username)
        .maybeSingle();

      if (fetchErr) {
        console.error('Supabase fetch error:', fetchErr.message);
      }

      if (!existing) {
        const newAcc = {
          username,
          pin,
          level: 1,
          exp: 0,
          coins: 200,
          gachaTickets: 1,
          unlockedSwords: ['steel_blade'],
          equippedSword: 'steel_blade',
          unlockedAuras: DEFAULT_AURAS,
          equippedAura: preferredColor || '#00aaff',
          redeemedCodes: [],
        };

        const { error: insertErr } = await supabase
          .from('players')
          .insert([accountToSupabaseRow(newAcc)]);

        if (insertErr) {
          console.error('Supabase insert error:', insertErr.message);
        }

        memoryCache[key] = newAcc;
        return { status: 'created', account: newAcc };
      }

      if (String(existing.pin) !== String(pin)) {
        return { status: 'wrong_pin', message: 'รหัส PIN 4 หลักไม่ถูกต้องสำหรับชื่อผู้ใช้นี้!' };
      }

      const loadedAcc = normalizeRowToAccount(existing);
      if (preferredColor) {
        loadedAcc.equippedAura = preferredColor;
        await savePlayerToSupabase(loadedAcc);
      }
      memoryCache[key] = loadedAcc;
      return { status: 'loaded', account: loadedAcc };
    } catch (err) {
      console.error('Unexpected Supabase error:', err);
    }
  }

  // Fallback in-memory when .env placeholder is not replaced yet
  const existingMem = memoryCache[key];
  if (!existingMem) {
    const newAcc = {
      username,
      pin,
      level: 1,
      exp: 0,
      coins: 200,
      gachaTickets: 1,
      unlockedSwords: ['steel_blade'],
      equippedSword: 'steel_blade',
      unlockedAuras: DEFAULT_AURAS,
      equippedAura: preferredColor || '#00aaff',
      redeemedCodes: [],
    };
    memoryCache[key] = newAcc;
    return { status: 'created', account: newAcc };
  }

  if (existingMem.pin !== pin) {
    return { status: 'wrong_pin', message: 'รหัส PIN 4 หลักไม่ถูกต้องสำหรับชื่อผู้ใช้นี้!' };
  }
  if (preferredColor) existingMem.equippedAura = preferredColor;
  return { status: 'loaded', account: existingMem };
}

async function savePlayerToSupabase(acc) {
  if (!acc || !acc.username) return;
  const key = acc.username.toLowerCase();
  memoryCache[key] = acc;

  if (!supabase) return;
  try {
    const row = accountToSupabaseRow(acc);
    const { error } = await supabase
      .from('players')
      .upsert(row, { onConflict: 'username' });

    if (error) {
      console.error('Supabase upsert error:', error.message);
    }
  } catch (err) {
    console.error('Failed saving player to Supabase:', err);
  }
}

// ============================================================
//  MULTIPLAYER ROOM & SERVER-AUTHORITATIVE MONSTER + WORLD BOSS
// ============================================================
const GAME_W = 900;
const GROUND_Y = 460;
const MAX_HOLLOWS = 5;
const BOSS_KILL_THRESHOLD = 15;
const BOSS_TIMER_MS = 120000;
const SPAWN_X_OPTS = [80, 200, 450, 700, 820];

const HOLLOW_CONFIG = {
  normal: {
    type: 'normal',
    hpMax: 120,
    speed: 80,
    atk: 12,
    exp: 35,
    coins: 25,
    detectRange: 220,
    atkRange: 50,
    atkCd: 1200,
    patrolRange: 140,
    dropChance: 0.6,
  },
  menos: {
    type: 'menos',
    hpMax: 420,
    speed: 55,
    atk: 28,
    exp: 130,
    coins: 90,
    detectRange: 300,
    atkRange: 72,
    atkCd: 2000,
    patrolRange: 100,
    dropChance: 0.95,
  },
  overlord: {
    type: 'overlord',
    name: 'OVERLORD HOLLOW — VASTO EMPEROR',
    hpMax: 2200,
    speed: 75,
    atk: 38,
    exp: 600,
    coins: 500,
    tickets: 1,
    detectRange: 850,
    atkRange: 95,
    atkCd: 1600,
    patrolRange: 260,
    dropChance: 1.0,
    ceroCd: 7500,
    dashCd: 5500,
  },
};

const rooms = {};

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      players: {},
      hollows: [],
      orbs: [],
      nextHollowId: 1,
      nextOrbId: 1,
      lastSpawnTime: Date.now(),
      killCount: 0,
      lastBossTime: Date.now(),
      bossActive: false,
      bossPending: false,
    };
    spawnHollowInRoom(roomId, 'normal');
    spawnHollowInRoom(roomId, 'normal');
  }
  return rooms[roomId];
}

function spawnHollowInRoom(roomId, forcedType = null) {
  const room = rooms[roomId];
  if (!room) return null;

  if (forcedType === 'overlord') {
    if (room.bossActive) return null;
    const cfg = HOLLOW_CONFIG.overlord;
    const boss = {
      id: `boss_${room.nextHollowId++}`,
      type: 'overlord',
      name: cfg.name,
      x: Math.round(GAME_W / 2),
      y: GROUND_Y - 78,
      hp: cfg.hpMax,
      hpMax: cfg.hpMax,
      state: 'chase',
      facingRight: true,
      patrolDir: 1,
      patrolOriginX: Math.round(GAME_W / 2),
      lastAtkTime: Date.now(),
      lastCeroTime: Date.now() - 2000,
      lastDashTime: Date.now(),
      isChargingCero: false,
    };
    room.bossActive = true;
    room.bossPending = false;
    room.hollows.push(boss);
    io.to(roomId).emit('hollowSpawned', boss);
    return boss;
  }

  const regularCount = room.hollows.filter((h) => h.type !== 'overlord').length;
  if (regularCount >= MAX_HOLLOWS) return null;

  const type = forcedType || (Math.random() < 0.2 ? 'menos' : 'normal');
  const cfg = HOLLOW_CONFIG[type];
  const spawnX =
    SPAWN_X_OPTS[Math.floor(Math.random() * SPAWN_X_OPTS.length)] +
    Math.floor((Math.random() - 0.5) * 40);
  const spawnY = type === 'menos' ? GROUND_Y - 70 : GROUND_Y - 34;

  const hollow = {
    id: `h_${room.nextHollowId++}`,
    type,
    x: spawnX,
    y: spawnY,
    hp: cfg.hpMax,
    hpMax: cfg.hpMax,
    state: 'patrol',
    facingRight: Math.random() < 0.5,
    patrolDir: Math.random() < 0.5 ? 1 : -1,
    patrolOriginX: spawnX,
    lastAtkTime: 0,
  };

  room.hollows.push(hollow);
  io.to(roomId).emit('hollowSpawned', hollow);
  return hollow;
}

function triggerWorldBossInRoom(roomId) {
  const room = rooms[roomId];
  if (!room || room.bossActive || room.bossPending) return;
  room.bossPending = true;
  room.killCount = 0;
  room.lastBossTime = Date.now();

  io.to(roomId).emit('bossWarning', {
    title: 'WARNING: OVERLORD HOLLOW APPEARED!',
    subtitle: 'จักรพรรดิฮอลโลว์ปรากฏตัว! เตรียมกระโดดหลบลำแสง Cero Beam!',
  });

  io.to(roomId).emit('chatMessage', {
    system: true,
    text: '🚨 WARNING: OVERLORD HOLLOW กำลังฉีกมิติเข้าสู่ฉาก!',
  });

  setTimeout(() => {
    if (rooms[roomId]) {
      spawnHollowInRoom(roomId, 'overlord');
    }
  }, 2600);
}

// ── Socket.io Connection Handling ───────────────────────────
io.on('connection', (socket) => {
  let currentRoom = null;
  let currentAccKey = null;

  socket.on('loginAndJoin', async ({ username, pin, roomId, color }) => {
    const cleanName = String(username || '').trim().slice(0, 16);
    const cleanPin = String(pin || '').trim();
    const cleanRoom = String(roomId || 'room1').trim().slice(0, 20) || 'room1';
    const cleanColor = color || '#00aaff';

    if (!cleanName || cleanName.length < 2) {
      socket.emit('authError', { message: 'กรุณากรอกชื่อผู้ใช้ (อย่างน้อย 2 ตัวอักษร)' });
      return;
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      socket.emit('authError', { message: 'กรุณากรอกรหัส PIN เป็นตัวเลข 4 หลัก (เช่น 1234)' });
      return;
    }

    const res = await createOrLoadPlayer(cleanName, cleanPin, cleanColor);
    if (res.status === 'wrong_pin') {
      socket.emit('authError', { message: res.message });
      return;
    }

    const acc = res.account;
    currentAccKey = cleanName.toLowerCase();
    currentRoom = cleanRoom;
    socket.join(cleanRoom);

    const room = getOrCreateRoom(cleanRoom);
    const hpMax = 100 + (acc.level - 1) * 20;

    room.players[socket.id] = {
      id: socket.id,
      name: acc.username,
      roomId: cleanRoom,
      color: acc.equippedAura,
      x: 120 + Math.floor(Math.random() * 120),
      y: GROUND_Y - 34,
      facingRight: true,
      level: acc.level,
      exp: acc.exp,
      coins: acc.coins,
      gachaTickets: acc.gachaTickets || 0,
      hp: hpMax,
      hpMax,
      equippedSword: acc.equippedSword,
      swordData: SWORD_CATALOG[acc.equippedSword] || SWORD_CATALOG.steel_blade,
      isAwakened: false,
      isDead: false,
    };

    socket.emit('roomJoined', {
      selfId: socket.id,
      authStatus: res.status,
      roomId: cleanRoom,
      account: {
        username: acc.username,
        level: acc.level,
        exp: acc.exp,
        coins: acc.coins,
        gachaTickets: acc.gachaTickets || 0,
        unlockedSwords: acc.unlockedSwords,
        equippedSword: acc.equippedSword,
        equippedAura: acc.equippedAura,
        redeemedCodes: acc.redeemedCodes,
      },
      swordCatalog: SWORD_CATALOG,
      players: room.players,
      hollows: room.hollows,
      orbs: room.orbs,
      killCount: room.killCount,
      bossKillThreshold: BOSS_KILL_THRESHOLD,
    });

    socket.to(cleanRoom).emit('playerJoined', room.players[socket.id]);
    io.to(cleanRoom).emit('playerListUpdate', Object.values(room.players));

    io.to(cleanRoom).emit('chatMessage', {
      system: true,
      text: `✦ ${acc.username} [LV.${acc.level}] เข้าสู่โลกวิญญาณ (${cleanRoom})`,
    });
  });

  socket.on('playerMove', (state) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const p = rooms[currentRoom].players[socket.id];
    if (!p) return;

    p.x = state.x;
    p.y = state.y;
    p.facingRight = state.facingRight;
    p.hp = state.hp ?? p.hp;
    p.hpMax = state.hpMax ?? p.hpMax;
    p.isAwakened = !!state.isAwakened;
    p.isDead = !!state.isDead;

    socket.to(currentRoom).emit('playerMoved', {
      id: socket.id,
      x: p.x,
      y: p.y,
      facingRight: p.facingRight,
      level: p.level,
      hp: p.hp,
      hpMax: p.hpMax,
      equippedSword: p.equippedSword,
      swordData: p.swordData,
      isAwakened: p.isAwakened,
      isDead: p.isDead,
    });
  });

  socket.on('playerAction', (actionData) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const p = rooms[currentRoom].players[socket.id];
    if (!p) return;

    if (actionData.type === 'awakening') {
      p.isAwakened = actionData.active;
      io.to(currentRoom).emit('playerListUpdate', Object.values(rooms[currentRoom].players));
    }

    socket.to(currentRoom).emit('remotePlayerAction', {
      id: socket.id,
      name: p.name,
      color: p.color,
      swordData: p.swordData,
      ...actionData,
    });
  });

  // Roll Gacha (Uses Free Ticket first, else 100 Soul Coins)
  socket.on('rollGacha', async () => {
    if (!currentAccKey || !memoryCache[currentAccKey]) return;
    const acc = memoryCache[currentAccKey];

    let usedTicket = false;
    if ((acc.gachaTickets || 0) > 0) {
      acc.gachaTickets -= 1;
      usedTicket = true;
    } else if (acc.coins >= GACHA_COST) {
      acc.coins -= GACHA_COST;
    } else {
      socket.emit('gachaResult', {
        success: false,
        message: `เหรียญวิญญาณไม่พอ! (ต้องการ ${GACHA_COST} Soul Coins หรือตั๋วกาชาฟรี)`,
      });
      return;
    }

    const wonSword = rollWeightedSword();
    const isNew = !acc.unlockedSwords.includes(wonSword.id);
    if (isNew) {
      acc.unlockedSwords.push(wonSword.id);
    }

    await savePlayerToSupabase(acc);

    if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
      rooms[currentRoom].players[socket.id].coins = acc.coins;
      rooms[currentRoom].players[socket.id].gachaTickets = acc.gachaTickets;
    }

    socket.emit('gachaResult', {
      success: true,
      sword: wonSword,
      isNew,
      usedTicket,
      coins: acc.coins,
      gachaTickets: acc.gachaTickets,
      unlockedSwords: acc.unlockedSwords,
    });

    if (wonSword.rarity === 'Legendary' || wonSword.rarity === 'Epic') {
      if (currentRoom) {
        io.to(currentRoom).emit('chatMessage', {
          system: true,
          text: `🎉 ${acc.username} สุ่มกาชาได้ [${wonSword.rarity}] ${wonSword.name}!`,
        });
      }
    }
  });

  socket.on('equipSword', async ({ swordId }) => {
    if (!currentAccKey || !memoryCache[currentAccKey]) return;
    const acc = memoryCache[currentAccKey];

    if (!acc.unlockedSwords.includes(swordId) || !SWORD_CATALOG[swordId]) return;
    acc.equippedSword = swordId;
    await savePlayerToSupabase(acc);

    const swordData = SWORD_CATALOG[swordId];
    if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
      const p = rooms[currentRoom].players[socket.id];
      p.equippedSword = swordId;
      p.swordData = swordData;

      io.to(currentRoom).emit('playerEquipmentChanged', {
        id: socket.id,
        equippedSword: swordId,
        swordData,
        color: p.color,
      });
    }

    socket.emit('equipConfirmed', {
      equippedSword: swordId,
      swordData,
    });
  });

  socket.on('redeemCode', async ({ code }) => {
    if (!currentAccKey || !memoryCache[currentAccKey]) return;
    const acc = memoryCache[currentAccKey];
    const cleanCode = String(code || '').trim().toUpperCase();

    if (!cleanCode) {
      socket.emit('redeemResult', { success: false, message: 'กรุณากรอกโค้ดก่อนกดรับรางวัล' });
      return;
    }

    const reward = REDEEM_CODES[cleanCode];
    if (!reward) {
      socket.emit('redeemResult', {
        success: false,
        message: 'ไม่พบโค้ดนี้ หรือโค้ดไม่ถูกต้อง! (ลองใช้ SOUL2026 หรือ VIP999)',
      });
      return;
    }

    if (acc.redeemedCodes.includes(cleanCode)) {
      socket.emit('redeemResult', {
        success: false,
        message: `คุณใช้โค้ด ${cleanCode} ไปแล้ว! (1 บัญชีใช้ซ้ำไม่ได้)`,
      });
      return;
    }

    acc.redeemedCodes.push(cleanCode);
    acc.coins += reward.coins || 0;
    acc.gachaTickets = (acc.gachaTickets || 0) + (reward.tickets || 0);
    await savePlayerToSupabase(acc);

    if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
      rooms[currentRoom].players[socket.id].coins = acc.coins;
      rooms[currentRoom].players[socket.id].gachaTickets = acc.gachaTickets;
    }

    socket.emit('redeemResult', {
      success: true,
      code: cleanCode,
      addedCoins: reward.coins,
      addedTickets: reward.tickets || 0,
      coins: acc.coins,
      gachaTickets: acc.gachaTickets,
      message: `สำเร็จ! ${reward.desc}`,
    });
  });

  // Player hits a Hollow or World Boss
  socket.on('hitHollow', async ({ hollowId, dmg }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    const hollow = room.hollows.find((h) => h.id === hollowId);
    if (!hollow || hollow.hp <= 0) return;

    const validDmg = Math.max(1, Math.min(5000, Math.round(dmg || 10)));
    hollow.hp = Math.max(0, hollow.hp - validDmg);

    io.to(currentRoom).emit('hollowDamaged', {
      id: hollow.id,
      type: hollow.type,
      hp: hollow.hp,
      hpMax: hollow.hpMax,
      dmg: validDmg,
      attackerId: socket.id,
    });

    if (hollow.hp <= 0) {
      const cfg = HOLLOW_CONFIG[hollow.type];
      const deadX = hollow.x;
      const deadY = hollow.y;
      const isBoss = hollow.type === 'overlord';

      room.hollows = room.hollows.filter((h) => h.id !== hollow.id);

      if (isBoss) {
        room.bossActive = false;
        room.lastBossTime = Date.now();
      } else {
        room.killCount = (room.killCount || 0) + 1;
      }

      let droppedOrb = null;
      if (Math.random() <= cfg.dropChance) {
        droppedOrb = {
          id: `orb_${room.nextOrbId++}`,
          isHP: Math.random() < 0.5,
          x: deadX,
          y: GROUND_Y - 22,
        };
        room.orbs.push(droppedOrb);
      }

      // Award EXP, Soul Coins & Boss Gacha Ticket to ALL living players in room & persist to Supabase
      for (const rp of Object.values(room.players)) {
        if (rp.isDead) continue;
        const accKey = rp.name.toLowerCase();
        const acc = memoryCache[accKey];
        if (!acc) continue;

        acc.exp += cfg.exp;
        acc.coins += cfg.coins;
        const ticketsAdded = cfg.tickets || 0;
        if (ticketsAdded > 0) {
          acc.gachaTickets = (acc.gachaTickets || 0) + ticketsAdded;
        }

        let leveledUp = false;
        while (acc.exp >= expForLevel(acc.level)) {
          acc.exp -= expForLevel(acc.level);
          acc.level++;
          leveledUp = true;
        }

        rp.level = acc.level;
        rp.exp = acc.exp;
        rp.coins = acc.coins;
        rp.gachaTickets = acc.gachaTickets;
        rp.hpMax = 100 + (acc.level - 1) * 20;
        if (leveledUp) rp.hp = rp.hpMax;

        await savePlayerToSupabase(acc);

        io.to(rp.id).emit('rewardGranted', {
          expAdded: cfg.exp,
          coinsAdded: cfg.coins,
          ticketsAdded,
          isBossReward: isBoss,
          level: acc.level,
          exp: acc.exp,
          coins: acc.coins,
          gachaTickets: acc.gachaTickets,
          leveledUp,
        });

        if (leveledUp) {
          socket.to(currentRoom).emit('remotePlayerAction', {
            id: rp.id,
            name: rp.name,
            color: rp.color,
            type: 'levelUp',
            level: acc.level,
          });
        }
      }

      io.to(currentRoom).emit('playerListUpdate', Object.values(room.players));

      io.to(currentRoom).emit('hollowKilled', {
        id: hollow.id,
        type: hollow.type,
        isBoss,
        x: deadX,
        y: deadY,
        exp: cfg.exp,
        coins: cfg.coins,
        killerId: socket.id,
        droppedOrb,
        killCount: room.killCount,
        bossKillThreshold: BOSS_KILL_THRESHOLD,
      });

      if (isBoss) {
        io.to(currentRoom).emit('chatMessage', {
          system: true,
          text: '🏆 OVERLORD HOLLOW ถูกปราบแล้ว! ทุกคนในห้องได้รับ +600 EXP, +500 Coins และ +1 ตั๋วสุ่มกาชาฟรี!',
        });
      } else if (room.killCount >= BOSS_KILL_THRESHOLD && !room.bossActive && !room.bossPending) {
        triggerWorldBossInRoom(currentRoom);
      }
    }
  });

  socket.on('pickupOrb', ({ orbId }) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    const idx = room.orbs.findIndex((o) => o.id === orbId);
    if (idx === -1) return;

    const [orb] = room.orbs.splice(idx, 1);
    io.to(currentRoom).emit('orbPickedUp', {
      orbId: orb.id,
      playerId: socket.id,
      isHP: orb.isHP,
      x: orb.x,
      y: orb.y,
    });
  });

  socket.on('chatMessage', (msgText) => {
    if (!currentRoom || !rooms[currentRoom]) return;
    const p = rooms[currentRoom].players[socket.id];
    if (!p) return;
    const text = String(msgText || '').trim().slice(0, 120);
    if (!text) return;

    io.to(currentRoom).emit('chatMessage', {
      id: socket.id,
      name: p.name,
      color: p.color,
      level: p.level,
      text,
    });
  });

  socket.on('disconnect', async () => {
    if (currentAccKey && memoryCache[currentAccKey]) {
      await savePlayerToSupabase(memoryCache[currentAccKey]);
    }
    if (!currentRoom || !rooms[currentRoom]) return;
    const room = rooms[currentRoom];
    const p = room.players[socket.id];
    const leavingName = p ? p.name : 'SoulReaper';

    delete room.players[socket.id];
    socket.to(currentRoom).emit('playerLeft', socket.id);
    io.to(currentRoom).emit('playerListUpdate', Object.values(room.players));
    io.to(currentRoom).emit('chatMessage', {
      system: true,
      text: `✧ ${leavingName} ออกจากโลกวิญญาณ`,
    });

    if (Object.keys(room.players).length === 0) {
      delete rooms[currentRoom];
    }
  });
});

// ============================================================
//  SERVER TICK LOOP (20 TPS) — Hollow & World Boss AI
// ============================================================
const TICK_RATE = 50;
setInterval(() => {
  const now = Date.now();
  const dt = TICK_RATE / 1000;

  for (const roomId of Object.keys(rooms)) {
    const room = rooms[roomId];
    const playerValues = Object.values(room.players).filter((p) => !p.isDead);

    if (!room.bossActive && !room.bossPending && now - room.lastBossTime >= BOSS_TIMER_MS) {
      triggerWorldBossInRoom(roomId);
    }

    if (now - room.lastSpawnTime >= 4500) {
      room.lastSpawnTime = now;
      spawnHollowInRoom(roomId);
    }

    for (const h of room.hollows) {
      const cfg = HOLLOW_CONFIG[h.type];

      let nearestPlayer = null;
      let minDist = Infinity;
      for (const p of playerValues) {
        const d = Math.abs(p.x - h.x);
        if (d < minDist) {
          minDist = d;
          nearestPlayer = p;
        }
      }

      if (h.type === 'overlord') {
        if (h.isChargingCero) continue;

        if (nearestPlayer && now - h.lastCeroTime >= cfg.ceroCd) {
          h.lastCeroTime = now;
          h.isChargingCero = true;
          h.facingRight = nearestPlayer.x >= h.x;
          const beamDir = h.facingRight ? 1 : -1;
          const beamY = GROUND_Y - 52;

          io.to(roomId).emit('bossCeroTelegraph', {
            bossId: h.id,
            x: Math.round(h.x),
            y: beamY,
            dir: beamDir,
          });

          setTimeout(() => {
            if (!rooms[roomId] || !room.hollows.includes(h) || h.hp <= 0) return;
            h.isChargingCero = false;

            io.to(roomId).emit('bossCeroFire', {
              bossId: h.id,
              x: Math.round(h.x),
              y: beamY,
              dir: beamDir,
              dmg: 45,
            });
          }, 1000);
          continue;
        }

        if (nearestPlayer && now - h.lastDashTime >= cfg.dashCd && minDist > 110) {
          h.lastDashTime = now;
          const dashDir = nearestPlayer.x >= h.x ? 1 : -1;
          h.facingRight = dashDir > 0;
          const fromX = h.x;
          h.x = Math.max(50, Math.min(GAME_W - 50, h.x + dashDir * 220));

          io.to(roomId).emit('bossDash', {
            bossId: h.id,
            fromX: Math.round(fromX),
            toX: Math.round(h.x),
            y: Math.round(h.y),
            dmg: 32,
          });
          continue;
        }
      }

      if (nearestPlayer && minDist <= cfg.atkRange) {
        h.state = 'attack';
        h.facingRight = nearestPlayer.x >= h.x;
        if (now - h.lastAtkTime >= cfg.atkCd) {
          h.lastAtkTime = now;
          io.to(roomId).emit('hollowAttack', {
            hollowId: h.id,
            targetId: nearestPlayer.id,
            dmg: cfg.atk,
            hollowX: h.x,
          });
        }
      } else if (nearestPlayer && minDist <= cfg.detectRange) {
        h.state = 'chase';
        const dir = nearestPlayer.x >= h.x ? 1 : -1;
        h.x += dir * cfg.speed * dt;
        h.facingRight = dir > 0;
      } else {
        h.state = 'patrol';
        const diff = h.x - h.patrolOriginX;
        if (diff > cfg.patrolRange) h.patrolDir = -1;
        else if (diff < -cfg.patrolRange) h.patrolDir = 1;
        h.x += h.patrolDir * (cfg.speed * 0.55) * dt;
        h.facingRight = h.patrolDir > 0;
      }

      h.x = Math.max(30, Math.min(GAME_W - 30, h.x));
    }

    if (room.hollows.length > 0) {
      io.to(roomId).emit(
        'hollowsSync',
        room.hollows.map((h) => ({
          id: h.id,
          type: h.type,
          x: Math.round(h.x),
          y: Math.round(h.y),
          hp: h.hp,
          hpMax: h.hpMax,
          state: h.state,
          facingRight: h.facingRight,
        }))
      );
    }
  }
}, TICK_RATE);

server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         SOUL REAPER WEB — Phase 6 & 7 Ready            ║');
  console.log('║   Supabase Cloud DB + Multiplayer + World Boss Raid    ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║   Server running on http://localhost:${PORT}              ║`);
  console.log('╚════════════════════════════════════════════════════════╝');
});

module.exports = { app, server };
