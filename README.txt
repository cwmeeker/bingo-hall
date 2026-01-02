_____________________________________________________________________________________________________

# 🎉 **Bingo Hall — A Real‑Time Multiplayer Bingo Web App**

A fast, lightweight, open‑source Bingo web app designed for **local network play**, family game nights, and small events. Features a dedicated **caller
page**, **player page**, real‑time sync via Socket.IO, multi‑card support, voice output, and a classic bingo‑hall aesthetic. Docker container currently is
only working on x86_64 architecture (tried on Rasp pi but did not work).

-----------------------------------------------------------------------------------------------------

## 🚀 Features

### 🎤 **Caller Page**
- Start/reset games  
- Draw numbers with one click  
- Automatic voice announcements  
- 10‑second grace period for Bingo claims  
- Full history of called numbers  
- Clean, responsive layout  

### 🎮 **Player Page**
- Choose **1, 3, or 6 cards**  
- Tap to mark squares  
- Automatic highlighting of called numbers  
- Checkerboard outline pattern for called squares  
- Mobile‑friendly layout  

### 🔄 **Real‑Time Sync**
- Built with **Socket.IO**  
- All players stay perfectly in sync  
- Caller actions instantly update all clients  
- Rejoining mid‑game restores full state  

### 🖥️ **LAN‑Friendly**
- Works great on home networks  
- Supports `.local` hostnames  

### 🧩 **Simple Architecture**
- Node.js + Express server  
- Static HTML/CSS/JS frontend  
- No database required  
- Optional Docker support  

-----------------------------------------------------------------------------------------------------

## 📦 Installation

### **Clone the repository**
```bash
git clone https://github.com/cwmeeker/bingo-hall.git
cd bingo-hall
```

### **Install dependencies**
```bash
npm install
```

### **Start the server**
```bash
node server.js
```

### **Access the app**
- **Caller:** `http://your-host:8080/caller`  
- **Player:** `http://your-host:8080/player`  
- **Home:** `http://your-host:8080/`

---

## 🐳 Docker (optional)

If you want to run the app in Docker:

```bash
docker build -t bingo-hall .
docker run -p 8080:8080 bingo-hall

or

docker compose up -d
```

-----------------------------------------------------------------------------------------------------

## 📁 Project Structure

```
/public
  index.html
  caller.html
  player.html
  css/
  js/
  images/
server.js
Dockerfile (optional)
README.md
```

-----------------------------------------------------------------------------------------------------

## 🤝 Contributing

Pull requests are welcome.  
If you have ideas for new features — animations, themes, accessibility improvements — feel free to open an issue.

-----------------------------------------------------------------------------------------------------

## 📜 License

MIT License — free to use, modify, and share.

____________________________________________________________________________________________________



