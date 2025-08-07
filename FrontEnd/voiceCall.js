let localStream;
let peerConnection;
let socketRef;
let nameRef;
let selectedUserRef;

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

    const voiceCallBtn = document.getElementById('chatVoiceCall');
    voiceCallBtn.addEventListener('click', handleVoiceCall);
}

async function handleVoiceCall() {
    const selectedUser = selectedUserRef();
    if (!selectedUser) {
        alert("Please select a user to call.");
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

        updateCallStatus(`Calling ${selectedUser.name}...`);

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
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        updateCallStatus(`Receiving call from ${from}...`);

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
    } catch (err) {
        console.error('Voice offer error:', err);
        alert(`Microphone access error: ${err.message}`);
    }
}

async function handleVoiceAnswer({ answer }) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    updateCallStatus(`In call`);

}

function handleIceCandidate({ candidate }) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

function updateCallStatus(msg) {
    const statusDiv = document.querySelector('.activity');
    if (statusDiv) statusDiv.textContent = msg;
}
