const msgInput = document.querySelector('#message');
const nameInput = document.querySelector('#name');
const activity = document.querySelector('.activity');
const userName = document.querySelector('.user-name');
const chatDisplay = document.querySelector('.chat-display');

const socket = io('http://localhost:3000');

document.querySelector('.form-msg').addEventListener('submit', sendMessage);
document.querySelector('.form-join').addEventListener('submit', enterApp);

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
    const { name, text, time, room } = data;
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

    saveMessages(data,room)
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
    // user.name !== nameInput.value
    if (users) {
        users.forEach((user, i) => {
            if (user.name !== nameInput.value) { // Don't show self
                const userItem = document.createElement('li');
                userItem.className = 'userItem';

                const initials = getUserInitials(user.name);                
                const userIcon = document.createElement('div');
                userIcon.className = 'userIcon';
                userIcon.innerHTML =initials    //Display Initials
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

        // Add Clear Chat button
        const clearChatButton = document.createElement('button');
        clearChatButton.textContent = 'Clear Chat';
        clearChatButton.className = 'clear-chat-button';
        clearChatButton.addEventListener('click', () => {
            const room = selectedUser ? getPrivateRoomId(nameInput.value, selectedUser.name) : null;
            deleteMessages(room);
            chatDisplay.innerHTML = '';
            updateChatDisplay('Chat history cleared');
        });
        userName.appendChild(clearChatButton);        

        
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
        const nameParts = userName.split(' ');  // Split name into words
        const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('');  // Get the first letter of each word
        return initials.length > 2 ? initials.substring(0, 2) : initials;  // Only take the first 2 letters
    }

    function updateChatDisplay(message) {
        const li = document.createElement('li');
        li.innerHTML = `<div class="post__admin">${message}</div>`;
        li.className = "post__admin";
        chatDisplay.appendChild(li);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }

}


function sendMessage(e) {
    e.preventDefault();
    const sendAllUsers = document.querySelector('#sendAllUsers').checked;
    let chatMessage = null
    let room = null
    
    if (nameInput.value && msgInput.value) {
        if (sendAllUsers) {
            // Send to all users
            chatMessage = {
                name: nameInput.value,
                text: msgInput.value,
                date: getDate_Now(),
                time: getTime_Now(),
                room: null // No room for broadcast
            } 
        } else if (selectedUser) {
            // Send to private room
            room = getPrivateRoomId(nameInput.value, selectedUser.name);
            chatMessage = {
                name: nameInput.value,
                text: msgInput.value,
                date: getDate_Now(),
                time: getTime_Now(),
                room 
            } 
        }
        socket.emit('message', chatMessage);
        msgInput.value = '';
    }
    msgInput.focus();
    saveMessages(chatMessage,room)
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

function saveMessages(data,room) {
    let messages = JSON.parse(localStorage.getItem(`chatMessages_${room}`) || '[]');
    messages.push(data);
    localStorage.setItem(`chatMessages_${room}`, JSON.stringify(messages));
}

function getTime_Now() {
    const date = new Date()
    cTime_Now= new Intl.DateTimeFormat('default', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    }).format(date)
    return cTime_Now
}
function getDate_Now() {
    const date = new Date()
    cDate_Now= new Intl.DateTimeFormat('default', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
   }).format(date)
    return cDate_Now
}


// Add this function to load messages from localStorage
function loadMessages(room) {
    const messages = JSON.parse(localStorage.getItem(`chatMessages_${room}`) || '[]');
    chatDisplay.innerHTML = ''; // Clear current chat display
    messages.forEach(data => {
        const { name, text, time, room: messageRoom } = data;
        const fromUser = name === nameInput.value;
        const li = document.createElement('li');
        li.className = fromUser ? 'post post--right' : 'post post--left';
        if (name === 'Admin') {
            li.innerHTML = `<div class="post__admin">${text}</div>`;
            li.className = "post__admin";
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