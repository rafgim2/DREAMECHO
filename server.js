// server.js
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const ytdl      = require('ytdl-core');       // para extraer manifiesto HLS
const cors      = require('cors');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// Permitir CORS en el endpoint de manifest
app.use(cors());

// Endpoint para obtener el URL de manifiesto HLS a partir de una URL de YouTube
app.get('/manifest', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'Falta parámetro url' });
  }
  try {
    // Obtenemos información del vídeo
    const info = await ytdl.getInfo(videoUrl);
    // Buscamos formatos HLS (application/vnd.apple.mpegurl)
    const hls = info.formats.find(f =>
      f.mimeType && f.mimeType.includes('application/vnd.apple.mpegurl')
    );
    if (!hls || !hls.url) {
      return res.status(404).json({ error: 'No se encontró manifiesto HLS' });
    }
    // Devolvemos la URL del manifiesto
    res.json({ manifestUrl: hls.url });
  } catch (err) {
    console.error('Error al extraer manifiesto HLS:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ——— Lógica WebSocket para MIDI, chat y calibración ———
const clients = new Set();

function broadcastStats() {
  const msg = JSON.stringify({ type: 'stats', clients: clients.size });
  for (let c of clients) {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  }
}

// Cada 20 minutos, reenviamos un sync a todos
setInterval(() => {
  const msg = JSON.stringify({ type: 'sync' });
  for (let c of clients) {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  }
}, 20 * 60 * 1000);

wss.on('connection', ws => {
  clients.add(ws);
  // Sync inicial
  ws.send(JSON.stringify({ type: 'sync' }));
  broadcastStats();

  ws.on('message', raw => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      console.error('Mensaje no JSON:', raw);
      return;
    }

    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'stats', clients: clients.size }));
        break;

      case 'midi':
      case 'calibrate':
        // reenviar MIDI y calibración a todos excepto al emisor
        for (let c of clients) {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            c.send(raw);
          }
        }
        break;

      case 'chat':
        const chatMsg = JSON.stringify({
          type: 'chat',
          user: message.user,
          text: message.text,
          time: Date.now()
        });
        for (let c of clients) {
          if (c.readyState === WebSocket.OPEN) {
            c.send(chatMsg);
          }
        }
        break;

      default:
        // ignorar otros tipos
        break;
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastStats();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
