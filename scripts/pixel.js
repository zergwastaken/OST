const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const BOARD_SIZE = 100; // 100x100 grid

// Initialize empty board state (white pixels)
let boardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('#FFFFFF'));

// Serve static frontend files
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send the current board state to the newly connected user
    socket.emit('init-board', boardState);

    // Listen for pixel updates from clients
    socket.on('draw-pixel', (data) => {
        const { x, y, color } = data;

        // Validate bounds
        if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            // Update in-memory state
            boardState[y][x] = color;

            // Broadcast the update to all other connected users
            socket.broadcast.emit('pixel-updated', { x, y, color });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
