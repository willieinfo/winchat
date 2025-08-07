import { MessageBox } from "./functlib.js";

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

msgInput.addEventListener('keypress', () => {
    const sendAllUsers = document.querySelector('#sendAllUsers').checked;
    if (sendAllUsers) {
        socket.emit('activity', { name: nameInput.value, room: null });
    } else if (selectedUser) {
        socket.emit('activity', { name: nameInput.value, room: getPrivateRoomId(nameInput.value, selectedUser.name) });
    }
});

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

socket.on('userList', ({ users }) => {
    showUsers(users);
});

function showUsers(users) {
    userName.innerHTML = '';
    if (users) {
        users.forEach((user) => {
            if (user.name !== nameInput.value) { // Don't show self
                const userItem = document.createElement('li');
                userItem.className = 'userItem';

                const initials = getUserInitials(user.name);                
                const userIcon = document.createElement('div');
                userIcon.className = 'userIcon';
                userIcon.innerHTML = initials; // Display Initials
                userIcon.style.backgroundColor = getRandomColor();

                if (selectedUser && selectedUser.name === user.name) {
                    userItem.classList.add('selected');
                }

                userItem.addEventListener('click', () => {
                    // Clear previous chat and switch to new private room
                    selectedUser = user;
                    chatDisplay.innerHTML = '';
                    userName.querySelectorAll('.userItem').forEach(item => item.classList.remove('selected'));
                    userItem.classList.add('selected');

                    activity.textContent = `Chatting with ${user.name}`;
                    const room = getPrivateRoomId(nameInput.value, user.name);
                    socket.emit('joinPrivateRoom', {
                        name: nameInput.value,
                        targetUser: user.name
                    });

                    // Load messages for the private room
                    loadMessages(room);
                    updateChatDisplay(`Started chat with ${user.name}`);
                });                

                // Append the user icon before the name
                userItem.appendChild(userIcon);
                const userNameText = document.createElement('span');
                userNameText.textContent = user.name;
                userItem.appendChild(userNameText);

                userName.appendChild(userItem);
            }
        });
    }

    // Moved chatEraser event listener outside the forEach loop
    chatEraser.addEventListener('click', () => {
        const room = selectedUser ? getPrivateRoomId(nameInput.value, selectedUser.name) : null;
        deleteMessages(room);
        chatDisplay.innerHTML = '';
        updateChatDisplay('Chat history cleared');
    });
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
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
        console.log('Fill in all fields and select a user or check All Users.');
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
    msgInput.focus();

    saveMessages(chatMessage, room);
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
    messages.push(data);
    localStorage.setItem(`chatMessages_${room}`, JSON.stringify(messages));
}

function loadMessages(room) {
    const messages = JSON.parse(localStorage.getItem(`chatMessages_${room}`) || '[]');
    chatDisplay.innerHTML = ''; // Clear current chat display
    messages.forEach(data => {
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
    const emoticons = ['😊', '🥰', '😂', '😍', '😎', '😢', '😡', '👍', '👏', '🙌'];
    const smileyPicker = document.createElement('div');
    smileyPicker.className = 'smiley-picker';
    smileyPicker.style.position = 'absolute';
    smileyPicker.style.background = '#fff';
    smileyPicker.style.border = '1px solid #ccc';
    smileyPicker.style.padding = '10px';
    smileyPicker.style.zIndex = '1000';
    smileyPicker.style.display = 'flex';
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