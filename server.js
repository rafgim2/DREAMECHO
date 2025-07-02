// server.js
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const ytdl      = require('ytdl-core');
const cors      = require('cors');
const path      = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// 1) Habilitar CORS para /manifest y para tu cliente
app.use(cors());

// 2) Servir estáticos desde ./public (coloca aquí tu oyente.html, artista.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// 3) Endpoint /manifest que recibe ?url=<URL de YouTube>
app.get('/manifest', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'Falta parámetro url' });
  }
  try {
    const info = await ytdl.getInfo(videoUrl);
    // buscamos el formato HLS
    const hlsFormat = info.formats.find(f =>
      f.mimeType && f.mimeType.includes('application/vnd.apple.mpegurl')
    );
    if (!hlsFormat || !hlsFormat.url) {
      console.error('No se encontró HLS en formats:', info.formats.map(f => f.mimeType));
      return res.status(404).json({ error: 'No se encontró manifiesto HLS' });
    }
    console.log('-> manifestUrl:', hlsFormat.url);
    return res.json({ manifestUrl: hlsFormat.url });
  } catch (err) {
    console.error('Error extrayendo manifiesto HLS:', err);
    return res.status(500).json({ error: 'Error interno al obtener manifiesto' });
  }
});

// ——— WebSocket: MIDI, chat, calibración ———
const clients = new Set();

function broadcastStats() {
  const msg = JSON.stringify({ type: 'stats', clients: clients.size });
  for (let c of clients) {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  }
}

// reenviar un sync cada 20 minutos
setInterval(() => {
  const sync = JSON.stringify({ type: 'sync' });
  for (let c of clients) {
    if (c.readyState === WebSocket.OPEN) c.send(sync);
  }
}, 20 * 60 * 1000);

wss.on('connection', ws => {
  clients.add(ws);
  // primer sync al conectar
  ws.send(JSON.stringify({ type: 'sync' }));
  broadcastStats();

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); }
    catch { return console.warn('Recibido no-JSON:', raw); }

    switch (msg.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'stats', clients: clients.size }));
        break;

      case 'midi':
      case 'calibrate':
        // reenviar MIDI y calibración a todos salvo al emisor
        for (let c of clients) {
          if (c !== ws && c.readyState === WebSocket.OPEN) {
            c.send(raw);
          }
        }
        break;

      case 'chat':
        const chat = JSON.stringify({
          type: 'chat',
          user: msg.user,
          text: msg.text,
          time: Date.now()
        });
        for (let c of clients) {
          if (c.readyState === WebSocket.OPEN) c.send(chat);
        }
        break;

      default:
        // ignorar
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
  console.log(`Servidor HTTP + WS escuchando en puerto ${PORT}`);
  console.log(`→ Abre http://localhost:${PORT}/oyente.html en tu navegador`);
});
