import { MessageBox } from "./functlib.js";
import { initVoiceCallFeatures } from './voiceCall.js';

const msgInput = document.querySelector('#message');
const nameInput = document.querySelector('#name');
const activity = document.querySelector('.activity');
const userName = document.querySelector('.user-name');
const chatDisplay = document.querySelector('.chat-display');

const chatEraser = document.querySelector('#chatEraser');
const chatSmile = document.querySelector('#chat-smile');
const chatImages = document.querySelector('#chat-images');
const chatPaperClip = document.querySelector('#chat-paperclip');

chatSmile.addEventListener('click', sendSmiley);
chatPaperClip.addEventListener('click', send_a_File);
chatImages.addEventListener('click', sendImage);

document.querySelector('.form-msg').addEventListener('submit', sendMessage);
document.querySelector('.form-join').addEventListener('submit', enterApp);

const socket = io('http://localhost:3500');
// const socket = io(
//     window.location.hostname === 'localhost'
//         ? 'http://localhost:3500'
//         : 'https://winchat.onrender.com'
// );


let selectedUser = null;

socket.on("message", (data) => {
    const { name, text, time, room, type, fileName } = data;
    if (
        (selectedUser && room === getPrivateRoomId(nameInput.value, selectedUser.name)) ||
        room === null
    ) {
        let fromUser = name === nameInput.value;
        const li = document.createElement('li');
        li.className = fromUser ? 'post post--right' : 'post post--left';
        if (name === 'Admin') {
            li.innerHTML = `<div class="post__admin">${text}</div>`;
            li.className = "post__admin";
        } else if (type === 'image') {
            li.innerHTML = `
                <div class="post__text ${fromUser ? 'post__text--user' : 'post__text--reply'}">
                    <img src="${text}" alt="${fileName}" style="max-width: 200px; max-height: 200px;" />
                </div>
                <div class="post__header ${fromUser ? 'post__header--user' : 'post__header--reply'}">
                    <span class="post__header--name">${fromUser ? '' : name}${room === null ? ' (All)' : ''}</span> 
                    <span class="post__header--time">${time}</span> 
                </div>`;
        } else if (type === 'file') {
            li.innerHTML = `
                <div class="post__text ${fromUser ? 'post__text--user' : 'post__text--reply'}">
                    <a href="${text}" download="${fileName}">${fileName}</a>
                </div>
                <div class="post__header ${fromUser ? 'post__header--user' : 'post__header--reply'}">
                    <span class="post__header--name">${fromUser ? '' : name}${room === null ? ' (All)' : ''}</span> 
                    <span class="post__header--time">${time}</span> 
                </div>`;
        } else {
            li.innerHTML = `
                <div class="post__text ${fromUser ? 'post__text--user' : 'post__text--reply'}">${text}</div>
                <div class="post__header ${fromUser ? 'post__header--user' : 'post__header--reply'}">
                    <span class="post__header--name">${fromUser ? '' : name}${room === null ? ' (All)' : ''}</span> 
                    <span class="post__header--time">${time}</span> 
                </div>`;
        }
        chatDisplay.appendChild(li);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

    saveMessages(data, room);
});

let activityTimer;
socket.on("activity", (name) => {
    if (selectedUser) {
        activity.textContent = `${name} is typing...`;
        clearTimeout(activityTimer);
        activityTimer = setTimeout(() => {
            activity.textContent = "";
        }, 2000);
    }
});

socket.on('notification', ({ from, room }) => {
    socket.emit('requestUserList');
});

socket.on('userList', ({ users, pendingMessages }) => {
    showUsers(users, pendingMessages);
});


function showUsers(users, pendingMessages) {
    if (!users) return;

    // Map existing usernames in DOM
    const existingUserNames = Array.from(userName.querySelectorAll('.userItem'))
        .map(item => item.dataset.username);

    // Build a quick lookup for incoming user list
    const incomingNames = users.map(u => u.name);

    // Remove only users who are not in the list at all
    // (They must be gone from server *and* offline)
    userName.querySelectorAll('.userItem').forEach(item => {
        const username = item.dataset.username;
        if (!incomingNames.includes(username)) {
            item.remove();
        }
    });

    // Merge: add new users or update existing ones
    users.forEach((user) => {
        if (user.name === nameInput.value) return; // skip self

        let userItem = userName.querySelector(`.userItem[data-username="${user.name}"]`);
        if (!userItem) {
            // --- Create a new DOM element for the user ---
            userItem = document.createElement('li');
            userItem.className = 'userItem';
            userItem.dataset.username = user.name;

            const initials = getUserInitials(user.name);
            const userIcon = document.createElement('div');
            userIcon.className = 'userIcon';
            userIcon.innerHTML = initials;
            userIcon.style.backgroundColor = getUserColor(user.name);

            // Add notification badge
            const pendingCount =
                pendingMessages?.[nameInput.value]?.[user.name] || 0;

            if (pendingCount > 0) {
                const badge = document.createElement('span');
                badge.className = 'notification-badge';
                badge.textContent = pendingCount;
                badge.style.backgroundColor = '#ff4d4f';
                badge.style.color = '#fff';
                badge.style.borderRadius = '50%';
                badge.style.padding = '2px 6px';
                badge.style.fontSize = '12px';
                badge.style.position = 'absolute';
                badge.style.top = '-5px';
                badge.style.right = '-5px';
                badge.style.zIndex = '10';
                badge.classList.add('pop');
                setTimeout(() => badge.classList.remove('pop'), 300);
                userIcon.appendChild(badge);
            }

            userItem.appendChild(userIcon);
            const userNameText = document.createElement('span');
            userNameText.textContent = user.name;
            userItem.appendChild(userNameText);

            userItem.addEventListener('click', () => {
                selectedUser = user;
                chatDisplay.innerHTML = '';
                userName.querySelectorAll('.userItem').forEach(item => item.classList.remove('selected'));
                userItem.classList.add('selected');
                activity.textContent = `Chatting with ${user.name}`;
                const room = getPrivateRoomId(nameInput.value, user.name);
                socket.emit('joinPrivateRoom', { name: nameInput.value, targetUser: user.name });
                loadMessages(room);
            });

            userName.appendChild(userItem);
        }

        // Keep selected state
        if (selectedUser && selectedUser.name === user.name) {
            userItem.classList.add('selected');
        } else {
            userItem.classList.remove('selected');
        }
    });

    // Keep chatEraser bound
    chatEraser.removeEventListener('click', clearChatHandler);
    chatEraser.addEventListener('click', clearChatHandler);
}

function clearChatHandler() {
    const room = selectedUser ? getPrivateRoomId(nameInput.value, selectedUser.name) : null;
    deleteMessages(room);
    chatDisplay.innerHTML = '';
    updateChatDisplay('Chat history cleared');
}
    
function getUserColor(username) {
    // Simple hash from string
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert hash to hex color
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).slice(-2);
    }
    return color;
}

function getUserInitials(userName) {
    const nameParts = userName.split(' '); // Split name into words
    const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join(''); // Get the first letter of each word
    return initials.length > 2 ? initials.substring(0, 2) : initials; // Only take the first 2 letters
}

function updateChatDisplay(message) {
    const li = document.createElement('li');
    li.innerHTML = `<div class="post__admin">${message}</div>`;
    li.className = "post__admin";
    chatDisplay.appendChild(li);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function sendMessage(e) {
    e.preventDefault();

    const sendAllUsers = document.querySelector('#sendAllUsers').checked;
    const name = nameInput.value.trim();
    const message = msgInput.value.trim();
    const hasSelectedUser = selectedUser && selectedUser.name;

    // Check if all are empty or invalid
    if (!name || !message || (!sendAllUsers && !hasSelectedUser)) {
        MessageBox('Fill in all fields and select a user or check All Users.', 'Ok');
        msgInput.focus();
        return;
    }

    let room = null;
    let chatMessage = {
        name,
        text: message,
        date: getDate_Now(),
        time: getTime_Now(),
        room: null
    };

    if (!sendAllUsers && hasSelectedUser) {
        room = getPrivateRoomId(name, selectedUser.name);
        chatMessage.room = room;
    }

    socket.emit('message', chatMessage);
    msgInput.value = '';
    msgInput.rows = '2';
    msgInput.focus();

    // saveMessages(chatMessage, room);
}

function enterApp(e) {
    e.preventDefault();
    if (nameInput.value) {
        socket.emit('enterApp', {
            name: nameInput.value
        });
        document.querySelector('.form-join').style.display = 'none';
        document.querySelector('.form-msg').style.display = 'flex';
        // Load global chat messages (room: null)
        loadMessages(null);
    }
}

function getPrivateRoomId(user1, user2) {
    // Create a consistent room ID by sorting names
    return [user1, user2].sort().join('_');
}

function getTime_Now() {
    const date = new Date();
    const cTime_Now = new Intl.DateTimeFormat('default', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    }).format(date);
    return cTime_Now;
}

function getDate_Now() {
    const date = new Date();
    const cDate_Now = new Intl.DateTimeFormat('default', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).format(date);
    return cDate_Now;
}

// Loading, Saving, Deleting messages to / from localStorage
function saveMessages(data, room) {
    let messages = JSON.parse(localStorage.getItem(`chatMessages_${room}`) || '[]');
    // Check if the message already exists to prevent duplicates
    const exists = messages.some(
        msg => 
            msg.name === data.name &&
            msg.text === data.text &&
            msg.time === data.time &&
            msg.room === data.room
    );
    if (!exists) {
        messages.push(data);
        localStorage.setItem(`chatMessages_${room}`, JSON.stringify(messages));
    }
}

function loadMessages(room) {
    const messages = JSON.parse(localStorage.getItem(`chatMessages_${room}`) || '[]');
    chatDisplay.innerHTML = ''; // Clear current chat display
    // Optional: Filter duplicates when rendering (in case duplicates exist in localStorage)
    const uniqueMessages = messages.filter((msg, index, self) =>
        index === self.findIndex(
            m => 
                m.name === msg.name &&
                m.text === msg.text &&
                m.time === msg.time &&
                m.room === msg.room
        )
    );
    uniqueMessages.forEach(data => {
        const { name, text, time, room: messageRoom, type, fileName } = data;
        const fromUser = name === nameInput.value;
        const li = document.createElement('li');
        
        if (text.includes('Welcome') || text.includes('joined')) return;
        
        li.className = fromUser ? 'post post--right' : 'post post--left';
        if (name === 'Admin') {
            li.innerHTML = `<div class="post__admin">${text}</div>`;
            li.className = "post__admin";
        } else if (type === 'image') {
            li.innerHTML = `
                <div class="post__text ${fromUser ? 'post__text--user' : 'post__text--reply'}">
                    <img src="${text}" alt="${fileName}" style="max-width: 200px; max-height: 200px;" />
                </div>
                <div class="post__header ${fromUser ? 'post__header--user' : 'post__header--reply'}">
                    <span class="post__header--name">${fromUser ? '' : name}${messageRoom === null ? ' (All)' : ''}</span> 
                    <span class="post__header--time">${time}</span> 
                </div>`;
        } else if (type === 'file') {
            li.innerHTML = `
                <div class="post__text ${fromUser ? 'post__text--user' : 'post__text--reply'}">
                    <a href="${text}" download="${fileName}">${fileName}</a>
                </div>
                <div class="post__header ${fromUser ? 'post__header--user' : 'post__header--reply'}">
                    <span class="post__header--name">${fromUser ? '' : name}${messageRoom === null ? ' (All)' : ''}</span> 
                    <span class="post__header--time">${time}</span> 
                </div>`;
        } else {
            li.innerHTML = `
                <div class="post__text ${fromUser ? 'post__text--user' : 'post__text--reply'}">${text}</div>
                <div class="post__header ${fromUser ? 'post__header--user' : 'post__header--reply'}">
                    <span class="post__header--name">${fromUser ? '' : name}${messageRoom === null ? ' (All)' : ''}</span> 
                    <span class="post__header--time">${time}</span> 
                </div>`;
        }
        chatDisplay.appendChild(li);
    });
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}


function deleteMessages(room) {
    localStorage.removeItem(`chatMessages_${room}`);
}

function sendSmiley() {
    const emoticons = ['😊', '🥰', '😂', '😍', '😎', '😢', '😡', '👍', '👏', '🙌','🍻','✌️'];
    const smileyPicker = document.createElement('div');
    smileyPicker.className = 'smiley-picker';
    smileyPicker.style.position = 'absolute';
    smileyPicker.style.background = '#fff';
    smileyPicker.style.border = '1px solid #ccc';
    smileyPicker.style.padding = '10px';
    smileyPicker.style.zIndex = '1000';
    smileyPicker.style.display = 'flex';
    smileyPicker.style.flexWrap = 'wrap';
    smileyPicker.style.gap = '10px';

    emoticons.forEach(emoji => {
        const button = document.createElement('button');
        button.textContent = emoji;
        button.style.fontSize = '20px';
        button.style.border = 'none';
        button.style.background = 'none';
        button.style.cursor = 'pointer';
        button.addEventListener('click', () => {
            msgInput.value += emoji;
            msgInput.focus();
            smileyPicker.remove();
            // Emit activity to show typing
            const sendAllUsers = document.querySelector('#sendAllUsers').checked;
            if (sendAllUsers) {
                socket.emit('activity', { name: nameInput.value, room: null });
            } else if (selectedUser) {
                socket.emit('activity', { name: nameInput.value, room: getPrivateRoomId(nameInput.value, selectedUser.name) });
            }
        });
        smileyPicker.appendChild(button);
    });

    const chatSmileRect = chatSmile.getBoundingClientRect();
    smileyPicker.style.top = `${chatSmileRect.top - 50}px`;
    smileyPicker.style.left = `${chatSmileRect.left}px`;
    document.body.appendChild(smileyPicker);

    // Close picker when clicking outside
    const closePicker = (e) => {
        if (!smileyPicker.contains(e.target) && e.target !== chatSmile) {
            smileyPicker.remove();
            document.removeEventListener('click', closePicker);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closePicker);
    }, 0);
}

function sendImage() {

    const sendAllUsers = document.querySelector('#sendAllUsers').checked;
    const name = nameInput.value.trim();
    const hasSelectedUser = selectedUser && selectedUser.name;

    // Check if all are empty or invalid
    if (!name || (!sendAllUsers && !hasSelectedUser)) {
        MessageBox('Fill in all fields and select a user or check All Users.', 'Ok');
        msgInput.focus();
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                MessageBox('Image size must be less than 5MB', 'Ok');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const name = nameInput.value.trim();
                const room = selectedUser ? getPrivateRoomId(name, selectedUser.name) : null;
                const chatMessage = {
                    name,
                    text: reader.result, // Base64 encoded image
                    date: getDate_Now(),
                    time: getTime_Now(),
                    room,
                    type: 'image',
                    fileName: file.name
                };
                socket.emit('message', chatMessage);
                saveMessages(chatMessage, room);
            };
            reader.readAsDataURL(file);
        }
        document.body.removeChild(input);
    });

    input.click();
}

function send_a_File() {
    
    const sendAllUsers = document.querySelector('#sendAllUsers').checked;
    const name = nameInput.value.trim();
    const hasSelectedUser = selectedUser && selectedUser.name;

    // Check if all are empty or invalid
    if (!name || (!sendAllUsers && !hasSelectedUser)) {
        MessageBox('Fill in all fields and select a user or check All Users.', 'Ok');
        msgInput.focus();
        return;
    }


    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                MessageBox('File size must be less than 10MB', 'Ok');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const name = nameInput.value.trim();
                const room = selectedUser ? getPrivateRoomId(name, selectedUser.name) : null;
                const chatMessage = {
                    name,
                    text: reader.result, // Base64 encoded file
                    date: getDate_Now(),
                    time: getTime_Now(),
                    room,
                    type: 'file',
                    fileName: file.name
                };
                socket.emit('message', chatMessage);
                saveMessages(chatMessage, room);
            };
            reader.readAsDataURL(file);
        }
        document.body.removeChild(input);
    });

    input.click();
}

msgInput.addEventListener('keypress', (event) => {
    const sendAllUsers = document.querySelector('#sendAllUsers').checked;
    if (sendAllUsers) {
        socket.emit('activity', { name: nameInput.value, room: null });
    } else if (selectedUser) {
        socket.emit('activity', { name: nameInput.value, room: getPrivateRoomId(nameInput.value, selectedUser.name) });
    }

    if (event.key === "Enter") document.querySelector("#sendMessage").click();
});

initVoiceCallFeatures({
    socket,
    nameInput,
    selectedUserGetter: () => selectedUser
});