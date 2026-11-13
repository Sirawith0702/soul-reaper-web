// ============================================================
//  SOUL REAPER WEB — Phase 5: Web Audio SFX, World Boss & Visuals
//  2D Action RPG Side-scrolling  |  Original Soul Hunter IP
//  Frontend: Phaser 3 (CDN) + Socket.io + Web Audio API
// ============================================================

const GAME_W = 900;
const GAME_H = 500;

const PLAYER_BASE = {
  SPEED: 200,
  JUMP_VEL: -520,
  HP_MAX: 100,
  SP_MAX: 100,
  SP_REGEN: 5,
  SLASH_COOLDOWN: 350,
  DASH_COOLDOWN: 1500,
  DASH_COST: 10,
  WAVE_COST: 25,
  AWAKEN_COST: 80,
  AWAKEN_DURATION: 10000,
  AWAKEN_SPEED_MULT: 1.5,
  HP_PER_LEVEL: 20,
  ATK_SCALE: 0.15,
};

function expForLevel(lvl) {
  return Math.floor(100 * lvl + (60 * (lvl - 1) * lvl) / 2);
}

// ============================================================
//  1. WEB AUDIO API SYNTHESIZER (SoundManager — No External Files)
// ============================================================
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // White noise buffer helper for sword whooshes & explosions
  _createNoiseBuffer(durationSec = 0.25) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // 3-Stage Sword Slash SFX
  playSlash(comboStep = 1) {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const isFinal = comboStep === 3;
    const dur = isFinal ? 0.26 : 0.14;

    // Filtered noise whoosh
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._createNoiseBuffer(dur);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq = comboStep === 1 ? 900 : comboStep === 2 ? 1250 : 650;
    filter.frequency.setValueAtTime(baseFreq, now);
    filter.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, now + dur);
    filter.Q.value = 2.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isFinal ? 0.35 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);

    // Metallic blade ring oscillator
    const osc = this.ctx.createOscillator();
    osc.type = isFinal ? 'sawtooth' : 'triangle';
    const startPitch = comboStep === 1 ? 520 : comboStep === 2 ? 660 : 380;
    osc.frequency.setValueAtTime(startPitch, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + dur);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(isFinal ? 0.22 : 0.12, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  // Crescent Wave Projectile SFX
  playWave() {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const dur = 0.38;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + dur);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  // Flash Dash (Shunpo) High-Speed Whoosh
  playDash() {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const dur = 0.18;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + dur * 0.7);
    osc.frequency.exponentialRampToValueAtTime(500, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  // Soul Awakening Heavy Bass + Power Surge
  playAwakening() {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const dur = 0.85;

    // Sub-bass drop/surge
    const sub = this.ctx.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(65, now);
    sub.frequency.exponentialRampToValueAtTime(180, now + 0.45);
    sub.frequency.exponentialRampToValueAtTime(48, now + dur);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.38, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + dur);

    // Noise burst
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._createNoiseBuffer(0.6);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.28, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    noise.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now);
  }

  // Monster Hit Impact
  playHit() {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.09);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Orb / Coin Pickup Chime
  playCoinOrb() {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.16, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.18);
    });
  }

  // Level Up Fanfare Arpeggio
  playLevelUp() {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.35);
    });
  }

  // Gacha Roll & Reveal SFX
  playGacha(rarity = 'Common') {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const isHigh = rarity === 'Legendary' || rarity === 'Epic';
    const notes = isHigh
      ? [440, 554.37, 659.25, 880, 1108.73, 1318.5]
      : [392, 493.88, 587.33, 783.99];

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = isHigh ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.16, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.28);
    });
  }

  // World Boss Warning Siren
  playBossSiren() {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const start = now + i * 0.65;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, start);
      osc.frequency.linearRampToValueAtTime(480, start + 0.32);
      osc.frequency.linearRampToValueAtTime(200, start + 0.6);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.62);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.62);
    }
  }

  // Boss Cero Beam Charge & Blast
  playCeroCharge() {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.9);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.9);
  }

  playCeroFire() {
    if (this.muted) return;
    this._init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const dur = 0.65;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }
}

const sfx = new SoundManager();

// ─── GLOBAL MULTIPLAYER, ACCOUNT & TOUCH STATE ───────────────
const socket = io({ autoConnect: false });

const ClientState = {
  joined: false,
  username: 'Ichigo',
  pin: '1234',
  roomId: 'room1',
  playerColor: '#00aaff',
  isChatFocused: false,
  isShopOpen: false,
  activeScene: null,
  swordCatalog: {},
  unlockedSwords: ['steel_blade'],
  equippedSword: 'steel_blade',
  coins: 0,
  gachaTickets: 0,
  touchInput: {
    left: false,
    right: false,
    jump: false,
  },
};

function updateGachaButtonLabels() {
  const modalCoins = document.getElementById('modal-coins');
  const modalTickets = document.getElementById('modal-tickets');
  const rollBtn = document.getElementById('roll-gacha-btn');

  if (modalCoins) modalCoins.textContent = String(ClientState.coins);
  if (modalTickets) modalTickets.textContent = String(ClientState.gachaTickets);
  if (rollBtn) {
    if (ClientState.gachaTickets > 0) {
      rollBtn.textContent = `🎟 ใช้ตั๋วสุ่มกาชาฟรี! (เหลือ ${ClientState.gachaTickets} ใบ)`;
    } else {
      rollBtn.textContent = '🎲 สุ่มดาบวิญญาณ (100 Soul Coins)';
    }
  }
}

// Setup DOM Listeners
window.addEventListener('DOMContentLoaded', () => {
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach((sw) => {
    sw.addEventListener('click', () => {
      swatches.forEach((s) => s.classList.remove('selected'));
      sw.classList.add('selected');
      ClientState.playerColor = sw.getAttribute('data-color') || '#00aaff';
    });
  });

  // Sound Mute / Unmute Toggle
  const soundBtn = document.getElementById('toggle-sound-btn');
  soundBtn.addEventListener('click', () => {
    const isMuted = sfx.toggleMute();
    soundBtn.textContent = isMuted ? '🔇 เสียง: ปิด' : '🔊 เสียง: เปิด';
    soundBtn.classList.toggle('muted', isMuted);
  });

  // Login & Join
  const joinBtn = document.getElementById('join-btn');
  const nameInput = document.getElementById('player-name');
  const pinInput = document.getElementById('player-pin');
  const roomInput = document.getElementById('room-id');
  const authErr = document.getElementById('auth-error');

  const attemptLogin = () => {
    if (ClientState.joined) return;
    sfx._init();
    const uname = (nameInput.value || '').trim();
    const pin = (pinInput.value || '').trim();
    const room = (roomInput.value || 'room1').trim() || 'room1';

    if (uname.length < 2) {
      authErr.textContent = 'กรุณากรอกชื่อผู้ใช้อย่างน้อย 2 ตัวอักษร';
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      authErr.textContent = 'กรุณากรอกรหัส PIN เป็นตัวเลข 4 หลัก (เช่น 1234)';
      return;
    }

    authErr.textContent = 'กำลังเข้าสู่โลกวิญญาณ...';
    ClientState.username = uname;
    ClientState.pin = pin;
    ClientState.roomId = room;

    if (ClientState.activeScene) {
      ClientState.activeScene.connectMultiplayer();
    }
  };

  joinBtn.addEventListener('click', attemptLogin);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });
  pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });
  roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });

  // Shop / Gacha Modal Controls
  const shopModal = document.getElementById('shop-modal');
  const openShopBtn = document.getElementById('open-shop-btn');
  const closeShopBtn = document.getElementById('close-shop-btn');

  const setShopOpen = (open) => {
    ClientState.isShopOpen = open;
    shopModal.classList.toggle('open', open);
    if (ClientState.activeScene && ClientState.activeScene.input && ClientState.activeScene.input.keyboard) {
      ClientState.activeScene.input.keyboard.enabled = !open && !ClientState.isChatFocused;
    }
    if (open) {
      updateGachaButtonLabels();
      renderInventoryGrid();
    }
  };

  openShopBtn.addEventListener('click', () => setShopOpen(!ClientState.isShopOpen));
  closeShopBtn.addEventListener('click', () => setShopOpen(false));

  const tabs = document.querySelectorAll('.shop-tab');
  const panes = document.querySelectorAll('.tab-pane');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      panes.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.getAttribute('data-tab'));
      if (target) target.classList.add('active');
      if (tab.getAttribute('data-tab') === 'tab-inv') renderInventoryGrid();
    });
  });

  document.getElementById('roll-gacha-btn').addEventListener('click', () => {
    socket.emit('rollGacha');
  });

  const redeemInput = document.getElementById('redeem-input');
  const redeemBtn = document.getElementById('redeem-btn');
  const triggerRedeem = () => {
    const code = redeemInput.value.trim();
    socket.emit('redeemCode', { code });
  };
  redeemBtn.addEventListener('click', triggerRedeem);
  redeemInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerRedeem(); });

  // Quick Chat
  const chatInput = document.getElementById('chat-input');
  const chatWrapper = document.getElementById('chat-input-wrapper');

  chatInput.addEventListener('focus', () => {
    ClientState.isChatFocused = true;
    chatWrapper.classList.add('active');
    if (ClientState.activeScene && ClientState.activeScene.input && ClientState.activeScene.input.keyboard) {
      ClientState.activeScene.input.keyboard.enabled = false;
    }
  });

  chatInput.addEventListener('blur', () => {
    ClientState.isChatFocused = false;
    chatWrapper.classList.remove('active');
    if (ClientState.activeScene && ClientState.activeScene.input && ClientState.activeScene.input.keyboard) {
      ClientState.activeScene.input.keyboard.enabled = !ClientState.isShopOpen;
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!ClientState.joined) return;
    if (e.key === 'Escape' && ClientState.isShopOpen) {
      setShopOpen(false);
      return;
    }
    if (ClientState.isShopOpen) return;

    if (e.key === 'Enter') {
      if (document.activeElement === chatInput) {
        const msg = chatInput.value.trim();
        if (msg) {
          socket.emit('chatMessage', msg);
          chatInput.value = '';
        }
        chatInput.blur();
      } else {
        if (ClientState.activeScene && ClientState.activeScene.isDead) return;
        e.preventDefault();
        chatInput.focus();
      }
    } else if (e.key === 'Escape' && document.activeElement === chatInput) {
      chatInput.blur();
    }
  });

  // Touch Controls
  const touchContainer = document.getElementById('touch-controls');
  const wrapper = document.getElementById('game-wrapper');
  const toggleTouchBtn = document.getElementById('toggle-touch-btn');

  const setTouchVisible = (vis) => {
    touchContainer.classList.toggle('visible', vis);
    wrapper.classList.toggle('touch-active', vis);
  };

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    setTouchVisible(true);
  }

  toggleTouchBtn.addEventListener('click', () => {
    setTouchVisible(!touchContainer.classList.contains('visible'));
  });

  document.querySelectorAll('.v-btn').forEach((btn) => {
    const action = btn.getAttribute('data-action');

    const onPress = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      const sc = ClientState.activeScene;
      if (!sc || !ClientState.joined) return;

      if (action === 'left') ClientState.touchInput.left = true;
      else if (action === 'right') ClientState.touchInput.right = true;
      else if (action === 'jump') ClientState.touchInput.jump = true;
      else if (action === 'attack') sc._normalAttack();
      else if (action === 'wave') sc._shootWave();
      else if (action === 'dash') sc._flashDash();
      else if (action === 'awaken') sc._activateAwakening();
    };

    const onRelease = (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      if (action === 'left') ClientState.touchInput.left = false;
      else if (action === 'right') ClientState.touchInput.right = false;
      else if (action === 'jump') ClientState.touchInput.jump = false;
    };

    btn.addEventListener('pointerdown', onPress);
    btn.addEventListener('pointerup', onRelease);
    btn.addEventListener('pointerleave', onRelease);
    btn.addEventListener('pointercancel', onRelease);
  });
});

function renderInventoryGrid() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.values(ClientState.swordCatalog).forEach((sw) => {
    const unlocked = ClientState.unlockedSwords.includes(sw.id);
    const isEq = ClientState.equippedSword === sw.id;

    const card = document.createElement('div');
    card.className = 'sword-item' + (isEq ? ' equipped' : '');
    if (!unlocked) card.style.opacity = '0.45';

    const info = document.createElement('div');
    info.className = 'sword-info';

    const title = document.createElement('h4');
    title.style.color = sw.rarityColor;
    title.textContent = `[${sw.rarity}] ${sw.name}`;

    const desc = document.createElement('p');
    desc.textContent = `พลังโจมตี +${Math.round(sw.atkBonus * 100)}%`;

    info.appendChild(title);
    info.appendChild(desc);

    const btn = document.createElement('button');
    btn.className = 'equip-btn' + (isEq ? ' active' : '');
    if (!unlocked) {
      btn.textContent = '🔒 ยังไม่ปลดล็อก';
      btn.disabled = true;
    } else if (isEq) {
      btn.textContent = '✓ สวมใส่อยู่';
    } else {
      btn.textContent = 'สวมใส่';
      btn.addEventListener('click', () => {
        socket.emit('equipSword', { swordId: sw.id });
      });
    }

    card.appendChild(info);
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

function appendChatMessage(data) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const line = document.createElement('div');
  line.className = 'chat-line' + (data.system ? ' system' : '');

  if (data.system) {
    line.textContent = data.text;
  } else {
    const badge = document.createElement('span');
    badge.style.color = data.color || '#66ccff';
    badge.style.fontWeight = 'bold';
    badge.textContent = `[LV.${data.level || 1}] ${data.name}: `;
    const msgSpan = document.createElement('span');
    msgSpan.style.color = '#eef6ff';
    msgSpan.textContent = data.text;
    line.appendChild(badge);
    line.appendChild(msgSpan);
  }

  box.appendChild(line);
  while (box.children.length > 40) {
    box.removeChild(box.firstChild);
  }
  box.scrollTop = box.scrollHeight;
}

function updateOnlinePlayersDOM(players, selfId) {
  const list = document.getElementById('online-list');
  const count = document.getElementById('online-count');
  if (!list || !count) return;

  count.textContent = String(players.length);
  list.innerHTML = '';

  players
    .slice()
    .sort((a, b) => b.level - a.level)
    .forEach((p) => {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'player-dot';
      dot.style.background = p.color || '#00aaff';
      dot.style.boxShadow = `0 0 6px ${p.color || '#00aaff'}`;

      const label = document.createElement('span');
      const isMe = p.id === selfId ? ' (You)' : '';
      label.textContent = `[LV.${p.level || 1}] ${p.name}${isMe}`;
      if (p.isAwakened) label.style.color = '#ff6644';

      li.appendChild(dot);
      li.appendChild(label);
      list.appendChild(li);
    });
}

// ─── BOOT SCENE ──────────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this._makePlayerTextures();
    this._makeWaveTextures();
    this._makeHollowTextures();
    this._makePlatformTextures();
    this._makeParticleTextures();
    this._makeOrbTextures();
  }

  _makePlayerTextures() {
    // Upgraded Soul Hunter character texture
    const pg = this.make.graphics({ x: 0, y: 0, add: false });
    // Inner white collar & dark battle haori coat
    pg.fillStyle(0xffffff); pg.fillRect(12, 20, 16, 12);
    pg.fillStyle(0x181c2b); pg.fillRect(8, 22, 24, 38);
    // Haori white trim lines
    pg.lineStyle(1.5, 0xaaccff, 0.8);
    pg.lineBetween(12, 22, 12, 58);
    pg.lineBetween(28, 22, 28, 58);
    // Head & face
    pg.fillStyle(0xffcc99); pg.fillCircle(20, 14, 11);
    // Spiky anime hair
    pg.fillStyle(0x1c1c28);
    pg.fillRect(9, 2, 22, 11);
    pg.fillTriangle(8, 12, 12, 2, 16, 12);
    pg.fillTriangle(24, 12, 28, 2, 33, 12);
    // Eyes
    pg.fillStyle(0x00ccff); pg.fillRect(14, 12, 4, 3); pg.fillRect(22, 12, 4, 3);
    // Boots
    pg.fillStyle(0x11111a); pg.fillRect(9, 59, 9, 7); pg.fillRect(22, 59, 9, 7);
    pg.generateTexture('player_normal', 40, 68);
    pg.destroy();

    // Awakened Mode Player
    const bg = this.make.graphics({ x: 0, y: 0, add: false });
    bg.fillStyle(0x330008); bg.fillRect(8, 22, 24, 38);
    bg.lineStyle(1.5, 0xff2244, 0.9);
    bg.lineBetween(12, 22, 12, 58);
    bg.lineBetween(28, 22, 28, 58);
    bg.fillStyle(0xffcc99); bg.fillCircle(20, 14, 11);
    bg.fillStyle(0x150005); bg.fillRect(9, 2, 22, 11);
    bg.fillStyle(0xff1122); bg.fillRect(14, 12, 4, 3); bg.fillRect(22, 12, 4, 3);
    bg.fillStyle(0x220000); bg.fillRect(9, 59, 9, 7); bg.fillRect(22, 59, 9, 7);
    bg.generateTexture('player_awakened', 40, 68);
    bg.destroy();

    const hpg = this.make.graphics({ x: 0, y: 0, add: false });
    hpg.fillStyle(0xffffff); hpg.fillRect(0, 0, 40, 68);
    hpg.generateTexture('player_hit', 40, 68);
    hpg.destroy();

    const sg = this.make.graphics({ x: 0, y: 0, add: false });
    sg.fillStyle(0x88aaff, 0.4); sg.fillRect(0, 0, 40, 68);
    sg.generateTexture('shunpo_ghost', 40, 68);
    sg.destroy();
  }

  _makeWaveTextures() {
    const wg = this.make.graphics({ x: 0, y: 0, add: false });
    wg.fillStyle(0xffffff, 0.95); wg.fillEllipse(30, 20, 60, 40);
    wg.fillStyle(0x000020, 1);    wg.fillEllipse(38, 20, 44, 28);
    wg.generateTexture('wave_base', 60, 40);
    wg.destroy();

    const lwg = this.make.graphics({ x: 0, y: 0, add: false });
    lwg.fillStyle(0x140024, 0.96); lwg.fillEllipse(30, 20, 60, 40);
    lwg.fillStyle(0x000000, 1);    lwg.fillEllipse(38, 20, 44, 28);
    lwg.lineStyle(3, 0xcc00ff, 1); lwg.strokeEllipse(30, 20, 60, 40);
    lwg.lineStyle(1, 0xff2255, 1); lwg.strokeEllipse(28, 20, 56, 36);
    lwg.generateTexture('wave_legendary', 60, 40);
    lwg.destroy();

    const bwg = this.make.graphics({ x: 0, y: 0, add: false });
    bwg.fillStyle(0x220000, 0.95); bwg.fillEllipse(30, 20, 60, 40);
    bwg.fillStyle(0x000000, 1);    bwg.fillEllipse(38, 20, 44, 28);
    bwg.lineStyle(2, 0xff2200, 1); bwg.strokeEllipse(30, 20, 60, 40);
    bwg.generateTexture('wave_awakened', 60, 40);
    bwg.destroy();
  }

  _makeHollowTextures() {
    // 1. Normal Hollow
    const ng = this.make.graphics({ x: 0, y: 0, add: false });
    ng.fillStyle(0x2a0040); ng.fillRect(6, 22, 24, 32);
    ng.fillStyle(0x1a0030); ng.fillRect(0, 24, 8, 24); ng.fillRect(28, 24, 8, 24);
    ng.fillStyle(0x9966cc); ng.fillRect(0, 46, 4, 8); ng.fillRect(4, 48, 4, 6);
    ng.fillRect(28, 46, 4, 8); ng.fillRect(32, 48, 4, 6);
    ng.fillStyle(0x200030); ng.fillRect(8, 52, 8, 16); ng.fillRect(20, 52, 8, 16);
    ng.fillStyle(0x1a0030); ng.fillCircle(18, 16, 14);
    ng.fillStyle(0xffffff); ng.fillEllipse(18, 14, 22, 20);
    ng.fillStyle(0x000000); ng.fillEllipse(12, 13, 6, 7); ng.fillEllipse(24, 13, 6, 7);
    ng.lineStyle(1, 0xcc9900, 0.8);
    ng.lineBetween(18, 4, 18, 24); ng.lineBetween(8, 14, 28, 14);
    ng.generateTexture('hollow_normal', 36, 72);
    ng.destroy();

    const nhg = this.make.graphics({ x: 0, y: 0, add: false });
    nhg.fillStyle(0xff4488); nhg.fillRect(0, 0, 36, 72);
    nhg.generateTexture('hollow_normal_hit', 36, 72);
    nhg.destroy();

    // 2. Menos Grande
    const mg = this.make.graphics({ x: 0, y: 0, add: false });
    mg.fillStyle(0x0a0015); mg.fillRect(8, 32, 38, 52);
    mg.fillStyle(0x0d001a); mg.fillRect(0, 36, 10, 40); mg.fillRect(44, 36, 10, 40);
    mg.fillStyle(0x08000f); mg.fillRect(10, 80, 14, 22); mg.fillRect(30, 80, 14, 22);
    mg.fillStyle(0x08000f); mg.fillCircle(27, 20, 20);
    mg.fillStyle(0xffffff); mg.fillEllipse(27, 18, 34, 30);
    mg.fillStyle(0x000000); mg.fillEllipse(18, 16, 10, 12); mg.fillEllipse(36, 16, 10, 12);
    mg.fillStyle(0xff0000, 0.7); mg.fillEllipse(18, 16, 5, 6); mg.fillEllipse(36, 16, 5, 6);
    mg.lineStyle(2, 0xcc6600, 0.9);
    mg.lineBetween(27, 2, 27, 34); mg.lineBetween(10, 18, 44, 18);
    mg.generateTexture('hollow_menos', 54, 108);
    mg.destroy();

    const mhg = this.make.graphics({ x: 0, y: 0, add: false });
    mhg.fillStyle(0xff2255); mhg.fillRect(0, 0, 54, 108);
    mhg.generateTexture('hollow_menos_hit', 54, 108);
    mhg.destroy();

    // 3. WORLD BOSS: OVERLORD HOLLOW (Horned Demon Mask + Abyssal Cloak)
    const bg = this.make.graphics({ x: 0, y: 0, add: false });
    // Tattered dark-crimson abyssal cloak
    bg.fillStyle(0x12001c);
    bg.fillTriangle(45, 28, 6, 134, 84, 134);
    bg.lineStyle(2, 0xaa0044, 0.85);
    bg.strokeTriangle(45, 28, 6, 134, 84, 134);
    // Core chest cavity (Hollow Hole glowing crimson-purple)
    bg.fillStyle(0x000000); bg.fillCircle(45, 72, 13);
    bg.lineStyle(2.5, 0xff0055, 0.95); bg.strokeCircle(45, 72, 13);
    bg.fillStyle(0xcc00ff, 0.7); bg.fillCircle(45, 72, 6);
    // Twin curved demon horns
    bg.fillStyle(0xeeeeee);
    bg.fillTriangle(26, 26, 4, 2, 34, 18);
    bg.fillTriangle(64, 26, 86, 2, 56, 18);
    // Demon skull mask
    bg.fillStyle(0xffffff);
    bg.fillEllipse(45, 30, 42, 34);
    // Crimson stripes on mask
    bg.lineStyle(2.5, 0xd90429, 0.95);
    bg.lineBetween(32, 16, 36, 42);
    bg.lineBetween(58, 16, 54, 42);
    // Glowing eyes
    bg.fillStyle(0x000000); bg.fillEllipse(35, 28, 11, 9); bg.fillEllipse(55, 28, 11, 9);
    bg.fillStyle(0xff0033); bg.fillCircle(35, 28, 4); bg.fillCircle(55, 28, 4);
    bg.generateTexture('hollow_overlord', 90, 140);
    bg.destroy();

    const bhg = this.make.graphics({ x: 0, y: 0, add: false });
    bhg.fillStyle(0xff1144); bhg.fillRect(6, 4, 78, 132);
    bhg.generateTexture('hollow_overlord_hit', 90, 140);
    bhg.destroy();
  }

  _makePlatformTextures() {
    const mg = this.make.graphics({ x: 0, y: 0, add: false });
    mg.fillStyle(0x1a1a2e); mg.fillRect(0, 0, 32, 32);
    mg.lineStyle(1, 0x2a2a4e, 1); mg.strokeRect(0, 0, 32, 32);
    mg.lineStyle(1, 0x003366, 0.8); mg.lineBetween(0, 0, 32, 0);
    mg.generateTexture('ground', 32, 32);
    mg.destroy();

    const fp = this.make.graphics({ x: 0, y: 0, add: false });
    fp.fillStyle(0x0d0d1f); fp.fillRect(0, 8, 160, 24);
    fp.fillStyle(0x1a1a3e); fp.fillRect(0, 8, 160, 8);
    fp.lineStyle(1, 0x0033aa, 0.5); fp.lineBetween(0, 8, 160, 8);
    fp.generateTexture('platform', 160, 32);
    fp.destroy();
  }

  _makeParticleTextures() {
    const pg = this.make.graphics({ x: 0, y: 0, add: false });
    pg.fillStyle(0xffffff, 1); pg.fillCircle(4, 4, 4);
    pg.generateTexture('particle', 8, 8);
    pg.destroy();
  }

  _makeOrbTextures() {
    const hg = this.make.graphics({ x: 0, y: 0, add: false });
    hg.fillStyle(0x00ff44, 0.9); hg.fillCircle(10, 10, 10);
    hg.fillStyle(0xaaffcc, 0.7); hg.fillCircle(7, 7, 4);
    hg.lineStyle(2, 0x00aa22, 1); hg.strokeCircle(10, 10, 10);
    hg.generateTexture('orb_hp', 20, 20);
    hg.destroy();

    const rg = this.make.graphics({ x: 0, y: 0, add: false });
    rg.fillStyle(0x0088ff, 0.9); rg.fillCircle(10, 10, 10);
    rg.fillStyle(0xaaddff, 0.7); rg.fillCircle(7, 7, 4);
    rg.lineStyle(2, 0x0055cc, 1); rg.strokeCircle(10, 10, 10);
    rg.generateTexture('orb_sp', 20, 20);
    rg.destroy();
  }

  create() {
    this.scene.start('GameScene');
  }
}

// ─── GAME SCENE ──────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    ClientState.activeScene = this;

    // ── Local RPG State ──────────────────────────────────────
    this.selfId = socket.id || null;
    this.playerLevel = 1;
    this.playerEXP = 0;
    this.playerCoins = 0;
    this.expToNext = expForLevel(1);
    this.currentSword = {
      id: 'steel_blade',
      name: 'ดาบเหล็กกล้า',
      rarity: 'Common',
      atkBonus: 0,
      bladeColor: '#dddddd',
      waveColor: '#0088ff',
    };
    this._calcStats();

    this.playerHP = this.statHPMax;
    this.playerSP = PLAYER_BASE.SP_MAX;

    this.isAwakened = false;
    this.awakenInterval = null;
    this.comboCount = 0;
    this.comboResetTimer = null;
    this.lastSlashTime = 0;
    this.lastDashTime = 0;
    this.facingRight = true;
    this.isOnGround = false;
    this.wasOnGround = true;
    this.isDead = false;
    this.isHitFlashing = false;
    this.lastNetSync = 0;

    // Sword swing animation state
    this.swingPhase = 0;
    this.lastDustTime = 0;

    // ── Multiplayer Entities ─────────────────────────────────
    this.remotePlayers = {};
    this.hollowMap = {};
    this.orbMap = {};

    // ── Build World ──────────────────────────────────────────
    this._createBackground();
    this._createPlatforms();
    this._createPlayer();
    this._createProjectiles();
    this._createParticles();
    this._createUI();
    this._createInputs();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this._regenSP,
      callbackScope: this,
    });

    this.physics.add.collider(this.player, this.platforms);

    this._bindSocketEvents();
  }

  _calcStats() {
    const lv = this.playerLevel - 1;
    const swordBonus = this.currentSword ? this.currentSword.atkBonus || 0 : 0;
    this.statHPMax = PLAYER_BASE.HP_MAX + PLAYER_BASE.HP_PER_LEVEL * lv;
    this.statAtkMult = (1 + PLAYER_BASE.ATK_SCALE * lv) * (1 + swordBonus);
    this.statSpeed = PLAYER_BASE.SPEED;
  }

  // ══════════════════════════════════════════════════════════
  //  SOCKET.IO MULTIPLAYER, WORLD BOSS & ACCOUNT SYNC
  // ══════════════════════════════════════════════════════════
  connectMultiplayer() {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('loginAndJoin', {
      username: ClientState.username,
      pin: ClientState.pin,
      roomId: ClientState.roomId,
      color: ClientState.playerColor,
    });
  }

  _bindSocketEvents() {
    socket.removeAllListeners();

    socket.on('authError', ({ message }) => {
      const authErr = document.getElementById('auth-error');
      if (authErr) authErr.textContent = message;
    });

    socket.on('roomJoined', ({ selfId, authStatus, roomId, account, swordCatalog, players, hollows, orbs }) => {
      this.selfId = selfId;
      ClientState.joined = true;
      ClientState.swordCatalog = swordCatalog || {};
      ClientState.unlockedSwords = account.unlockedSwords || ['steel_blade'];
      ClientState.equippedSword = account.equippedSword || 'steel_blade';
      ClientState.playerColor = account.equippedAura || ClientState.playerColor;
      ClientState.coins = account.coins || 0;
      ClientState.gachaTickets = account.gachaTickets || 0;

      document.getElementById('lobby-overlay').classList.add('hidden');
      document.getElementById('online-panel').style.display = 'block';
      document.getElementById('chat-box').style.display = 'flex';
      document.getElementById('open-shop-btn').style.display = 'inline-block';
      document.getElementById('toggle-touch-btn').style.display = 'inline-block';
      document.getElementById('room-badge').textContent = `ROOM: ${roomId}`;

      this.playerLevel = account.level || 1;
      this.playerEXP = account.exp || 0;
      this.expToNext = expForLevel(this.playerLevel);
      this.playerCoins = account.coins || 0;
      this.currentSword = swordCatalog[account.equippedSword] || this.currentSword;

      this._calcStats();
      this.playerHP = this.statHPMax;
      this.selfColorInt = Phaser.Display.Color.HexStringToColor(ClientState.playerColor).color;

      this._updateSelfNameTag();
      this._drawBars();
      this._updateCoinsUI();

      if (authStatus === 'loaded') {
        this._spawnPopup(this.player.x, this.player.y - 75, `โหลดข้อมูลสำเร็จ! (LV.${this.playerLevel})`, '#44ffaa', '15px');
      } else {
        this._spawnPopup(this.player.x, this.player.y - 75, 'สร้างบัญชีใหม่ +200 Coins +1 ตั๋วกาชา!', '#ffdd44', '15px');
      }

      Object.values(players).forEach((p) => {
        if (p.id !== selfId) this._addOrUpdateRemotePlayer(p);
      });
      hollows.forEach((h) => this._createOrUpdateHollow(h));
      orbs.forEach((o) => this._spawnServerOrb(o));

      updateOnlinePlayersDOM(Object.values(players), this.selfId);
      this._updateHollowCounter();
    });

    socket.on('rewardGranted', ({ expAdded, coinsAdded, ticketsAdded, isBossReward, level, exp, coins, gachaTickets, leveledUp }) => {
      this.playerEXP = exp;
      this.playerCoins = coins;
      ClientState.coins = coins;
      if (typeof gachaTickets === 'number') {
        ClientState.gachaTickets = gachaTickets;
      }

      sfx.playCoinOrb();
      const ticketTxt = ticketsAdded > 0 ? `  +${ticketsAdded} 🎟ตั๋วกาชา!` : '';
      this._spawnPopup(
        this.player.x,
        this.player.y - 78,
        `+${expAdded} EXP  +${coinsAdded} 🪙${ticketTxt}`,
        isBossReward ? '#ff66aa' : '#ffdd44',
        isBossReward ? '17px' : '14px'
      );

      if (leveledUp || level > this.playerLevel) {
        this.playerLevel = level;
        this.expToNext = expForLevel(this.playerLevel);
        this._calcStats();
        this.playerHP = this.statHPMax;
        this.playerSP = PLAYER_BASE.SP_MAX;
        this._playLevelUpEffect();
      } else {
        this.expToNext = expForLevel(this.playerLevel);
      }

      this._updateSelfNameTag();
      this._drawBars();
      this._updateCoinsUI();
    });

    socket.on('gachaResult', (res) => {
      const box = document.getElementById('gacha-result-box');
      if (!box) return;
      box.classList.remove('gacha-pop');
      void box.offsetWidth;
      box.classList.add('gacha-pop');

      if (!res.success) {
        box.innerHTML = `<span style="color:#ff5566; font-weight:bold;">${res.message}</span>`;
        return;
      }

      this.playerCoins = res.coins;
      ClientState.coins = res.coins;
      if (typeof res.gachaTickets === 'number') {
        ClientState.gachaTickets = res.gachaTickets;
      }
      ClientState.unlockedSwords = res.unlockedSwords;
      this._updateCoinsUI();

      const sw = res.sword;
      sfx.playGacha(sw.rarity);

      const badge = res.isNew
        ? '<span style="background:#118844;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px;margin-left:6px;">NEW!</span>'
        : '<span style="color:#8899aa;font-size:10px;margin-left:6px;">(มีแล้ว)</span>';

      box.innerHTML = `
        <div style="font-size:15px; font-weight:900; color:${sw.rarityColor};">
          ★ [${sw.rarity}] ${sw.name} ★ ${badge}
        </div>
        <div style="font-size:11px; color:#cce6ff; margin-top:4px;">
          พลังโจมตี +${Math.round(sw.atkBonus * 100)}% (ไปที่แท็บ "คลังอาวุธ" เพื่อกดสวมใส่)
        </div>
      `;
    });

    socket.on('equipConfirmed', ({ equippedSword, swordData }) => {
      ClientState.equippedSword = equippedSword;
      this.currentSword = swordData;
      this._calcStats();
      this._drawBars();
      renderInventoryGrid();
      sfx.playSlash(2);
      this._spawnPopup(this.player.x, this.player.y - 65, `สวมใส่: ${swordData.name}`, swordData.rarityColor, '14px');
    });

    socket.on('playerEquipmentChanged', ({ id, equippedSword, swordData }) => {
      if (id === this.selfId) return;
      const rp = this.remotePlayers[id];
      if (rp) {
        rp.equippedSword = equippedSword;
        rp.swordData = swordData;
      }
    });

    socket.on('redeemResult', (res) => {
      const msgEl = document.getElementById('redeem-msg');
      if (msgEl) {
        msgEl.style.color = res.success ? '#44ff88' : '#ff5566';
        msgEl.textContent = res.message;
      }
      if (res.success) {
        sfx.playLevelUp();
        this.playerCoins = res.coins;
        ClientState.coins = res.coins;
        if (typeof res.gachaTickets === 'number') {
          ClientState.gachaTickets = res.gachaTickets;
        }
        this._updateCoinsUI();
        document.getElementById('redeem-input').value = '';
        this._spawnPopup(this.player.x, this.player.y - 70, `+${res.addedCoins} Soul Coins!`, '#ffdd44');
      }
    });

    socket.on('playerJoined', (p) => {
      if (p.id !== this.selfId) this._addOrUpdateRemotePlayer(p);
    });

    socket.on('playerMoved', (p) => {
      if (p.id === this.selfId) return;
      this._addOrUpdateRemotePlayer(p);
    });

    socket.on('playerLeft', (playerId) => {
      this._removeRemotePlayer(playerId);
    });

    socket.on('playerListUpdate', (list) => {
      updateOnlinePlayersDOM(list, this.selfId);
    });

    socket.on('remotePlayerAction', (act) => {
      if (act.id === this.selfId) return;
      this._playRemoteAction(act);
    });

    // ── WORLD BOSS EVENTS ────────────────────────────────────
    socket.on('bossWarning', ({ title, subtitle }) => {
      sfx.playBossSiren();
      this.cameras.main.shake(600, 0.008);
      const banner = document.getElementById('boss-warning-banner');
      const tEl = document.getElementById('warn-title-text');
      const sEl = document.getElementById('warn-sub-text');
      if (tEl && title) tEl.textContent = `⚠ ${title} ⚠`;
      if (sEl && subtitle) sEl.textContent = subtitle;
      if (banner) {
        banner.style.display = 'block';
        setTimeout(() => { banner.style.display = 'none'; }, 3200);
      }
    });

    socket.on('bossCeroTelegraph', ({ x, y, dir }) => {
      sfx.playCeroCharge();
      const warnG = this.add.graphics().setDepth(14);
      const endX = dir > 0 ? GAME_W : 0;

      // Dashed / glowing red warning line for 1 second
      warnG.lineStyle(3, 0xff1133, 0.95);
      warnG.lineBetween(x, y, endX, y);
      warnG.fillStyle(0xff0022, 0.18);
      warnG.fillRect(Math.min(x, endX), y - 22, Math.abs(endX - x), 44);

      const warnTxt = this.add
        .text(GAME_W / 2, y - 30, '⚠ CERO BEAM INCOMING — JUMP OR DASH! ⚠', {
          fontSize: '13px',
          fill: '#ff3355',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setDepth(15)
        .setOrigin(0.5, 0.5);

      this.tweens.add({
        targets: [warnG, warnTxt],
        alpha: 0.25,
        duration: 160,
        yoyo: true,
        repeat: 4,
        onComplete: () => {
          warnG.destroy();
          warnTxt.destroy();
        },
      });
    });

    socket.on('bossCeroFire', ({ x, y, dir, dmg }) => {
      sfx.playCeroFire();
      this.cameras.main.shake(320, 0.012);

      const endX = dir > 0 ? GAME_W : 0;
      const beamX = Math.min(x, endX);
      const beamW = Math.abs(endX - x);

      const beamG = this.add.graphics().setDepth(15);
      // Outer purple-crimson energy
      beamG.fillStyle(0x8800ff, 0.85);
      beamG.fillRect(beamX, y - 26, beamW, 52);
      // Inner dark-red core
      beamG.fillStyle(0xff0055, 0.95);
      beamG.fillRect(beamX, y - 14, beamW, 28);
      // White hot center line
      beamG.fillStyle(0xffffff, 0.95);
      beamG.fillRect(beamX, y - 5, beamW, 10);

      this.tweens.add({
        targets: beamG,
        alpha: 0,
        scaleY: 0.2,
        duration: 480,
        onComplete: () => beamG.destroy(),
      });

      // Check if local player is in the horizontal beam path
      if (!this.isDead) {
        const inHorizontalSide = dir > 0 ? this.player.x >= x - 15 : this.player.x <= x + 15;
        const inVerticalBand = Math.abs(this.player.y - y) <= 38;
        if (inHorizontalSide && inVerticalBand) {
          this._damagePlayer(dmg || 45);
          this.player.setVelocityX(dir * 380);
          this.player.setVelocityY(-240);
        }
      }
    });

    socket.on('bossDash', ({ fromX, toX, y, dmg }) => {
      sfx.playDash();
      for (let i = 0; i < 5; i++) {
        const gx = Phaser.Math.Linear(fromX, toX, i / 5);
        const ghost = this.add.image(gx, y, 'hollow_overlord').setDepth(4.5).setAlpha(0.45).setTint(0xff0055);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 350, onComplete: () => ghost.destroy() });
      }

      if (!this.isDead) {
        const minX = Math.min(fromX, toX) - 30;
        const maxX = Math.max(fromX, toX) + 30;
        if (this.player.x >= minX && this.player.x <= maxX && Math.abs(this.player.y - y) < 65) {
          this._damagePlayer(dmg || 32);
          this.player.setVelocityY(-220);
        }
      }
    });

    socket.on('hollowSpawned', (h) => {
      this._createOrUpdateHollow(h, true);
      this._updateHollowCounter();
    });

    socket.on('hollowsSync', (hollowList) => {
      const seen = new Set();
      hollowList.forEach((h) => {
        seen.add(h.id);
        this._createOrUpdateHollow(h, false);
      });
      Object.keys(this.hollowMap).forEach((id) => {
        if (!seen.has(id)) this._destroyHollowVisual(id);
      });
      this._updateHollowCounter();
      this._updateBossHUD();
    });

    socket.on('hollowDamaged', ({ id, hp, hpMax, dmg }) => {
      const h = this.hollowMap[id];
      if (!h) return;
      h.hp = hp;
      h.hpMax = hpMax;

      sfx.playHit();
      this._spawnPopup(h.sprite.x, h.sprite.y - 40, `-${dmg}`, '#ffcc66');
      h.sprite.setTexture(h.hitKey);
      if (h.flashTimer) clearTimeout(h.flashTimer);
      h.flashTimer = setTimeout(() => {
        if (h.sprite && h.sprite.active) h.sprite.setTexture(h.normalKey);
      }, 95);
      this._drawHollowHP(h);
      if (h.type === 'overlord') this._updateBossHUD();
    });

    socket.on('hollowKilled', ({ id, isBoss, x, y, droppedOrb }) => {
      const h = this.hollowMap[id];
      const hx = h ? h.sprite.x : x;
      const hy = h ? h.sprite.y : y;

      this.waveParticles.setParticleTint(isBoss ? 0xff0055 : 0x9900ff);
      this.waveParticles.explode(isBoss ? 50 : 20, hx, hy);
      this.waveParticles.setParticleTint(0xffffff);
      this.waveParticles.explode(isBoss ? 30 : 10, hx, hy - 20);
      this._spawnPopup(hx, hy - 55, isBoss ? '★ OVERLORD VANQUISHED! ★' : 'PURIFIED!', isBoss ? '#ffdd00' : '#cc88ff');

      if (isBoss) {
        this.cameras.main.flash(500, 255, 200, 50);
        this.cameras.main.shake(400, 0.012);
      }

      this._destroyHollowVisual(id);
      this._updateHollowCounter();
      this._updateBossHUD();

      if (droppedOrb) {
        this._spawnServerOrb(droppedOrb);
      }
    });

    socket.on('hollowAttack', ({ targetId, dmg, hollowX }) => {
      if (targetId === this.selfId && !this.isDead) {
        this._damagePlayer(dmg);
        const dir = this.player.x >= hollowX ? 1 : -1;
        this.player.setVelocityX(dir * 280);
        this.player.setVelocityY(-180);
      }
    });

    socket.on('orbPickedUp', ({ orbId, playerId, isHP, x, y }) => {
      const orb = this.orbMap[orbId];
      if (orb) {
        orb.destroy();
        delete this.orbMap[orbId];
      }
      this.slashParticles.setParticleTint(isHP ? 0x44ff88 : 0x44aaff);
      this.slashParticles.explode(10, x, y);

      if (playerId === this.selfId && !this.isDead) {
        sfx.playCoinOrb();
        if (isHP) {
          this.playerHP = Math.min(this.statHPMax, this.playerHP + 30);
          this._spawnPopup(x, y - 30, '+30 HP', '#44ff88');
        } else {
          this.playerSP = Math.min(PLAYER_BASE.SP_MAX, this.playerSP + 40);
          this._spawnPopup(x, y - 30, '+40 SP', '#44aaff');
        }
        this._drawBars();
      }
    });

    socket.on('chatMessage', (data) => {
      appendChatMessage(data);
      if (!data.system && data.id) {
        if (data.id === this.selfId) {
          this._showChatBubble(this, data.text);
        } else if (this.remotePlayers[data.id]) {
          this._showChatBubble(this.remotePlayers[data.id], data.text);
        }
      }
    });
  }

  _updateBossHUD() {
    const bossHud = document.getElementById('boss-hud');
    const fillEl = document.getElementById('boss-bar-fill');
    const txtEl = document.getElementById('boss-hp-text');
    if (!bossHud || !fillEl || !txtEl) return;

    const boss = Object.values(this.hollowMap).find((h) => h.type === 'overlord' && h.hp > 0);
    if (!boss) {
      bossHud.classList.remove('active');
      return;
    }

    bossHud.classList.add('active');
    const pct = Math.max(0, Math.min(100, (boss.hp / boss.hpMax) * 100));
    fillEl.style.width = `${pct}%`;
    txtEl.textContent = `${boss.hp} / ${boss.hpMax}`;
  }

  _updateCoinsUI() {
    if (this.coinsText) {
      this.coinsText.setText(`🪙 Coins: ${this.playerCoins}  |  🎟 ${ClientState.gachaTickets}`);
    }
    if (this.swordText && this.currentSword) {
      this.swordText.setText(`🗡 ${this.currentSword.name}`);
      this.swordText.setColor(this.currentSword.rarityColor || '#cccccc');
    }
    updateGachaButtonLabels();
  }

  // ── Remote Players Management ──────────────────────────────
  _addOrUpdateRemotePlayer(p) {
    let rp = this.remotePlayers[p.id];
    if (!rp) {
      const sprite = this.add.sprite(p.x, p.y, p.isAwakened ? 'player_awakened' : 'player_normal');
      sprite.setDepth(4.8);

      const sashGraphic = this.add.graphics().setDepth(4.9);
      const awakenAura = this.add.graphics().setDepth(4.7);
      const slashGraphic = this.add.graphics().setDepth(5.8);

      const nameTag = this.add
        .text(p.x, p.y - 46, `[LV.${p.level || 1}] ${p.name || 'Hunter'}`, {
          fontSize: '11px',
          fill: p.color || '#00aaff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setDepth(9)
        .setOrigin(0.5, 1);

      rp = {
        id: p.id,
        name: p.name || 'Hunter',
        color: p.color || '#00aaff',
        colorInt: Phaser.Display.Color.HexStringToColor(p.color || '#00aaff').color,
        sprite,
        sashGraphic,
        awakenAura,
        slashGraphic,
        nameTag,
        chatBubble: null,
        targetX: p.x,
        targetY: p.y,
        facingRight: p.facingRight ?? true,
        level: p.level || 1,
        equippedSword: p.equippedSword || 'steel_blade',
        swordData: p.swordData || null,
        isAwakened: !!p.isAwakened,
        isDead: !!p.isDead,
        swingPhase: 0,
      };
      this.remotePlayers[p.id] = rp;
    } else {
      rp.targetX = p.x;
      rp.targetY = p.y;
      rp.facingRight = p.facingRight ?? rp.facingRight;
      if (p.level) rp.level = p.level;
      if (p.swordData) rp.swordData = p.swordData;
      if (p.isAwakened !== undefined && rp.isAwakened !== p.isAwakened) {
        rp.isAwakened = p.isAwakened;
        rp.sprite.setTexture(rp.isAwakened ? 'player_awakened' : 'player_normal');
        if (!rp.isAwakened) rp.awakenAura.clear();
      }
      if (p.isDead !== undefined) {
        rp.isDead = p.isDead;
        rp.sprite.setAlpha(rp.isDead ? 0.35 : 1);
      }
      rp.nameTag.setText(`[LV.${rp.level}] ${rp.name}`);
    }
  }

  _removeRemotePlayer(id) {
    const rp = this.remotePlayers[id];
    if (!rp) return;
    rp.sprite.destroy();
    rp.sashGraphic.destroy();
    rp.awakenAura.destroy();
    rp.slashGraphic.destroy();
    rp.nameTag.destroy();
    if (rp.chatBubble) rp.chatBubble.destroy();
    delete this.remotePlayers[id];
  }

  _playRemoteAction(act) {
    const rp = this.remotePlayers[act.id];
    if (!rp) return;

    const sw = act.swordData || rp.swordData;
    const waveColInt = sw && sw.waveColor
      ? Phaser.Display.Color.HexStringToColor(sw.waveColor).color
      : rp.colorInt;

    if (act.type === 'slash') {
      rp.swingPhase = 1.0;
      const sg = rp.slashGraphic;
      const px = rp.sprite.x;
      const py = rp.sprite.y;
      const dir = act.facingRight ? 1 : -1;
      const isFinisher = act.isFinal;

      const strokeCol = rp.isAwakened ? 0xff2200 : waveColInt;
      this._drawMultiLayerSlashTrail(sg, px, py, dir, strokeCol, isFinisher);

      this.slashParticles.setParticleTint(strokeCol);
      this.slashParticles.explode(isFinisher ? 14 : 6, px + dir * 45, py);
      this.time.delayedCall(isFinisher ? 180 : 120, () => sg.clear());
    } else if (act.type === 'wave') {
      const isLeg = sw && sw.id === 'eclipse_blade';
      const texKey = act.isAwakened
        ? 'wave_awakened'
        : isLeg
        ? 'wave_legendary'
        : 'wave_base';
      const dir = act.facingRight ? 1 : -1;
      const spd = act.isAwakened ? 650 : 480;
      const wave = this.waveGroup.create(act.x + dir * 30, act.y, texKey);
      wave.setDepth(5.8);
      wave.body.setAllowGravity(false);
      wave.setVelocityX(spd * dir);
      wave.setFlipX(!act.facingRight);
      wave._isRemote = true;
      if (texKey === 'wave_base') {
        wave.setTint(waveColInt);
      }
      this.time.delayedCall(2500, () => {
        if (wave && wave.active) wave.destroy();
      });
    } else if (act.type === 'dash') {
      for (let i = 0; i < 4; i++) {
        this.time.delayedCall(i * 30, () => {
          const g = this.add.image(act.fromX, act.fromY, 'shunpo_ghost');
          g.setDepth(4).setFlipX(!act.facingRight).setTint(rp.colorInt);
          this.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: () => g.destroy() });
        });
      }
      this.slashParticles.setParticleTint(rp.colorInt);
      this.slashParticles.explode(10, act.toX, act.toY);
    } else if (act.type === 'awakening') {
      rp.isAwakened = !!act.active;
      rp.sprite.setTexture(rp.isAwakened ? 'player_awakened' : 'player_normal');
      if (rp.isAwakened) {
        this._spawnPopup(rp.sprite.x, rp.sprite.y - 65, '★ SOUL AWAKENING ★', '#ff4400');
      } else {
        rp.awakenAura.clear();
      }
    } else if (act.type === 'levelUp') {
      rp.level = act.level;
      rp.nameTag.setText(`[LV.${rp.level}] ${rp.name}`);
      this.goldParticles.explode(35, rp.sprite.x, rp.sprite.y);
      this._spawnPopup(rp.sprite.x, rp.sprite.y - 65, `LEVEL UP! LV.${rp.level}`, '#ffdd00');
    }
  }

  _showChatBubble(targetObj, text) {
    const isSelf = targetObj === this;
    const prev = isSelf ? this.selfChatBubble : targetObj.chatBubble;
    if (prev) prev.destroy();

    const sx = isSelf ? this.player.x : targetObj.sprite.x;
    const sy = isSelf ? this.player.y : targetObj.sprite.y;

    const bubble = this.add
      .text(sx, sy - 66, text, {
        fontSize: '11px',
        fill: '#ffffff',
        backgroundColor: '#08142ce0',
        padding: { x: 6, y: 3 },
      })
      .setDepth(16)
      .setOrigin(0.5, 1);

    if (isSelf) this.selfChatBubble = bubble;
    else targetObj.chatBubble = bubble;

    this.time.delayedCall(3500, () => {
      if (bubble && bubble.active) bubble.destroy();
    });
  }

  // ── Server Hollow & World Boss Visuals ─────────────────────
  _createOrUpdateHollow(hData, isNewSpawn = false) {
    let h = this.hollowMap[hData.id];
    const isBoss = hData.type === 'overlord';
    const isMenos = hData.type === 'menos';

    if (!h) {
      const texKey = isBoss ? 'hollow_overlord' : isMenos ? 'hollow_menos' : 'hollow_normal';
      const hitKey = isBoss ? 'hollow_overlord_hit' : isMenos ? 'hollow_menos_hit' : 'hollow_normal_hit';
      const scale = isBoss ? 1.25 : isMenos ? 1.45 : 1;
      const hSize = isBoss ? 130 : isMenos ? 90 : 60;

      const sprite = this.physics.add.sprite(hData.x, hData.y, texKey);
      sprite.setDepth(isBoss ? 5.5 : 5).setScale(scale);
      sprite.body.setAllowGravity(false);
      sprite.body.setImmovable(true);
      sprite._hollowId = hData.id;
      this.hollowPhysicsGroup.add(sprite);

      const hpBar = this.add.graphics().setDepth(8);
      const labelStr = isBoss
        ? '☠ OVERLORD HOLLOW ☠'
        : isMenos
        ? '◆ ARCHFIEND WRAITH'
        : '◇ SHADOW HOLLOW';

      const nameTag = this.add
        .text(hData.x, hData.y - (hSize * scale) / 2 - 16, labelStr, {
          fontSize: isBoss ? '12px' : isMenos ? '10px' : '9px',
          fill: isBoss ? '#ff3355' : isMenos ? '#ff88ff' : '#cc88ff',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setDepth(9)
        .setOrigin(0.5, 1);

      h = {
        id: hData.id,
        type: hData.type || 'normal',
        sprite,
        hpBar,
        nameTag,
        hp: hData.hp,
        hpMax: hData.hpMax,
        targetX: hData.x,
        targetY: hData.y,
        facingRight: hData.facingRight ?? true,
        hitKey,
        normalKey: texKey,
        scale,
        hSize,
        flashTimer: null,
      };
      this.hollowMap[hData.id] = h;
      this._drawHollowHP(h);

      if (isNewSpawn) {
        this.waveParticles.setParticleTint(isBoss ? 0xff0044 : 0x9900ff);
        this.waveParticles.explode(isBoss ? 35 : 12, hData.x, hData.y);
      }
      if (isBoss) this._updateBossHUD();
    } else {
      h.targetX = hData.x;
      h.targetY = hData.y;
      h.hp = hData.hp;
      h.hpMax = hData.hpMax;
      h.facingRight = hData.facingRight;
    }
  }

  _destroyHollowVisual(id) {
    const h = this.hollowMap[id];
    if (!h) return;
    if (h.flashTimer) clearTimeout(h.flashTimer);
    h.hpBar.destroy();
    h.nameTag.destroy();
    h.sprite.destroy();
    delete this.hollowMap[id];
  }

  _drawHollowHP(h) {
    if (!h || !h.sprite.active) return;
    const sx = h.sprite.x;
    const sy = h.sprite.y;
    const bw = h.type === 'overlord' ? 90 : h.type === 'menos' ? 60 : 44;
    const bh = h.type === 'overlord' ? 7 : 5;
    const by = sy - (h.hSize * h.scale) / 2 - 8;

    h.hpBar.clear();
    if (h.hp <= 0) return;

    h.hpBar.fillStyle(0x000000, 0.8);
    h.hpBar.fillRect(sx - bw / 2, by, bw, bh);
    const ratio = Math.max(0, h.hp / h.hpMax);
    const col = h.type === 'overlord' ? 0xff1144 : ratio > 0.5 ? 0x22cc44 : ratio > 0.25 ? 0xffaa00 : 0xff3300;
    h.hpBar.fillStyle(col, 1);
    h.hpBar.fillRect(sx - bw / 2, by, bw * ratio, bh);
    h.hpBar.lineStyle(1, 0x444444, 0.9);
    h.hpBar.strokeRect(sx - bw / 2, by, bw, bh);
  }

  _spawnServerOrb(orbData) {
    if (this.orbMap[orbData.id]) return;
    const key = orbData.isHP ? 'orb_hp' : 'orb_sp';
    const orb = this.orbGroup.create(orbData.x, orbData.y, key);
    orb.setDepth(4);
    orb.body.setAllowGravity(false);
    orb._orbId = orbData.id;
    orb._isHP = orbData.isHP;
    this.orbMap[orbData.id] = orb;

    this.tweens.add({
      targets: orb,
      y: orbData.y + 8,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  // ══════════════════════════════════════════════════════════
  //  WORLD, PARTICLES & VISUAL UPGRADES
  // ══════════════════════════════════════════════════════════
  _createBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x000010, 0x000010, 0x0a0020, 0x0a0020, 1);
    bg.fillRect(0, 0, GAME_W, GAME_H);

    const moon = this.add.graphics();
    moon.fillStyle(0xffeedd, 0.9); moon.fillCircle(760, 70, 40);
    moon.fillStyle(0x000018, 1);   moon.fillCircle(778, 62, 36);

    const stars = this.add.graphics();
    stars.fillStyle(0xffffff, 1);
    [
      [80, 30],[150, 60],[220, 20],[300, 50],[400, 15],[480, 55],[550, 25],[620, 70],
      [680, 40],[800, 90],[840, 30],[870, 55],[120, 90],[260, 80],[360, 95],[450, 75],
      [530, 95],[700, 85],[730, 50],[810, 60],[170, 110],[340, 115],[600, 105],[780, 115],
    ].forEach(([x, y]) => stars.fillCircle(x, y, Math.random() * 1.5 + 0.5));

    const rocks = this.add.graphics();
    rocks.fillStyle(0x0d0d1f, 0.8);
    [[100, 160, 70, 25],[400, 130, 90, 20],[700, 180, 60, 18]].forEach(([x, y, w, h]) =>
      rocks.fillEllipse(x, y, w, h)
    );

    const mist = this.add.graphics();
    mist.fillGradientStyle(0x000820, 0x000820, 0x001040, 0x001040, 0, 0, 0.6, 0.6);
    mist.fillRect(0, GAME_H - 160, GAME_W, 160);

    [bg, moon, stars, rocks, mist].forEach((g) => g.setDepth(0));
  }

  _createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    this.groundY = GAME_H - 40;

    for (let x = 0; x < GAME_W; x += 32) {
      this.platforms.create(x + 16, this.groundY + 16, 'ground').refreshBody();
    }
    const gl = this.add.graphics();
    gl.lineStyle(1, 0x0044aa, 0.6);
    gl.lineBetween(0, this.groundY, GAME_W, this.groundY);
    gl.setDepth(1);

    const floats = [
      { x: 150, y: 340, w: 160 },
      { x: 450, y: 280, w: 160 },
      { x: 720, y: 330, w: 160 },
    ];
    floats.forEach(({ x, y, w }) => {
      this.add.tileSprite(x + w / 2, y, w, 32, 'platform').setDepth(1);
      const b = this.physics.add.staticImage(x + w / 2, y, 'platform');
      b.setDisplaySize(w, 32).refreshBody().setAlpha(0);
      this.platforms.add(b);
    });
  }

  _createPlayer() {
    this.player = this.physics.add.sprite(140, this.groundY - 68, 'player_normal');
    this.player.setCollideWorldBounds(true).setDepth(5);
    this.player.body.setSize(28, 60).setOffset(6, 8);
    this.player.body.setGravityY(400).setMaxVelocityY(800);

    this.selfColorInt = Phaser.Display.Color.HexStringToColor(ClientState.playerColor || '#00aaff').color;
    this.selfSash = this.add.graphics().setDepth(5.2);
    this.awakenAura = this.add.graphics().setDepth(4.5).setAlpha(0);
    this.slashGraphic = this.add.graphics().setDepth(6);

    this.selfNameTag = this.add
      .text(this.player.x, this.player.y - 46, `[LV.${this.playerLevel}] ${ClientState.username}`, {
        fontSize: '11px',
        fill: ClientState.playerColor || '#00aaff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(9)
      .setOrigin(0.5, 1);
  }

  _updateSelfNameTag() {
    if (!this.selfNameTag) return;
    this.selfNameTag.setText(`[LV.${this.playerLevel}] ${ClientState.username}`);
    this.selfNameTag.setColor(ClientState.playerColor || '#00aaff');
  }

  // Upgraded Visuals: Flowing Scarf + Dynamic Sword Swing + Coat Trail
  _drawPlayerScarfAndSword(graphic, x, y, facingRight, colorInt, swordData, isAwakened, isMoving, swingPhase) {
    graphic.clear();
    const dir = facingRight ? 1 : -1;
    const t = this.time.now * 0.012;
    const scarfCol = isAwakened ? 0xff1133 : colorInt || 0x00aaff;

    // 1. Colored waist belt
    graphic.fillStyle(scarfCol, 0.95);
    graphic.fillRect(x - 11, y + 5, 22, 4);

    // 2. Flowing Neck Scarf trailing behind player
    graphic.lineStyle(4, scarfCol, 0.9);
    graphic.beginPath();
    const neckX = x - dir * 4;
    const neckY = y - 12;
    graphic.moveTo(neckX, neckY);
    const stretch = isMoving ? 26 : 14;
    for (let i = 1; i <= 4; i++) {
      const segX = neckX - dir * (i * (stretch / 4));
      const waveY = Math.sin(t - i * 0.9) * (isMoving ? 5 : 2);
      graphic.lineTo(segX, neckY + i * 2 + waveY);
    }
    graphic.strokePath();

    // 3. Subtle spiritual aura ring under feet
    graphic.lineStyle(1.5, scarfCol, 0.4);
    graphic.strokeEllipse(x, y + 30, 32, 8);

    // 4. Dynamic Sword in hand (rotates during swingPhase)
    const handX = x + dir * 12;
    const handY = y - 2;
    const angle = swingPhase > 0
      ? dir * (1.2 - swingPhase * 2.4)
      : dir * -0.25;

    const bladeLen = 34;
    const tipX = handX + Math.sin(angle) * bladeLen + dir * 6;
    const tipY = handY - Math.cos(angle) * bladeLen;

    const isLeg = swordData && swordData.id === 'eclipse_blade';
    const bladeCol = swordData && swordData.bladeColor
      ? Phaser.Display.Color.HexStringToColor(swordData.bladeColor).color
      : 0xdddddd;

    // Outer glow for Epic/Legendary/Awakened blades
    if (isLeg || isAwakened || (swordData && swordData.rarity !== 'Common')) {
      const glowCol = isAwakened
        ? 0xff2200
        : isLeg
        ? 0xcc00ff
        : Phaser.Display.Color.HexStringToColor(swordData.waveColor || '#00aaff').color;
      graphic.lineStyle(5, glowCol, 0.38);
      graphic.lineBetween(handX, handY, tipX, tipY);
    }

    // Main blade line
    graphic.lineStyle(3, isAwakened ? 0x110000 : bladeCol, 1);
    graphic.lineBetween(handX, handY, tipX, tipY);

    // Hilt guard
    graphic.fillStyle(0xffcc33, 1);
    graphic.fillCircle(handX, handY, 3);
  }

  // Multi-layered glowing crescent Slash Trail
  _drawMultiLayerSlashTrail(sg, px, py, dir, strokeCol, isFinisher) {
    sg.clear();
    const arcW = isFinisher ? 102 : 72;
    const arcH = isFinisher ? 78 : 54;

    // Outer colored glow arc
    sg.fillStyle(strokeCol, isFinisher ? 0.35 : 0.24);
    sg.fillEllipse(px + (dir * arcW) / 2, py, arcW, arcH);
    sg.lineStyle(isFinisher ? 5 : 3, strokeCol, 0.95);
    sg.strokeEllipse(px + (dir * arcW) / 2, py, arcW, arcH);

    // Inner white-hot core slash arc
    sg.lineStyle(isFinisher ? 2.5 : 1.5, 0xffffff, 0.9);
    sg.strokeEllipse(px + (dir * arcW) / 2 + dir * 4, py, arcW * 0.82, arcH * 0.82);

    // Speed lines
    for (let i = -1; i <= 1; i++) {
      sg.lineStyle(2, strokeCol, 0.75);
      sg.lineBetween(px + dir * 14, py + i * 16, px + dir * (arcW + 18), py + i * 10);
    }
  }

  _createProjectiles() {
    this.waveGroup = this.physics.add.group({ allowGravity: false });
    this.hollowPhysicsGroup = this.physics.add.group({ allowGravity: false });
    this.orbGroup = this.physics.add.group({ allowGravity: false });

    this.physics.add.overlap(
      this.waveGroup,
      this.hollowPhysicsGroup,
      this._onWaveHitHollow,
      null,
      this
    );
  }

  _createParticles() {
    this.slashParticles = this.add
      .particles(0, 0, 'particle', {
        speed: { min: 80, max: 220 },
        scale: { start: 0.65, end: 0 },
        alpha: { start: 0.85, end: 0 },
        lifespan: 260,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(7);

    this.waveParticles = this.add
      .particles(0, 0, 'particle', {
        speed: { min: 15, max: 60 },
        scale: { start: 0.45, end: 0 },
        alpha: { start: 0.55, end: 0 },
        lifespan: 200,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(7);

    this.goldParticles = this.add
      .particles(0, 0, 'particle', {
        speed: { min: 60, max: 160 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: 0xffcc00,
        lifespan: 600,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(9);

    // Jump & Landing Dust Particles
    this.dustParticles = this.add
      .particles(0, 0, 'particle', {
        speedX: { min: -70, max: 70 },
        speedY: { min: -40, max: -10 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.5, end: 0 },
        tint: 0x99aacc,
        lifespan: 320,
        emitting: false,
      })
      .setDepth(4.9);
  }

  // ══════════════════════════════════════════════════════════
  //  UI
  // ══════════════════════════════════════════════════════════
  _createUI() {
    const D = 10;
    const p = 14;

    this.uiPanel = this.add.graphics().setDepth(D).setScrollFactor(0);
    this.uiPanel.fillStyle(0x000010, 0.6);
    this.uiPanel.fillRoundedRect(p - 4, p - 4, 210, 134, 6);
    this.uiPanel.lineStyle(1, 0x112244, 0.65);
    this.uiPanel.strokeRoundedRect(p - 4, p - 4, 210, 134, 6);

    this.add.text(p, p, '❤ HP', { fontSize: '11px', fill: '#aaffaa', fontStyle: 'bold' }).setDepth(D);
    this.hpBarBg = this.add.graphics().setDepth(D);
    this.hpBarFill = this.add.graphics().setDepth(D);
    this.hpValueTxt = this.add.text(p + 192, p + 14, '', { fontSize: '10px', fill: '#88ee88' }).setDepth(D).setOrigin(1, 0);

    this.add.text(p, p + 27, '✦ SOUL ENERGY (SP)', { fontSize: '10px', fill: '#aaccff', fontStyle: 'bold' }).setDepth(D);
    this.spBarBg = this.add.graphics().setDepth(D);
    this.spBarFill = this.add.graphics().setDepth(D);
    this.spValueTxt = this.add.text(p + 192, p + 41, '', { fontSize: '10px', fill: '#88aaff' }).setDepth(D).setOrigin(1, 0);

    this.lvlLabel = this.add.text(p, p + 54, '', { fontSize: '11px', fill: '#ffdd44', fontStyle: 'bold' }).setDepth(D);
    this.expBarBg = this.add.graphics().setDepth(D);
    this.expBarFill = this.add.graphics().setDepth(D);
    this.expValueTxt = this.add.text(p + 192, p + 68, '', { fontSize: '10px', fill: '#ddaa00' }).setDepth(D).setOrigin(1, 0);

    this.coinsText = this.add
      .text(p, p + 84, '🪙 Coins: 0  |  🎟 0', { fontSize: '11px', fill: '#ffd166', fontStyle: 'bold' })
      .setDepth(D);
    this.swordText = this.add
      .text(p, p + 101, '🗡 ดาบเหล็กกล้า', { fontSize: '10px', fill: '#cccccc', fontStyle: 'bold' })
      .setDepth(D);

    this.comboText = this.add
      .text(GAME_W / 2, 44, '', {
        fontSize: '26px',
        fill: '#ffcc00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setDepth(D)
      .setOrigin(0.5, 0);

    this.awakenText = this.add
      .text(GAME_W / 2, GAME_H - 32, '', {
        fontSize: '14px',
        fill: '#ff4400',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(D)
      .setOrigin(0.5, 0.5);

    this.hollowCountText = this.add
      .text(GAME_W - 10, 10, '', {
        fontSize: '11px',
        fill: '#cc88ff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(D)
      .setOrigin(1, 0);

    const hints = [
      'MOVE: A/D or ←/→   JUMP: W/Space',
      'SLASH: J / Click     CRESCENT WAVE: K (25 SP)',
      'FLASH DASH: Shift (10 SP)',
      'SOUL AWAKENING: L (80 SP, 10s)',
    ];
    const hp = this.add.graphics().setDepth(D - 1);
    hp.fillStyle(0x000010, 0.5);
    hp.fillRoundedRect(GAME_W - 290, GAME_H - 84, 284, 78, 5);

    hints.forEach((h, i) => {
      this.add
        .text(GAME_W - 10, GAME_H - 10 - (hints.length - 1 - i) * 17, h, {
          fontSize: '10px',
          fill: '#aaddff',
          stroke: '#000000',
          strokeThickness: 1,
        })
        .setDepth(D)
        .setOrigin(1, 1);
    });

    this.dashCDText = this.add.text(p, p + 120, '', { fontSize: '10px', fill: '#88bbdd' }).setDepth(D);

    this._drawBars();
  }

  _drawBars() {
    const p = 14, bw = 190, bh = 9;

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x111111, 0.9);
    this.hpBarBg.fillRoundedRect(p, p + 14, bw, bh, 3);
    this.hpBarFill.clear();
    const hpR = Math.max(0, this.playerHP / this.statHPMax);
    const hpC = hpR > 0.5 ? 0x22cc44 : hpR > 0.25 ? 0xffaa00 : 0xff3300;
    this.hpBarFill.fillStyle(hpC, 1);
    if (hpR > 0) this.hpBarFill.fillRoundedRect(p, p + 14, bw * hpR, bh, 3);
    this.hpValueTxt.setText(`${Math.ceil(this.playerHP)}/${this.statHPMax}`);

    this.spBarBg.clear();
    this.spBarBg.fillStyle(0x111111, 0.9);
    this.spBarBg.fillRoundedRect(p, p + 41, bw, bh, 3);
    this.spBarFill.clear();
    const sR = Math.max(0, this.playerSP / PLAYER_BASE.SP_MAX);
    this.spBarFill.fillStyle(this.isAwakened ? 0xcc2200 : 0x0088ff, 1);
    if (sR > 0) this.spBarFill.fillRoundedRect(p, p + 41, bw * sR, bh, 3);
    this.spValueTxt.setText(`${Math.floor(this.playerSP)}/100`);

    this.lvlLabel.setText(`★ LV.${this.playerLevel}`);
    this.expBarBg.clear();
    this.expBarBg.fillStyle(0x111111, 0.9);
    this.expBarBg.fillRoundedRect(p, p + 68, bw, bh, 3);
    this.expBarFill.clear();
    const eR = Math.min(1, this.playerEXP / this.expToNext);
    this.expBarFill.fillStyle(0xffcc00, 1);
    if (eR > 0) this.expBarFill.fillRoundedRect(p, p + 68, bw * eR, bh, 3);
    this.expValueTxt.setText(`${this.playerEXP}/${this.expToNext}`);
  }

  _updateHollowCounter() {
    const list = Object.values(this.hollowMap);
    const n = list.filter((h) => h.type !== 'overlord').length;
    const m = list.filter((h) => h.type === 'menos').length;
    const b = list.filter((h) => h.type === 'overlord').length;
    this.hollowCountText.setText(
      `👁 Wraiths: ${n}/5` +
        (m > 0 ? ` [⚠ Archfiend: ${m}]` : '') +
        (b > 0 ? ` [☠ BOSS ACTIVE]` : '')
    );
  }

  // ══════════════════════════════════════════════════════════
  //  COMBAT, SKILLS & SFX TRIGGERS
  // ══════════════════════════════════════════════════════════
  _normalAttack() {
    if (!ClientState.joined || ClientState.isChatFocused || ClientState.isShopOpen || this.isDead) return;
    const now = this.time.now;
    const cd = this.isAwakened
      ? PLAYER_BASE.SLASH_COOLDOWN * (1 / PLAYER_BASE.AWAKEN_SPEED_MULT)
      : PLAYER_BASE.SLASH_COOLDOWN;
    if (now - this.lastSlashTime < cd) return;
    this.lastSlashTime = now;

    this.comboCount = (this.comboCount % 3) + 1;
    clearTimeout(this.comboResetTimer);
    this.comboResetTimer = setTimeout(() => {
      this.comboCount = 0;
      this.comboText.setText('');
    }, 900);

    const isFinal = this.comboCount === 3;
    const baseDmg = isFinal ? 22 : 10;
    const dmg = Math.round(baseDmg * this.statAtkMult * (this.isAwakened ? 1.5 : 1));

    // Trigger sword swing animation & Web Audio SFX
    this.swingPhase = 1.0;
    sfx.playSlash(this.comboCount);
    this._showSlashEffect(isFinal);

    socket.emit('playerAction', {
      type: 'slash',
      isFinal,
      facingRight: this.facingRight,
    });

    const labels = ['', '2 HIT!!', '★ SOUL FINISH !!'];
    this.comboText.setText(this.comboCount > 1 ? labels[this.comboCount - 1] : '');
    if (isFinal) this.cameras.main.shake(110, 0.006);

    const hitRange = isFinal ? 105 : 75;
    Object.values(this.hollowMap).forEach((h) => {
      if (!h.sprite.active || h.hp <= 0) return;
      const dist = Math.abs(h.sprite.x - this.player.x);
      const sameSide = this.facingRight
        ? h.sprite.x > this.player.x - 18
        : h.sprite.x < this.player.x + 18;
      if (dist < hitRange && sameSide) {
        socket.emit('hitHollow', { hollowId: h.id, dmg });
      }
    });
  }

  _showSlashEffect(isFinisher) {
    const sg = this.slashGraphic;
    const px = this.player.x, py = this.player.y;
    const dir = this.facingRight ? 1 : -1;

    const swCol = this.currentSword && this.currentSword.waveColor
      ? Phaser.Display.Color.HexStringToColor(this.currentSword.waveColor).color
      : this.selfColorInt || 0x88ddff;
    const strokeCol = this.isAwakened ? 0xff2200 : swCol;

    this._drawMultiLayerSlashTrail(sg, px, py, dir, strokeCol, isFinisher);

    this.slashParticles.setParticleTint(strokeCol);
    this.slashParticles.explode(isFinisher ? 20 : 9, px + dir * 50, py);
    this.time.delayedCall(isFinisher ? 190 : 125, () => sg.clear());
  }

  _shootWave() {
    if (!ClientState.joined || ClientState.isChatFocused || ClientState.isShopOpen || this.isDead) return;
    if (this.playerSP < PLAYER_BASE.WAVE_COST) {
      this._notEnoughSP();
      return;
    }
    this.playerSP -= PLAYER_BASE.WAVE_COST;
    this._drawBars();

    this.swingPhase = 1.0;
    sfx.playWave();

    const isLeg = this.currentSword && this.currentSword.id === 'eclipse_blade';
    const texKey = this.isAwakened
      ? 'wave_awakened'
      : isLeg
      ? 'wave_legendary'
      : 'wave_base';
    const dir = this.facingRight ? 1 : -1;
    const spd = this.isAwakened ? 650 : 480;
    const baseDmg = this.isAwakened ? 48 : 32;
    const dmg = Math.round(baseDmg * this.statAtkMult);

    const wave = this.waveGroup.create(this.player.x + dir * 30, this.player.y, texKey);
    wave.setDepth(6);
    wave.body.setAllowGravity(false);
    wave.setVelocityX(spd * dir);
    wave.setFlipX(!this.facingRight);
    wave._dmg = dmg;
    wave._isRemote = false;

    if (texKey === 'wave_base' && this.currentSword && this.currentSword.waveColor) {
      const colInt = Phaser.Display.Color.HexStringToColor(this.currentSword.waveColor).color;
      wave.setTint(colInt);
    }

    socket.emit('playerAction', {
      type: 'wave',
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight: this.facingRight,
      isAwakened: this.isAwakened,
    });

    this.time.delayedCall(2500, () => {
      if (wave && wave.active) wave.destroy();
    });
    this.cameras.main.shake(60, 0.004);
  }

  _onWaveHitHollow(wave, hollowSprite) {
    const hollowId = hollowSprite._hollowId;
    if (!wave._isRemote && hollowId) {
      socket.emit('hitHollow', { hollowId, dmg: wave._dmg || 32 });
    }
    this.waveParticles.setParticleTint(this.isAwakened ? 0xff4400 : 0x0088ff);
    this.waveParticles.explode(16, wave.x, wave.y);
    wave.destroy();
  }

  _flashDash() {
    if (!ClientState.joined || ClientState.isChatFocused || ClientState.isShopOpen || this.isDead) return;
    const now = this.time.now;
    if (now - this.lastDashTime < PLAYER_BASE.DASH_COOLDOWN) return;
    if (this.playerSP < PLAYER_BASE.DASH_COST) {
      this._notEnoughSP();
      return;
    }
    this.lastDashTime = now;
    this.playerSP -= PLAYER_BASE.DASH_COST;
    this._drawBars();

    sfx.playDash();

    const fromX = this.player.x;
    const fromY = this.player.y;
    const dir = this.facingRight ? 1 : -1;

    this.dustParticles.explode(8, fromX, fromY + 28);

    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 30, () => {
        const g = this.add.image(fromX, fromY, 'shunpo_ghost');
        g.setDepth(4).setFlipX(!this.facingRight).setTint(this.selfColorInt);
        this.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
      });
    }

    this.player.x = Phaser.Math.Clamp(this.player.x + dir * 180, 20, GAME_W - 20);
    this.player.setVelocityX(dir * 400);
    this.slashParticles.setParticleTint(this.selfColorInt || 0xaaccff);
    this.slashParticles.explode(12, this.player.x, this.player.y);

    socket.emit('playerAction', {
      type: 'dash',
      fromX: Math.round(fromX),
      fromY: Math.round(fromY),
      toX: Math.round(this.player.x),
      toY: Math.round(this.player.y),
      facingRight: this.facingRight,
    });
    this._emitPlayerMove(true);

    this.dashCDText.setText('FLASH DASH: Cooldown...');
    this.time.delayedCall(PLAYER_BASE.DASH_COOLDOWN, () => {
      this.dashCDText.setText('FLASH DASH: Ready ✓');
      this.time.delayedCall(1000, () => this.dashCDText.setText(''));
    });
  }

  _activateAwakening() {
    if (!ClientState.joined || ClientState.isChatFocused || ClientState.isShopOpen || this.isDead || this.isAwakened) return;
    if (this.playerSP < PLAYER_BASE.AWAKEN_COST) {
      this._notEnoughSP();
      return;
    }
    this.playerSP -= PLAYER_BASE.AWAKEN_COST;
    this._drawBars();
    this.isAwakened = true;
    this.player.setTexture('player_awakened');

    sfx.playAwakening();
    socket.emit('playerAction', { type: 'awakening', active: true });

    const flash = this.add.graphics().setDepth(20);
    flash.fillStyle(0xff0000, 0.4);
    flash.fillRect(0, 0, GAME_W, GAME_H);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });

    this.awakenAura.setAlpha(1);
    this.awakenText.setText('★ SOUL AWAKENING — CRIMSON OVERDRIVE ★').setColor('#ff4400');
    this.cameras.main.shake(260, 0.012);
    this.cameras.main.flash(300, 180, 0, 0);

    let remaining = PLAYER_BASE.AWAKEN_DURATION;
    this.awakenInterval = setInterval(() => {
      remaining -= 100;
      this.awakenText.setText(`★ SOUL AWAKENING (${Math.ceil(remaining / 1000)}s) ★`);
      if (remaining <= 0) this._deactivateAwakening();
    }, 100);
  }

  _animateAwakeningAura(auraGraphic, px, py) {
    auraGraphic.clear();
    const t = this.time.now * 0.003;
    for (let i = 3; i >= 0; i--) {
      const p = Math.sin(t + i * 0.8) * 0.3 + 0.7;
      const r = (28 + i * 12) * p;
      auraGraphic.lineStyle(2, 0xff1100, (0.6 - i * 0.12) * p);
      auraGraphic.strokeCircle(px, py - 10, r);
      auraGraphic.fillStyle(0x220000, (0.08 - i * 0.015) * p);
      auraGraphic.fillCircle(px, py - 10, r);
    }
  }

  _deactivateAwakening() {
    clearInterval(this.awakenInterval);
    this.isAwakened = false;
    this.player.setTexture('player_normal');
    this.awakenAura.clear().setAlpha(0);
    this.awakenText.setText('');
    this._drawBars();
    socket.emit('playerAction', { type: 'awakening', active: false });
  }

  _playLevelUpEffect() {
    sfx.playLevelUp();
    this.goldParticles.explode(60, this.player.x, this.player.y);
    this.cameras.main.flash(400, 255, 220, 50);

    const lv = this.playerLevel;
    const lu = this.add
      .text(this.player.x, this.player.y - 80, `LEVEL UP!\nLV. ${lv}`, {
        fontSize: '26px',
        fill: '#ffdd00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
      })
      .setDepth(20)
      .setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: lu,
      y: lu.y - 70,
      alpha: 0,
      duration: 1800,
      ease: 'Cubic.Out',
      onComplete: () => lu.destroy(),
    });
  }

  _damagePlayer(dmg) {
    if (this.isDead || this.isHitFlashing) return;
    this.playerHP = Math.max(0, this.playerHP - dmg);
    this._drawBars();

    sfx.playHit();
    this._spawnPopup(this.player.x, this.player.y - 50, `-${dmg}`, '#ff4444');

    this.isHitFlashing = true;
    const origTex = this.isAwakened ? 'player_awakened' : 'player_normal';
    this.player.setTexture('player_hit');
    this.time.delayedCall(120, () => {
      if (!this.isDead) this.player.setTexture(origTex);
      this.isHitFlashing = false;
    });

    this.cameras.main.shake(80, 0.007);
    if (this.playerHP <= 0) this._gameOver();
  }

  _checkOrbPickup() {
    if (this.isDead) return;
    Object.values(this.orbMap).forEach((orb) => {
      if (!orb || !orb.active) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, orb.x, orb.y);
      if (dist < 38) {
        socket.emit('pickupOrb', { orbId: orb._orbId });
      }
    });
  }

  _gameOver() {
    if (this.isDead) return;
    this.isDead = true;
    if (this.awakenInterval) clearInterval(this.awakenInterval);
    this.player.setVelocity(0, 0);
    this.player.setAlpha(0.35);
    this._emitPlayerMove(true);

    const overlay = this.add.graphics().setDepth(50);
    overlay.fillStyle(0x110000, 0.72);
    overlay.fillRect(0, 0, GAME_W, GAME_H);

    this.cameras.main.flash(500, 200, 0, 0);

    const title = this.add
      .text(GAME_W / 2, GAME_H / 2 - 55, 'YOU DIED', {
        fontSize: '60px',
        fill: '#cc0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setDepth(55)
      .setOrigin(0.5, 0.5);

    const sub = this.add
      .text(GAME_W / 2, GAME_H / 2 + 8, `LV. ${this.playerLevel}  |  Soul Coins: ${this.playerCoins}`, {
        fontSize: '14px',
        fill: '#aa6666',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(55)
      .setOrigin(0.5, 0.5);

    const btnBg = this.add.graphics().setDepth(55);
    btnBg.fillStyle(0x2a0000, 1);
    btnBg.fillRoundedRect(GAME_W / 2 - 100, GAME_H / 2 + 42, 200, 44, 8);
    btnBg.lineStyle(2, 0xff3333, 1);
    btnBg.strokeRoundedRect(GAME_W / 2 - 100, GAME_H / 2 + 42, 200, 44, 8);

    const doRespawn = () => {
      if (!this.isDead) return;
      this.isDead = false;
      this.playerHP = this.statHPMax;
      this.playerSP = PLAYER_BASE.SP_MAX;
      this.player.setAlpha(1);
      this.player.setTexture('player_normal');
      this.player.setPosition(140, this.groundY - 68);
      this._drawBars();
      this._emitPlayerMove(true);

      overlay.destroy();
      title.destroy();
      sub.destroy();
      btnBg.destroy();
      btn.destroy();
    };

    const btn = this.add
      .text(GAME_W / 2, GAME_H / 2 + 64, '⟳ เกิดใหม่ (RESPAWN)', {
        fontSize: '16px',
        fill: '#ffaaaa',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(56)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerdown', doRespawn);
    this.input.keyboard.once('keydown-ENTER', doRespawn);
  }

  // ══════════════════════════════════════════════════════════
  //  HELPERS & INPUTS
  // ══════════════════════════════════════════════════════════
  _spawnPopup(x, y, text, color = '#ffffff', size = '16px') {
    const t = this.add
      .text(x, y, text, {
        fontSize: size,
        fill: color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(15)
      .setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: t,
      y: y - 50,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    });
  }

  _notEnoughSP() {
    const t = this.add
      .text(this.player.x, this.player.y - 60, 'Not enough Soul Energy (SP)!', {
        fontSize: '12px',
        fill: '#ff6644',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(15)
      .setOrigin(0.5, 0.5);
    this.tweens.add({
      targets: t,
      y: t.y - 30,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy(),
    });
  }

  _regenSP() {
    if (this.isDead) return;
    if (this.playerSP < PLAYER_BASE.SP_MAX) {
      this.playerSP = Math.min(PLAYER_BASE.SP_MAX, this.playerSP + PLAYER_BASE.SP_REGEN);
      this._drawBars();
    }
  }

  _createInputs() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      A: Phaser.Input.Keyboard.KeyCodes.A,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      W: Phaser.Input.Keyboard.KeyCodes.W,
      J: Phaser.Input.Keyboard.KeyCodes.J,
      K: Phaser.Input.Keyboard.KeyCodes.K,
      L: Phaser.Input.Keyboard.KeyCodes.L,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });
    this.input.keyboard.on('keydown-J', () => this._normalAttack());
    this.input.keyboard.on('keydown-K', () => this._shootWave());
    this.input.keyboard.on('keydown-L', () => this._activateAwakening());
    this.input.keyboard.on('keydown-SHIFT', () => this._flashDash());
    this.input.on('pointerdown', (ptr) => {
      if (!ClientState.joined || ClientState.isChatFocused || ClientState.isShopOpen) return;
      if (ptr.leftButtonDown()) this._normalAttack();
      if (ptr.rightButtonDown()) this._shootWave();
    });
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _emitPlayerMove(force = false) {
    if (!ClientState.joined || !socket.connected) return;
    const now = this.time.now;
    if (!force && now - this.lastNetSync < 45) return;
    this.lastNetSync = now;

    socket.emit('playerMove', {
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight: this.facingRight,
      level: this.playerLevel,
      hp: Math.ceil(this.playerHP),
      hpMax: this.statHPMax,
      isAwakened: this.isAwakened,
      isDead: this.isDead,
    });
  }

  // ══════════════════════════════════════════════════════════
  //  MAIN UPDATE LOOP
  // ══════════════════════════════════════════════════════════
  update() {
    if (ClientState.joined && !ClientState.isChatFocused && !ClientState.isShopOpen && !this.isDead) {
      this._handleMovement();
      this._handleJump();
    } else if ((ClientState.isChatFocused || ClientState.isShopOpen) && !this.isDead) {
      this.player.setVelocityX(0);
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 20, GAME_W - 20);

    // Decay sword swing animation
    if (this.swingPhase > 0) {
      this.swingPhase = Math.max(0, this.swingPhase - 0.12);
    }

    const isMoving = Math.abs(this.player.body.velocity.x) > 10;

    // Running footstep dust
    if (isMoving && this.isOnGround && this.time.now - this.lastDustTime > 170) {
      this.lastDustTime = this.time.now;
      this.dustParticles.explode(2, this.player.x, this.player.y + 30);
    }

    this.selfNameTag.setPosition(this.player.x, this.player.y - 44);
    if (this.selfChatBubble && this.selfChatBubble.active) {
      this.selfChatBubble.setPosition(this.player.x, this.player.y - 64);
    }
    this._drawPlayerScarfAndSword(
      this.selfSash,
      this.player.x,
      this.player.y,
      this.facingRight,
      this.selfColorInt,
      this.currentSword,
      this.isAwakened,
      isMoving,
      this.swingPhase
    );
    if (this.isAwakened) {
      this._animateAwakeningAura(this.awakenAura, this.player.x, this.player.y);
    }

    this._emitPlayerMove(false);

    // Interpolate Remote Players
    Object.values(this.remotePlayers).forEach((rp) => {
      const dx = Math.abs(rp.targetX - rp.sprite.x);
      rp.sprite.x = Phaser.Math.Linear(rp.sprite.x, rp.targetX, 0.28);
      rp.sprite.y = Phaser.Math.Linear(rp.sprite.y, rp.targetY, 0.28);
      rp.sprite.setFlipX(!rp.facingRight);

      if (rp.swingPhase > 0) {
        rp.swingPhase = Math.max(0, rp.swingPhase - 0.12);
      }

      rp.nameTag.setPosition(rp.sprite.x, rp.sprite.y - 44);
      if (rp.chatBubble && rp.chatBubble.active) {
        rp.chatBubble.setPosition(rp.sprite.x, rp.sprite.y - 64);
      }
      this._drawPlayerScarfAndSword(
        rp.sashGraphic,
        rp.sprite.x,
        rp.sprite.y,
        rp.facingRight,
        rp.colorInt,
        rp.swordData,
        rp.isAwakened,
        dx > 1.5,
        rp.swingPhase
      );
      if (rp.isAwakened) {
        this._animateAwakeningAura(rp.awakenAura, rp.sprite.x, rp.sprite.y);
      }
    });

    // Interpolate Server Hollows & World Boss
    Object.values(this.hollowMap).forEach((h) => {
      if (!h.sprite.active) return;
      h.sprite.x = Phaser.Math.Linear(h.sprite.x, h.targetX, 0.25);
      h.sprite.y = Phaser.Math.Linear(h.sprite.y, h.targetY, 0.25);
      h.sprite.setFlipX(!h.facingRight);
      this._drawHollowHP(h);
      h.nameTag.setPosition(h.sprite.x, h.sprite.y - (h.hSize * h.scale) / 2 - 18);
    });

    // Wave trails
    this.waveGroup.getChildren().forEach((wave) => {
      if (!wave.active) return;
      if (Math.random() < 0.5) {
        this.waveParticles.setParticleTint(this.isAwakened ? 0xff2200 : 0x0088ff);
        this.waveParticles.explode(1, wave.x, wave.y);
      }
      if (wave.x < -100 || wave.x > GAME_W + 100) wave.destroy();
    });

    this._checkOrbPickup();
  }

  _handleMovement() {
    const spd = (this.isAwakened ? PLAYER_BASE.AWAKEN_SPEED_MULT : 1) * this.statSpeed;
    const left = this.cursors.left.isDown || this.keys.A.isDown || ClientState.touchInput.left;
    const right = this.cursors.right.isDown || this.keys.D.isDown || ClientState.touchInput.right;

    if (left) {
      this.player.setVelocityX(-spd);
      this.facingRight = false;
      this.player.setFlipX(true);
    } else if (right) {
      this.player.setVelocityX(spd);
      this.facingRight = true;
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }
  }

  _handleJump() {
    this.isOnGround = this.player.body.blocked.down;

    // Landing dust puff when hitting ground from air
    if (this.isOnGround && !this.wasOnGround) {
      this.dustParticles.explode(7, this.player.x, this.player.y + 30);
    }
    this.wasOnGround = this.isOnGround;

    const jumped =
      this.cursors.up.isDown ||
      this.keys.W.isDown ||
      this.keys.SPACE.isDown ||
      ClientState.touchInput.jump;
    if (jumped && this.isOnGround) {
      this.player.setVelocityY(PLAYER_BASE.JUMP_VEL);
      this.dustParticles.explode(6, this.player.x, this.player.y + 30);
      this.slashParticles.setParticleTint(0x8888ff);
      this.slashParticles.explode(5, this.player.x, this.player.y + 30);
    }
  }
}

// ─── PHASER CONFIG ────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: 'game-container',
  backgroundColor: '#000010',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 600 }, debug: false },
  },
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { pixelArt: false, antialias: true },
};

const game = new Phaser.Game(config);

console.log('%c⚔ SOUL REAPER ONLINE — Phase 5 (World Boss + SFX) Ready ⚔', 'color:#ff3366;font-size:18px;font-weight:bold;');
