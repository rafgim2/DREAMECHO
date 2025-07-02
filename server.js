// server.js
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// Mantiene todos los clientes conectados
targets = new Set();

// Función para enviar a todos los clientes el número de conexiones
function broadcastStats() {
  const total = targets.size;
  const msg   = JSON.stringify({ type: 'stats', clients: total });
  for (let client of targets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

wss.on('connection', ws => {
  // Añadimos el nuevo cliente
targets.add(ws);

  // —— Envío inmediato de sincronización inicial solo al nuevo cliente ——
  ws.send(JSON.stringify({ type: 'sync' }));
  // ————————————————————————————————————————————————

  // Notificar a todos del nuevo total
  broadcastStats();

  ws.on('message', raw => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch (e) {
      console.error('Mensaje no válido:', raw);
      return;
    }

    switch (message.type) {
      case 'ping':
        // Responder sólo a este cliente
        ws.send(JSON.stringify({
          type: 'stats',
          clients: targets.size
        }));
        break;

      case 'midi':
        // Reenviar mensaje MIDI a todos excepto al emisor
        for (let client of targets) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(raw);
          }
        }
        break;

      case 'chat':
        // Reenviar chat a todos
        const chatMsg = JSON.stringify({
          type: 'chat',
          user: message.user,
          text: message.text,
          time: Date.now()
        });
        for (let client of targets) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(chatMsg);
          }
        }
        break;

      default:
        // Ignorar otros tipos
        break;
    }
  });

  ws.on('close', () => {
    targets.delete(ws);
    // Notificar a todos del nuevo total tras desconexión
    broadcastStats();
  });
});

// —— Envío periódico de sincronización a todos cada 20 minutos ——
setInterval(() => {
  const syncMsg = JSON.stringify({ type: 'sync' });
  for (let client of targets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(syncMsg);
    }
  }
}, 20 * 60 * 1000);
// ————————————————————————————————————————————————

// Opcional: servir archivos estáticos (HTML, JS, CSS) en /public
// app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket activo en el puerto ${PORT}`);
});
