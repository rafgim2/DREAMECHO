// server.js
// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Almacena todos los clientes conectados
const clients = new Set();

// Función genérica para enviar un mensaje a todos (opcionalmente excluyendo uno)
function broadcast(message, exclude) {
  for (const client of clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Envía estadísticas de número de clientes a todos
function broadcastStats() {
  const statsMsg = JSON.stringify({ type: 'stats', clients: clients.size });
  broadcast(statsMsg, null);
}

wss.on('connection', (ws) => {
  // Nuevo cliente
  clients.add(ws);
  broadcastStats();

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      console.error('JSON inválido:', data);
      return;
    }

    switch (msg.type) {
      case 'ping':
        // Responde al ping con estadísticas
        ws.send(JSON.stringify({ type: 'stats', clients: clients.size }));
        break;

      case 'stats':
        // También permitimos solicitar stats explícitamente
        ws.send(JSON.stringify({ type: 'stats', clients: clients.size }));
        break;

      case 'chat':
        // Reenvía chat a todos
        broadcast(JSON.stringify({
          type: 'chat',
          user: msg.user,
          text: msg.text,
          time: Date.now()
        }), null);
        break;

      case 'midi':
        // Reenvía datos MIDI a todos excepto emisor
        broadcast(data, ws);
        break;

      case 'signal':
        // Reenvía señalización WebRTC a todos excepto emisor
        broadcast(data, ws);
        break;

      default:
        console.warn('Tipo de mensaje desconocido:', msg.type);
    }
  });

  ws.on('close', () => {
    // Cliente desconectado
    clients.delete(ws);
    broadcastStats();
  });

  ws.on('error', (err) => {
    console.error('Error WebSocket:', err);
  });
});

// Puerto de escucha
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket activo en el puerto ${PORT}`);
});

