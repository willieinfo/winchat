// voiceCall.js
let localStream;
let peerConnection;
let socketRef;
let nameRef;
let selectedUserRef;
let callActive = false; // Track call state
let ringingAnimation = null;

const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export function initVoiceCallFeatures({ socket, nameInput, selectedUserGetter }) {
    socketRef = socket;
    nameRef = nameInput;
    selectedUserRef = selectedUserGetter;

    socketRef.on('voice-offer', handleVoiceOffer);
    socketRef.on('voice-answer', handleVoiceAnswer);
    socketRef.on('ice-candidate', handleIceCandidate);

    socketRef.on('voice-rejected', ({ message }) => {
        alert(message);  // or use a UI element to show the rejection
        stopOutgoingRingtone();
        resetCallUI();
    });


    const voiceCallBtn = document.getElementById('chatVoiceCall');
    voiceCallBtn.addEventListener('click', () => {
        if (callActive) {
            endCall();
        } else {
            handleVoiceCall();
        }
    });
}

async function handleVoiceCall() {
    const selectedUser = selectedUserRef();
    if (!selectedUser) {
        alert("Please select a user to call.");
        return;
    }

    if (callActive) {
        alert("You are already in a call.");
        return;
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        peerConnection = new RTCPeerConnection(config);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socketRef.emit('ice-candidate', {
                    target: selectedUser.name,
                    candidate: event.candidate
                });
            }
        };

        peerConnection.ontrack = event => {
            const audio = document.createElement('audio');
            audio.srcObject = event.streams[0];
            audio.autoplay = true;
            document.body.appendChild(audio);
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        playOutgoingRingtone()
        updateCallStatus(`Calling ${selectedUser.name}...`);
        animatePhoneRinging(true);

        socketRef.emit('voice-offer', {
            target: selectedUser.name,
            offer
        });

    } catch (err) {
        console.error('Voice call error:', err);
        updateCallStatus(`Microphone error: ${err.message}`);
        alert(`Microphone access error: ${err.message}`);
    }
}


async function handleVoiceOffer({ from, offer }) {
    if (callActive) {
        // Reject if already in a call
        socketRef.emit('voice-busy', { target: from });
        return;
    }

    // Prompt user to accept or reject the call
    const userWantsToAnswer = confirm(`Incoming call from ${from}. Do you accept?`);

    if (!userWantsToAnswer) {
        // Emit a reject signal if the user declines the call
        socketRef.emit('voice-reject', { target: from });
        return;
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        updateCallStatus(`Receiving call from ${from}...`);
        animatePhoneRinging(true);

        peerConnection = new RTCPeerConnection(config);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socketRef.emit('ice-candidate', {
                    target: from,
                    candidate: event.candidate
                });
            }
        };

        peerConnection.ontrack = event => {
            const audio = document.createElement('audio');
            audio.srcObject = event.streams[0];
            audio.autoplay = true;
            document.body.appendChild(audio);
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socketRef.emit('voice-answer', {
            target: from,
            answer
        });

        setInCallUI();

    } catch (err) {
        console.error('Voice offer error:', err);
        alert(`Microphone access error: ${err.message}`);
    }
}

async function handleVoiceAnswer({ answer }) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    setInCallUI();
}

function handleIceCandidate({ candidate }) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    callActive = false;
    updateCallStatus("Call ended");
    resetCallUI();
}

function setInCallUI() {
    callActive = true;
    stopOutgoingRingtone()
    animatePhoneRinging(false);
    const icon = document.querySelector('#chatVoiceCall i');
    if (icon) {
        icon.classList.remove('fa-phone-flip');
        icon.classList.add('fa-phone-slash');
    }
    updateCallStatus("In call");
}

function resetCallUI() {
    animatePhoneRinging(false);
    const icon = document.querySelector('#chatVoiceCall i');
    if (icon) {
        icon.classList.remove('fa-phone-slash');
        icon.classList.add('fa-phone-flip');
    }
}

function animatePhoneRinging(enable) {
    const icon = document.querySelector('#chatVoiceCall i');
    if (!icon) return;

    if (enable) {
        icon.classList.add('ringing-animation');
    } else {
        icon.classList.remove('ringing-animation');
    }
}

function updateCallStatus(msg) {
    const statusDiv = document.querySelector('.activity');
    if (statusDiv) statusDiv.textContent = msg;
}

// 
function playOutgoingRingtone() {
    const audio = new Audio('/sounds/ringtone.mp3');
    audio.loop = true;
    audio.play().catch(() => {}); // ignore autoplay restrictions
    window._outgoingTone = audio;
}

function stopOutgoingRingtone() {
    if (window._outgoingTone) {
        window._outgoingTone.pause();
        window._outgoingTone = null;
    }
}

function playIncomingRingtone() {
    const audio = new Audio('/sounds/incoming.mp3');
    audio.loop = true;
    audio.play().catch(() => {});
    window._incomingTone = audio;
}

function stopIncomingRingtone() {
    if (window._incomingTone) {
        window._incomingTone.pause();
        window._incomingTone = null;
    }
}
