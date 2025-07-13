// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname)));

const clients = new Set();

function broadcastStats() {
  const msg = JSON.stringify({ type: 'stats', clients: clients.size });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

wss.on('connection', ws => {
  clients.add(ws);
  broadcastStats();

  ws.on('message', raw => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch (e) {
      console.error(raw);
      return;
    }
    const { type } = message;
    if (type === 'ping') {
      ws.send(JSON.stringify({ type: 'stats', clients: clients.size }));
    } else if (type === 'chat' || type === 'midi' || type === 'signal') {
      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(raw);
        }
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastStats();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor HTTP + WS escuchando en puerto ${PORT}`);
  console.log(`→ Abre http://localhost:${PORT}/oyente.html en tu navegador`);
});
