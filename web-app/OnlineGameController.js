// OnlineGameController.js — Phase 2B-1 + Phase 2C-1
//
// Adapts Human_VS_Human.html for online play.
// Only activates when sessionStorage holds an "online_session" object written
// by online.js after both players name themselves.
//
// This module runs AFTER Human_VS_Human.js has finished (ES module order).
// It never modifies BattleShip.js or local 2-player logic.
// Phase 2B-1 responsibilities:
//   • reconnect socket, pre-fill names, auto-submit
//   • suppress "HIDE YOUR SCREEN" and swap-animation overlays online
//   • intercept Confirm Deployment buttons, emit placement_done
//   • forward per-ship placements to server as place_ship events
// Phase 2C-1 responsibilities:
//   • on battle_ready: inject server boards via window.hvh_online_start_battle,
//     suppress the local swap-animation, wait for HVH.js to enter battle-phase
//   • intercept attack-board clicks → emit shoot → server validates
//   • on shot_result: force td.click() so HVH.js fires all VFX/audio/turn logic
//   • disable sonar + ghost actions (not synced in Phase 2C-1)

// ── 1. Read session ────────────────────────────────────────────────────────────

const session = (function () {
    try {
        return JSON.parse(sessionStorage.getItem("online_session") || "null");
    } catch (_) {
        return null;
    }
}());

if (session) {

const { room, seat, my_name, opp_name } = session;

// ── 2. Guard: socket.io must be loaded ────────────────────────────────────────

if (typeof io === "undefined") {
    const err = document.createElement("div");
    err.className = "online-waiting-overlay";
    err.innerHTML =
        "<div class='ogc-wait-title'>SERVER NOT RUNNING</div>" +
        "<div class='ogc-wait-sub'>Start the server with <code>npm run server</code>" +
        " then open <strong>http://localhost:3001</strong></div>" +
        "<a href='./online.html' style='color:#4fe3ff;font-family:inherit;" +
        "font-size:0.8rem;margin-top:1rem;text-decoration:none'>← BACK TO LOBBY</a>";
    document.body.append(err);
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

// ── 4. Pre-fill name overlay and auto-submit ───────────────────────────────────

const ns_1   = document.getElementById("ns_name_1");
const ns_2   = document.getElementById("ns_name_2");
const ns_btn = document.getElementById("ns_begin");

if (ns_1 && ns_2 && ns_btn) {
    ns_1.value = (seat === 0) ? my_name : opp_name;
    ns_2.value = (seat === 0) ? opp_name : my_name;
    ns_btn.click();
}

// ── 5. Suppress "HIDE YOUR SCREEN" overlay (both seats) ──────────────────────
//
// hide_obs disconnects itself after catching the HIDE overlay so it is no
// longer active when the swap animation fires.  The swap-animation is handled
// separately via swap_obs inside the battle_ready handler.

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
                    btn.click();
                }
            }
        }
    }
});
hide_obs.observe(document.body, {childList: true});

// ── 5b. Guest (seat 1) — jump straight to placing-player-2 ───────────────────

if (seat === 1) {
    const phase_obs = new MutationObserver(function () {
        if (document.body.classList.contains("placing-player-1")) {
            phase_obs.disconnect();
            document.body.classList.remove("placing-player-1");
            document.body.classList.add("placing-player-2");
            // Mirror what HVH.js's pass-screen callback does in local play:
            // hide board 1 elements so HVH.js's keyboard handler correctly
            // identifies board index 1 as active.
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
// seat 0 → intercept .player-1-save (aside board)
// seat 1 → intercept .player-2-save (main board)
//
// bypass_deploy_intercept is set true just before window.hvh_online_start_battle
// programmatically clicks player_2_save_button so the battle-start click
// bypasses this listener and reaches HVH.js normally.

let bypass_deploy_intercept = false;

const confirm_selector = (seat === 0) ? ".player-1-save" : ".player-2-save";
const confirm_btn      = document.querySelector(confirm_selector);

if (confirm_btn) {
    confirm_btn.addEventListener("click", function (event) {
        if (bypass_deploy_intercept) { return; }
        if (confirm_btn.disabled) { return; }
        event.stopImmediatePropagation();
        socket.emit("placement_done");
        show_waiting_overlay();
    }, true /* capture */);
}

// ── 6.5. Per-ship placement forwarding (Phase 2B-1) ──────────────────────────
//
// HVH.js calls window.hvh_on_ship_placed(game_board_index, ship_name, col, row,
// orientation) immediately after every confirmed placement (fresh or reposition).
// We only forward events for this player's own board (game_board_index === seat).

window.hvh_on_ship_placed = function (game_board_index, ship_name, col, row, orientation) {
    if (game_board_index !== seat) { return; }
    socket.emit("place_ship", {
        shipName:    ship_name,
        col:         col,
        row:         row,
        orientation: orientation
    });
};

// ── 7. Battle-phase entry (Phase 2C-1) ────────────────────────────────────────
//
// Board index mapping after HVH.js's internal game-state swap:
//   game_state[0] = P2's fleet → game_board_1 (aside,  index 0) ← P1 attacks
//   game_state[1] = P1's fleet → game_board_2 (main,   index 1) ← P2 attacks
// Therefore: shooter_seat == game_board_index for every shot.
//
// Sequence:
//   t=0    show "DEPLOYMENT CONFIRMED" overlay (2.4 s hold + 0.45 s fade)
//   t=0    swap_obs installed to catch & discard the swap-animation overlay
//   t=0    window.hvh_online_start_battle(boards):
//            • sets game_state[0]/[1] from server data so is_player_ready(1) passes
//            • programmatically clicks player_2_save_button
//            • HVH.js calls show_swap_animation → appends .swap-overlay
//   t≈0ms  swap_obs fires (microtask) → removes .swap-overlay immediately
//   t=2.2s HVH.js's 2200 ms timer fires → executes battle-start callback
//            (battle-phase begins behind our overlay)
//   t=2.85s overlay fully removed → init_online_shooting() called

socket.on("battle_ready", function (data) {
    const b0_ships = (data && data.boards && data.boards[0])
        ? data.boards[0].flat().filter(function (c) { return c && c.ship; }).length
        : "N/A";
    const b1_ships = (data && data.boards && data.boards[1])
        ? data.boards[1].flat().filter(function (c) { return c && c.ship; }).length
        : "N/A";

    window.hvh_on_ship_placed = null;

    // Install swap_obs BEFORE triggering hvh_online_start_battle.
    // hide_obs has already disconnected after the HIDE overlay, so a fresh
    // observer is needed here to catch and suppress the swap animation.
    const swap_obs = new MutationObserver(function (mutations) {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1 && node.classList.contains("swap-overlay")) {
                    swap_obs.disconnect();
                    node.remove();
                }
            }
        }
    });
    swap_obs.observe(document.body, {childList: true});

    // Show overlay that covers the 2.2 s transition.
    show_combat_start(function () {
        init_online_shooting();
    });

    // Inject server boards and trigger HVH.js battle-phase setup.
    window.hvh_skip_ghost_handoff = true;   // suppress "look away" overlay on separate devices
    bypass_deploy_intercept = true;
    if (window.hvh_online_start_battle) {
        window.hvh_online_start_battle(data.boards);
    } else {
    }
    bypass_deploy_intercept = false;
});

// ── 8. Online shooting (Phase 2C-1) ───────────────────────────────────────────

let bypass_intercept = false;
let my_turn = (seat === 0);   // P1 (seat 0) always fires first

function init_online_shooting () {
    // The boards were recreated by reset_display_to_shoot inside HVH.js's
    // battle-start callback — query fresh IDs now.
    const my_attack_el  = document.getElementById(
        seat === 0 ? "game_board_1" : "game_board_2"
    );
    const opp_attack_el = document.getElementById(
        seat === 0 ? "game_board_2" : "game_board_1"
    );

    // MY attack board: intercept unshot-cell clicks and route via server.
    // Phase 2C-2: sonar branch precedes shoot branch.  Mode is detected via DOM
    // (".sonar-action.is-active") rather than reading HVH.js's private
    // current_action_mode — this prevents the opponent from accidentally emitting
    // "sonar" during the 3500 ms sonar display window (when the opponent's
    // current_action_mode would be "sonar" due to hvh_ensure_sonar_mode, but
    // their sonar button has no .is-active class because they never clicked it).
    if (my_attack_el) {
        my_attack_el.addEventListener("click", function (event) {
            if (bypass_intercept) { return; }   // allow forced sonar/shot replays
            if (!my_turn) { return; }
            const td = event.target.closest("td");
            if (!td || td.className !== "unshot") { return; }
            const tr = td.closest("tr");
            if (!tr) { return; }

            const is_sonar = !!document.querySelector(".sonar-action.is-active");
            if (is_sonar) {
                event.stopImmediatePropagation();
                socket.emit("sonar", {col: td.cellIndex, row: tr.rowIndex});
                return;
            }

            event.stopImmediatePropagation();
            socket.emit("shoot", {col: td.cellIndex, row: tr.rowIndex});
        }, true /* capture */);
    }

    // OPPONENT's board (= this player's own fleet board, also used for ghost interaction).
    // Three branches: bypass replays, ghost ship-selection pass-through,
    // ghost_relocate placement intercept, default block.
    if (opp_attack_el) {
        opp_attack_el.addEventListener("click", function (event) {
            // Branch 1: allow forced replays through (shot_result / sonar_result).
            if (bypass_intercept) { return; }

            const is_ghost_active = !!document.querySelector(".ghost-action.is-active");
            const is_relocate     = !!document.querySelector(".ghost-relocate-controls");

            // Branch 2: ghost_select / ghost_move ship selection — pass through to HVH.js.
            if (is_ghost_active && !is_relocate) { return; }

            // Branch 3: ghost_relocate placement — intercept and emit to server.
            if (is_relocate && my_turn) {
                const td = event.target.closest("td");
                if (!td) { event.stopImmediatePropagation(); return; }
                const tr = td.closest("tr");
                if (!tr) { event.stopImmediatePropagation(); return; }
                const params = window.hvh_get_ghost_params
                    ? window.hvh_get_ghost_params() : null;
                if (!params || !params.ship_name) {
                    event.stopImmediatePropagation(); return;
                }
                console.log("[OGC GHOST] ghost_relocate intercept", {
                    ship_name:   params.ship_name,
                    anchor_col:  td.cellIndex,
                    anchor_row:  tr.rowIndex,
                    orientation: params.orientation
                });
                event.stopImmediatePropagation();
                socket.emit("ghost_relocate", {
                    ship_name:   params.ship_name,
                    anchor_col:  td.cellIndex,
                    anchor_row:  tr.rowIndex,
                    orientation: params.orientation
                });
                return;
            }

            // Default: block all other clicks on this board.
            event.stopImmediatePropagation();
        }, true /* capture */);
    }

    // Ghost and Sonar are now live — buttons managed by HVH.js's update_battle_controls.
    // Phase 2C-3: intercept ghost_slide confirm button via capture listener on center_el.
    // The confirm button is recreated each render, so we listen on the stable parent.
    const center_el = document.getElementById("center_control");
    if (center_el) {
        center_el.addEventListener("click", function (event) {
            if (!my_turn) { return; }
            const ghost_confirm = event.target.closest(".ghost-confirm-btn");
            if (!ghost_confirm) { return; }
            if (ghost_confirm.disabled) { return; }
            const params = window.hvh_get_ghost_params
                ? window.hvh_get_ghost_params() : null;
            if (!params || !params.ship_name || !params.direction) { return; }
            console.log("[OGC GHOST] ghost_slide intercept", {
                ship_name: params.ship_name,
                direction: params.direction,
                distance:  params.distance
            });
            event.stopImmediatePropagation();
            socket.emit("ghost_slide", {
                ship_name: params.ship_name,
                direction: params.direction,
                distance:  params.distance
            });
        }, true /* capture */);
    }

    // Handle every shot result — applies to BOTH clients for every shot.
    socket.on("shot_result", function (data) {
        // data.shooter_seat === the game_board_index that was hit.
        const board_id = data.shooter_seat === 0 ? "game_board_1" : "game_board_2";
        const board_el = document.getElementById(board_id);
        if (!board_el) { return; }
        const trs = board_el.querySelectorAll("tr");
        if (!trs[data.row]) { return; }
        const td = trs[data.row].querySelectorAll("td")[data.col];
        if (!td) { return; }

        // Ensure HVH.js's onclick condition (current_action_mode === "shoot") passes.
        if (window.hvh_ensure_shoot_mode) { window.hvh_ensure_shoot_mode(); }

        // Force the shot through HVH.js's normal click path so all VFX,
        // audio, stat tracking, and turn logic run identically on both clients.
        bypass_intercept = true;
        td.click();
        bypass_intercept = false;

        // Sync whose turn it is from the server's authoritative counter.
        my_turn = (data.next_turn % 2 === seat);
    });

    // ── Phase 2C-2: sonar result — applies to BOTH clients for every sonar scan.
    // Mirrors shot_result exactly: find the board cell, force HVH.js into sonar
    // mode, replay the click so HVH.js runs its full sonar path (overlays,
    // count label, 3500 ms display timer, end_current_turn).
    socket.on("sonar_result", function (data) {

        const board_id = data.shooter_seat === 0 ? "game_board_1" : "game_board_2";
        const board_el = document.getElementById(board_id);
        if (!board_el) {
            return;
        }
        const trs = board_el.querySelectorAll("tr");
        if (!trs[data.row]) {
            return;
        }
        const td = trs[data.row].querySelectorAll("td")[data.col];
        if (!td) {
            return;
        }

        // Set current_action_mode = "sonar" so HVH.js routes td.onclick to the
        // sonar branch.  Uses the same hook pattern as hvh_ensure_shoot_mode.
        if (window.hvh_ensure_sonar_mode) {
            window.hvh_ensure_sonar_mode();
        } else {
            return;
        }

        // Force the sonar through HVH.js's normal click path so overlays,
        // sonar_scans_left decrement, display timer and end_current_turn all run
        // identically on both clients.
        bypass_intercept = true;
        td.click();
        bypass_intercept = false;

        // Sync whose turn it is from the server's authoritative counter.
        my_turn = (data.next_turn % 2 === seat);
    });

    // ── Phase 2C-3: ghost slide result ────────────────────────────────────────
    // Called on BOTH clients after the server validates and applies ghost_slide.
    // show_flash is true only for the mover — opponent gets false to preserve stealth.
    socket.on("ghost_slide_result", function (data) {
        console.log("[OGC GHOST] ghost_slide_result received", data);
        const is_mover = (data.shooter_seat === seat);
        if (window.hvh_commit_ghost_slide) {
            window.hvh_commit_ghost_slide(
                data.ship_name, data.direction, data.distance, is_mover, data.ghost_moves_left
            );
        }
        my_turn = (data.next_turn % 2 === seat);
    });

    // ── Phase 2C-3: ghost relocate result ─────────────────────────────────────
    // Called on BOTH clients after the server validates and applies ghost_relocate.
    socket.on("ghost_relocate_result", function (data) {
        console.log("[OGC GHOST] ghost_relocate_result received", data);
        const is_mover = (data.shooter_seat === seat);
        if (window.hvh_commit_ghost_relocate) {
            window.hvh_commit_ghost_relocate(
                data.ship_name, data.anchor_col, data.anchor_row,
                data.orientation, is_mover, data.ghost_moves_left
            );
        }
        my_turn = (data.next_turn % 2 === seat);
    });
}

// ── 9. UI helpers ──────────────────────────────────────────────────────────────

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

// on_done is called after the overlay fully fades (~2.85 s after this call).
// The 2400 ms hold deliberately exceeds HVH.js's 2200 ms swap-animation timer
// so the battle-phase UI is ready before the overlay lifts.
function show_combat_start (on_done) {
    const prev = document.getElementById("ogc-waiting-overlay");
    if (prev) { prev.remove(); }

    const overlay = document.createElement("div");
    overlay.className = "online-waiting-overlay ogc-combat-ready";
    overlay.innerHTML =
        "<div class='ogc-particles'></div>" +
        "<div class='ogc-wait-title'>DEPLOYMENT CONFIRMED</div>" +
        "<div class='ogc-combat-sub'>ENTERING COMBAT THEATRE</div>";
    document.body.append(overlay);

    setTimeout(function () {
        overlay.classList.add("ogc-fade-out");
        setTimeout(function () {
            overlay.remove();
            if (on_done) { on_done(); }
        }, 450);
    }, 2400);
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
