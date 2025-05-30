// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

wss.on('connection', ws => {
  // Añadimos el nuevo cliente
  clients.add(ws);
  // Enviamos sólo a este cliente el número total de conexiones
  ws.send(JSON.stringify({
    type: 'stats',
    clients: clients.size
  }));

  ws.on('message', message => {
    // Reenviamos cada mensaje MIDI a todos los demás clientes
    for (let client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Servimos en el puerto 3000 o el que indique RENDER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket activo en el puerto ${PORT}`);
});
