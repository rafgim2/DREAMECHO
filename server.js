// server.js
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('🟢 Cliente conectado. Total:', clients.size);

  ws.on('message', (message) => {
    // Reenvía el mensaje a todos los demás clientes
    for (let client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('🔴 Cliente desconectado. Total:', clients.size);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Servidor WebSocket activo en el puerto 3000');
});
