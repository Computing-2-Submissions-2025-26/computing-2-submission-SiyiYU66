// Sound effects synthesised with the Web Audio API (no audio files needed).
// A shared master chain (reverb + compressor) gives every cue a polished,
// spacious, modern feel rather than a bare retro beep.

let audioContext = null;
let masterGain = null;
let reverb = null;

// AudioContext is created lazily on first interaction to avoid suspension.
const get_context = function () {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        setup_master_chain();
    }
    return audioContext;
};

// Builds the shared output chain: dry/wet signals -> compressor -> speakers.
const setup_master_chain = function () {
    const ctx = audioContext;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;
    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    // Convolution reverb gives the cues a sense of physical space.
    reverb = ctx.createConvolver();
    reverb.buffer = make_impulse_response(2.4, 3.0);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.55;
    reverb.connect(reverbGain);
    reverbGain.connect(masterGain);
};

// Generates a decaying-noise impulse response for the reverb.
const make_impulse_response = function (duration, decay) {
    const ctx = audioContext;
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return impulse;
};

// Generates a buffer of white noise of the given duration.
const make_noise = function (duration) {
    const ctx = audioContext;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
};

// Routes a node to the speakers with a dry level and a reverb (wet) send.
const route = function (node, dry, wet) {
    const ctx = audioContext;
    const dryGain = ctx.createGain();
    dryGain.gain.value = dry;
    node.connect(dryGain);
    dryGain.connect(masterGain);
    if (wet > 0) {
        const wetGain = ctx.createGain();
        wetGain.gain.value = wet;
        node.connect(wetGain);
        wetGain.connect(reverb);
    }
};

// Hit: a crisp, bright digital impact with a metallic ping.
const playHitSound = function () {
    const ctx = get_context();
    const t = ctx.currentTime;

    // Tonal body that drops slightly in pitch.
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(720, t + 0.12);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(oscGain);
    route(oscGain, 0.9, 0.25);
    osc.start(t);
    osc.stop(t + 0.25);

    // Sharp transient click for attack.
    const noise = ctx.createBufferSource();
    noise.buffer = make_noise(0.08);
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2600;
    band.Q.value = 1.2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    noise.connect(band);
    band.connect(noiseGain);
    route(noiseGain, 0.8, 0.15);
    noise.start(t);
    noise.stop(t + 0.08);
};

// Miss: a soft sonar ping dissolving into a watery splash.
const playMissSound = function () {
    const ctx = get_context();
    const t = ctx.currentTime;

    // Gentle sonar ping with a heavy reverb tail (spacious / underwater).
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(720, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.18);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(oscGain);
    route(oscGain, 0.7, 0.6);
    osc.start(t);
    osc.stop(t + 0.45);

    // Water splash from filtered noise.
    const noise = ctx.createBufferSource();
    noise.buffer = make_noise(0.25);
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 1100;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(4000, t);
    lowpass.frequency.exponentialRampToValueAtTime(800, t + 0.2);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.16, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    noise.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(noiseGain);
    route(noiseGain, 0.6, 0.4);
    noise.start(t);
    noise.stop(t + 0.25);
};

// Sunk: a deep cinematic explosion with sub-bass, rumble and debris.
const playSunkSound = function () {
    const ctx = get_context();
    const t = ctx.currentTime;

    // Sub-bass boom that drops in pitch.
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(38, t + 0.6);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, t);
    subGain.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    sub.connect(subGain);
    route(subGain, 1.0, 0.3);
    sub.start(t);
    sub.stop(t + 0.95);

    // Low-passed noise rumble.
    const noise = ctx.createBufferSource();
    noise.buffer = make_noise(1.2);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(900, t);
    lowpass.frequency.exponentialRampToValueAtTime(120, t + 1.0);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.8, t + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    noise.connect(lowpass);
    lowpass.connect(noiseGain);
    route(noiseGain, 0.9, 0.5);
    noise.start(t);
    noise.stop(t + 1.2);

    // Metallic debris resonance.
    const metal = ctx.createOscillator();
    metal.type = "square";
    metal.frequency.value = 320;
    const metalBand = ctx.createBiquadFilter();
    metalBand.type = "bandpass";
    metalBand.frequency.value = 820;
    metalBand.Q.value = 6;
    const metalGain = ctx.createGain();
    metalGain.gain.setValueAtTime(0.0001, t + 0.05);
    metalGain.gain.exponentialRampToValueAtTime(0.14, t + 0.08);
    metalGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    metal.connect(metalBand);
    metalBand.connect(metalGain);
    route(metalGain, 0.5, 0.6);
    metal.start(t + 0.05);
    metal.stop(t + 0.5);
};

// Win: an elegant ascending arpeggio with detuned, shimmering voices.
const playWinSound = function () {
    const ctx = get_context();
    const t0 = ctx.currentTime;

    // Major add9 arpeggio: C E G B D.
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
    notes.forEach(function (freq, i) {
        const t = t0 + i * 0.12;
        // Two slightly detuned voices per note for a rich, wide tone.
        [-6, 6].forEach(function (detune) {
            const osc = ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.value = freq;
            osc.detune.value = detune;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
            osc.connect(gain);
            route(gain, 0.7, 0.7);
            osc.start(t);
            osc.stop(t + 0.65);
        });
    });

    // High sparkle to finish.
    const sparkle = ctx.createOscillator();
    sparkle.type = "sine";
    sparkle.frequency.setValueAtTime(1567.98, t0 + 0.6);
    sparkle.frequency.exponentialRampToValueAtTime(2349.32, t0 + 0.9);
    const sparkleGain = ctx.createGain();
    sparkleGain.gain.setValueAtTime(0.0001, t0 + 0.6);
    sparkleGain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.66);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
    sparkle.connect(sparkleGain);
    route(sparkleGain, 0.6, 0.8);
    sparkle.start(t0 + 0.6);
    sparkle.stop(t0 + 1.3);
};

export { playHitSound, playMissSound, playSunkSound, playWinSound };
