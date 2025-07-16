const express   = require('express')
const http      = require('http')
const WebSocket = require('ws')

const app    = express()
const server = http.createServer(app)
const wss    = new WebSocket.Server({ server })

const rooms = new Map()

function broadcastStats(room) {
  const clients = rooms.get(room) || new Set()
  const total = clients.size
  const msg   = JSON.stringify({ type: 'stats', clients: total })
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg)
    }
  }
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let message
    try {
      message = JSON.parse(raw)
    } catch {
      return
    }
    switch (message.type) {
      case 'join':
        ws.role = message.role
        ws.room = message.pin
        if (!rooms.has(ws.room)) {
          rooms.set(ws.room, new Set())
        }
        rooms.get(ws.room).add(ws)
        broadcastStats(ws.room)
        break

      case 'chat':
        {
          const clients = rooms.get(ws.room) || new Set()
          const chatMsg = JSON.stringify({
            type: 'chat',
            user: message.user,
            text: message.text,
            time: Date.now()
          })
          for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(chatMsg)
            }
          }
        }
        break

      case 'signal':
        {
          const clients = rooms.get(ws.room) || new Set()
          for (const client of clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(raw)
            }
          }
        }
        break
    }
  })

  ws.on('close', () => {
    if (ws.room && rooms.has(ws.room)) {
      rooms.get(ws.room).delete(ws)
      if (rooms.get(ws.room).size === 0) {
        rooms.delete(ws.room)
      } else {
        broadcastStats(ws.room)
      }
    }
  })
})

app.use(express.static('public'))

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Servidor WebSocket activo en el puerto ${PORT}`)
})
