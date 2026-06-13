import R from "./ramda.js";
import Battleship from "./BattleShip.js";
import { run_battle_countdown } from "./countdown.js?v=7";
import {
    playHitSound,
    playMissSound,
    playSunkSound
} from "./sound.js";

// ==========================================
// AUDIO SYSTEM
// ==========================================
// Sounds are synthesised with the Web Audio API (see sounds.js).
// No MP3/OGG files are required.
const Audio_Manager = {
    start_ambient: function () { /* no ambient track */ },
    stop_ambient: function () { /* no ambient track */ },
    play_miss: function () { playMissSound(); },
    play_hit:  function () { playHitSound(); },
    play_sunk: function () { playSunkSound(); }
};

// Defining the parameters of the grid
const height = 10;
const width = 10;

// Generating two empty grids in an array, this will be the game state
let game_state = [
    Battleship.empty_board(width, height),
    Battleship.empty_board(width, height)
];

let multiplayer_ship_array = Battleship.multiplayer_ship_array;

// Last board cell the cursor hovered over during placement (used to refresh
// the ship preview when R is pressed to rotate mid-hover).
let hovered_cell_info = null;

// Battle-phase statistics for the victory screen.
let battle_start_time = null;
let standard_fire_shots = [0, 0];
let standard_fire_hits  = [0, 0];
let ships_sunk_count    = [0, 0];
let game_over = false;

// At first, the page is in "place_ship" mode.
// The update_display function updates the display to show
// where the ships have been placed
let update_display = function () {
    game_state.forEach(function (game_board, game_board_index) {
        game_board.forEach(function (row, row_index) {
            row.forEach(function (cell, column_index) {
                const table_cell = table_cells[
                    game_board_index
                ][row_index][column_index];
                table_cell.className = (
                    Battleship.is_ship_here(cell)
                    ? "cell_with_ship"
                    : "unshot"
                );
            });
        });
    });
};

////////////

// Instantiating all the html variables

document.documentElement.style.setProperty("--game-rows", height);
document.documentElement.style.setProperty("--game-columns", width);

let game_board_1 = document.getElementById("game_board_1");
let game_board_2 = document.getElementById("game_board_2");

const game_container_1 = document.getElementById("game_container_1");
const game_container_2 = document.getElementById("game_container_2");

const ships_1 = document.getElementById("ships_1");
const ships_2 = document.getElementById("ships_2");

const button_container_1 = document.getElementById("button_container_1");
const button_container_2 = document.getElementById("button_container_2");

let player_1_save_button = null;
let player_2_save_button = null;

const set_game_phase = function (phase) {
    document.body.classList.remove(
        "intro-phase",
        "placing-player-1",
        "placing-player-2",
        "battle-phase"
    );
    document.body.classList.add(phase);
};

const set_deploy_title = function () {
    const game_title = document.querySelector("header h1");
    const player_1_title = document.querySelector("aside h2");
    const player_2_title = document.querySelector("main h2");
    // The "Fleet Deployment" subtitle is added by CSS (h1::after).
    if (game_title) game_title.textContent = "Battleship";
    if (player_1_title) player_1_title.textContent = "Deploy your ships";
    if (player_2_title) player_2_title.textContent = "Deploy your ships";
};

const set_battle_titles = function () {
    const game_title = document.querySelector("header h1");
    const player_1_title = document.querySelector("aside h2");
    const player_2_title = document.querySelector("main h2");
    if (game_title) game_title.textContent = "Battleship";
    if (player_1_title) player_1_title.textContent = "Player 1";
    if (player_2_title) player_2_title.textContent = "Player 2";
};

const total_ship_cell_count = Battleship.ship_array.reduce(function (total, ship) {
    return total + ship.length;
}, 0);

const count_ship_cells_on_board = function (player_index) {
    return game_state[player_index].reduce(function (total, row) {
        return total + row.filter(function (cell) {
            return cell && Battleship.is_ship_here(cell);
        }).length;
    }, 0);
};

const count_ship_cells_in_display = function (player_index) {
    const board = player_index === 0 ? game_board_1 : game_board_2;
    if (!board) return 0;
    return board.querySelectorAll(".cell_with_ship").length;
};

const is_ship_tray_empty = function (player_index) {
    const ship_container = player_index === 0 ? ships_1 : ships_2;
    if (!ship_container) return false;
    return ship_container.querySelectorAll("td.ship, td.dragging").length === 0;
};

const is_player_ready_to_save = function (player_index) {
    return multiplayer_ship_array[player_index].every((ship) => ship.placed) ||
        count_ship_cells_on_board(player_index) >= total_ship_cell_count ||
        count_ship_cells_in_display(player_index) >= total_ship_cell_count ||
        is_ship_tray_empty(player_index);
};

// Visual-only: refreshes the side "Tactical Data" panel (fleet count, bar,
// deployment status). Reads state, never mutates it.
const update_tactical_panel = function (player_index) {
    const section = player_index === 0
        ? document.querySelector("aside")
        : document.querySelector("main");
    if (!section) return;
    const panel = section.querySelector(".deploy-tactical");
    if (!panel) return;
    const fleet = multiplayer_ship_array[player_index];
    const total = fleet.length;
    const placed = fleet.filter((ship) => ship.placed).length;
    const count_el = panel.querySelector(".tac-fleet-count");
    if (count_el) count_el.textContent = placed + " / " + total;
    const fill_el = panel.querySelector(".tac-bar-fill");
    if (fill_el) fill_el.style.width = ((placed / total) * 100) + "%";
    const status_el = panel.querySelector(".tac-deploy-status");
    if (status_el) {
        status_el.textContent = placed >= total ? "Ready" : "In Progress";
        status_el.classList.toggle("is-ready", placed >= total);
    }
};

const update_deploy_controls = function () {
    update_tactical_panel(0);
    update_tactical_panel(1);
    // The SAVE button stays hidden until every ship of that board is placed,
    // so beginners are not tempted to save an incomplete board.
    if (player_1_save_button) {
        const ready = is_player_ready_to_save(0);
        player_1_save_button.disabled = !ready;
        player_1_save_button.setAttribute("aria-disabled", String(!ready));
        player_1_save_button.classList.toggle("is-ready", ready);
        player_1_save_button.classList.toggle("is-hidden", !ready);
    }
    if (player_2_save_button) {
        const ready = is_player_ready_to_save(1);
        player_2_save_button.disabled = !ready;
        player_2_save_button.setAttribute("aria-disabled", String(!ready));
        player_2_save_button.classList.toggle("is-ready", ready);
        player_2_save_button.classList.toggle("is-hidden", !ready);
    }
};

const remove_overlay = function () {
    const existing_overlay = document.querySelector(".screen-overlay");
    if (existing_overlay) {
        existing_overlay.remove();
    }
};

const show_message_overlay = function (
    message,
    button_text,
    accent_class,
    on_confirm
) {
    remove_overlay();
    const overlay = document.createElement("div");
    overlay.className = `screen-overlay ${accent_class}`;

    const text = document.createElement("div");
    text.className = "overlay-message";
    text.textContent = message;
    overlay.append(text);

    const action_holder = document.createElement("div");
    action_holder.className = "overlay-action-holder";

    const ok_button = document.createElement("button");
    ok_button.className = "overlay-ok-button";
    ok_button.textContent = button_text;
    ok_button.onclick = function () {
        remove_overlay();
        if (on_confirm) on_confirm();
    };
    action_holder.append(ok_button);
    overlay.append(action_holder);

    document.body.append(overlay);
};

// ── Animated multiplayer transition scenes (no images) ──────────────
// Two cinematic HUD overlays built entirely from HTML/CSS/SVG:
//   • "Hide your screen"  — orange Player-1 tactical shield scene
//   • "Pass the screen"   — orange→blue data-handoff scene
// Presentation only; the game logic is unchanged.

// Shared shell: injects the scene markup and wires the GOT IT button. The
// confirm callback runs BEFORE the exit fade so the next game state is
// already in place and nothing flashes through during the dissolve.
const build_transition_overlay = function (theme, scene_html, on_confirm) {
    remove_overlay();
    const overlay = document.createElement("div");
    overlay.className = "screen-overlay transition-overlay " + theme;
    overlay.innerHTML = scene_html;
    document.body.append(overlay);

    const btn = overlay.querySelector(".ts-button");
    if (btn) {
        btn.addEventListener("click", function () {
            if (btn.disabled) return;
            btn.disabled = true;
            if (on_confirm) on_confirm();
            overlay.classList.add("ts-exit");
            setTimeout(remove_overlay, 460);
        });
    }
    return overlay;
};

// Scatter drifting energy particles into a stage (transform/opacity only).
const sprinkle_particles = function (container, count) {
    if (!container) return;
    R.range(0, count).forEach(function () {
        const p = document.createElement("span");
        p.className = "ts-particle";
        p.style.left = (6 + Math.random() * 88) + "%";
        p.style.setProperty("--rise", (2.8 + Math.random() * 2.6).toFixed(2) + "s");
        p.style.setProperty("--delay", (-Math.random() * 4).toFixed(2) + "s");
        p.style.setProperty("--drift", (Math.random() * 26 - 13).toFixed(0) + "px");
        p.style.setProperty("--size", (2 + Math.random() * 3).toFixed(1) + "px");
        container.append(p);
    });
};

// SCREEN 1 — Player 1, "HIDE YOUR SCREEN": holographic tactical shield.
const show_hide_screen_overlay = function (on_confirm) {
    const scene = `
        <div class="ts-bg ts-bg-orange">
            <div class="ts-grid"></div>
            <div class="ts-scanline"></div>
            <div class="ts-vignette"></div>
        </div>
        <div class="ts-content">
            <div class="ts-head">
                <div class="ts-eyebrow">// PLAYER 1 TURN //</div>
                <h1 class="ts-title">HIDE YOUR SCREEN</h1>
                <div class="ts-sub">FROM YOUR FRIEND</div>
            </div>
            <div class="ts-center">
                <div class="ts-shield-stage" aria-hidden="true">
                    <div class="ts-glow"></div>
                    <span class="ts-wave"></span>
                    <span class="ts-wave"></span>
                    <span class="ts-wave"></span>
                    <div class="ts-ring ts-ring-outer"></div>
                    <div class="ts-ring ts-ring-inner"></div>
                    <div class="ts-scan-ring"></div>
                    <svg class="ts-shield-svg" viewBox="0 0 120 132">
                        <path class="ts-shield-body" d="M60 7 L105 25 L105 64 C105 97 60 125 60 125 C60 125 15 97 15 64 L15 25 Z"/>
                        <path class="ts-shield-edge" d="M60 7 L105 25 L105 64 C105 97 60 125 60 125 C60 125 15 97 15 64 L15 25 Z"/>
                        <circle class="ts-shield-ring" cx="60" cy="62" r="20"/>
                        <line class="ts-shield-cross" x1="60" y1="40" x2="60" y2="84"/>
                        <line class="ts-shield-cross" x1="38" y1="62" x2="82" y2="62"/>
                        <circle class="ts-shield-dot" cx="60" cy="62" r="3.5"/>
                    </svg>
                    <div class="ts-particles"></div>
                </div>
                <div class="ts-status"><span class="ts-status-dot"></span>VISUAL LOCKDOWN ACTIVE</div>
            </div>
            <div class="ts-foot">
                <button class="ts-button" type="button">GOT IT</button>
                <div class="ts-caption">KEEP YOUR FLEET SAFE</div>
            </div>
        </div>`;
    const overlay = build_transition_overlay("ts-theme-orange", scene, on_confirm);
    sprinkle_particles(overlay.querySelector(".ts-particles"), 10);
};

// SCREEN 2 — Player 2, "PASS THE SCREEN": orange→blue data handoff.
const show_pass_screen_overlay = function (on_confirm) {
    const node = function (cls, label) {
        return `
            <div class="ts-node ${cls}">
                <svg class="ts-node-svg" viewBox="0 0 88 88">
                    <polygon class="ts-hex" points="26,6 62,6 84,44 62,82 26,82 4,44"/>
                    <polygon class="ts-hex-inner" points="33,18 55,18 70,44 55,70 33,70 18,44"/>
                    <circle class="ts-hex-dot" cx="44" cy="44" r="5"/>
                </svg>
                <span class="ts-node-label">${label}</span>
            </div>`;
    };
    const scene = `
        <div class="ts-bg ts-bg-split">
            <div class="ts-grid"></div>
            <div class="ts-seam"></div>
            <div class="ts-scanline"></div>
            <div class="ts-vignette"></div>
        </div>
        <div class="ts-content">
            <div class="ts-head">
                <div class="ts-eyebrow ts-eyebrow-blue">// PLAYER 2 TURN //</div>
                <h1 class="ts-title">PASS THE SCREEN</h1>
                <div class="ts-sub ts-sub-blue">TO YOUR FRIEND</div>
            </div>
            <div class="ts-transfer-stage" aria-hidden="true">
                ${node("ts-node-orange", "P1")}
                <div class="ts-stream">
                    <div class="ts-stream-track"></div>
                    <span class="ts-chevron"></span>
                    <span class="ts-chevron"></span>
                    <span class="ts-chevron"></span>
                    <div class="ts-core"></div>
                    <div class="ts-packets"></div>
                </div>
                ${node("ts-node-blue", "P2")}
            </div>
            <div class="ts-foot">
                <button class="ts-button ts-button-blue" type="button">GOT IT</button>
                <div class="ts-caption ts-caption-blue">DON'T LOOK!</div>
            </div>
        </div>`;
    const overlay = build_transition_overlay("ts-theme-split", scene, on_confirm);
    const packets = overlay.querySelector(".ts-packets");
    if (packets) {
        R.range(0, 5).forEach(function (i) {
            const dot = document.createElement("span");
            dot.className = "ts-packet";
            dot.style.setProperty("--delay", (i * 0.46).toFixed(2) + "s");
            packets.append(dot);
        });
    }
};

// ── Ghost Move tactical decision overlays ───────────────────────────
// A two-step gate that replaces the old "click → ships instantly revealed"
// behaviour. Step 1 asks the acting player to confirm; step 2 warns the
// opponent to look away. Only after both does ghost-select mode begin.

// Shared animated backdrop + reticle for the ghost screens (themed by --ga).
const ghost_scene = function (accent, eyebrow, title, message_lines, glyph, buttons_html) {
    const msgs = message_lines.map(function (line, i) {
        return `<p class="ghost-msg${i === 0 ? "" : " dim"}">${line}</p>`;
    }).join("");
    return `
        <div class="ghost-bg"></div>
        <div class="ts-grid"></div>
        <div class="ghost-scanline"></div>
        <div class="ts-vignette"></div>
        <div class="ts-content">
            <div class="ts-head">
                <div class="ts-eyebrow">${eyebrow}</div>
                <h1 class="ts-title ghost-title">${title}</h1>
            </div>
            <div class="ghost-mid">
                <div class="ghost-scope" aria-hidden="true">
                    <div class="ghost-scope-ring"></div>
                    <div class="ghost-scope-ring2"></div>
                    <div class="ghost-scope-core"></div>
                    <span class="ghost-scope-glyph">${glyph}</span>
                </div>
                <div class="ghost-message-block">${msgs}</div>
            </div>
            <div class="ts-btn-row">${buttons_html}</div>
        </div>`;
};

const build_ghost_overlay = function (accent_idx, scene_html) {
    remove_overlay();
    const theme = accent_idx === 0 ? "ghost-theme-orange" : "ghost-theme-blue";
    const overlay = document.createElement("div");
    overlay.className = "screen-overlay transition-overlay ghost-overlay " + theme;
    overlay.innerHTML = scene_html;
    document.body.append(overlay);
    return overlay;
};

const dismiss_overlay = function (overlay, after) {
    overlay.classList.add("ts-exit");
    setTimeout(function () {
        remove_overlay();
        if (after) after();
    }, 460);
};

// Step 1 — shown to the acting player.
const show_ghost_confirm = function (active_idx, on_confirm, on_cancel) {
    const player = active_idx === 0 ? "PLAYER 1" : "PLAYER 2";
    const scene = ghost_scene(
        active_idx,
        "// " + player + " · GHOST PROTOCOL //",
        "ACTIVATE GHOST MOVE?",
        [
            "Your unsunken ships can relocate and recover.",
            "But every decision leaves traces.",
            "Your opponent may discover your movement."
        ],
        "👻",
        "<button class=\"ts-button ghost-confirm\" type=\"button\">CONFIRM</button>" +
        "<button class=\"ts-button ghost-cancel\" type=\"button\">CANCEL</button>"
    );
    const overlay = build_ghost_overlay(active_idx, scene);
    overlay.querySelector(".ghost-confirm").addEventListener("click", function () {
        dismiss_overlay(overlay, on_confirm);
    });
    overlay.querySelector(".ghost-cancel").addEventListener("click", function () {
        dismiss_overlay(overlay, on_cancel);
    });
};

// Step 2 — addressed to the opponent (themed in the opponent's colour).
const show_ghost_handoff = function (active_idx, on_proceed) {
    const opponent_idx = 1 - active_idx;
    const scene = ghost_scene(
        opponent_idx,
        "// INCOMING SIGNAL · GHOST PROTOCOL //",
        "OPPONENT ACTIVATED GHOST MOVE",
        [
            "Turn away. Do not look.",
            "But remember…",
            "Nothing disappears without a trace.",
            "Analyse the battlefield carefully."
        ],
        "⚠",
        "<button class=\"ts-button ghost-confirm\" type=\"button\">PROCEED</button>"
    );
    const overlay = build_ghost_overlay(opponent_idx, scene);
    overlay.querySelector(".ghost-confirm").addEventListener("click", function () {
        dismiss_overlay(overlay, on_proceed);
    });
};

// Cinematic end-game overlay with the victory image and a battle report.
const show_victory_screen = function (winner_player) {
    const img_src = winner_player === 1
        ? "./assets/player1 win pic.png"
        : "./assets/player2 win pic.png";
    const player_idx = winner_player - 1;

    const elapsed_seconds = battle_start_time
        ? Math.floor((Date.now() - battle_start_time) / 1000)
        : 0;
    const mins = Math.floor(elapsed_seconds / 60);
    const secs = elapsed_seconds % 60;
    const time_str = mins + ":" + String(secs).padStart(2, "0");

    const accuracy = standard_fire_shots[player_idx] > 0
        ? Math.round(standard_fire_hits[player_idx] / standard_fire_shots[player_idx] * 100)
        : 0;

    const total_ships = Battleship.ship_array.length;

    const overlay = document.createElement("div");
    overlay.className = "victory-overlay";

    const bg_img = document.createElement("img");
    bg_img.src = img_src;
    bg_img.className = "victory-bg-img";
    overlay.append(bg_img);

    const report = document.createElement("div");
    report.className = "victory-report";

    const report_title = document.createElement("div");
    report_title.className = "victory-report-title";
    report_title.textContent = "BATTLE REPORT";
    report.append(report_title);

    const stats_row = document.createElement("div");
    stats_row.className = "victory-stats-row";

    const make_stat = function (label, value) {
        const card = document.createElement("div");
        card.className = "victory-stat-card";
        const val = document.createElement("div");
        val.className = "victory-stat-value";
        val.textContent = value;
        const lbl = document.createElement("div");
        lbl.className = "victory-stat-label";
        lbl.textContent = label;
        card.append(val, lbl);
        return card;
    };

    stats_row.append(
        make_stat("ACCURACY",    accuracy + "%"),
        make_stat("SHIPS SUNK",  ships_sunk_count[player_idx] + "/" + total_ships),
        make_stat("BATTLE TIME", time_str)
    );
    report.append(stats_row);
    overlay.append(report);

    const return_btn = document.createElement("button");
    return_btn.className = "victory-return-btn";
    return_btn.textContent = "RETURN TO MENU";
    return_btn.onclick = function () { window.location.href = "./index.html"; };
    overlay.append(return_btn);

    document.body.append(overlay);
};

// Plays a board-exchange animation before the battle begins: the orange
// (Player 1) and blue (Player 2) boards slide across and swap sides, making it
// clear that players now attack the opponent rather than their own board.
const show_swap_animation = function (on_complete) {
    remove_overlay();

    const overlay = document.createElement("div");
    overlay.className = "screen-overlay swap-overlay";

    const stage = document.createElement("div");
    stage.className = "swap-stage";

    const make_panel = function (panel_class, label_text) {
        const panel = document.createElement("div");
        panel.className = "swap-panel " + panel_class;

        const grid = document.createElement("div");
        grid.className = "swap-grid";
        R.range(0, 36).forEach(function () {
            grid.append(document.createElement("span"));
        });

        const label = document.createElement("div");
        label.className = "swap-label";
        label.textContent = label_text;

        panel.append(grid, label);
        return panel;
    };

    stage.append(
        make_panel("swap-p1", "Player 1"),
        make_panel("swap-p2", "Player 2")
    );

    const caption = document.createElement("div");
    caption.className = "swap-caption";
    caption.textContent = "Boards swapped — now attack your opponent!";

    overlay.append(stage, caption);
    document.body.append(overlay);

    // Trigger the CSS transition on the next frame.
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            overlay.classList.add("swap-go");
        });
    });

    setTimeout(function () {
        remove_overlay();
        if (on_complete) {
            on_complete();
        }
    }, 2200);
};

const show_countdown_overlay = function () {
    set_game_phase("intro-phase");
    remove_overlay();
    // body starts with .battle-initializing (set in the HTML) so no game UI
    // can flash before the cinematic launch sequence finishes.
    run_battle_countdown(function () {
        document.body.classList.remove("battle-initializing");
        show_hide_screen_overlay(function () {
            set_game_phase("placing-player-1");
            set_deploy_title();
            update_deploy_controls();
        });
    }, { finaleTitle: "GAME START" });
};

////////////

// The next turn button allows the display to update in order to show
// Player 2's board, and hide Player 1's board. That way both users can place
// their ships without seeing the other player's board
const create_next_turn_button = function () {
    const button = document.createElement("button");
    button.textContent = "Confirm Deployment";
    button.className = "save-turn-button player-1-save";
    button.disabled = true;
    player_1_save_button = button;
    button.addEventListener("click", function () {
        // This button only works if all the ships of that board are placed
        if (is_player_ready_to_save(0)) {
            show_pass_screen_overlay(function () {
                // Hide game board 1
                game_board_1.style.visibility = "hidden";
                ships_1.style.visibility = "hidden";
                button_container_1.style.visibility = "hidden";

                // Display game board 2
                game_board_2.style.visibility = "visible";
                ships_2.style.visibility = "visible";
                button_container_2.style.visibility = "visible";

                selected_ship_name = undefined;
                set_game_phase("placing-player-2");
                set_deploy_title();
                update_deploy_controls();
            });
        }
    });
    button_container_1.append(button);
};

// The function is used to change the display to "shoot_ship" mode.
// It gets rid of the html tables that show where the boats are and
// generate new empty ones (to be filled up later)
// It is called when the user presses on the play button.
const reset_display_to_shoot = function () {
    // Removes unwanted elements
    game_board_1.remove();
    game_board_2.remove();
    ships_1.remove();
    ships_2.remove();
    button_container_2.remove();
    button_container_1.remove();

    // Creates new tables
    game_board_1 = document.createElement("table");
    game_board_1.index = 0;
    game_board_1.id = "game_board_1";
    game_container_1.append(game_board_1);
    game_board_2 = document.createElement("table");
    game_container_2.append(game_board_2);
    game_board_2.index = 0;
    game_board_2.id = "game_board_2";
    // Resets the visibility of board 2 which was previously hidden by default
    game_board_2.style.visibility = "visible";
};

// The play button is used to reset the display and then generate the new one
// It modifies the update_display function so that it now updates to show if a
// cell is hit, miss, sunken_ship, or unshot, and will check every round if a
// player has won. It only works if all the ships of board 2 have been placed
const create_play_button = function () {
    const play_button = document.createElement("button");
    play_button.textContent = "Confirm Deployment";
    play_button.className = "save-turn-button player-2-save";
    play_button.disabled = true;
    player_2_save_button = play_button;
    play_button.addEventListener("click", function () {
        if (is_player_ready_to_save(1)) {
            show_swap_animation(function () {
            set_game_phase("battle-phase");
            set_battle_titles();
            reset_display_to_shoot();
            battle_start_time = Date.now();
            
            // 
            // Centre control is in HTML — no dynamic panel needed

            // Create ship-status trackers (one per side)
            const create_ship_tracker = function (tracker_id, player_folder, parent_el) {
                const tracker = document.createElement("div");
                tracker.id = "tracker_" + tracker_id;
                tracker.className = "ship-tracker";

                // Two rows: first 3 ships on top, last 2 on bottom
                const row1 = document.createElement("div");
                row1.className = "tracker-row";
                const row2 = document.createElement("div");
                row2.className = "tracker-row";

                Battleship.ship_array.forEach(function (ship, ship_index) {
                    const item = document.createElement("div");
                    item.className = "tracker-ship";
                    item.dataset.ship = ship.name;
                    // Staggered cascade: each icon enters 130 ms after the previous
                    item.style.animationDelay = (ship_index * 130) + "ms";

                    const img = document.createElement("img");
                    img.src = "./assets/" + player_folder + "/" + ship.name + ".png";
                    img.alt = ship.name;
                    item.append(img);
                    item.append(create_ship_size_strip(ship));

                    // Top row: 2 longest ships (carrier-5, battleship-4)
                    // Bottom row: 3 shorter ships (cruiser-3, submarine-3, destroyer-2)
                    if (ship_index < 2) {
                        row1.append(item);
                    } else {
                        row2.append(item);
                    }
                });

                tracker.append(row1);
                tracker.append(row2);
                parent_el.append(tracker);
            };
            create_ship_tracker(0, "player2", document.querySelector("aside"));
            create_ship_tracker(1, "player1", document.querySelector("main"));

            // Swap game states
            [game_state[0], game_state[1]] = [game_state[1], game_state[0]];
            Audio_Manager.start_ambient();

            // 
            update_display = function () {
                const active_player_idx = next_player % 2;

                // Pre-compute the ghost preview destination cells (if any) so the
                // per-cell loop can highlight the would-be new position.
                const ghost_own_board_idx = 1 - active_player_idx;
                const ghost_preview_keys = {};
                let ghost_preview_blocked = false;
                if (ghost_selected_ship && ghost_preview_direction &&
                    (current_action_mode === "ghost_select" || current_action_mode === "ghost_move")) {
                    const gboard = game_state[ghost_own_board_idx];
                    const offsets = {up:[0,-1], down:[0,1], left:[-1,0], right:[1,0]};
                    const off = offsets[ghost_preview_direction];
                    const dist = ghost_preview_distance || 1;
                    // Whole slide validity (bounds + path) comes from the engine.
                    ghost_preview_blocked = !can_ghost_move(
                        active_player_idx, ghost_selected_ship,
                        ghost_preview_direction, dist
                    );
                    // Highlight the would-be destination footprint (offset × distance).
                    for (let r = 0; r < height; r++) {
                        for (let c = 0; c < width; c++) {
                            if (Battleship.is_ship_here(gboard[r][c]) &&
                                get_ship_name(gboard[r][c]) === ghost_selected_ship) {
                                const nc = c + off[0] * dist;
                                const nr = r + off[1] * dist;
                                ghost_preview_keys[nc + "," + nr] = true;
                            }
                        }
                    }
                }

                game_state.forEach(function (game_board, game_board_index) {
                    game_board.forEach(function (row, row_index) {
                        row.forEach(function (cell, column_index) {
                            const table_cell = table_cells[game_board_index][row_index][column_index];
                            
                            // 
                            table_cell.className = Battleship.cell_state(
                                game_board,
                                cell,
                                [column_index, row_index],
                                (game_board_index + 1) % 2
                            );

                            // Clear old ghost-mode UI from the previous render.
                            table_cell.style.outline = "none";
                            table_cell.style.cursor = "default";
                            table_cell.classList.remove(
                                "ghost-target", "ghost-selected", "shot-flash",
                                "ghost-origin", "ghost-preview", "ghost-preview-invalid"
                            );

                            // 
                            // (game_board_index === active_player_idx)
                            // 1 - active_player_idx)
                            const own_board_idx = (1 - active_player_idx);

                            if ((current_action_mode === "ghost_select" || current_action_mode === "ghost_move") && game_board_index === own_board_idx) {
                                // 
                                const ship_name = get_ship_name(cell);
                                if (ship_name && Battleship.is_ship_here(cell) && !is_ship_sunk_by_name(game_board, ship_name)) {
                                    table_cell.className = "cell_with_ship"; 
                                    table_cell.classList.add("ghost-target");
                                    table_cell.style.cursor = "pointer";
                                    
                                    // 
                                    if (ghost_selected_ship && ship_name === ghost_selected_ship) {
                                        table_cell.classList.add("ghost-origin");
                                    }
                                }

                                // Preview of the would-be destination footprint.
                                if (ghost_preview_keys[column_index + "," + row_index]) {
                                    table_cell.classList.add(
                                        ghost_preview_blocked
                                            ? "ghost-preview-invalid"
                                            : "ghost-preview"
                                    );
                                }
                            }

                            // Ghost-move damage trace: a vacated, previously-hit
                            // cell stays on the board as a scar (full override of
                            // the plain "miss" look) until a ship occupies it again.
                            if (ghost_scars[game_board_index].includes(column_index + "," + row_index)
                                    && !Battleship.is_ship_here(cell)) {
                                table_cell.className = "ghost-scar";
                            }
                        });
                    });
                });

                if (Battleship.has_player_won(game_state[0])) {
                    game_over = true;
                    show_victory_screen(1);
                    return;
                }
                if (Battleship.has_player_won(game_state[1])) {
                    game_over = true;
                    show_victory_screen(2);
                    return;
                }

                // Update ship-status trackers
                [0, 1].forEach(function (board_idx) {
                    const tracker = document.getElementById("tracker_" + board_idx);
                    if (!tracker) return;
                    Battleship.ship_array.forEach(function (ship) {
                        const item = tracker.querySelector("[data-ship=\"" + ship.name + "\"]");
                        if (!item) return;
                        item.classList.toggle("sunk", is_ship_sunk_by_name(game_state[board_idx], ship.name));
                    });
                });
            };

            table_cells = [
                R.range(0, height).map(create_row_in_table_to_shoot_ships(game_board_1, 0)),
                R.range(0, height).map(create_row_in_table_to_shoot_ships(game_board_2, 1))
            ];
            
            update_display();
            update_battle_controls();
            });
        }
    });
    button_container_2.append(play_button);
};

// The rotate button works by clicking on a ship and then clicking the rotate
// button. This will modify the ship element's orientation, meaning it will
// remain in that orienation even if it isn't placed. If no ship is
// selected, it won't do anything
const create_rotate_button = function (button_container, game_board_index) {
    const button = document.createElement("button");
    button.textContent = "Rotate Ship";
    button.className = "rotate-ship-button";
    button.addEventListener("click", function () {
        if (selected_ship_name !== undefined) {
            const selected_ship_object = multiplayer_ship_array[
                game_board_index
            ].find((ship) => ship.name === selected_ship_name);

            const active_td = document.querySelector(".dragging, .is-repositioning");
            const img = active_td ? active_td.querySelector("img") : null;

            if (selected_ship_object.orientation === "horizontal") {
                selected_ship_object.orientation = "vertical";
                if (img) img.style.transform = "rotate(90deg)";
            } else if (selected_ship_object.orientation === "vertical") {
                selected_ship_object.orientation = "horizontal";
                if (img) img.style.transform = "rotate(0deg)";
            }
            if (hovered_cell_info && hovered_cell_info.board_index === game_board_index) {
                show_preview(game_board_index, hovered_cell_info.col, hovered_cell_info.row);
            }
        }
    });
    button_container.append(button);
};

// ── Ship placement preview (beginner-friendly hover feedback) ──
// These helpers only read state and toggle CSS classes; they never mutate the
// game state, so the underlying game logic is untouched.

// Returns the [x, y] cells a ship would occupy if its top-left were at (x, y).
const get_preview_cells = function (ship, x, y) {
    const cells = [];
    if (!ship) {
        return cells;
    }
    R.range(0, ship.length).forEach(function (i) {
        if (ship.orientation === "vertical") {
            cells.push([x, y + i]);
        } else {
            cells.push([x + i, y]);
        }
    });
    return cells;
};

// A placement is valid when every cell is in bounds and free of other ships.
// Valid when every cell is in bounds and free — except cells held by the ship
// currently being repositioned (it is moving off them).
const is_preview_valid = function (game_board_index, cells, ignore_name) {
    return cells.every(function (coords) {
        const cx = coords[0];
        const cy = coords[1];
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) {
            return false;
        }
        const cell = game_state[game_board_index][cy][cx];
        return !Battleship.is_ship_here(cell) || cell.shipName === ignore_name;
    });
};

// Removes any preview highlight from a board.
const clear_preview = function (game_board_index) {
    if (!table_cells || !table_cells[game_board_index]) {
        return;
    }
    table_cells[game_board_index].forEach(function (row) {
        row.forEach(function (td) {
            td.classList.remove("preview-valid", "preview-invalid");
        });
    });
};

// Keep the repositioning ship's current footprint highlighted as a reference.
const mark_origin = function (game_board_index) {
    if (!table_cells || !table_cells[game_board_index]) {
        return;
    }
    table_cells[game_board_index].forEach(function (row) {
        row.forEach(function (td) { td.classList.remove("place-origin"); });
    });
    if (!repositioning || selected_ship_name === undefined) {
        return;
    }
    game_state[game_board_index].forEach(function (row, r) {
        row.forEach(function (cell, c) {
            if (cell.shipName === selected_ship_name) {
                table_cells[game_board_index][r][c].classList.add("place-origin");
            }
        });
    });
};

// Brief settle animation on the cells a repositioned ship just landed on.
const flash_landing = function (game_board_index, ship_name) {
    game_state[game_board_index].forEach(function (row, r) {
        row.forEach(function (cell, c) {
            if (cell.shipName === ship_name) {
                const cell_td = table_cells[game_board_index][r][c];
                cell_td.classList.add("place-landed");
                setTimeout(function () {
                    cell_td.classList.remove("place-landed");
                }, 500);
            }
        });
    });
};

// Highlights, in green or red, the cells the selected ship would occupy.
const show_preview = function (game_board_index, column_index, row_index) {
    clear_preview(game_board_index);
    if (selected_ship_name === undefined) {
        mark_origin(game_board_index);
        return;
    }
    const ship = multiplayer_ship_array[game_board_index].find(
        (s) => s.name === selected_ship_name
    );
    if (!ship) {
        return;
    }
    const cells = get_preview_cells(ship, column_index, row_index);
    const valid = is_preview_valid(
        game_board_index,
        cells,
        repositioning ? selected_ship_name : null
    );
    cells.forEach(function (coords) {
        const cx = coords[0];
        const cy = coords[1];
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
            table_cells[game_board_index][cy][cx].classList.add(
                valid ? "preview-valid" : "preview-invalid"
            );
        }
    });
    mark_origin(game_board_index);
};

// This function generates/fills up the cells of the tables in place mode.
const create_cell_in_row_to_place_ships = function (
    game_board_index,
    row_index,
    tr
) {
    return function (column_index) {
        const td = document.createElement("td");

        td.tabIndex = 0;

        // Live preview: show where the selected ship would land on hover/focus.
        // Also track the last hovered cell so R-key rotation can refresh the preview.
        td.onmouseenter = function () {
            hovered_cell_info = { board_index: game_board_index, col: column_index, row: row_index };
            show_preview(game_board_index, column_index, row_index);
        };
        td.onfocus = function () {
            hovered_cell_info = { board_index: game_board_index, col: column_index, row: row_index };
            show_preview(game_board_index, column_index, row_index);
        };

        td.onclick = function () {
            if (selected_ship_name === undefined) {
                return;
            }
            const ship = multiplayer_ship_array[game_board_index].find(
                (s) => s.name === selected_ship_name
            );

            // ── Repositioning an already-placed ship ──
            if (repositioning) {
                const cells = get_preview_cells(ship, column_index, row_index);
                const valid = is_preview_valid(
                    game_board_index, cells, selected_ship_name
                );
                const card = document.querySelector(
                    "#ships_" + (game_board_index + 1) +
                    " [data-ship=\"" + selected_ship_name + "\"]"
                );
                const moved_name = selected_ship_name;
                if (valid) {
                    pickup_ship(game_board_index, ship);
                    game_state[game_board_index] = Battleship.place_ship(
                        game_state[game_board_index], ship,
                        column_index, row_index, game_board_index
                    );
                    repositioning = false;
                    selected_ship_name = undefined;
                    if (card) card.className = "ship is-placed";
                    update_display();
                    flash_landing(game_board_index, moved_name);
                } else {
                    repositioning = false;
                    selected_ship_name = undefined;
                    if (card) card.className = "ship is-placed";
                    update_display();
                }
                clear_preview(game_board_index);
                mark_origin(game_board_index);
                update_deploy_controls();
                return;
            }

            // ── Fresh placement ──
            const ship_element = document.getElementsByClassName("dragging");
            game_state[game_board_index] = Battleship.place_ship(
                game_state[game_board_index],
                ship,
                column_index,
                row_index,
                game_board_index
            );
            if (ship.placed === true) {
                if (ship_element[0]) {
                    ship_element[0].className = "ship is-placed";
                }
                selected_ship_name = undefined;
            }
            update_display();
            if (ship.placed === true) {
                // Energy-activation effect on the cells the ship landed on.
                flash_landing(game_board_index, ship.name);
            }
            update_deploy_controls();
        };

        td.onkeydown = function (event) {
            if (event.key === "Enter" || event.key === " ") {
                td.onclick();
                event.preventDefault();
                return;
            }
            const moves = {
                ArrowRight: [(column_index + 1) % width, row_index],
                ArrowLeft: [(column_index + width - 1) % width, row_index],
                ArrowDown: [column_index, (row_index + 1) % height],
                ArrowUp: [column_index, (row_index + height - 1) % height]
            };
            const move = moves[event.key];
            if (move) {
                table_cells[game_board_index][move[1]][move[0]].focus();
                // Refresh the cursor preview directly too — focus events do
                // not fire while the window is unfocused.
                hovered_cell_info = {
                    board_index: game_board_index,
                    col: move[0],
                    row: move[1]
                };
                show_preview(game_board_index, move[0], move[1]);
                event.stopPropagation();
                event.preventDefault();
            }
        };
        tr.append(td);
        return td;
    };
};

// Generates a row of cells in place mode.
const create_row_in_table_to_place_ships = function (
    game_board,
    game_board_index
) {
    return function (row_index) {
        const tr = document.createElement("tr");
        game_board.append(tr);
        return R.range(0, width).map(create_cell_in_row_to_place_ships(
            game_board_index,
            row_index,
            tr
        ));
    };
};

// (7) Lifts a placed ship off the board so it can be repositioned: clears its
// cells and marks it un-placed. ship_locations is overwritten on the next drop.
const pickup_ship = function (game_board_index, ship) {
    const board = game_state[game_board_index].map(function (row) {
        return row.map(function (cell) { return Object.assign({}, cell); });
    });
    board.forEach(function (row) {
        row.forEach(function (cell) {
            if (cell.shipName === ship.name) {
                cell.ship = false;
                delete cell.shipName;
            }
        });
    });
    game_state[game_board_index] = board;
    ship.placed = false;
};

// Builds a length indicator (one pip per grid cell the ship occupies) so a
// beginner can tell at a glance how many squares each ship needs.
const create_ship_size_strip = function (ship) {
    const strip = document.createElement("div");
    strip.className = "ship-size-strip";
    R.range(0, ship.length).forEach(function () {
        const pip = document.createElement("span");
        pip.className = "ship-size-pip";
        strip.append(pip);
    });
    const label = document.createElement("span");
    label.className = "ship-size-count";
    label.textContent = ship.length + " cells";
    strip.append(label);
    return strip;
};

// Creates one selectable ship cell (image + name + length indicator).
const create_ship_cell = function (ship, game_board_index, tr) {
    const td = document.createElement("td");
    td.className = "ship";
    td.dataset.ship = ship.name;

    const img = document.createElement("img");
    const player_folder = game_board_index === 0 ? "player1" : "player2";
    img.setAttribute("src", `./assets/${player_folder}/${ship.name}.png`);
    img.id = ship.name;
    img.style.transition = "transform 0.2s ease";

    const name = document.createElement("div");
    name.className = "ship-name";
    name.textContent = ship.name;

    td.onclick = function () {
        const table = tr.parentElement;
        const ship_obj = multiplayer_ship_array[game_board_index].find(
            (s) => s.name === ship.name
        );

        // Clicking the ship already in reposition mode cancels it.
        if (repositioning && selected_ship_name === ship.name) {
            repositioning = false;
            selected_ship_name = undefined;
            td.className = "ship is-placed";
            update_display();
            clear_preview(game_board_index);
            mark_origin(game_board_index);
            update_deploy_controls();
            return;
        }

        // Restore whichever card was previously active.
        const prev = table.querySelector(".dragging, .is-repositioning");
        if (prev && prev !== td) {
            const prev_ship = multiplayer_ship_array[game_board_index].find(
                (s) => s.name === prev.dataset.ship
            );
            prev.className = "ship" + (prev_ship && prev_ship.placed ? " is-placed" : "");
        }

        // A placed ship enters reposition mode and STAYS on the board as a
        // reference until the move is confirmed; a fresh ship is just selected.
        repositioning = Boolean(ship_obj && ship_obj.placed);
        selected_ship_name = img.id;
        td.className = repositioning
            ? "ship is-placed is-repositioning"
            : "dragging";
        if (ship_obj) {
            img.style.transform = ship_obj.orientation === "vertical"
                ? "rotate(90deg)" : "rotate(0deg)";
        }
        update_display();
        mark_origin(game_board_index);
        update_deploy_controls();
    };
    td.tabIndex = 0;
    td.onkeydown = function (event) {
        if (event.key === "Enter" || event.key === " ") {
            td.onclick();
            return;
        }
    };
    td.append(img);
    td.append(name);
    td.append(create_ship_size_strip(ship));
    tr.append(td);
};

// Generates a ship table under the game board of the index provided.
// Layout: top row = the 3 shorter ships, bottom row = the 2 longer ships.
const create_ship_table = function (ship_table, game_board_index) {
    const short_ships = Battleship.ship_array.filter((s) => s.length <= 3);
    const long_ships = Battleship.ship_array.filter((s) => s.length >= 4);

    const top_row = document.createElement("tr");
    top_row.className = "ship-row-top";
    ship_table.append(top_row);
    short_ships.forEach(function (ship) {
        create_ship_cell(ship, game_board_index, top_row);
    });

    const bottom_row = document.createElement("tr");
    bottom_row.className = "ship-row-bottom";
    ship_table.append(bottom_row);
    long_ships.forEach(function (ship) {
        create_ship_cell(ship, game_board_index, bottom_row);
    });
};

// This function generates/fills up the cells of the tables in shoot mode.
const create_cell_in_row_to_shoot_ships = function (
    game_board_index,
    row_index,
    tr
) {
    return function (column_index) {
        const td = document.createElement("td");
        td.tabIndex = 0;
        td.style.position = "relative";

        td.onclick = function () {
            if (game_over) return;

            const active_player_idx = next_player % 2;
            const own_board_idx = 1 - active_player_idx;

            if ((current_action_mode === "ghost_select" || current_action_mode === "ghost_move") && game_board_index === own_board_idx) {
                const cell = game_state[game_board_index][row_index][column_index];
                const ship_name = get_ship_name(cell);

                if (ship_name && Battleship.is_ship_here(cell) && !is_ship_sunk_by_name(game_state[game_board_index], ship_name)) {
                    ghost_selected_ship = ship_name;
                    ghost_preview_direction = null;
                    ghost_preview_distance = 1;
                    current_action_mode = "ghost_move";
                    update_display();
                    update_battle_controls();
                }
                return;
            }

            // 
            if (next_player % 2 === game_board_index) {
                
                // 1. 
                if (current_action_mode === "shoot" && td.className === "unshot" && !board_locked) {
                    board_locked = true;
                    document.body.classList.add("board-locked");

                    const target_had_ship = Battleship.is_ship_here(
                        game_state[game_board_index][row_index][column_index]
                    );
                    game_state[game_board_index] = Battleship.shoot_cell(
                        game_state[game_board_index],
                        [column_index, row_index]
                    );
                    const new_cell_state = Battleship.cell_state(
                        game_state[game_board_index],
                        game_state[game_board_index][row_index][column_index],
                        [column_index, row_index],
                        (game_board_index + 1) % 2
                    );

                    // Track battle statistics for the victory screen
                    standard_fire_shots[active_player_idx]++;
                    if (target_had_ship) standard_fire_hits[active_player_idx]++;
                    if (target_had_ship && new_cell_state === "sunken_ship") {
                        ships_sunk_count[active_player_idx]++;
                    }

                    // Show this cell's result immediately (turn switches after delay)
                    const shot_td = table_cells[game_board_index][row_index][column_index];
                    shot_td.className = new_cell_state;
                    shot_td.classList.add("shot-flash");

                    let vfx_delay = 900;
                    if (target_had_ship && new_cell_state === "sunken_ship") {
                        add_impact_strike(game_board_index, row_index, column_index);
                        trigger_sunk_bombardment(game_board_index, row_index, column_index);
                        Audio_Manager.play_sunk();
                        // Let the explosion play, then freeze ~0.8s on the result.
                        vfx_delay = 2600;
                    } else if (target_had_ship) {
                        add_impact_strike(game_board_index, row_index, column_index);
                        add_cell_effect(game_board_index, row_index, column_index, "hit-bubbles");
                        Audio_Manager.play_hit();
                        vfx_delay = 1300;
                    } else {
                        Audio_Manager.play_miss();
                        vfx_delay = 900;
                    }

                    setTimeout(function () {
                        board_locked = false;
                        document.body.classList.remove("board-locked");
                        end_current_turn();
                    }, vfx_delay);
                } 
                // 2. Sonar scan mode
                else if (current_action_mode === "sonar" && td.className === "unshot" && !board_locked) {
                    // Lock the board so the scan result stays on the active
                    // player's side until they have had time to read it.
                    board_locked = true;
                    document.body.classList.add("board-locked");

                    let count = 0;
                    const enemy_board = game_state[game_board_index];
                    const sonar_cells = [];

                    for (let r = row_index - 1; r <= row_index + 1; r++) {
                        for (let c = column_index - 1; c <= column_index + 1; c++) {
                            if (r >= 0 && r < height && c >= 0 && c < width) {
                                const cell = enemy_board[r][c];
                                if (cell && Battleship.is_ship_here(cell)) {
                                    count++;
                                }
                                sonar_cells.push({r, c});
                            }
                        }
                    }

                    const sonar_overlays = [];
                    sonar_cells.forEach(function (coords) {
                        const target_td = table_cells[game_board_index][coords.r][coords.c];
                        const overlay = document.createElement("div");
                        overlay.className = "sonar-cell-overlay";
                        target_td.appendChild(overlay);
                        sonar_overlays.push(overlay);
                    });

                    const sonar_count_label = document.createElement("div");
                    sonar_count_label.className = "sonar-count-label";
                    sonar_count_label.textContent = String(count);
                    td.appendChild(sonar_count_label);

                    const active_player_idx = next_player % 2;
                    sonar_scans_left[active_player_idx]--;

                    // Keep the scan visible for the full display window, then
                    // clear it, unlock the board and pass the turn.
                    setTimeout(function () {
                        sonar_overlays.forEach(function (overlay) { overlay.remove(); });
                        sonar_count_label.remove();
                        board_locked = false;
                        document.body.classList.remove("board-locked");
                        end_current_turn();
                    }, 3500);
                }
            }
        };

        td.onkeydown = function (event) {
            if (event.key === "Enter" || event.key === " ") {
                td.onclick();
                return;
            }
            // Ghost mode: skip cell-navigation so arrow keys reach document.body.onkeydown
            if (current_action_mode === "ghost_select" || current_action_mode === "ghost_move") {
                return;
            }
            if (event.key === "ArrowRight") {
                table_cells[game_board_index][row_index][
                    (column_index + 1) % width
                ].focus();
                event.stopPropagation();
                return;
            }
            if (event.key === "ArrowLeft") {
                table_cells[game_board_index][row_index][
                    (column_index + width - 1) % width
                ].focus();
                event.stopPropagation();
                return;
            }
            if (event.key === "ArrowUp") {
                table_cells[game_board_index][
                    (row_index + height - 1) % height
                ][column_index].focus();
                event.stopPropagation();
                return;
            }
            if (event.key === "ArrowDown") {
                table_cells[game_board_index][
                    (row_index + 1) % height
                ][column_index].focus();
                event.stopPropagation();
                return;
            }
        };
        tr.append(td);
        return td;
    };
};

// Generates a row of cells in shoot mode
const create_row_in_table_to_shoot_ships = function (
    game_board,
    game_board_index
) {
    return function (row_index) {
        const tr = document.createElement("tr");
        game_board.append(tr);
        return R.range(0, width).map(create_cell_in_row_to_shoot_ships(
            game_board_index,
            row_index,
            tr
        ));
    };
};

document.body.onkeydown = function (event) {
    // Ghost move direction via arrow keys — checked first so it takes priority
    // over the generic cell-focus fallback below.
    if ((current_action_mode === "ghost_select" || current_action_mode === "ghost_move")
            && ghost_selected_ship) {
        const dir_map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
        const dir = dir_map[event.key];
        if (dir) {
            ghost_preview_direction = dir;
            current_action_mode = "ghost_move";
            update_display();
            update_battle_controls();
            event.preventDefault();
            return;
        }
    }

    if (
        event.key === "ArrowUp"
        || event.key === "ArrowDown"
        || event.key === "ArrowLeft"
        || event.key === "ArrowRight"
    ) {
        const is_placing = document.body.classList.contains("placing-player-1")
            || document.body.classList.contains("placing-player-2");
        if (is_placing) {
            // Keyboard cursor: if focus is not yet on the active player's
            // board, jump it there (to the last hovered cell, or A1). Once a
            // cell has focus, the cell's own onkeydown moves the cursor and
            // Enter places the ship.
            const active_board_index =
                game_board_1.style.visibility === "hidden" ? 1 : 0;
            const board_el = active_board_index === 0
                ? game_board_1
                : game_board_2;
            const focused = document.activeElement;
            const on_board = focused && focused.tagName === "TD"
                && board_el.contains(focused);
            if (!on_board) {
                const start = (hovered_cell_info
                    && hovered_cell_info.board_index === active_board_index)
                    ? hovered_cell_info
                    : { col: 0, row: 0 };
                table_cells[active_board_index][start.row][start.col].focus();
                hovered_cell_info = {
                    board_index: active_board_index,
                    col: start.col,
                    row: start.row
                };
                show_preview(active_board_index, start.col, start.row);
                event.preventDefault();
            }
            return;
        }
        if (!document.activeElement || document.activeElement.tagName !== "TD") {
            table_cells[0][0][0].focus();
        }
    }

    // R key: rotate the currently selected/repositioning ship on either board.
    if ((event.key === "r" || event.key === "R") && selected_ship_name !== undefined) {
        const active_board_index = game_board_1.style.visibility === "hidden" ? 1 : 0;
        const selected_ship_object = multiplayer_ship_array[active_board_index].find(
            (ship) => ship.name === selected_ship_name
        );

        // Works for fresh placement (.dragging) and repositioning (.is-repositioning)
        const active_td = document.querySelector(".dragging, .is-repositioning");
        const img = active_td ? active_td.querySelector("img") : null;

        if (selected_ship_object) {
            if (selected_ship_object.orientation === "horizontal") {
                selected_ship_object.orientation = "vertical";
                if (img) img.style.transform = "rotate(90deg)";
            } else {
                selected_ship_object.orientation = "horizontal";
                if (img) img.style.transform = "rotate(0deg)";
            }
            // Refresh the hover preview so the new orientation is shown immediately
            if (hovered_cell_info && hovered_cell_info.board_index === active_board_index) {
                show_preview(active_board_index, hovered_cell_info.col, hovered_cell_info.row);
            }
        }
        event.preventDefault();
    }
};

// ==========================================
// 1. Global battle state
// ==========================================
let selected_ship_name = undefined;
let repositioning = false;   // true while moving an already-placed ship
let next_player = 0;
let sonar_scans_left = [2, 2];       // Each player has 2 sonar scans.
let ghost_moves_left = [1, 1];       // Each player has 1 ghost move.
let current_action_mode = "shoot";   // shoot, sonar, ghost_select, ghost_move
let ghost_selected_ship = null;
let ghost_preview_direction = null;  // pending preview direction (not yet confirmed)
let ghost_preview_distance = 1;      // pending preview distance: 1 or 2 tiles
let board_locked = false;   // true while VFX plays; blocks new shots

// Per-board "x,y" keys of cells a ghost-moved ship left behind as damage.
// These persist as visible scars (the tactical cost of relocating).
let ghost_scars = [[], []];

// Snapshot the named ship's currently-hit cells BEFORE it ghost-moves; once
// it leaves, those cells read as empty+shot and we flag them as scars.
const record_ghost_scars = function (board_index, ship_name) {
    const board = game_state[board_index];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const cell = board[r][c];
            if (Battleship.is_ship_here(cell) && cell.shot &&
                    get_ship_name(cell) === ship_name) {
                const key = c + "," + r;
                if (!ghost_scars[board_index].includes(key)) {
                    ghost_scars[board_index].push(key);
                }
            }
        }
    }
};

const end_current_turn = function () {
    current_action_mode = "shoot";
    ghost_selected_ship = null;
    ghost_preview_direction = null;
    ghost_preview_distance = 1;
    next_player += 1;
    update_display();
    update_battle_controls();
};

// Pure validity check for a ghost move of `distance` tiles (1 or 2). The
// slide is simulated one tile at a time on a throwaway board, so the engine
// enforces bounds + blocking for every cell the ship sweeps through.
const can_ghost_move = function (player_idx, ship_name, direction, distance) {
    if (!ship_name || !direction) return false;
    const steps = distance || 1;
    const board = game_state[1 - player_idx];
    if (is_ship_sunk_by_name(board, ship_name)) return false;
    let moved = board;
    for (let s = 0; s < steps; s++) {
        const next = Battleship.move_ship(moved, ship_name, direction);
        if (next === moved) return false;   // off-board or blocked this step
        moved = next;
    }
    return true;
};

// Briefly flash the ship's cells at its new position after a confirmed move.
const flash_ghost_landing = function (player_idx, ship_name) {
    const own_board_idx = 1 - player_idx;
    const board = game_state[own_board_idx];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            if (Battleship.is_ship_here(board[r][c]) &&
                get_ship_name(board[r][c]) === ship_name) {
                table_cells[own_board_idx][r][c].classList.add("ghost-landed");
            }
        }
    }
};

const add_cell_effect = function (game_board_index, row_index, column_index, effect_type) {
    const target_cell = table_cells[game_board_index][row_index][column_index];
    if (!target_cell) return;

    const effect = document.createElement("div");
    effect.className = `cell-effect ${effect_type}`;

    const particle_count =
        effect_type === "sunk-explosion" ? 18 :
        effect_type === "sunk-dust"      ? 14 : 9;
    const base_dist  = effect_type === "sunk-explosion" ? 32 : 24;
    const step_dist  = effect_type === "sunk-explosion" ? 12 : 9;
    const delay_step = effect_type === "sunk-explosion" ? 18 : 22;
    R.range(0, particle_count).forEach(function (particle_index) {
        const particle = document.createElement("span");
        particle.style.setProperty("--angle",    ((360 / particle_count) * particle_index) + "deg");
        particle.style.setProperty("--delay",    (particle_index * delay_step) + "ms");
        particle.style.setProperty("--distance", (base_dist + (particle_index % 5) * step_dist) + "px");
        effect.append(particle);
    });

    target_cell.append(effect);
    setTimeout(function () {
        effect.remove();
    }, effect_type === "sunk-explosion" ? 2200 :
       effect_type === "sunk-dust"      ? 1300 : 1000);
};

// A thick, glowing diagonal "cut" centred on the attacked cell.
const add_impact_strike = function (game_board_index, row_index, column_index) {
    const target_cell = table_cells[game_board_index][row_index][column_index];
    if (!target_cell) return;
    const strike = document.createElement("div");
    strike.className = "impact-strike";
    target_cell.append(strike);
    setTimeout(function () {
        strike.remove();
    }, 650);
};

// ==========================================
// 2a. Ship-wide sunk bombardment
// ==========================================
const trigger_sunk_bombardment = function (game_board_index, hit_row, hit_col) {
    const board = game_state[game_board_index];
    const hit_cell = board[hit_row][hit_col];
    const ship_name = get_ship_name ? get_ship_name(hit_cell) : (hit_cell && hit_cell.shipName);

    if (!ship_name) {
        add_cell_effect(game_board_index, hit_row, hit_col, "sunk-explosion");
        return;
    }

    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const cell = board[r][c];
            if (cell && Battleship.is_ship_here(cell) &&
                ((cell.shipName && cell.shipName === ship_name) ||
                 (cell.ship_name && cell.ship_name === ship_name))) {
                add_cell_effect(game_board_index, r, c, "sunk-explosion");
            }
        }
    }
};

// ==========================================
// 2. Ghost movement helpers
// ==========================================
const get_ship_name = function (cell) {
    if (!cell) return undefined;
    if (cell.shipName) return cell.shipName;
    if (cell.ship_name) return cell.ship_name;
    if (typeof cell.ship === "string") return cell.ship;
    if (cell.ship && cell.ship.name) return cell.ship.name;
    if (cell.name) return cell.name;
    return undefined;
};

const is_ship_sunk_by_name = function (game_board, ship_name) {
    let foundShipCell = false;

    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const cell = game_board[r][c];
            if (cell && Battleship.is_ship_here(cell) && get_ship_name(cell) === ship_name) {
                foundShipCell = true;
                if (!cell.shot) {
                    return false;
                }
            }
        }
    }

    return foundShipCell;
};

// Moves a ship `distance` tiles (1 or 2) by applying that many single-tile
// engine moves. If any step is illegal the whole move is abandoned and the
// board is left untouched, so a 2-tile slide is all-or-nothing.
const try_move_single_ship = function (player_idx, ship_name, direction, distance) {
    const own_board_idx = 1 - player_idx;
    const steps = distance || 1;
    const board = game_state[own_board_idx];

    if (!ship_name) {
        alert("Please choose one of your ships first.");
        return false;
    }
    if (is_ship_sunk_by_name(board, ship_name)) {
        alert("That ship is already sunk and cannot ghost move.");
        return false;
    }

    let moved = board;
    for (let s = 0; s < steps; s++) {
        const next = Battleship.move_ship(moved, ship_name, direction);
        if (next === moved) {
            alert("Ghost move failed: the path is blocked or off the board.");
            return false;
        }
        moved = next;
    }

    game_state[own_board_idx] = moved;
    return true;
};

// ==========================================
// 3. Centre control axis
// ==========================================

// Fills an action button with an icon, title, description and optional count,
// so each control doubles as its own explanation (no separate top bar needed).
const fill_action_button = function (button, icon, title, desc, count) {
    button.innerHTML = "";

    const icon_el = document.createElement("span");
    icon_el.className = "action-icon";
    icon_el.textContent = icon;

    const text_el = document.createElement("span");
    text_el.className = "action-text";

    const title_el = document.createElement("span");
    title_el.className = "action-title";
    title_el.textContent = title;

    const desc_el = document.createElement("span");
    desc_el.className = "action-desc";
    desc_el.textContent = desc;

    text_el.append(title_el, desc_el);
    button.append(icon_el, text_el);

    if (count !== null && count !== undefined) {
        const count_el = document.createElement("span");
        count_el.className = "action-count";
        count_el.textContent = count;
        button.append(count_el);
    }
};

const update_battle_controls = function () {
    const active_player_idx = next_player % 2;
    const player_name = active_player_idx === 0 ? "Player 1" : "Player 2";
    const inactive_name = active_player_idx === 0 ? "Player 2" : "Player 1";

    // Body classes drive CSS turn-dimming and ghost-accessible states
    document.body.classList.toggle("turn-p1", active_player_idx === 0);
    document.body.classList.toggle("turn-p2", active_player_idx === 1);
    const is_ghost_mode = current_action_mode === "ghost_select" ||
                          current_action_mode === "ghost_move";
    document.body.classList.toggle("ghost-active", is_ghost_mode);

    const center = document.getElementById("center_control");
    if (!center) return;
    center.innerHTML = "";

    // ── Turn label ──────────────────────────────────────────────
    const label_row = document.createElement("div");
    label_row.style.cssText = "display:flex;align-items:center;gap:0.5rem;justify-content:center;width:100%;";

    const dot = document.createElement("div");
    dot.className = "center-player-dot " + (active_player_idx === 0 ? "dot-p1" : "dot-p2");
    label_row.append(dot);

    const turn_label = document.createElement("div");
    turn_label.className = "center-turn-label " +
        (active_player_idx === 0 ? "is-p1" : "is-p2");
    turn_label.textContent = player_name.toUpperCase() + "'S TURN";
    label_row.append(turn_label);
    center.append(label_row);

    // (4) Score board — enemy ship cells each player has hit.
    const count_hits = function (board) {
        return board.reduce(function (sum, row) {
            return sum + row.filter(function (cell) {
                return cell && cell.shot && Battleship.is_ship_here(cell);
            }).length;
        }, 0);
    };
    const build_score = function () {
        const wrap = document.createElement("div");
        wrap.className = "score-board";
        [
            { cls: "score-p1", label: "Player 1", value: count_hits(game_state[0]), active: active_player_idx === 0 },
            { cls: "score-p2", label: "Player 2", value: count_hits(game_state[1]), active: active_player_idx === 1 }
        ].forEach(function (s) {
            const side = document.createElement("div");
            side.className = "score-side " + s.cls + (s.active ? " is-active" : "");
            const lbl = document.createElement("div");
            lbl.className = "score-label";
            lbl.textContent = s.label;
            const val = document.createElement("div");
            val.className = "score-value";
            val.textContent = s.value;
            const tot = document.createElement("div");
            tot.className = "score-total";
            tot.textContent = "of 17 hits";
            side.append(lbl, val, tot);
            wrap.append(side);
        });
        return wrap;
    };
    center.append(build_score());

    // ── Status text ─────────────────────────────────────────────
    const status = document.createElement("div");
    status.className = "center-status";
    if (current_action_mode === "shoot") {
        status.textContent = "Click an enemy cell to fire.";
    } else if (current_action_mode === "sonar") {
        status.textContent = "Sonar — click an enemy cell to scan.";
    } else if (current_action_mode === "ghost_select") {
        status.textContent = "Ghost — click one of your ships.";
    } else if (current_action_mode === "ghost_move") {
        if (ghost_preview_direction) {
            status.textContent = "Preview ready — confirm to move, or pick another direction.";
        } else {
            status.textContent = ghost_selected_ship + " selected. Pick a direction to preview.";
        }
    }
    center.append(status);

    center.append(Object.assign(document.createElement("div"), { className: "center-divider" }));

    // ── Action buttons ──────────────────────────────────────────
    const btn_row = document.createElement("div");
    btn_row.className = "center-btn-row";

    const shoot_btn = document.createElement("button");
    shoot_btn.className = "battle-action standard-fire" +
        (current_action_mode === "shoot" ? " is-active" : "");
    fill_action_button(
        shoot_btn,
        "🎯",
        "Standard Fire",
        "Attacks a single enemy tile",
        null
    );
    shoot_btn.onclick = function () {
        current_action_mode = "shoot";
        ghost_selected_ship = null;
        ghost_preview_direction = null;
        update_display();
        update_battle_controls();
    };
    btn_row.append(shoot_btn);

    const sonar_btn = document.createElement("button");
    sonar_btn.className = "battle-action sonar-action" +
        (current_action_mode === "sonar" ? " is-active" : "");
    fill_action_button(
        sonar_btn,
        "📡",
        "Sonar Scan",
        "Reveals ship count in 3×3 area",
        sonar_scans_left[active_player_idx] + " left"
    );
    if (sonar_scans_left[active_player_idx] <= 0) sonar_btn.disabled = true;
    sonar_btn.onclick = function () {
        current_action_mode = "sonar";
        ghost_selected_ship = null;
        ghost_preview_direction = null;
        update_display();
        update_battle_controls();
    };
    btn_row.append(sonar_btn);

    const ghost_btn = document.createElement("button");
    ghost_btn.className = "battle-action ghost-action" +
        ((current_action_mode === "ghost_select" ||
          current_action_mode === "ghost_move") ? " is-active" : "");
    fill_action_button(
        ghost_btn,
        "👻",
        "Ghost Move",
        "Shift an unsunk ship 1 tile",
        ghost_moves_left[active_player_idx] + " left"
    );
    if (ghost_moves_left[active_player_idx] <= 0) ghost_btn.disabled = true;
    ghost_btn.onclick = function () {
        ghost_preview_direction = null;
        ghost_preview_distance = 1;
        // Already in ghost mode → this is a toggle-off (no reveal involved).
        if (current_action_mode === "ghost_select" || current_action_mode === "ghost_move") {
            current_action_mode = "shoot";
            ghost_selected_ship = null;
            update_display();
            update_battle_controls();
            return;
        }
        // Ghost Move is now a deliberate tactical decision: confirm first, warn
        // the opponent, and ONLY THEN reveal this player's ships for relocation.
        show_ghost_confirm(active_player_idx, function () {
            show_ghost_handoff(active_player_idx, function () {
                ghost_preview_direction = null;
                current_action_mode = "ghost_select";
                update_display();
                update_battle_controls();
            });
        });
    };
    btn_row.append(ghost_btn);

    center.append(btn_row);

    // ── Direction grid + confirm (ghost_move only) ──────────────
    // Pressing a direction only PREVIEWS the move; the player then compares
    // old vs new position and presses Confirm to actually move.
    if (current_action_mode === "ghost_move") {
        const dir_box = document.createElement("div");
        dir_box.className = "direction-grid";

        [
            { name: "Up",    value: "up"    },
            { name: "Down",  value: "down"  },
            { name: "Left",  value: "left"  },
            { name: "Right", value: "right" }
        ].forEach(function (d) {
            const d_btn = document.createElement("button");
            d_btn.className = "direction-btn" +
                (ghost_preview_direction === d.value ? " is-active" : "");
            d_btn.textContent = d.name;
            d_btn.onclick = function () {
                ghost_preview_direction = d.value;
                update_display();
                update_battle_controls();
            };
            dir_box.append(d_btn);
        });
        center.append(dir_box);

        // Distance selector — each direction can slide 1 or 2 tiles.
        const dist_box = document.createElement("div");
        dist_box.className = "ghost-distance";
        [
            { label: "1 Tile",  value: 1 },
            { label: "2 Tiles", value: 2 }
        ].forEach(function (d) {
            const dist_btn = document.createElement("button");
            dist_btn.className = "distance-btn" +
                (ghost_preview_distance === d.value ? " is-active" : "");
            dist_btn.textContent = d.label;
            dist_btn.onclick = function () {
                ghost_preview_distance = d.value;
                update_display();
                update_battle_controls();
            };
            dist_box.append(dist_btn);
        });
        center.append(dist_box);

        // Confirm / cancel appear once a direction has been previewed.
        if (ghost_preview_direction) {
            const confirm_row = document.createElement("div");
            confirm_row.className = "ghost-confirm-row";

            const confirm_btn = document.createElement("button");
            confirm_btn.className = "ghost-confirm-btn";
            confirm_btn.textContent = "Confirm Move";
            const valid = can_ghost_move(
                active_player_idx, ghost_selected_ship,
                ghost_preview_direction, ghost_preview_distance
            );
            confirm_btn.disabled = !valid;
            confirm_btn.onclick = function () {
                if (!can_ghost_move(active_player_idx, ghost_selected_ship,
                        ghost_preview_direction, ghost_preview_distance)) {
                    return;
                }
                // Tactical cost: record where this ship was already damaged so
                // the vacated hits stay on the board as a "scar" trace. The
                // engine restores the ship to full health at its new position;
                // the old hits become permanent intel for the opponent.
                const own_board_idx = 1 - active_player_idx;
                record_ghost_scars(own_board_idx, ghost_selected_ship);

                const moved = try_move_single_ship(
                    active_player_idx, ghost_selected_ship,
                    ghost_preview_direction, ghost_preview_distance
                );
                if (!moved) {
                    return;
                }
                ghost_moves_left[active_player_idx] -= 1;
                const moved_ship = ghost_selected_ship;
                ghost_preview_direction = null;
                ghost_preview_distance = 1;

                // Lock, show the ship settle into its new spot, then pass turn.
                board_locked = true;
                document.body.classList.add("board-locked");
                update_display();
                flash_ghost_landing(active_player_idx, moved_ship);
                update_battle_controls();
                setTimeout(function () {
                    board_locked = false;
                    document.body.classList.remove("board-locked");
                    end_current_turn();
                }, 800);
            };

            const cancel_btn = document.createElement("button");
            cancel_btn.className = "ghost-cancel-btn";
            cancel_btn.textContent = "Cancel";
            cancel_btn.onclick = function () {
                ghost_preview_direction = null;
                update_display();
                update_battle_controls();
            };

            confirm_row.append(confirm_btn, cancel_btn);
            center.append(confirm_row);
        }
    }

    center.append(Object.assign(document.createElement("div"), { className: "center-divider" }));

    // ── Waiting label ───────────────────────────────────────────
    const wait = document.createElement("div");
    wait.className = "center-wait-label";
    wait.textContent = inactive_name + " is waiting...";
    center.append(wait);

    // Clear player battle windows (not used in battle phase anymore)
    ["player_1_battle_window", "player_2_battle_window"].forEach(function (id) {
        const win = document.getElementById(id);
        if (win) win.innerHTML = "";
    });
};

// ==========================================
// 5. 
// ==========================================
create_rotate_button(button_container_1, 0);
create_rotate_button(button_container_2, 1);

let table_cells = [
    R.range(0, height).map(create_row_in_table_to_place_ships(game_board_1, 0)),
    R.range(0, height).map(create_row_in_table_to_place_ships(game_board_2, 1))
];

// Clear the placement preview when the pointer leaves a board.
game_board_1.addEventListener("mouseleave", function () {
    clear_preview(0);
});
game_board_2.addEventListener("mouseleave", function () {
    clear_preview(1);
});

create_ship_table(ships_1, 0);
create_ship_table(ships_2, 1);

// Visual-only: tactical coordinate strips (1-10 / A-J) around each board.
// CSS shows them during the deploy phase only.
const add_coordinate_labels = function (container) {
    const cols = document.createElement("div");
    cols.className = "board-coords board-coords-cols";
    R.range(0, width).forEach(function (i) {
        const label = document.createElement("span");
        label.textContent = i + 1;
        cols.append(label);
    });
    const rows = document.createElement("div");
    rows.className = "board-coords board-coords-rows";
    R.range(0, height).forEach(function (i) {
        const label = document.createElement("span");
        label.textContent = String.fromCharCode(65 + i);
        rows.append(label);
    });
    container.append(cols, rows);
};
add_coordinate_labels(game_container_1);
add_coordinate_labels(game_container_2);

create_next_turn_button();
create_play_button();

update_display();
update_deploy_controls();
setInterval(function () {
    if (
        document.body.classList.contains("placing-player-1") ||
        document.body.classList.contains("placing-player-2")
    ) {
        update_deploy_controls();
    }
}, 250);
show_countdown_overlay();
