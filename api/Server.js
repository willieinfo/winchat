// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3500", "http://127.0.0.1:5500"],
        methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 10e6
});

require('dotenv').config();
const PORT = process.env.PORT || 3500;
const SYSTEM = "Admin";

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray;
    }
};

// Store pending messages for users
const PendingMessages = {
    messages: {}, // { userId: [{ message, room, senderId }], ... }
    addMessage: function (userId, message, room, senderId) {
        if (!this.messages[userId]) {
            this.messages[userId] = [];
        }
        this.messages[userId].push({ message, room, senderId });
    },
    getMessages: function (userId, room) {
        if (!this.messages[userId]) return [];
        return this.messages[userId].filter(msg => msg.room === room);
    },
    clearMessages: function (userId, room) {
        if (this.messages[userId]) {
            this.messages[userId] = this.messages[userId].filter(msg => msg.room !== room);
            if (this.messages[userId].length === 0) {
                delete this.messages[userId];
            }
        }
    }
};


io.on('connection', socket => {
    socket.emit('message', buildMsg(SYSTEM, "Welcome to WinChat!"));

    socket.on('requestUserList', () => {
        socket.emit('userList', {
            users: getAllUsers(),
            pendingMessages: getPendingMessagesForAllUsers()
        });
    });

    socket.on('enterApp', ({ name }) => {
        const user = activateUser(socket.id, name, null);
        io.emit('userList', {
            users: getAllUsers(),
            pendingMessages: getPendingMessagesForAllUsers()
        });
        socket.emit('message', buildMsg(SYSTEM, `You have joined WinChat`));
        socket.broadcast.emit('message', buildMsg(SYSTEM, `${user.name} has joined WinChat`));
    });

    socket.on('joinPrivateRoom', ({ name, targetUser }) => {
        const user = getUser(socket.id);
        if (!user) return;

        const room = getPrivateRoomId(name, targetUser);
        const prevRoom = user.room;

        if (prevRoom) {
            socket.leave(prevRoom);
        }

        user.room = room;
        UsersState.setUsers([...UsersState.users]);

        socket.join(room);
        // socket.emit('message', buildMsg(SYSTEM, `You have started a chat with ${targetUser}`));

        // Deliver any pending messages for this room
        const targetUserId = getUserSocketIdByName(targetUser);
        const pendingMessages = PendingMessages.getMessages(socket.id, room);
        pendingMessages.forEach(({ message }) => {
            socket.emit('message', message);
        });
        PendingMessages.clearMessages(socket.id, room);

        // Update user list with pending message counts
        io.emit('userList', {
            users: getAllUsers(),
            pendingMessages: getPendingMessagesForAllUsers()
        });
    });

    socket.on('disconnect', () => {
        const user = getUser(socket.id);
        userLeavesApp(socket.id);
        if (user) {
            io.emit('message', buildMsg(SYSTEM, `${user.name} has left WinChat`));
            io.emit('userList', {
                users: getAllUsers(),
                pendingMessages: getPendingMessagesForAllUsers()
            });
            // Clear pending messages for disconnected user
            delete PendingMessages.messages[socket.id];
        }
    });

    socket.on('message', ({ name, text, room, type, fileName }) => {
        const message = buildMsg(name, text, room, type, fileName);
        if (room) {
            // Find the target user (other user in the private room)
            const usersInRoom = room.split('_');
            const targetUserName = usersInRoom.find(u => u !== name);
            const targetUser = UsersState.users.find(u => u.name === targetUserName);
            
            if (targetUser) {
                // Check if target user is in the same room
                if (targetUser.room === room) {
                    io.to(room).emit('message', message);
                } else {
                    // Queue the message and notify the target user
                    PendingMessages.addMessage(targetUser.id, message, room, socket.id);
                    io.to(targetUser.id).emit('notification', {
                        from: name,
                        room
                    });
                    // Emit to sender to display the message immediately
                    socket.emit('message', message);
                }
            } else {
                // If target user is not found, still emit to sender
                socket.emit('message', message);
            }
        } else {
            // Broadcast to all users
            io.emit('message', message);
        }
    });


    socket.on('activity', ({ name, room }) => {
        if (room) {
            socket.broadcast.to(room).emit('activity', name);
        } else {
            socket.broadcast.emit('activity', name);
        }
    });

    // Voice call handlers 
    socket.on('voice-offer', ({ target, offer }) => {
        const targetSocket = getUserSocketIdByName(target);
        if (targetSocket) {
            io.to(targetSocket).emit('voice-offer', {
                from: getUser(socket.id).name,
                offer
            });
        }
    });

    socket.on('voice-reject', ({ target }) => {
        const targetSocket = getUserSocketIdByName(target);
        if (targetSocket) {
            io.to(targetSocket).emit('voice-rejected', {
                message: "The call was rejected."
            });
        }
    });

    socket.on('voice-answer', ({ target, answer }) => {
        const targetSocket = getUserSocketIdByName(target);
        if (targetSocket) {
            io.to(targetSocket).emit('voice-answer', {
                answer
            });
        }
    });

    socket.on('ice-candidate', ({ target, candidate }) => {
        const targetSocket = getUserSocketIdByName(target);
        if (targetSocket) {
            io.to(targetSocket).emit('ice-candidate', {
                candidate
            });
        }
    });
});

function getUserSocketIdByName(name) {
    const user = UsersState.users.find(u => u.name === name);
    return user?.id;
}

function buildMsg(name, text, room = null, type = 'text', fileName = '') {
    return {
        name,
        text,
        date: new Intl.DateTimeFormat('default', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        }).format(new Date()),
        time: new Intl.DateTimeFormat('default', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date()),
        room,
        type,
        fileName
    };
}

function activateUser(id, name, room) {
    const user = { id, name, room };
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ]);
    return user;
}

function userLeavesApp(id) {
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    );
}

function getUser(id) {
    return UsersState.users.find(user => user.id === id);
}

function getAllUsers() {
    return UsersState.users;
}

function getPrivateRoomId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// Helper function to get pending message counts for all users
function getPendingMessagesForAllUsers() {
    const pendingCounts = {};
    Object.keys(PendingMessages.messages).forEach(userId => {
        const user = getUser(userId);
        if (user) {
            const counts = {};
            PendingMessages.messages[userId].forEach(({ room }) => {
                const otherUser = room.split('_').find(name => name !== user.name);
                counts[otherUser] = (counts[otherUser] || 0) + 1;
            });
            pendingCounts[user.name] = counts;
        }
    });
    return pendingCounts;
}

server.listen(PORT, () => {
    console.log(`WinChat Server is running on http://localhost:${PORT}`);
});