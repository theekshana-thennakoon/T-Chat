/* ==========================================================================
   VOICE RECORDER & AUDIO WAVEFORM MODULE
   ========================================================================== */

const VoiceModule = {
  mediaRecorder: null,
  audioChunks: [],
  recordingTimer: null,
  secondsElapsed: 0,
  audioContext: null,
  analyser: null,
  animFrameId: null,
  isRecording: false,
  stream: null,

  async startRecording() {
    if (this.isRecording) {
      // If already recording, stop & send
      this.stopRecording(true);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (window.showToast) window.showToast('Voice recording is not supported in this browser.', 'error');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      // Determine best supported mimeType
      let options = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          options = { mimeType: 'audio/ogg' };
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const mimeType = (this.mediaRecorder && this.mediaRecorder.mimeType) || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        
        if (this.audioChunks.length > 0 && audioBlob.size > 0) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (window.ChatModule) {
              window.ChatModule.sendMessage({
                type: 'voice',
                voiceUrl: e.target.result
              });
            }
          };
          reader.readAsDataURL(audioBlob);
        }

        // Clean up media tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;

      this.startTimerUI();
      this.initWaveformCanvas(this.stream);

      // Play Beep sound
      if (window.SoundManager) window.SoundManager.playBeep();

      const recordingBar = document.getElementById('voice-recording-bar');
      const inputContainer = document.querySelector('.message-text-input-box');
      const btnSendMic = document.getElementById('btn-send-or-mic');

      if (recordingBar) recordingBar.classList.remove('hidden');
      if (inputContainer) inputContainer.classList.add('hidden');

      // Update mic button to show send state during recording
      if (btnSendMic) {
        btnSendMic.setAttribute('title', 'Send Voice Message');
        const iconMic = document.getElementById('icon-mic');
        const iconSend = document.getElementById('icon-send');
        if (iconMic) iconMic.classList.add('hidden');
        if (iconSend) iconSend.classList.remove('hidden');
      }

    } catch (err) {
      console.warn('Microphone access denied or error:', err);
      this.isRecording = false;
      if (window.showToast) {
        window.showToast('Microphone access denied or unavailable.', 'error');
      } else {
        alert('Could not access microphone. Please allow microphone permissions in your browser.');
      }
    }
  },

  stopRecording(send = true) {
    if (!this.isRecording && (!this.mediaRecorder || this.mediaRecorder.state === 'inactive')) {
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      if (!send) {
        // Cancel recording without sending
        this.mediaRecorder.onstop = () => {
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
          }
        };
        this.mediaRecorder.stop();
      } else {
        this.mediaRecorder.stop();
      }
    }

    this.isRecording = false;
    this.stopTimerUI();

    const recordingBar = document.getElementById('voice-recording-bar');
    const inputContainer = document.querySelector('.message-text-input-box');
    const btnSendMic = document.getElementById('btn-send-or-mic');
    const txtInput = document.getElementById('message-input');

    if (recordingBar) recordingBar.classList.add('hidden');
    if (inputContainer) inputContainer.classList.remove('hidden');

    // Reset mic / send button icon according to text input content
    if (btnSendMic) {
      const textHasValue = txtInput && txtInput.value.trim().length > 0;
      btnSendMic.setAttribute('title', textHasValue ? 'Send Message' : 'Voice Message');
      const iconMic = document.getElementById('icon-mic');
      const iconSend = document.getElementById('icon-send');
      if (iconMic) iconMic.classList.toggle('hidden', textHasValue);
      if (iconSend) iconSend.classList.toggle('hidden', !textHasValue);
    }
  },

  startTimerUI() {
    this.secondsElapsed = 0;
    const timerEl = document.getElementById('recording-time');
    if (timerEl) timerEl.textContent = '00:00';
    
    if (this.recordingTimer) clearInterval(this.recordingTimer);
    this.recordingTimer = setInterval(() => {
      this.secondsElapsed++;
      const mins = String(Math.floor(this.secondsElapsed / 60)).padStart(2, '0');
      const secs = String(this.secondsElapsed % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);

    const btnCancel = document.getElementById('btn-cancel-recording');
    if (btnCancel) {
      btnCancel.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.stopRecording(false);
      };
    }

    const btnSend = document.getElementById('btn-send-recording');
    if (btnSend) {
      btnSend.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.stopRecording(true);
      };
    }
  },

  stopTimerUI() {
    if (this.recordingTimer) clearInterval(this.recordingTimer);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch(e) {}
    }
    const timerEl = document.getElementById('recording-time');
    if (timerEl) timerEl.textContent = '00:00';
  },

  initWaveformCanvas(stream) {
    const canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!this.isRecording) return;
        this.animFrameId = requestAnimationFrame(draw);
        this.analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = '#0084ff';
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      };

      draw();
    } catch (e) {
      console.warn('Waveform audio context error:', e);
    }
  }
};

window.VoiceModule = VoiceModule;
