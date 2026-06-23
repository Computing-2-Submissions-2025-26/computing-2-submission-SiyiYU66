// OnlineGameController.js — Phase 2B-1
//
// Adapts Human_VS_Human.html for online play.
// Only activates when sessionStorage holds an "online_session" object written
// by online.js after both players name themselves.
//
// This module runs AFTER Human_VS_Human.js has finished (ES module order).
// It never modifies BattleShip.js, Human_VS_Human.js, or local 2-player logic.
// Its only responsibilities:
//   • reconnect the socket to the server room
//   • pre-fill the name overlay and auto-submit it
//   • for the guest (seat 1) auto-dismiss the "HIDE YOUR SCREEN" overlay and
//     jump directly to the placing-player-2 body class
//   • intercept the relevant "Confirm Deployment" button (capture phase) so the
//     placement is sent to the server instead of starting a local pass-screen
//   • forward each per-ship placement to the server as place_ship events
//   • show a "Waiting for opponent" overlay while the server waits for both

// ── 1. Read session ────────────────────────────────────────────────────────────

const session = (function () {
    try {
        return JSON.parse(sessionStorage.getItem("online_session") || "null");
    } catch (_) {
        return null;
    }
}());

// Nothing to do for local 2-player or single-player — module exits silently.
if (session) {

const { room, seat, my_name, opp_name } = session;

// ── 2. Guard: socket.io must be loaded ────────────────────────────────────────

if (typeof io === "undefined") {
    // Human_VS_Human.html was opened without the Node.js server.
    // Show an inline error and don't proceed.
    const err = document.createElement("div");
    err.className = "online-waiting-overlay";
    err.innerHTML =
        "<div class='ogc-wait-title'>SERVER NOT RUNNING</div>" +
        "<div class='ogc-wait-sub'>Start the server with <code>npm run server</code>" +
        " then open <strong>http://localhost:3001</strong></div>" +
        "<a href='./online.html' style='color:#4fe3ff;font-family:inherit;" +
        "font-size:0.8rem;margin-top:1rem;text-decoration:none'>← BACK TO LOBBY</a>";
    document.body.append(err);
    // Clear the stale session so a refresh of the lobby is clean.
    sessionStorage.removeItem("online_session");
    throw new Error("OnlineGameController: socket.io not available");
}

// ── 3. Socket connection ───────────────────────────────────────────────────────

const socket = io();

socket.on("connect", function () {
    socket.emit("rejoin_room", {room, seat});
});

socket.on("rejoin_failed", function (data) {
    show_ogc_error("Room expired — please start a new game.", data && data.reason);
});

socket.on("opponent_left", function () {
    show_ogc_error("Your opponent disconnected.");
});

// Phase 2B-1: both players have confirmed deployment; battle can begin.
socket.on("battle_ready", function () {
    placement_obs.disconnect();
    show_combat_start();
});

// ── 4. Pre-fill name overlay and auto-submit ───────────────────────────────────
//
// Human_VS_Human.js already ran start_with_names() which set up listeners on
// #ns_name_1, #ns_name_2, and #ns_begin.  We fill the inputs with the names
// agreed in the lobby and click the button — HVH.js's commit() fires normally.

const ns_1   = document.getElementById("ns_name_1");
const ns_2   = document.getElementById("ns_name_2");
const ns_btn = document.getElementById("ns_begin");

if (ns_1 && ns_2 && ns_btn) {
    // seat 0 = P1 (orange, aside), seat 1 = P2 (blue, main)
    ns_1.value = (seat === 0) ? my_name : opp_name;
    ns_2.value = (seat === 0) ? opp_name : my_name;
    ns_btn.click();
}

// ── 5. Bypass all same-device handoff overlays (both seats) ──────────────────
//
// "HIDE YOUR SCREEN" is designed for local same-device play where both players
// share one screen.  Online players are on separate devices, so this overlay
// must never block either player.  A MutationObserver fires for BOTH seats and
// auto-dismisses it the instant HVH.js creates it.
//
// "PASS THE SCREEN" and the swap animation are already suppressed because OGC.js
// intercepts the Confirm Deployment button (capture phase + stopImmediatePropagation).

const hide_obs = new MutationObserver(function (mutations) {
    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (node.nodeType !== 1) { continue; }
            if (!node.classList.contains("screen-overlay")) { continue; }
            const title = node.querySelector(".ts-title");
            if (title && title.textContent.includes("HIDE")) {
                const btn = node.querySelector(".ts-button");
                if (btn) {
                    hide_obs.disconnect();
                    btn.click();   // dismiss immediately — no handoff needed online
                }
            }
        }
    }
});
hide_obs.observe(document.body, {childList: true});

// ── 5b. Guest (seat 1) — jump straight to placing-player-2 ───────────────────
//
// After the HIDE overlay is auto-dismissed its callback sets placing-player-1.
// For seat 1 that is wrong — P2's board is in <main> (placing-player-2).
// Detect the class change and flip it immediately, then reveal P2's elements
// which start as visibility:hidden by default CSS (the local pass-screen
// callback that normally shows them never runs in online mode).

if (seat === 1) {
    const phase_obs = new MutationObserver(function () {
        if (document.body.classList.contains("placing-player-1")) {
            phase_obs.disconnect();
            document.body.classList.remove("placing-player-1");
            document.body.classList.add("placing-player-2");
            // Mirror what HVH.js's pass-screen callback does in local play:
            // hide board 1 elements so HVH.js's keyboard handler correctly
            // identifies board index 1 as active (it checks
            // game_board_1.style.visibility === "hidden" to pick the board).
            const gb1 = document.getElementById("game_board_1");
            const s1  = document.getElementById("ships_1");
            const bc1 = document.getElementById("button_container_1");
            if (gb1) { gb1.style.visibility = "hidden"; }
            if (s1)  { s1.style.visibility  = "hidden"; }
            if (bc1) { bc1.style.visibility = "hidden"; }
            const gb2 = document.getElementById("game_board_2");
            const s2  = document.getElementById("ships_2");
            const bc2 = document.getElementById("button_container_2");
            if (gb2) { gb2.style.visibility = "visible"; }
            if (s2)  { s2.style.visibility  = "visible"; }
            if (bc2) { bc2.style.visibility = "visible"; }
        }
    });
    phase_obs.observe(document.body, {attributes: true, attributeFilter: ["class"]});
}

// ── 6. Intercept "Confirm Deployment" for the online player's own board ────────
//
// HVH.js wires the buttons with addEventListener (bubble phase).
// We add a capture-phase listener which fires first and calls
// stopImmediatePropagation(), preventing the local pass-screen / battle-start
// from triggering.  We then emit placement_done and show a waiting overlay.
//
// seat 0 → intercept .player-1-save (aside board)
// seat 1 → intercept .player-2-save (main board)

const confirm_selector = (seat === 0) ? ".player-1-save" : ".player-2-save";
const confirm_btn      = document.querySelector(confirm_selector);

if (confirm_btn) {
    confirm_btn.addEventListener("click", function (event) {
        // Button is disabled until all ships are placed — if somehow
        // a click fires while disabled, do nothing.
        if (confirm_btn.disabled) { return; }
        event.stopImmediatePropagation();
        socket.emit("placement_done");
        show_waiting_overlay();
    }, true /* capture */);
}

// ── 6.5. Per-ship placement forwarding (Phase 2B-1) ──────────────────────────
//
// Each time HVH.js successfully places or repositions a ship on the online
// player's own board, we emit place_ship to the server so it can validate and
// store the board state (ready for Phase 2B-2 battle routing).
//
// Detection strategy — no HVH.js modification needed:
//   HVH.js calls flash_landing() — which adds the "place-landed" CSS class to
//   the ship's cells — ONLY on successful placement (both fresh and reposition).
//   A MutationObserver on the board element detects this class addition.
//   A capture-phase click listener records which ship is pending (from the
//   .dragging / .is-repositioning tray element) and the clicked col/row before
//   HVH.js processes the click.

const my_board_el = document.getElementById(
    seat === 0 ? "game_board_1" : "game_board_2"
);
const my_ships_el = document.getElementById(
    seat === 0 ? "ships_1" : "ships_2"
);

let pending_drop = null;

// Observe "place-landed" class additions — added by HVH.js only on success.
const placement_obs = new MutationObserver(function () {
    if (!pending_drop) { return; }
    if (!my_board_el.querySelector(".place-landed")) { return; }
    const pd = pending_drop;
    pending_drop = null;
    socket.emit("place_ship", {
        shipName:    pd.shipName,
        col:         pd.col,
        row:         pd.row,
        orientation: pd.orientation
    });
});

if (my_board_el && my_ships_el) {
    placement_obs.observe(my_board_el, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class"]
    });

    // Capture phase: snapshot the ship being dropped and the target cell before
    // HVH.js processes the click.  Resets on every board cell click so stale
    // state from a failed previous attempt is automatically discarded.
    my_board_el.addEventListener("click", function (event) {
        pending_drop = null;
        const td = event.target.closest("td");
        if (!td) { return; }

        // .dragging  = fresh placement (not yet on board)
        // .is-repositioning = already placed, being moved
        const active_el = my_ships_el.querySelector(".dragging")
            || my_ships_el.querySelector(".is-repositioning");
        if (!active_el) { return; }

        const ship_name = active_el.dataset.ship;
        if (!ship_name) { return; }

        const tr = td.closest("tr");
        if (!tr) { return; }

        // Orientation is tracked by HVH.js via rotate(90deg) on the image.
        const img = active_el.querySelector("img");
        const orientation = (img && img.style.transform.includes("rotate(90deg)"))
            ? "vertical" : "horizontal";

        // td.cellIndex and tr.rowIndex are 0-based, matching HVH.js's
        // column_index / row_index closures and BattleShip.place_ship's
        // x_top_left / y_top_left parameters.
        pending_drop = {
            shipName:    ship_name,
            col:         td.cellIndex,
            row:         tr.rowIndex,
            orientation: orientation
        };
    }, true /* capture — runs before HVH.js onclick */);
}

// ── 7. UI helpers ──────────────────────────────────────────────────────────────

function show_waiting_overlay () {
    const prev = document.getElementById("ogc-waiting-overlay");
    if (prev) { prev.remove(); }

    const overlay = document.createElement("div");
    overlay.id = "ogc-waiting-overlay";
    overlay.className = "online-waiting-overlay";
    overlay.innerHTML =
        "<div class='ogc-particles'></div>" +
        "<div class='ogc-radar'><div class='ogc-radar-sweep'></div></div>" +
        "<div class='ogc-wait-title'>FLEET DEPLOYED</div>" +
        "<div class='ogc-wait-sub'>Waiting for opposing commander…</div>";
    document.body.append(overlay);
}

function show_combat_start () {
    // Remove the "waiting" overlay if still present.
    const prev = document.getElementById("ogc-waiting-overlay");
    if (prev) { prev.remove(); }

    const overlay = document.createElement("div");
    overlay.className = "online-waiting-overlay ogc-combat-ready";
    overlay.innerHTML =
        "<div class='ogc-particles'></div>" +
        "<div class='ogc-wait-title'>DEPLOYMENT CONFIRMED</div>" +
        "<div class='ogc-combat-sub'>ENTERING COMBAT THEATRE</div>";
    document.body.append(overlay);

    // Hold for 1.5 s, then fade out over 0.45 s.
    setTimeout(function () {
        overlay.classList.add("ogc-fade-out");
        setTimeout(function () { overlay.remove(); }, 450);
    }, 1500);
}

function show_ogc_error (msg, detail) {
    const prev = document.getElementById("ogc-waiting-overlay");
    if (prev) { prev.remove(); }
    const overlay = document.createElement("div");
    overlay.className = "online-waiting-overlay";
    overlay.innerHTML =
        "<div class='ogc-wait-title' style='color:#ff6450'>CONNECTION LOST</div>" +
        "<div class='ogc-wait-sub'>" + msg + (detail ? " (" + detail + ")" : "") + "</div>" +
        "<a href='./online.html' style='color:#4fe3ff;font-family:inherit;" +
        "font-size:0.8rem;margin-top:1.5rem;text-decoration:none'>← RETURN TO LOBBY</a>";
    sessionStorage.removeItem("online_session");
    document.body.append(overlay);
}

} // end if (session)
