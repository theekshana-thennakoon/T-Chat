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

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
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

        // Stop media stream tracks
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.startTimerUI();
      this.initWaveformCanvas(stream);

      // Play Beep sound
      if (window.SoundManager) window.SoundManager.playBeep();

      document.getElementById('voice-recording-bar').classList.remove('hidden');
      document.querySelector('.message-text-input-box').classList.add('hidden');
    } catch (err) {
      console.warn('Microphone access denied or unsupported:', err);
      alert('Could not access microphone. Please allow microphone permissions in your browser.');
    }
  },

  stopRecording(send = true) {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      if (!send) {
        // Cancel recording without sending
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      } else {
        this.mediaRecorder.stop();
      }
    }

    this.stopTimerUI();
    document.getElementById('voice-recording-bar').classList.add('hidden');
    document.querySelector('.message-text-input-box').classList.remove('hidden');
  },

  startTimerUI() {
    this.secondsElapsed = 0;
    const timerEl = document.getElementById('recording-time');
    
    this.recordingTimer = setInterval(() => {
      this.secondsElapsed++;
      const mins = String(Math.floor(this.secondsElapsed / 60)).padStart(2, '0');
      const secs = String(this.secondsElapsed % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);

    const btnCancel = document.getElementById('btn-cancel-recording');
    if (btnCancel) {
      btnCancel.onclick = () => this.stopRecording(false);
    }
  },

  stopTimerUI() {
    if (this.recordingTimer) clearInterval(this.recordingTimer);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    document.getElementById('recording-time').textContent = '00:00';
  },

  initWaveformCanvas(stream) {
    const canvas = document.getElementById('waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioCtx();
    const source = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    source.connect(this.analyser);

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animFrameId = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = '#f15c6d';
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    draw();
  }
};

window.VoiceModule = VoiceModule;
