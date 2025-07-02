// server.js (calibración incluida)
const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// Todos los clientes conectados
const targets = new Set();

function broadcastStats(){
  const total = targets.size;
  const msg   = JSON.stringify({ type:'stats', clients: total });
  for(const c of targets){
    if(c.readyState===WebSocket.OPEN) c.send(msg);
  }
}

wss.on('connection', ws => {
  targets.add(ws);
  // sync inicial para quien llega tarde
  ws.send(JSON.stringify({ type:'sync' }));
  broadcastStats();

  ws.on('message', raw => {
    let message;
    try { message = JSON.parse(raw); }
    catch { console.error('No JSON:', raw); return; }

    switch(message.type){
      case 'ping':
        ws.send(JSON.stringify({ type:'stats', clients: targets.size }));
        break;

      case 'midi':
      case 'calibrate':
        // reenviamos midi y calibrate a todos menos al emisor
        for(const c of targets){
          if(c!==ws && c.readyState===WebSocket.OPEN){
            c.send(raw);
          }
        }
        break;

      case 'chat':
        const chatMsg = JSON.stringify({
          type:'chat', user:message.user, text:message.text, time:Date.now()
        });
        for(const c of targets){
          if(c.readyState===WebSocket.OPEN) c.send(chatMsg);
        }
        break;

      default:
        // ignorar
        break;
    }
  });

  ws.on('close', () => {
    targets.delete(ws);
    broadcastStats();
  });
});

// resync periódico cada 20 minutos
setInterval(()=>{
  const m = JSON.stringify({ type:'sync' });
  for(const c of targets){
    if(c.readyState===WebSocket.OPEN) c.send(m);
  }
}, 20*60*1000);

const PORT = process.env.PORT||3000;
server.listen(PORT, ()=>console.log(`WS en puerto ${PORT}`));
