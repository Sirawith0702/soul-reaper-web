# Soul Reaper Web 🗡 — Phase 3 (Real-time Multiplayer)

> 2D Action RPG Side-scrolling game inspired by Bleach anime  
> **Phase 3** — Real-time Co-op Multiplayer with Socket.io

## Tech Stack

- **Backend**: Node.js + Express + **Socket.io** (Server-authoritative Hollow AI & Room management)
- **Frontend**: HTML5 + Phaser 3 (CDN) + Socket.io Client
- **Assets**: 100% programmatic graphics (no external images required)

## Project Structure

```
soul-reaper-web/
├── server.js          # Express + Socket.io server (port 3000)
├── package.json       # Dependencies (express, socket.io, nodemon)
└── public/
    ├── index.html     # Lobby Overlay, Online Players List, Quick Chat + Game Shell
    └── game.js        # Phaser 3 Multiplayer Game Logic
```

## Quick Start

```bash
npm install
npm start
# Open 2+ browser tabs at: http://localhost:3000
```

## Controls

| Action | Keys |
|--------|------|
| Move | `A` / `D` or `←` / `→` |
| Jump | `W` or `Space` |
| **Shunpo** (Flash Step) | `Shift` — 10 Reiatsu, 1.5s CD |
| **Normal Attack** (3-Hit Combo) | `J` or Left Click |
| **Moon Wave Skill** | `K` or Right Click — 25 Reiatsu |
| **BANKAI Mode** | `L` — 80 Reiatsu, 10 seconds |
| **Quick Chat** | `Enter` to focus chat, `Enter` again to send |
