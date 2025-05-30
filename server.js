// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);

  // Opcional: notificar a todos los clientes que ha cambiado el número
  broadcastStats();

  ws.on('message', rawMessage => {
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch (e) {
      console.error("Mensaje no válido:", rawMessage);
      return;
    }

    if (message.type === "ping") {
      // Responder sólo al cliente que preguntó
      ws.send(JSON.stringify({
        type: "stats",
        clients: clients.size
      }));
    } else if (message.type === "midi") {
      // Reenviar el mensaje MIDI a todos menos al emisor
      for (let client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(rawMessage);
        }
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    // Opcional: notificar a todos los demás
    broadcastStats();
  });
});

// Enviar a todos los clientes el número total de conexiones
function broadcastStats() {
  const total = clients.size;
  const message = JSON.stringify({ type: "stats", clients: total });
  for (let client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket activo en el puerto ${PORT}`);
});
