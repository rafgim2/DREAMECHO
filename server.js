const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

function roomStats(pin) {
  const clients = rooms[pin] || new Set();
  return { type: 'stats', clients: clients.size };
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    const pin = message.pin;
    if (pin && !ws.pin) {
      ws.pin = pin;
      if (!rooms[pin]) rooms[pin] = new Set();
      rooms[pin].add(ws);
    }
    switch (message.type) {
      case 'ping':
        if (ws.pin) {
          ws.send(JSON.stringify(roomStats(ws.pin)));
        }
        break;
      case 'chat':
        if (ws.pin) {
          const chatMsg = JSON.stringify({
            type: 'chat',
            user: message.user,
            text: message.text,
            time: Date.now()
          });
          for (const client of rooms[ws.pin]) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(chatMsg);
            }
          }
        }
        break;
      case 'signal':
        if (ws.pin) {
          for (const client of rooms[ws.pin]) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(raw);
            }
          }
        }
        break;
    }
  });

  ws.on('close', () => {
    if (ws.pin && rooms[ws.pin]) {
      rooms[ws.pin].delete(ws);
      if (rooms[ws.pin].size === 0) {
        delete rooms[ws.pin];
      } else {
        const stats = JSON.stringify(roomStats(ws.pin));
        for (const client of rooms[ws.pin]) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(stats);
          }
        }
      }
    }
  });
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket activo en el puerto ${PORT}`);
});
