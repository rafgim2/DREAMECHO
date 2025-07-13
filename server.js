const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// Mantiene todos los clientes conectados
const clients = new Set();

// Envía a todos el número de conexiones
function broadcastStats() {
  const total = clients.size;
  const msg   = JSON.stringify({ type: 'stats', clients: total });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

wss.on('connection', ws => {
  // Añadimos el nuevo cliente
  clients.add(ws);
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
        // Responder estadísticas solo a este cliente
        ws.send(JSON.stringify({ type: 'stats', clients: clients.size }));
        break;

      case 'chat':
        // Reenviar chat a todos
        const chatMsg = JSON.stringify({
          type: 'chat',
          user: message.user,
          text: message.text,
          time: Date.now()
        });
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(chatMsg);
          }
        }
        break;

      case 'signal':
        // Reenviar ofertas/respuestas/candidatos ICE a todos excepto al emisor
        for (const client of clients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(raw);
          }
        }
        break;

      default:
        // Ignorar otros tipos (antes: 'midi', etc.)
        break;
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastStats();
  });
});

// Servir archivos estáticos desde /public si los pones ahí
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket activo en el puerto ${PORT}`);
});
