const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// rooms: { pin: Set<ws> }
const rooms = {};

function broadcastStats(pin) {
  const clients = rooms[pin] ? rooms[pin].size : 0;
  const statsMsg = JSON.stringify({ type: 'stats', clients });
  for (const c of rooms[pin] || []) {
    if (c.readyState === WebSocket.OPEN) {
      c.send(statsMsg);
    }
  }
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // mensaje no JSON
    }
    const pin = msg.pin;

    // Al unirse a la sala por primera vez
    if (pin && !ws.pin) {
      ws.pin = pin;
      if (!rooms[pin]) {
        rooms[pin] = new Set();
      }
      rooms[pin].add(ws);
      broadcastStats(pin);
    }

    switch (msg.type) {
      case 'ping':
        if (ws.pin) broadcastStats(ws.pin);
        break;

      case 'chat':
        if (ws.pin) {
          const chatMsg = JSON.stringify({
            type: 'chat',
            user: msg.user,
            text: msg.text,
            time: Date.now(),
            pin: ws.pin
          });
          for (const c of rooms[ws.pin]) {
            if (c.readyState === WebSocket.OPEN) {
              c.send(chatMsg);
            }
          }
        }
        break;

      case 'signal':
        if (ws.pin) {
          const enriched = JSON.stringify({ ...msg, pin: ws.pin });
          for (const c of rooms[ws.pin]) {
            if (c !== ws && c.readyState === WebSocket.OPEN) {
              c.send(enriched);
            }
          }
        }
        break;

      case 'simon':  // SIMON: manejar partida Simon
        if (ws.pin && rooms[ws.pin]) {
          // reenviar el mensaje tal cual a todos en la sala
          for (const c of rooms[ws.pin]) {
            if (c.readyState === WebSocket.OPEN) {
              c.send(JSON.stringify(msg));
            }
          }
        }
        break;

      default:
        // otros tipos ignorados
        break;
    }
  });

  ws.on('close', () => {
    if (ws.pin && rooms[ws.pin]) {
      rooms[ws.pin].delete(ws);
      if (rooms[ws.pin].size === 0) {
        delete rooms[ws.pin];
      } else {
        broadcastStats(ws.pin);
      }
    }
  });
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket activo en el puerto ${PORT}`);
});
