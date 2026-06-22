import R from "./ramda.js";
import Battleship from "./BattleShip.js";
import { run_battle_countdown } from "./countdown.js";
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

// Multiplayer identity. Index 0 = Player 1 / ORANGE faction, index 1 =
// Player 2 / BLUE faction. Set in the name-setup phase before the countdown;
// these names then replace every "Player 1 / Player 2" label in the UI.
let player_names = ["Player 1", "Player 2"];
const player_name_of = function (idx) {
    return player_names[idx] || (idx === 0 ? "Player 1" : "Player 2");
};
// Names are user input but only ever rendered via textContent, except inside
// the few innerHTML overlay templates — escape there to stay injection-safe.
const escape_html = function (text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    };
    return String(text).replace(/[&<>"']/g, function (ch) {
        return map[ch];
    });
};

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
    if (game_title) { game_title.textContent = "Battleship"; }
    if (player_1_title) { player_1_title.textContent = "Deploy your ships"; }
    if (player_2_title) { player_2_title.textContent = "Deploy your ships"; }
};

const set_battle_titles = function () {
    const game_title = document.querySelector("header h1");
    const player_1_title = document.querySelector("aside h2");
    const player_2_title = document.querySelector("main h2");
    // Each board is an attack view: it shows the ENEMY waters that side fires
    // on. Colours stay fixed (left = orange Player 1, right = blue Player 2).
    if (game_title) { game_title.textContent = "Battleship"; }
    if (player_1_title) {
        player_1_title.textContent =
            player_name_of(0) + " attacking " + player_name_of(1) + "'s waters";
    }
    if (player_2_title) {
        player_2_title.textContent =
            player_name_of(1) + " attacking " + player_name_of(0) + "'s waters";
    }
};

const total_ship_cell_count = Battleship.ship_array.reduce(
    function (total, ship) {
        return total + ship.length;
    },
    0
);

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

// ── Animated multiplayer transition scenes (no images) ──────────
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
        p.style.setProperty(
            "--rise",
            (2.8 + Math.random() * 2.6).toFixed(2) + "s"
        );
        p.style.setProperty(
            "--delay",
            (-Math.random() * 4).toFixed(2) + "s"
        );
        p.style.setProperty(
            "--drift",
            (Math.random() * 26 - 13).toFixed(0) + "px"
        );
        p.style.setProperty(
            "--size",
            (2 + Math.random() * 3).toFixed(1) + "px"
        );
        container.append(p);
    });
};

// SCREEN 1 — Player 1, "HIDE YOUR SCREEN": holographic tactical shield.
const show_hide_screen_overlay = function (on_confirm) {
    const shield_d = "M60 7 L105 25 L105 64 C105 97 60 125 60 125"
        + " C60 125 15 97 15 64 L15 25 Z";
    const eyebrow = "// "
        + escape_html(player_name_of(0)) + "'S TURN //";
    const scene = "<div class=\"ts-bg ts-bg-orange\">"
        + "<div class=\"ts-grid\"></div>"
        + "<div class=\"ts-scanline\"></div>"
        + "<div class=\"ts-vignette\"></div>"
        + "</div>"
        + "<div class=\"ts-content\">"
        + "<div class=\"ts-head\">"
        + "<div class=\"ts-eyebrow\">" + eyebrow + "</div>"
        + "<h1 class=\"ts-title\">HIDE YOUR SCREEN</h1>"
        + "<div class=\"ts-sub\">FROM YOUR FRIEND</div>"
        + "</div>"
        + "<div class=\"ts-center\">"
        + "<div class=\"ts-shield-stage\" aria-hidden=\"true\">"
        + "<div class=\"ts-glow\"></div>"
        + "<span class=\"ts-wave\"></span>"
        + "<span class=\"ts-wave\"></span>"
        + "<span class=\"ts-wave\"></span>"
        + "<div class=\"ts-ring ts-ring-outer\"></div>"
        + "<div class=\"ts-ring ts-ring-inner\"></div>"
        + "<div class=\"ts-scan-ring\"></div>"
        + "<svg class=\"ts-shield-svg\" viewBox=\"0 0 120 132\">"
        + "<path class=\"ts-shield-body\" d=\"" + shield_d + "\"/>"
        + "<path class=\"ts-shield-edge\" d=\"" + shield_d + "\"/>"
        + "<circle class=\"ts-shield-ring\" cx=\"60\" cy=\"62\" r=\"20\"/>"
        + "<line class=\"ts-shield-cross\""
        + " x1=\"60\" y1=\"40\" x2=\"60\" y2=\"84\"/>"
        + "<line class=\"ts-shield-cross\""
        + " x1=\"38\" y1=\"62\" x2=\"82\" y2=\"62\"/>"
        + "<circle class=\"ts-shield-dot\" cx=\"60\" cy=\"62\" r=\"3.5\"/>"
        + "</svg>"
        + "<div class=\"ts-particles\"></div>"
        + "</div>"
        + "<div class=\"ts-status\">"
        + "<span class=\"ts-status-dot\"></span>"
        + "VISUAL LOCKDOWN ACTIVE"
        + "</div>"
        + "</div>"
        + "<div class=\"ts-foot\">"
        + "<button class=\"ts-button\" type=\"button\">GOT IT</button>"
        + "<div class=\"ts-caption\">KEEP YOUR FLEET SAFE</div>"
        + "</div>"
        + "</div>";
    const overlay = build_transition_overlay(
        "ts-theme-orange", scene, on_confirm
    );
    sprinkle_particles(overlay.querySelector(".ts-particles"), 10);
};

// SCREEN 2 — Player 2, "PASS THE SCREEN": orange→blue data handoff.
const show_pass_screen_overlay = function (on_confirm) {
    const node = function (cls, label) {
        const hex_pts = "26,6 62,6 84,44 62,82 26,82 4,44";
        const hex_inner = "33,18 55,18 70,44 55,70 33,70 18,44";
        return "<div class=\"ts-node " + cls + "\">"
            + "<svg class=\"ts-node-svg\" viewBox=\"0 0 88 88\">"
            + "<polygon class=\"ts-hex\" points=\"" + hex_pts + "\"/>"
            + "<polygon class=\"ts-hex-inner\""
            + " points=\"" + hex_inner + "\"/>"
            + "<circle class=\"ts-hex-dot\" cx=\"44\" cy=\"44\" r=\"5\"/>"
            + "</svg>"
            + "<span class=\"ts-node-label\">" + label + "</span>"
            + "</div>";
    };
    const eyebrow2 = "// "
        + escape_html(player_name_of(1)) + "'S TURN //";
    const sub2 = "TO " + escape_html(player_name_of(1));
    const scene = "<div class=\"ts-bg ts-bg-split\">"
        + "<div class=\"ts-grid\"></div>"
        + "<div class=\"ts-seam\"></div>"
        + "<div class=\"ts-scanline\"></div>"
        + "<div class=\"ts-vignette\"></div>"
        + "</div>"
        + "<div class=\"ts-content\">"
        + "<div class=\"ts-head\">"
        + "<div class=\"ts-eyebrow ts-eyebrow-blue\">"
        + eyebrow2 + "</div>"
        + "<h1 class=\"ts-title\">PASS THE SCREEN</h1>"
        + "<div class=\"ts-sub ts-sub-blue\">" + sub2 + "</div>"
        + "</div>"
        + "<div class=\"ts-transfer-stage\" aria-hidden=\"true\">"
        + node("ts-node-orange", escape_html(player_name_of(0)))
        + "<div class=\"ts-stream\">"
        + "<div class=\"ts-stream-track\"></div>"
        + "<span class=\"ts-chevron\"></span>"
        + "<span class=\"ts-chevron\"></span>"
        + "<span class=\"ts-chevron\"></span>"
        + "<div class=\"ts-core\"></div>"
        + "<div class=\"ts-packets\"></div>"
        + "</div>"
        + node("ts-node-blue", escape_html(player_name_of(1)))
        + "</div>"
        + "<div class=\"ts-foot\">"
        + "<button class=\"ts-button ts-button-blue\""
        + " type=\"button\">GOT IT</button>"
        + "<div class=\"ts-caption ts-caption-blue\">DON'T LOOK!</div>"
        + "</div>"
        + "</div>";
    const overlay = build_transition_overlay(
        "ts-theme-split", scene, on_confirm
    );
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

// ── Ghost Move tactical decision overlays ───────────────────────
// A two-step gate that replaces the old "click → ships instantly revealed"
// behaviour. Step 1 asks the acting player to confirm; step 2 warns the
// opponent to look away. Only after both does ghost-select mode begin.

// Shared animated backdrop + reticle for the ghost screens (themed by --ga).
const ghost_scene = function (
    accent, eyebrow, title, message_lines, glyph, buttons_html
) {
    const msgs = message_lines.map(function (line, i) {
        const cls = (i === 0 ? "ghost-msg" : "ghost-msg dim");
        return "<p class=\"" + cls + "\">" + line + "</p>";
    }).join("");
    return "<div class=\"ghost-bg\"></div>"
        + "<div class=\"ts-grid\"></div>"
        + "<div class=\"ghost-scanline\"></div>"
        + "<div class=\"ts-vignette\"></div>"
        + "<div class=\"ts-content\">"
        + "<div class=\"ts-head\">"
        + "<div class=\"ts-eyebrow\">" + eyebrow + "</div>"
        + "<h1 class=\"ts-title ghost-title\">" + title + "</h1>"
        + "</div>"
        + "<div class=\"ghost-mid\">"
        + "<div class=\"ghost-scope\" aria-hidden=\"true\">"
        + "<div class=\"ghost-scope-ring\"></div>"
        + "<div class=\"ghost-scope-ring2\"></div>"
        + "<div class=\"ghost-scope-core\"></div>"
        + "<span class=\"ghost-scope-glyph\">" + glyph + "</span>"
        + "</div>"
        + "<div class=\"ghost-message-block\">" + msgs + "</div>"
        + "</div>"
        + "<div class=\"ts-btn-row\">" + buttons_html + "</div>"
        + "</div>";
};

const build_ghost_overlay = function (accent_idx, scene_html) {
    remove_overlay();
    const theme = accent_idx === 0 ? "ghost-theme-orange" : "ghost-theme-blue";
    const overlay = document.createElement("div");
    overlay.className = "screen-overlay transition-overlay ghost-overlay "
        + theme;
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
    const player = escape_html(player_name_of(active_idx));
    const scene = ghost_scene(
        active_idx,
        "// " + player + " · GHOST PROTOCOL //",
        "ACTIVATE GHOST MOVE?",
        [
            "Intact ships slip away to any clear waters.",
            "Damaged ships can only crawl 2 tiles to escape.",
            "And every hit you took stays on the map."
        ],
        "👻",
        "<button class=\"ts-button ghost-confirm\""
        + " type=\"button\">CONFIRM</button>"
        + "<button class=\"ts-button ghost-cancel\""
        + " type=\"button\">CANCEL</button>"
    );
    const overlay = build_ghost_overlay(active_idx, scene);
    overlay.querySelector(".ghost-confirm").addEventListener(
        "click",
        function () { dismiss_overlay(overlay, on_confirm); }
    );
    overlay.querySelector(".ghost-cancel").addEventListener(
        "click",
        function () { dismiss_overlay(overlay, on_cancel); }
    );
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
        "<button class=\"ts-button ghost-confirm\""
        + " type=\"button\">PROCEED</button>"
    );
    const overlay = build_ghost_overlay(opponent_idx, scene);
    overlay.querySelector(".ghost-confirm").addEventListener(
        "click",
        function () { dismiss_overlay(overlay, on_proceed); }
    );
};

// Cinematic end-game overlay — HTML/CSS text banner + battle report.
const show_victory_screen = function (winner_player) {
    const player_idx = winner_player - 1;
    const faction = (
        winner_player === 1
        ? "is-p1"
        : "is-p2"
    );

    const elapsed_seconds = battle_start_time
        ? Math.floor((Date.now() - battle_start_time) / 1000)
        : 0;
    const mins = Math.floor(elapsed_seconds / 60);
    const secs = elapsed_seconds % 60;
    const time_str = mins + ":" + String(secs).padStart(2, "0");

    const accuracy = (
        standard_fire_shots[player_idx] > 0
        ? Math.round(
            standard_fire_hits[player_idx]
            / standard_fire_shots[player_idx] * 100
        )
        : 0
    );

    const total_ships = Battleship.ship_array.length;

    const overlay = document.createElement("div");
    overlay.className = "victory-overlay " + faction;

    // Rising embers — same style as homepage .bg-embers
    const vc_p = document.createElement("div");
    vc_p.className = "vc-particles";
    [
        {"l": "5%",  "d": "0.4s", "s": "5px"},
        {"l": "12%", "d": "2.4s", "s": "4px"},
        {"l": "20%", "d": "4.7s", "s": "6px"},
        {"l": "28%", "d": "1.5s", "s": "4px"},
        {"l": "38%", "d": "4.1s", "s": "5px"},
        {"l": "48%", "d": "6.3s", "s": "3px"},
        {"l": "58%", "d": "1.0s", "s": "5px"},
        {"l": "68%", "d": "5.5s", "s": "4px"},
        {"l": "76%", "d": "3.2s", "s": "6px"},
        {"l": "84%", "d": "2.1s", "s": "4px"},
        {"l": "90%", "d": "4.3s", "s": "5px"},
        {"l": "96%", "d": "0.9s", "s": "3px"}
    ].forEach(function (cfg) {
        const sp = document.createElement("span");
        sp.style.left = cfg.l;
        sp.style.width = cfg.s;
        sp.style.height = cfg.s;
        sp.style.animationDelay = cfg.d;
        vc_p.append(sp);
    });
    overlay.append(vc_p);

    // ── Cinematic text banner ─────────────────────────
    const banner = document.createElement("div");
    banner.className = "victory-cinematic";

    const top_lbl = document.createElement("div");
    top_lbl.className = "victory-label";
    top_lbl.textContent = "MISSION COMPLETE";

    const name_el = document.createElement("div");
    name_el.className = "victory-name " + faction;
    name_el.textContent = player_name_of(player_idx);

    const tagline = document.createElement("div");
    tagline.className = "victory-tagline";
    tagline.textContent = "YOU HAVE SUNK THE ENEMY FLEET";

    banner.append(top_lbl, name_el, tagline);
    overlay.append(banner);

    // ── Battle report card ────────────────────────────
    const report = document.createElement("div");
    report.className = "victory-report " + faction;

    const report_title = document.createElement("div");
    report_title.className = "victory-report-title";
    report_title.textContent = (
        player_name_of(player_idx) + "'s Battle Report"
    );
    report.append(report_title);

    const stats_row = document.createElement("div");
    stats_row.className = "victory-stats-row";

    const make_stat = function (label, value, extra_cls) {
        const card = document.createElement("div");
        card.className = "victory-stat-card";
        const val = document.createElement("div");
        val.className = "victory-stat-value" + (
            extra_cls ? " " + extra_cls : ""
        );
        val.textContent = value;
        const lbl = document.createElement("div");
        lbl.className = "victory-stat-label";
        lbl.textContent = label;
        card.append(val, lbl);
        return card;
    };

    const acc_card = make_stat("ACCURACY", "0%");
    const acc_val = acc_card.querySelector(".victory-stat-value");

    const sunk_total_str = "0/" + total_ships;
    const sunk_card = make_stat("SHIPS SUNK", sunk_total_str);
    const sunk_val = sunk_card.querySelector(".victory-stat-value");

    const time_card = make_stat("BATTLE TIME", time_str, "vc-time-fade");

    stats_row.append(acc_card, sunk_card, time_card);
    report.append(stats_row);
    overlay.append(report);

    const return_btn = document.createElement("button");
    return_btn.className = "victory-return-btn";
    return_btn.textContent = "RETURN TO MENU";
    return_btn.onclick = function () {
        window.location.href = "./index.html";
    };
    overlay.append(return_btn);

    document.body.append(overlay);

    // Count-up animation: starts after report card slides in (~2.4s)
    const count_up = function (el, target, render_fn, duration) {
        if (target === 0) {
            el.textContent = render_fn(0);
            return;
        }
        const t0 = Date.now();
        const tick = function () {
            const ratio = Math.min((Date.now() - t0) / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - ratio, 3);
            el.textContent = render_fn(Math.round(eased * target));
            if (ratio < 1) { requestAnimationFrame(tick); }
        };
        requestAnimationFrame(tick);
    };

    const sunk_target = ships_sunk_count[player_idx];
    setTimeout(function () {
        count_up(acc_val, accuracy, function (v) {
            return v + "%";
        }, 1200);
        count_up(sunk_val, sunk_target, function (v) {
            return v + "/" + total_ships;
        }, 1000);
    }, 2400);
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
        make_panel("swap-p1", player_name_of(0)),
        make_panel("swap-p2", player_name_of(1))
    );

    const caption = document.createElement("div");
    caption.className = "swap-caption";
    caption.textContent = "Boards locked — fire on your opponent's fleet!";

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
    }, {
        finaleTitle: "GAME START",
        subtitle: player_name_of(0) + "  ⚔  " + player_name_of(1)
    });
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
    game_board_1.dataset.index = "0";
    game_board_1.id = "game_board_1";
    game_container_1.append(game_board_1);
    game_board_2 = document.createElement("table");
    game_container_2.append(game_board_2);
    game_board_2.dataset.index = "0";
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

            // Centre control is in HTML — no dynamic panel needed

            // Create ship-status trackers (one per side)
            const create_ship_tracker = function (
                tracker_id, player_folder, parent_el, fleet_owner
            ) {
                const tracker = document.createElement("div");
                tracker.id = "tracker_" + tracker_id;
                tracker.className = "ship-tracker";

                // Title names whose fleet's remaining health this panel shows.
                const title = document.createElement("div");
                title.className = "tracker-title";
                title.textContent = fleet_owner + "'s Fleet Status";
                tracker.append(title);

                // Two rows: first 3 ships on top, last 2 on bottom
                const row1 = document.createElement("div");
                row1.className = "tracker-row";
                const row2 = document.createElement("div");
                row2.className = "tracker-row";

                Battleship.ship_array.forEach(function (ship, ship_index) {
                    const item = document.createElement("div");
                    item.className = "tracker-ship";
                    item.dataset.ship = ship.name;
                    item.dataset.length = ship.length;
                    // Staggered cascade: each icon enters 130 ms after previous
                    item.style.animationDelay = (ship_index * 130) + "ms";

                    const img = document.createElement("img");
                    img.src = "./assets/" + player_folder + "/"
                        + ship.name + ".png";
                    img.alt = ship.name;
                    item.append(img);
                    item.append(create_ship_size_strip(ship));

                    // Top row: 2 longest ships (carrier-5, battleship-4)
                    // Bottom: 3 shorter ships (cruiser-3, sub-3, destroyer-2)
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
            // Left (aside): orange Player-1 attack view, but the tracker below
            // shows the BLUE enemy fleet it is damaging → Player 2's fleet.
            // Right (main): blue Player-2 attack view, tracker shows Player 1.
            create_ship_tracker(
                0, "player2", document.querySelector("aside"), player_name_of(1)
            );
            create_ship_tracker(
                1, "player1", document.querySelector("main"), player_name_of(0)
            );

            // Swap game states
            const gs_temp = game_state[0];
            game_state[0] = game_state[1];
            game_state[1] = gs_temp;
            Audio_Manager.start_ambient();

            update_display = function () {
                const active_player_idx = next_player % 2;

                // Pre-compute ghost preview destination cells (if any)
                // so the per-cell loop can highlight the new position.
                const ghost_own_board_idx = 1 - active_player_idx;
                const ghost_preview_keys = {};
                let ghost_preview_blocked = false;
                if (ghost_selected_ship
                        && current_action_mode === "ghost_relocate"
                        && ghost_relocate_anchor) {
                    // Teleport: highlight the footprint under the cursor.
                    const gboard = game_state[ghost_own_board_idx];
                    const len = Battleship.ship_cells_by_name(
                        gboard, ghost_selected_ship
                    ).length;
                    const cells = Battleship.relocate_footprint(
                        ghost_relocate_anchor, len, ghost_relocate_orientation
                    );
                    ghost_preview_blocked = !Battleship.relocate_valid(
                        gboard, cells, ghost_selected_ship
                    );
                    cells.forEach(function (cr) {
                        if (cr[0] >= 0 && cr[0] < width
                                && cr[1] >= 0 && cr[1] < height) {
                            ghost_preview_keys[cr[0] + "," + cr[1]] = true;
                        }
                    });
                } else if (ghost_selected_ship && ghost_preview_direction
                        && (current_action_mode === "ghost_select"
                        || current_action_mode === "ghost_move")) {
                    const gboard = game_state[ghost_own_board_idx];
                    const offsets = {
                        "up": [0, -1],
                        "down": [0, 1],
                        "left": [-1, 0],
                        "right": [1, 0]
                    };
                    const off = offsets[ghost_preview_direction];
                    const dist = ghost_preview_distance || 1;
                    // Slide validity (bounds + path) from engine.
                    ghost_preview_blocked = Battleship.ghost_slide(
                        game_state[ghost_own_board_idx], ghost_selected_ship,
                        ghost_preview_direction, dist
                    ) === game_state[ghost_own_board_idx];
                    // Highlight would-be destination footprint (offset × dist).
                    for (let r = 0; r < height; r++) {
                        for (let c = 0; c < width; c++) {
                            if (Battleship.is_ship_here(gboard[r][c])
                                    && get_ship_name(gboard[r][c])
                                    === ghost_selected_ship) {
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
                            const table_cell = table_cells[
                                game_board_index
                            ][row_index][column_index];

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
                                "ghost-target", "ghost-selected",
                                "shot-flash", "ghost-origin",
                                "ghost-preview", "ghost-preview-invalid"
                            );

                            // Active player's own fleet is on opposite board.
                            const own_board_idx = (1 - active_player_idx);

                            if ((current_action_mode === "ghost_select"
                                    || current_action_mode === "ghost_move"
                                    || current_action_mode === "ghost_relocate")
                                    && game_board_index === own_board_idx) {
                                const ship_name = get_ship_name(cell);
                                if (ship_name
                                        && Battleship.is_ship_here(cell)
                                        && !Battleship.is_ship_sunk_by_name(
                                            game_board, ship_name
                                        )) {
                                    table_cell.className = "cell_with_ship";
                                    table_cell.classList.add("ghost-target");
                                    table_cell.style.cursor = "pointer";

                                    if (ghost_selected_ship
                                            && ship_name
                                            === ghost_selected_ship) {
                                        table_cell.classList
                                            .add("ghost-origin");
                                    }
                                }

                                // Preview of would-be destination footprint.
                                const preview_key = (
                                    column_index + "," + row_index
                                );
                                if (ghost_preview_keys[preview_key]) {
                                    table_cell.classList.add(
                                        ghost_preview_blocked
                                            ? "ghost-preview-invalid"
                                            : "ghost-preview"
                                    );
                                }
                            }

                            // Ghost-move trace: vacated hit-cell becomes scar
                            // until a ship occupies it again.
                            const scar_key = column_index + "," + row_index;
                            if (ghost_scars[game_board_index].includes(scar_key)
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
                    const tracker = document.getElementById(
                        "tracker_" + board_idx
                    );
                    if (!tracker) return;
                    Battleship.ship_array.forEach(function (ship) {
                        const item = tracker.querySelector(
                            "[data-ship=\"" + ship.name + "\"]"
                        );
                        if (!item) return;
                        item.classList.toggle(
                            "sunk",
                            Battleship.is_ship_sunk_by_name(
                                game_state[board_idx], ship.name
                            )
                        );
                    });
                });
            };

            table_cells = [
                R.range(0, height).map(
                    create_row_in_table_to_shoot_ships(game_board_1, 0)
                ),
                R.range(0, height).map(
                    create_row_in_table_to_shoot_ships(game_board_2, 1)
                )
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

            const active_td = document.querySelector(
                ".dragging, .is-repositioning"
            );
            const img = active_td ? active_td.querySelector("img") : null;

            if (selected_ship_object.orientation === "horizontal") {
                selected_ship_object.orientation = "vertical";
                if (img) img.style.transform = "rotate(90deg)";
            } else if (selected_ship_object.orientation === "vertical") {
                selected_ship_object.orientation = "horizontal";
                if (img) img.style.transform = "rotate(0deg)";
            }
            if (hovered_cell_info
                    && hovered_cell_info.board_index === game_board_index) {
                show_preview(
                    game_board_index,
                    hovered_cell_info.col,
                    hovered_cell_info.row
                );
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
                table_cells[game_board_index][r][c].classList
                    .add("place-origin");
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

        // Live preview: show where selected ship would land on hover/focus.
        // Also track last hovered cell so R-key rotation refreshes preview.
        td.onmouseenter = function () {
            hovered_cell_info = {
                "board_index": game_board_index,
                "col": column_index,
                "row": row_index
            };
            show_preview(game_board_index, column_index, row_index);
        };
        td.onfocus = function () {
            hovered_cell_info = {
                "board_index": game_board_index,
                "col": column_index,
                "row": row_index
            };
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
                    ship.placed = true;
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
            const prev_board = game_state[game_board_index];
            game_state[game_board_index] = Battleship.place_ship(
                prev_board,
                ship,
                column_index,
                row_index,
                game_board_index
            );
            if (game_state[game_board_index] !== prev_board) {
                ship.placed = true;
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
    img.setAttribute(
        "src",
        "./assets/" + player_folder + "/" + ship.name + ".png"
    );
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
            prev.className = (
                "ship" + (prev_ship && prev_ship.placed ? " is-placed" : "")
            );
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

        // Live footprint preview while teleporting an intact ship.
        td.onmouseenter = function () {
            if (current_action_mode === "ghost_relocate"
                    && game_board_index === (1 - (next_player % 2))) {
                ghost_relocate_anchor = [column_index, row_index];
                update_display();
            }
        };

        td.onclick = function () {
            if (game_over) return;

            const active_player_idx = next_player % 2;
            const own_board_idx = 1 - active_player_idx;

            if ((current_action_mode === "ghost_select"
                    || current_action_mode === "ghost_move"
                    || current_action_mode === "ghost_relocate")
                    && game_board_index === own_board_idx) {
                // In teleport mode a board click is a placement attempt, not a
                // re-selection. Cancel (in the side panel) returns to picking.
                if (current_action_mode === "ghost_relocate") {
                    attempt_ghost_relocate(
                        active_player_idx, column_index, row_index
                    );
                    return;
                }

                const cell = game_state[game_board_index][row_index][
                    column_index
                ];
                const ship_name = get_ship_name(cell);

                if (ship_name && Battleship.is_ship_here(cell)
                        && !Battleship.is_ship_sunk_by_name(
                            game_state[game_board_index], ship_name
                        )) {
                    ghost_selected_ship = ship_name;
                    ghost_preview_direction = null;
                    ghost_preview_distance = 1;
                    if (Battleship.is_ship_damaged(
                        game_state[game_board_index], ship_name
                    )) {
                        // Detected & damaged: emergency escape (1-2 tiles).
                        current_action_mode = "ghost_move";
                    } else {
                        // Intact & undetected: stealth teleport anywhere.
                        ghost_relocate_orientation = (
                            Battleship.infer_ship_orientation(
                                Battleship.ship_cells_by_name(
                                    game_state[game_board_index], ship_name
                                )
                            )
                        );
                        ghost_relocate_anchor = null;
                        current_action_mode = "ghost_relocate";
                    }
                    update_display();
                    update_battle_controls();
                }
                return;
            }

            if (next_player % 2 === game_board_index) {
                if (current_action_mode === "shoot"
                        && td.className === "unshot"
                        && !board_locked) {
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
                    if (target_had_ship) {
                        standard_fire_hits[active_player_idx]++;
                    }
                    if (target_had_ship && new_cell_state === "sunken_ship") {
                        ships_sunk_count[active_player_idx]++;
                    }

                    // Show this cell's result immediately (turn switches later)
                    const shot_td = table_cells[
                        game_board_index
                    ][row_index][column_index];
                    shot_td.className = new_cell_state;
                    shot_td.classList.add("shot-flash");

                    let vfx_delay = 900;
                    if (target_had_ship && new_cell_state === "sunken_ship") {
                        add_impact_strike(
                            game_board_index, row_index, column_index
                        );
                        trigger_sunk_bombardment(
                            game_board_index, row_index, column_index
                        );
                        Audio_Manager.play_sunk();
                        // Let explosion play, then freeze ~0.8s on result.
                        vfx_delay = 2600;
                    } else if (target_had_ship) {
                        add_impact_strike(
                            game_board_index, row_index, column_index
                        );
                        add_cell_effect(
                            game_board_index, row_index, column_index,
                            "hit-bubbles"
                        );
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
                else if (current_action_mode === "sonar"
                        && td.className === "unshot"
                        && !board_locked) {
                    // Lock the board so the scan result stays on the active
                    // player's side until they have had time to read it.
                    board_locked = true;
                    document.body.classList.add("board-locked");

                    const enemy_board = game_state[game_board_index];
                    const sonar_cells = [];

                    const count = Battleship.count_ships_in_area(
                        enemy_board, column_index, row_index
                    );

                    for (let r = row_index - 1; r <= row_index + 1; r++) {
                        for (let c = column_index - 1; c <= column_index + 1;
                                c++) {
                            if (r >= 0 && r < height && c >= 0 && c < width) {
                                sonar_cells.push({"r": r, "c": c});
                            }
                        }
                    }

                    const sonar_overlays = [];
                    sonar_cells.forEach(function (coords) {
                        const target_td = table_cells[
                            game_board_index
                        ][coords.r][coords.c];
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
                        sonar_overlays.forEach(function (ov) { ov.remove(); });
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
            // Ghost mode: skip cell-nav so arrow keys reach body.onkeydown
            if (current_action_mode === "ghost_select"
                    || current_action_mode === "ghost_move"
                    || current_action_mode === "ghost_relocate") {
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
    // Teleport mode: R rotates the footprint being placed.
    if (current_action_mode === "ghost_relocate" && ghost_selected_ship
            && (event.key === "r" || event.key === "R")) {
        ghost_relocate_orientation = (
            ghost_relocate_orientation === "horizontal"
            ? "vertical"
            : "horizontal"
        );
        update_display();
        update_battle_controls();
        event.preventDefault();
        return;
    }

    // Ghost move direction via arrow keys — checked first so it takes
    // priority over the generic cell-focus fallback below.
    if ((current_action_mode === "ghost_select"
            || current_action_mode === "ghost_move")
            && ghost_selected_ship) {
        const dir_map = {
            "ArrowUp": "up",
            "ArrowDown": "down",
            "ArrowLeft": "left",
            "ArrowRight": "right"
        };
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
        if (!document.activeElement
                || document.activeElement.tagName !== "TD") {
            table_cells[0][0][0].focus();
        }
    }

    // R key: rotate the currently selected/repositioning ship on either board.
    if ((event.key === "r" || event.key === "R")
            && selected_ship_name !== undefined) {
        const active_board_index = (
            game_board_1.style.visibility === "hidden" ? 1 : 0
        );
        const selected_ship_object = multiplayer_ship_array[
            active_board_index
        ].find((ship) => ship.name === selected_ship_name);

        // Works for fresh placement (.dragging) and repositioning
        const active_td = document.querySelector(
            ".dragging, .is-repositioning"
        );
        const img = active_td ? active_td.querySelector("img") : null;

        if (selected_ship_object) {
            if (selected_ship_object.orientation === "horizontal") {
                selected_ship_object.orientation = "vertical";
                if (img) img.style.transform = "rotate(90deg)";
            } else {
                selected_ship_object.orientation = "horizontal";
                if (img) img.style.transform = "rotate(0deg)";
            }
            // Refresh hover preview so new orientation shows immediately
            if (hovered_cell_info
                    && hovered_cell_info.board_index === active_board_index) {
                show_preview(
                    active_board_index,
                    hovered_cell_info.col,
                    hovered_cell_info.row
                );
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
// pending preview direction (not yet confirmed):
let ghost_preview_direction = null;
let ghost_preview_distance = 1;      // pending preview distance: 1 or 2 tiles
// footprint orientation while teleporting an intact ship:
let ghost_relocate_orientation = "horizontal";
// hovered top-left anchor while teleporting (null = none):
let ghost_relocate_anchor = null;
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
    ghost_relocate_anchor = null;
    ghost_relocate_orientation = "horizontal";
    next_player += 1;
    update_display();
    update_battle_controls();
};

// ── Stealth teleport (intact ships) ─────────────────────────────
// A ship with zero hits is "undetected" and may relocate to any pristine
// position; a ship with at least one hit is "damaged" and is limited to the
// orthogonal 1–2 tile escape slide above.
// Ghost move logic (ghost_slide, is_ship_damaged, is_ship_sunk_by_name,
// relocate_footprint, relocate_valid, apply_ghost_relocate,
// infer_ship_orientation, ship_cells_by_name) lives in BattleShip.js.

// Commits a teleport at the given anchor (no-op if the footprint is invalid).
const attempt_ghost_relocate = function (
    active_player_idx, anchor_col, anchor_row
) {
    if (board_locked || !ghost_selected_ship) return;
    const own_board_idx = 1 - active_player_idx;
    const gboard = game_state[own_board_idx];
    const len = Battleship.ship_cells_by_name(
        gboard, ghost_selected_ship
    ).length;
    const cells = Battleship.relocate_footprint(
        [anchor_col, anchor_row], len, ghost_relocate_orientation
    );
    if (!Battleship.relocate_valid(gboard, cells, ghost_selected_ship)) return;

    game_state[own_board_idx] = Battleship.apply_ghost_relocate(
        game_state[own_board_idx], ghost_selected_ship, cells
    );
    ghost_moves_left[active_player_idx] -= 1;
    const moved_ship = ghost_selected_ship;
    ghost_relocate_anchor = null;

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

const add_cell_effect = function (
    game_board_index, row_index, column_index, effect_type
) {
    const target_cell = table_cells[game_board_index][row_index][column_index];
    if (!target_cell) return;

    const effect = document.createElement("div");
    effect.className = "cell-effect " + effect_type;

    const particle_count = (
        effect_type === "sunk-explosion" ? 18
        : effect_type === "sunk-dust" ? 14
        : 9
    );
    const base_dist  = (effect_type === "sunk-explosion" ? 32 : 24);
    const step_dist  = (effect_type === "sunk-explosion" ? 12 : 9);
    const delay_step = (effect_type === "sunk-explosion" ? 18 : 22);
    R.range(0, particle_count).forEach(function (particle_index) {
        const particle = document.createElement("span");
        const angle = ((360 / particle_count) * particle_index) + "deg";
        const delay = (particle_index * delay_step) + "ms";
        const dist = (
            base_dist + (particle_index % 5) * step_dist
        ) + "px";
        particle.style.setProperty("--angle", angle);
        particle.style.setProperty("--delay", delay);
        particle.style.setProperty("--distance", dist);
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
    const ship_name = get_ship_name(hit_cell);

    if (!ship_name) {
        add_cell_effect(game_board_index, hit_row, hit_col, "sunk-explosion");
        return;
    }

    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const cell = board[r][c];
            if (cell && Battleship.is_ship_here(cell)
                    && cell.shipName === ship_name) {
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
    const player_name = player_name_of(active_player_idx);
    const inactive_name = player_name_of(1 - active_player_idx);

    // Body classes drive CSS turn-dimming and ghost-accessible states
    document.body.classList.toggle("turn-p1", active_player_idx === 0);
    document.body.classList.toggle("turn-p2", active_player_idx === 1);
    const is_ghost_mode = current_action_mode === "ghost_select" ||
                          current_action_mode === "ghost_move" ||
                          current_action_mode === "ghost_relocate";
    document.body.classList.toggle("ghost-active", is_ghost_mode);

    const center = document.getElementById("center_control");
    if (!center) return;
    center.innerHTML = "";

    // ── Turn label ──────────────────────────────────────────────
    const label_row = document.createElement("div");
    label_row.style.cssText = "display:flex;align-items:center;"
        + "gap:0.5rem;justify-content:center;width:100%;";

    const dot = document.createElement("div");
    dot.className = (
        "center-player-dot " + (active_player_idx === 0 ? "dot-p1" : "dot-p2")
    );
    label_row.append(dot);

    const turn_label = document.createElement("div");
    turn_label.className = "center-turn-label " +
        (active_player_idx === 0 ? "is-p1" : "is-p2");
    turn_label.textContent = player_name.toUpperCase() + "'S TURN";
    label_row.append(turn_label);
    center.append(label_row);

    // ── Identity: who is firing, and whose fleet they are attacking ──
    const make_id_block = function (label_text, name_text, faction_cls) {
        const block = document.createElement("div");
        block.className = "ci-block";
        const lbl = document.createElement("div");
        lbl.className = "ci-label";
        lbl.textContent = label_text;
        const chip = document.createElement("div");
        chip.className = "ci-chip " + faction_cls;
        chip.textContent = name_text;
        block.append(lbl, chip);
        return block;
    };
    const identity = document.createElement("div");
    identity.className = "center-identity";
    identity.append(
        make_id_block("CURRENT PLAYER", player_name,
            active_player_idx === 0 ? "ci-p1" : "ci-p2"),
        make_id_block("ATTACKING", inactive_name + "'s Fleet",
            active_player_idx === 0 ? "ci-p2" : "ci-p1")
    );
    center.append(identity);

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
            {
                "cls": "score-p1",
                "label": player_name_of(0),
                "value": count_hits(game_state[0]),
                "active": active_player_idx === 0
            },
            {
                "cls": "score-p2",
                "label": player_name_of(1),
                "value": count_hits(game_state[1]),
                "active": active_player_idx === 1
            }
        ].forEach(function (s) {
            const side = document.createElement("div");
            side.className = (
                "score-side " + s.cls + (s.active ? " is-active" : "")
            );
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
            status.textContent = (
                "Damaged ship — confirm escape, or pick another direction."
            );
        } else {
            status.textContent = ghost_selected_ship
                + " is damaged. Escape up to 2 tiles — pick a direction.";
        }
    } else if (current_action_mode === "ghost_relocate") {
        status.textContent = ghost_selected_ship
            + " is intact. Click any clear water to redeploy · R to rotate.";
    }
    center.append(status);

    center.append(Object.assign(
        document.createElement("div"), {"className": "center-divider"}
    ));

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
          current_action_mode === "ghost_move" ||
          current_action_mode === "ghost_relocate") ? " is-active" : "");
    fill_action_button(
        ghost_btn,
        "👻",
        "Ghost Move",
        "Intact ships teleport · damaged ships escape 2 tiles",
        ghost_moves_left[active_player_idx] + " left"
    );
    if (ghost_moves_left[active_player_idx] <= 0) ghost_btn.disabled = true;
    ghost_btn.onclick = function () {
        ghost_preview_direction = null;
        ghost_preview_distance = 1;
        ghost_relocate_anchor = null;
        // Already in ghost mode → this is a toggle-off (no reveal involved).
        if (current_action_mode === "ghost_select"
                || current_action_mode === "ghost_move"
                || current_action_mode === "ghost_relocate") {
            current_action_mode = "shoot";
            ghost_selected_ship = null;
            update_display();
            update_battle_controls();
            return;
        }
        // Ghost Move: confirm first, warn the opponent, THEN reveal ships.
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
            const own_board_idx = 1 - active_player_idx;
            const valid = Battleship.ghost_slide(
                game_state[own_board_idx], ghost_selected_ship,
                ghost_preview_direction, ghost_preview_distance
            ) !== game_state[own_board_idx];
            confirm_btn.disabled = !valid;
            confirm_btn.onclick = function () {
                const new_board = Battleship.ghost_slide(
                    game_state[own_board_idx], ghost_selected_ship,
                    ghost_preview_direction, ghost_preview_distance
                );
                if (new_board === game_state[own_board_idx]) {
                    return;
                }
                // Tactical cost: record where this ship was already damaged so
                // the vacated hits stay on the board as a "scar" trace. The
                // engine restores the ship to full health at its new position;
                // the old hits become permanent intel for the opponent.
                record_ghost_scars(own_board_idx, ghost_selected_ship);
                game_state[own_board_idx] = new_board;
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

    // ── Teleport controls (ghost_relocate only) ──────────────────
    // Intact ships place directly on the board (like deployment); this
    // panel only offers Rotate and Cancel — click commits the move.
    if (current_action_mode === "ghost_relocate") {
        const relocate_box = document.createElement("div");
        relocate_box.className = "ghost-relocate-controls";

        const rotate_btn = document.createElement("button");
        rotate_btn.className = "ghost-rotate-btn";
        rotate_btn.textContent = "⟳ Rotate  [R]";
        rotate_btn.onclick = function () {
            ghost_relocate_orientation = (
                ghost_relocate_orientation === "horizontal"
                ? "vertical"
                : "horizontal"
            );
            update_display();
            update_battle_controls();
        };

        const relocate_cancel = document.createElement("button");
        relocate_cancel.className = "ghost-cancel-btn";
        relocate_cancel.textContent = "Choose another ship";
        relocate_cancel.onclick = function () {
            ghost_relocate_anchor = null;
            ghost_selected_ship = null;
            current_action_mode = "ghost_select";
            update_display();
            update_battle_controls();
        };

        relocate_box.append(rotate_btn, relocate_cancel);
        center.append(relocate_box);
    }

    center.append(Object.assign(
        document.createElement("div"), {"className": "center-divider"}
    ));

    // ── Waiting label ───────────────────────────────────────────
    const wait = document.createElement("div");
    wait.className = "center-wait-label";
    wait.textContent = inactive_name + " is waiting...";
    center.append(wait);

    // ── Embedded legend (replaces removed bottom bar) ────────────
    const legend_row = document.createElement("div");
    legend_row.className = "hud-legend";
    [
        { cls: "ship-label",         label: "Ship" },
        { cls: "hit-label",          label: "Hit" },
        { cls: "miss-label",         label: "Miss" },
        { cls: "sunken-ship-label",  label: "Sunk" }
    ].forEach(function (d) {
        const item = document.createElement("div");
        item.className = "hud-leg-item";
        const box = document.createElement("div");
        box.className = "colour-box " + d.cls;
        const lbl = document.createElement("span");
        lbl.textContent = d.label;
        item.append(box, lbl);
        legend_row.append(item);
    });
    center.append(legend_row);
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
// ── Name-setup phase ─────────────────────────────────────────────
// Both commanders enter their call signs before anything else; the names
// then drive every multiplayer label. Defaults to Siyi / Zipei if left blank.
const start_with_names = function () {
    const overlay = document.getElementById("name_setup");
    const input_1 = document.getElementById("ns_name_1");
    const input_2 = document.getElementById("ns_name_2");
    const begin = document.getElementById("ns_begin");
    if (!overlay || !input_1 || !input_2 || !begin) {
        show_countdown_overlay();
        return;
    }
    const commit = function () {
        const n1 = input_1.value.trim();
        const n2 = input_2.value.trim();
        player_names[0] = (n1 || "Player 1").slice(0, 14);
        player_names[1] = (n2 || "Player 2").slice(0, 14);
        overlay.classList.add("ns-hide");
        setTimeout(function () { overlay.remove(); }, 420);
        show_countdown_overlay();
    };
    begin.addEventListener("click", commit);
    [input_1, input_2].forEach(function (inp) {
        inp.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                commit();
            }
        });
    });
    input_1.focus();
    input_1.select();
};
start_with_names();
