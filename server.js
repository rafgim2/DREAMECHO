const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Cada sala: conjunto de sockets y array de señales (offer/answer/candidates)
const rooms = {};        // { pin: Set<ws> }
const roomSignals = {};  // { pin: Array<string> }

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

    // Si llega un mensaje con pin y este socket aún no está asignado, lo añadimos
    if (pin && !ws.pin) {
      ws.pin = pin;
      if (!rooms[pin]) {
        rooms[pin] = new Set();
        roomSignals[pin] = [];
      }
      rooms[pin].add(ws);
      // Reenviamos todas las señales almacenadas a este nuevo cliente
      for (const sig of roomSignals[pin]) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(sig);
        }
      }
      // Y actualizamos estadísticas
      const statsMsg = JSON.stringify(roomStats(pin));
      for (const c of rooms[pin]) {
        if (c.readyState === WebSocket.OPEN) {
          c.send(statsMsg);
        }
      }
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
          // Creamos la señal enriquecida con el pin
          const enriched = JSON.stringify({ ...message, pin: ws.pin });
          // La almacenamos
          roomSignals[ws.pin].push(enriched);
          // Y la reenviamos a todos excepto al emisor
          for (const c of rooms[ws.pin]) {
            if (c !== ws && c.readyState === WebSocket.OPEN) {
              c.send(enriched);
            }
          }
        }
        break;

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (ws.pin && rooms[ws.pin]) {
      rooms[ws.pin].delete(ws);
      if (rooms[ws.pin].size === 0) {
        delete rooms[ws.pin];
        delete roomSignals[ws.pin];
      } else {
        const statsMsg = JSON.stringify(roomStats(ws.pin));
        for (const c of rooms[ws.pin]) {
          if (c.readyState === WebSocket.OPEN) {
            c.send(statsMsg);
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
