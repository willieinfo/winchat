const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "http://127.0.0.1:5500"],
        methods: ["GET", "POST"],
    },
});

const PORT = process.env.PORT || 3000;
const SYSTEM = "Admin";

app.use(express.static(path.join(__dirname, '../FrontEnd')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../FrontEnd', 'index.html'));
});

const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray;
    }
};

io.on('connection', socket => {
    socket.emit('message', buildMsg(SYSTEM, "Welcome to WinChat!"));

    socket.on('enterApp', ({ name }) => {
        const user = activateUser(socket.id, name, null);
        io.emit('userList', {
            users: getAllUsers()
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
        socket.emit('message', buildMsg(SYSTEM, `You have started a chat with ${targetUser}`));
    });

    socket.on('disconnect', () => {
        const user = getUser(socket.id);
        userLeavesApp(socket.id);
        if (user) {
            io.emit('message', buildMsg(SYSTEM, `${user.name} has left WinChat`));
            io.emit('userList', {
                users: getAllUsers()
            });
        }
    });

    socket.on('message', ({ name, text, room }) => {
        if (room) {
            // Send to specific private room
            io.to(room).emit('message', buildMsg(name, text, room));
        } else {
            // Broadcast to all users
            io.emit('message', buildMsg(name, text, null));
        }
    });    

    socket.on('activity', ({ name, room }) => {
        if (room) {
            socket.broadcast.to(room).emit('activity', name);
        } else {
            socket.broadcast.emit('activity', name);
        }
    });
});

function buildMsg(name, text, room = null) {
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
        room
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

server.listen(PORT, () => {
    console.log(`WinChat Server is running on http://localhost:${PORT}`);
});