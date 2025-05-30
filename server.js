// server.js
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// Mantiene todos los clientes conectados
const clients = new Set();

// Función para enviar a todos los clientes el número de conexiones
function broadcastStats() {
  const total = clients.size;
  const msg   = JSON.stringify({ type: 'stats', clients: total });
  for (let client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

wss.on('connection', ws => {
  // Añadimos el nuevo cliente
  clients.add(ws);

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
          clients: clients.size
        }));
        break;

      case 'midi':
        // Reenviar mensaje MIDI a todos excepto al emisor
        for (let client of clients) {
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
        for (let client of clients) {
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
    clients.delete(ws);
    // Notificar a todos del nuevo total tras desconexión
    broadcastStats();
  });
});

// Opcional: servir archivos estáticos (HTML, JS, CSS) en /public
// app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket activo en el puerto ${PORT}`);
});
