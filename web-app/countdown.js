// Cinematic 3-2-1 battle-launch sequence, shared by Two Player and
// Single Player modes so both feel like the same combat system booting up.
// Pure presentation: builds an overlay, plays the sequence, then calls
// on_complete. No game state is touched here.

const TICK_MS = 850;
const FINALE_MS = 1150;
const FADE_MS = 650;

export function run_battle_countdown(on_complete) {
    const overlay = document.createElement("div");
    overlay.className = "screen-overlay countdown-overlay";

    // Layered tactical backdrop — reuses the battlefield environment
    // classes (ocean shimmer, HUD grid, scan band, particles, vignette).
    ["env-ocean", "env-hud", "env-scanline", "env-particles", "env-vignette"]
        .forEach(function (cls) {
            const layer = document.createElement("div");
            layer.className = "cd-layer " + cls;
            overlay.append(layer);
        });

    // Circular radar scope with rotating sweep and a target-lock ring that
    // pulses on every tick.
    const radar = document.createElement("div");
    radar.className = "cd-radar";
    const sweep = document.createElement("div");
    sweep.className = "cd-radar-sweep";
    const lock = document.createElement("div");
    lock.className = "cd-lock";
    radar.append(sweep, lock);
    overlay.append(radar);

    const title = document.createElement("div");
    title.className = "cd-title";
    title.textContent = "SYSTEM INITIALIZING";
    overlay.append(title);

    const number = document.createElement("div");
    number.className = "cd-number";
    number.textContent = "3";
    overlay.append(number);

    const sub = document.createElement("div");
    sub.className = "cd-sub";
    sub.textContent = "PREPARE FOR NAVAL ENGAGEMENT";
    overlay.append(sub);

    document.body.append(overlay);

    // Restart the number + lock-ring animations on each tick.
    const pulse = function () {
        number.classList.remove("cd-tick");
        lock.classList.remove("cd-lock-pulse");
        void number.offsetWidth;
        number.classList.add("cd-tick");
        lock.classList.add("cd-lock-pulse");
    };
    pulse();

    let count = 3;
    const timer = setInterval(function () {
        count -= 1;
        if (count > 0) {
            number.textContent = String(count);
            pulse();
            return;
        }
        clearInterval(timer);

        // Finale: BATTLE START with flash + shockwave.
        number.remove();
        title.remove();
        sub.remove();
        const flash = document.createElement("div");
        flash.className = "cd-flash";
        const wave = document.createElement("div");
        wave.className = "cd-shockwave";
        const start_text = document.createElement("div");
        start_text.className = "cd-battle-start";
        start_text.textContent = "BATTLE START";
        overlay.append(flash, wave, start_text);

        setTimeout(function () {
            // Hand over while the overlay fades, so the next screen
            // appears underneath instead of cutting in.
            overlay.classList.add("cd-fade-out");
            if (on_complete) {
                on_complete();
            }
            setTimeout(function () {
                overlay.remove();
            }, FADE_MS);
        }, FINALE_MS);
    }, TICK_MS);
}
