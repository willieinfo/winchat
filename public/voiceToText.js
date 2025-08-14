const voiceToTextSpan = document.getElementById('voiceToText');
const textarea = document.getElementById('message');
const form = document.querySelector('.form-msg');
const microphoneIcon = voiceToTextSpan.querySelector('i');
let recognition = null;
let isRecognizing = false;
let finalTranscript = '';

function initializeSpeechRecognition() {
    // Auto-resize textarea based on content
    textarea.addEventListener('input', autoResizeTextarea);

    // Initialize Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            textarea.value = finalTranscript + interimTranscript;
            autoResizeTextarea({ target: textarea });
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'audio-capture' || event.error === 'not-allowed') {
                if (event.error === 'not-allowed') {
                    alert("Microphone access denied or not available. Please check your browser or device settings.");
                }
                stopRecognition();
            }
        };

        recognition.onend = () => {
            if (isRecognizing) {
                recognition.start(); // Restart if still active
            }
        };
    } else {
        console.error('Speech Recognition API not supported in this browser');
        voiceToTextSpan.style.opacity = '0.5';
        voiceToTextSpan.title = 'Speech recognition not supported';
        voiceToTextSpan.style.pointerEvents = 'none';
    }
}

function autoResizeTextarea(event) {
    const textarea = event.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 12 * 16); // Max 8 rows (assuming 1.5em ≈ 16px per row)
    textarea.style.height = `${newHeight}px`;
}

function toggleSpeechRecognition() {
    if (!recognition) return;

    if (isRecognizing) {
        stopRecognition();
    } else {
        startRecognition();
    }
}

function startRecognition() {
    isRecognizing = true;
    finalTranscript = ''; // Reset final transcript
    microphoneIcon.classList.add('fa-microphone');
    microphoneIcon.classList.add('fa-volume-high', 'voice-animate');
    // document.querySelector('#signal-icon').style.display = 'block';
    microphoneIcon.title = "Listening..."; 

    microphoneIcon.style.transition = 'color 0.2s ease';
    microphoneIcon.style.color = 'var(--second-bg-color)';
    voiceToTextSpan.classList.add('active'); // Optional: for additional styling
    recognition.start();
}

function stopRecognition() {
    isRecognizing = false;
    microphoneIcon.classList.remove('fa-volume-high', 'voice-animate');
    microphoneIcon.classList.add('fa-microphone');    
    // document.querySelector('#signal-icon').style.display = 'none';
    microphoneIcon.title = "Say your message"; 

    microphoneIcon.style.color = '';
    voiceToTextSpan.classList.remove('active');
    recognition.stop();
}

// Reset form and textarea on submission
function handleFormSubmission(event) {
    event.preventDefault(); // Prevent default form submission for demo
    if (isRecognizing) {
        stopRecognition();
    }
    finalTranscript = ''; // Clear final transcript
    textarea.value = ''; // Clear textarea
    textarea.style.height = 'auto'; // Reset textarea height
    // Add actual form submission logic here if needed
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
    // Add form submission handler
    form.addEventListener('submit', handleFormSubmission);
});

// Toggle speech recognition on span click
voiceToTextSpan.addEventListener('click', toggleSpeechRecognition);