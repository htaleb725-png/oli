// Web Audio API helper for subtle, pleasant office chime
export const playWelcomeChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    
    // First soft harmonic note (C5 - 523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.08);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.85);

    // Second elegant note (E5 - 659.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.15);
    gain2.gain.setValueAtTime(0.001, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.15, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 1.25);

    // Third warm note (G5 - 783.99 Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(783.99, now + 0.3);
    gain3.gain.setValueAtTime(0.001, now + 0.3);
    gain3.gain.exponentialRampToValueAtTime(0.08, now + 0.38);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.3);
    osc3.stop(now + 1.55);
  } catch (err) {
    console.warn('Audio chime playback omitted:', err);
  }
};

let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
};

// Play crisp, subtle UI tap/click sound when clicking on buttons or icons
export const playUiClickSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const playTone = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Crisp, pleasant tactile interface click (840Hz dropping to 360Hz in 35ms)
      osc.frequency.setValueAtTime(840, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.035);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        playTone();
      }).catch(() => {
        // Autoplay policy prevented playback
      });
    } else {
      playTone();
    }
  } catch {
    // Ignore audio context initialization failures
  }
};

// Play authentic, acoustic parliamentary gavel strike sound
export const playParliamentGavelStrikeSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const playStrike = () => {
      const now = ctx.currentTime;

      // 1. Sharp wooden impact snap (Noise burst + fast transient)
      const bufferSize = ctx.sampleRate * 0.035; // 35ms burst
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1400, now);
      noiseFilter.Q.setValueAtTime(1.5, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start(now);

      // 2. Heavy hardwood acoustic body resonance (Double-headed mallet impact)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(280, now);
      osc1.frequency.exponentialRampToValueAtTime(95, now + 0.18);

      gain1.gain.setValueAtTime(0.55, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // 3. Sound Block (قاعدة المطرقة) hollow wooden ring
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(520, now);
      osc2.frequency.exponentialRampToValueAtTime(210, now + 0.12);

      gain2.gain.setValueAtTime(0.28, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.25);

      // 4. Grand Parliament Hall Chamber Acoustic Echo (انعكاس صدى قاعة المجلس)
      const oscEcho = ctx.createOscillator();
      const gainEcho = ctx.createGain();
      oscEcho.type = 'sine';
      oscEcho.frequency.setValueAtTime(180, now + 0.08);
      oscEcho.frequency.exponentialRampToValueAtTime(80, now + 0.45);

      gainEcho.gain.setValueAtTime(0.0001, now);
      gainEcho.gain.setValueAtTime(0.18, now + 0.08);
      gainEcho.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      oscEcho.connect(gainEcho);
      gainEcho.connect(ctx.destination);
      oscEcho.start(now + 0.08);
      oscEcho.stop(now + 0.6);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        playStrike();
      }).catch(() => {});
    } else {
      playStrike();
    }
  } catch (err) {
    console.warn('Gavel audio note:', err);
  }
};

