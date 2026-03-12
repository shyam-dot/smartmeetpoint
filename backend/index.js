const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store session data in memory. Key: sessionId, Value: array of friend objects
const sessions = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // A user joins a specific session/room
  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
    console.log(`User ${socket.id} joined session ${sessionId}`);
    
    // Optionally send current state immediately upon joining
    if (sessions[sessionId]) {
      socket.emit('update_friends', sessions[sessionId]);
    }
  });

  // When a user updates the friends list in their session
  socket.on('sync_friends', (data) => {
    const { sessionId, friends } = data;
    
    // Update the server's state for this session
    sessions[sessionId] = friends;
    
    // Broadcast the updated list to ALL other clients in the exact same session
    socket.to(sessionId).emit('update_friends', friends);
  });

  socket.on('sync_live_location', (data) => {
    socket.to(data.sessionId).emit('update_live_location', data);
  });

  socket.on('stop_live_location', (data) => {
    if (data && data.sessionId) {
      socket.to(data.sessionId).emit('remove_live_location', data.userId);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO Server running on port ${PORT}`);
});
