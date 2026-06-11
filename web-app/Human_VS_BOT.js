import R from "./ramda.js";
import Battleship from "./BattleShip.js";
import {
    playHitSound,
    playMissSound,
    playSunkSound,
    playWinSound
} from "./sound.js";

// ==========================================================================
// Single Player — same visual universe as Multiplayer, different rules.
// Board index 0 = the player's own fleet (aside, orange).
// Board index 1 = the bot's hidden fleet (main, blue).
// ==========================================================================

const width = 10;
const height = 10;
const TOTAL_SHIP_CELLS = Battleship.ship_array.reduce(function (sum, s) {
    return sum + s.length;
}, 0);

let game_state = [
    Battleship.empty_board(width, height),
    Battleship.empty_board(width, height)
];

// Fresh, mutable copy of the fleet for the player's deploy tray.
let player_fleet = JSON.parse(JSON.stringify(Battleship.ship_array));

let difficulty = "normal";
let table_cells = [null, null];
let selected_ship_name = undefined;
let repositioning = false;   // true while moving an already-placed ship
let board_locked = false;
let hovered_cell_info = null;  // last hovered placement cell for R-key preview refresh
let phase = "difficulty";   // difficulty | placing | deploying | battle | over
let turn = "player";        // player | bot

// Bot AI memory
let ai_queue = [];          // priority cells to fire at next
let ai_hits = [];           // current run of unsunk hits

document.documentElement.style.setProperty("--game-rows", height);
document.documentElement.style.setProperty("--game-columns", width);

const game_board_1 = document.getElementById("game_board_1");
const game_board_2 = document.getElementById("game_board_2");
const ships_1 = document.getElementById("ships_1");
const button_container_1 = document.getElementById("button_container_1");
const center_control = document.getElementById("center_control");

// ==========================================================================
// 1. DIFFICULTY SELECT — drag/scroll carousel
// ==========================================================================
const DIFFICULTIES = ["easy", "normal", "hard"];

const setup_difficulty_select = function () {
    const overlay = document.getElementById("difficulty_overlay");
    const track = document.getElementById("diff_track");
    const dots_wrap = document.getElementById("diff_dots");
    const prev_btn = document.getElementById("diff_prev");
    const next_btn = document.getElementById("diff_next");
    const start_btn = document.getElementById("diff_start");
    const cards = Array.from(track.children);

    let index = 1; // start on Normal

    // Build dots
    cards.forEach(function () {
        const dot = document.createElement("div");
        dot.className = "diff-dot";
        dots_wrap.append(dot);
    });
    const dots = Array.from(dots_wrap.children);

    const render = function () {
        track.style.transform = "translateX(" + (-index * 100) + "%)";
        cards.forEach(function (card, i) {
            card.classList.toggle("is-focus", i === index);
        });
        dots.forEach(function (dot, i) {
            dot.classList.toggle("is-active", i === index);
        });
    };

    const go = function (next_index) {
        index = Math.max(0, Math.min(cards.length - 1, next_index));
        render();
    };

    prev_btn.onclick = function () { go(index - 1); };
    next_btn.onclick = function () { go(index + 1); };
    dots.forEach(function (dot, i) {
        dot.onclick = function () { go(i); };
    });

    // Pointer drag to roll between difficulties
    let drag_x = null;
    const carousel = document.getElementById("diff_carousel");
    carousel.addEventListener("pointerdown", function (e) {
        drag_x = e.clientX;
    });
    window.addEventListener("pointerup", function (e) {
        if (drag_x === null) return;
        const dx = e.clientX - drag_x;
        drag_x = null;
        if (dx < -40) go(index + 1);
        else if (dx > 40) go(index - 1);
    });

    start_btn.onclick = function () {
        difficulty = DIFFICULTIES[index];
        overlay.classList.add("hidden");
        start_placement();
    };

    render();
};

// ==========================================================================
// 2. PLACEMENT PHASE (player) — reuses the multiplayer deploy visuals
// ==========================================================================

// One pip per grid cell so a beginner sees a ship's length at a glance.
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

// (7) Lift a placed ship off the board so it can be repositioned.
const pickup_ship = function (ship) {
    const board = game_state[0].map(function (row) {
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
    game_state[0] = board;
    ship.placed = false;
};

// Brief settle animation on the cells a repositioned ship just landed on.
const flash_landing = function (ship_name) {
    game_state[0].forEach(function (row, r) {
        row.forEach(function (cell, c) {
            if (cell.shipName === ship_name) {
                const cell_td = table_cells[0][r][c];
                cell_td.classList.add("place-landed");
                setTimeout(function () {
                    cell_td.classList.remove("place-landed");
                }, 500);
            }
        });
    });
};

const create_ship_cell = function (ship, tr) {
    const td = document.createElement("td");
    td.className = "ship";
    td.dataset.ship = ship.name;

    const img = document.createElement("img");
    img.setAttribute("src", "./assets/player1/" + ship.name + ".png");
    img.id = ship.name;
    img.style.transition = "transform 0.2s ease";

    const name = document.createElement("div");
    name.className = "ship-name";
    name.textContent = ship.name;

    td.onclick = function () {
        const ship_obj = player_fleet.find((s) => s.name === ship.name);

        // Clicking the ship that is already in reposition mode cancels it.
        if (repositioning && selected_ship_name === ship.name) {
            repositioning = false;
            selected_ship_name = undefined;
            td.className = "ship is-placed";
            render_placement();
            clear_preview();
            mark_origin();
            update_deploy_controls();
            return;
        }

        // Restore whichever card was previously active.
        const prev = ships_1.querySelector(".dragging, .is-repositioning");
        if (prev && prev !== td) {
            const prev_ship = player_fleet.find((s) => s.name === prev.dataset.ship);
            prev.className = "ship" + (prev_ship && prev_ship.placed ? " is-placed" : "");
        }

        // A placed ship enters reposition mode — it STAYS on the board as a
        // reference until the move is confirmed. A fresh ship is just selected.
        repositioning = Boolean(ship_obj && ship_obj.placed);
        selected_ship_name = img.id;
        td.className = repositioning
            ? "ship is-placed is-repositioning"
            : "dragging";
        if (ship_obj) {
            img.style.transform = ship_obj.orientation === "vertical"
                ? "rotate(90deg)" : "rotate(0deg)";
        }
        render_placement();
        mark_origin();
        update_deploy_controls();
    };
    td.tabIndex = 0;
    td.onkeydown = function (event) {
        if (event.key === "Enter" || event.key === " ") {
            td.onclick();
        }
    };
    td.append(img, name, create_ship_size_strip(ship));
    tr.append(td);
};

const create_ship_table = function () {
    ships_1.innerHTML = "";
    const short_ships = player_fleet.filter((s) => s.length <= 3);
    const long_ships = player_fleet.filter((s) => s.length >= 4);
    const top_row = document.createElement("tr");
    ships_1.append(top_row);
    short_ships.forEach((ship) => create_ship_cell(ship, top_row));
    const bottom_row = document.createElement("tr");
    ships_1.append(bottom_row);
    long_ships.forEach((ship) => create_ship_cell(ship, bottom_row));
};

// ── Placement preview (green = valid, red = invalid) ──
const get_preview_cells = function (ship, x, y) {
    const cells = [];
    if (!ship) return cells;
    R.range(0, ship.length).forEach(function (i) {
        if (ship.orientation === "vertical") cells.push([x, y + i]);
        else cells.push([x + i, y]);
    });
    return cells;
};

// A placement is valid when every cell is in bounds and free — except cells
// occupied by the ship currently being repositioned (it is moving off them).
const is_preview_valid = function (cells, ignore_name) {
    return cells.every(function (coord) {
        const cx = coord[0];
        const cy = coord[1];
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) return false;
        const cell = game_state[0][cy][cx];
        return !Battleship.is_ship_here(cell) || cell.shipName === ignore_name;
    });
};

const clear_preview = function () {
    if (!table_cells[0]) return;
    table_cells[0].forEach(function (row) {
        row.forEach(function (td) {
            td.classList.remove("preview-valid", "preview-invalid");
        });
    });
};

// While repositioning, keep the ship's current footprint highlighted (yellow)
// as a reference until the move is confirmed.
const mark_origin = function () {
    if (!table_cells[0]) return;
    table_cells[0].forEach(function (row) {
        row.forEach(function (td) { td.classList.remove("place-origin"); });
    });
    if (!repositioning || selected_ship_name === undefined) return;
    game_state[0].forEach(function (row, r) {
        row.forEach(function (cell, c) {
            if (cell.shipName === selected_ship_name) {
                table_cells[0][r][c].classList.add("place-origin");
            }
        });
    });
};

const show_preview = function (column_index, row_index) {
    clear_preview();
    if (selected_ship_name === undefined) {
        mark_origin();
        return;
    }
    const ship = player_fleet.find((s) => s.name === selected_ship_name);
    if (!ship) return;
    const cells = get_preview_cells(ship, column_index, row_index);
    const valid = is_preview_valid(
        cells,
        repositioning ? selected_ship_name : null
    );
    cells.forEach(function (coord) {
        const cx = coord[0];
        const cy = coord[1];
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
            table_cells[0][cy][cx].classList.add(
                valid ? "preview-valid" : "preview-invalid"
            );
        }
    });
    mark_origin();
};

const create_place_cell = function (row_index, tr) {
    return function (column_index) {
        const td = document.createElement("td");
        td.tabIndex = 0;
        td.onmouseenter = function () {
            hovered_cell_info = { col: column_index, row: row_index };
            show_preview(column_index, row_index);
        };
        td.onfocus = function () {
            hovered_cell_info = { col: column_index, row: row_index };
            show_preview(column_index, row_index);
        };
        td.onclick = function () {
            if (selected_ship_name === undefined) return;
            const ship = player_fleet.find((s) => s.name === selected_ship_name);

            // ── Repositioning an already-placed ship ──
            if (repositioning) {
                const cells = get_preview_cells(ship, column_index, row_index);
                const valid = is_preview_valid(cells, selected_ship_name);
                const card = ships_1.querySelector(
                    "[data-ship=\"" + selected_ship_name + "\"]"
                );
                const moved_name = selected_ship_name;
                if (valid) {
                    pickup_ship(ship);   // clear the old position
                    game_state[0] = Battleship.place_ship(
                        game_state[0], ship, column_index, row_index, 0
                    );
                    repositioning = false;
                    selected_ship_name = undefined;
                    if (card) card.className = "ship is-placed";
                    render_placement();
                    flash_landing(moved_name);
                } else {
                    // Invalid drop — cancel smoothly, keep the original.
                    repositioning = false;
                    selected_ship_name = undefined;
                    if (card) card.className = "ship is-placed";
                    render_placement();
                }
                clear_preview();
                mark_origin();
                update_deploy_controls();
                return;
            }

            // ── Fresh placement ──
            game_state[0] = Battleship.place_ship(
                game_state[0], ship, column_index, row_index, 0
            );
            if (ship.placed === true) {
                const dragging = document.getElementsByClassName("dragging");
                if (dragging.length) dragging[0].className = "ship is-placed";
                selected_ship_name = undefined;
            }
            render_placement();
            update_deploy_controls();
        };
        tr.append(td);
        return td;
    };
};

const create_place_row = function (row_index) {
    const tr = document.createElement("tr");
    game_board_1.append(tr);
    return R.range(0, width).map(create_place_cell(row_index, tr));
};

const render_placement = function () {
    game_state[0].forEach(function (row, r) {
        row.forEach(function (cell, c) {
            table_cells[0][r][c].className =
                Battleship.is_ship_here(cell) ? "cell_with_ship" : "unshot";
        });
    });
};

let save_button = null;

const update_deploy_controls = function () {
    if (!save_button) return;
    const ready = player_fleet.every((s) => s.placed);
    save_button.disabled = !ready;
    save_button.classList.toggle("is-ready", ready);
    save_button.classList.toggle("is-hidden", !ready);
};

const create_rotate_button = function () {
    const button = document.createElement("button");
    button.textContent = "Rotate Ship";
    button.className = "rotate-ship-button";
    button.addEventListener("click", function () {
        if (selected_ship_name === undefined) return;
        const ship = player_fleet.find((s) => s.name === selected_ship_name);
        const active_td = document.querySelector(".dragging, .is-repositioning");
        const img = active_td ? active_td.querySelector("img") : null;
        if (ship.orientation === "horizontal") {
            ship.orientation = "vertical";
            if (img) img.style.transform = "rotate(90deg)";
        } else {
            ship.orientation = "horizontal";
            if (img) img.style.transform = "rotate(0deg)";
        }
        if (hovered_cell_info) {
            show_preview(hovered_cell_info.col, hovered_cell_info.row);
        }
    });
    button_container_1.append(button);
};

const create_save_button = function () {
    const button = document.createElement("button");
    button.textContent = "Save";
    button.className = "save-turn-button is-hidden";
    button.disabled = true;
    button.addEventListener("click", function () {
        if (!player_fleet.every((s) => s.placed)) return;
        start_bot_deploy();
    });
    button_container_1.append(button);
    save_button = button;
};

const start_placement = function () {
    phase = "placing";
    document.body.className = "placing-player-1";

    game_board_1.innerHTML = "";
    table_cells[0] = R.range(0, height).map(create_place_row);
    game_board_1.addEventListener("mouseleave", clear_preview);

    create_ship_table();
    create_rotate_button();
    create_save_button();

    render_placement();
    update_deploy_controls();
};

// R key rotates the selected ship during placement and refreshes the preview.
document.body.onkeydown = function (event) {
    if ((event.key === "r" || event.key === "R") && selected_ship_name !== undefined) {
        const ship = player_fleet.find((s) => s.name === selected_ship_name);
        if (!ship) return;
        const active_td = document.querySelector(".dragging, .is-repositioning");
        const img = active_td ? active_td.querySelector("img") : null;
        if (ship.orientation === "horizontal") {
            ship.orientation = "vertical";
            if (img) img.style.transform = "rotate(90deg)";
        } else {
            ship.orientation = "horizontal";
            if (img) img.style.transform = "rotate(0deg)";
        }
        if (hovered_cell_info) {
            show_preview(hovered_cell_info.col, hovered_cell_info.row);
        }
        event.preventDefault();
    }
};

// ==========================================================================
// 3. BOT DEPLOY PHASE — bot places ships one by one, then hides them
// ==========================================================================
const bot_random_place = function () {
    let board = Battleship.empty_board(width, height);
    const fleet = JSON.parse(JSON.stringify(Battleship.ship_array));
    fleet.forEach(function (ship) {
        ship.orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
        ship.placed = false;
        let next_board = board;
        let guard = 0;
        do {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            next_board = Battleship.place_ship(board, ship, x, y, 1);
            guard += 1;
        } while (next_board === board && guard < 500);
        board = next_board.map((row) => row.map(R.identity));
    });
    return board;
};

const build_battle_boards = function () {
    game_board_1.innerHTML = "";
    game_board_2.innerHTML = "";
    table_cells[0] = R.range(0, height).map(function (r) {
        const tr = document.createElement("tr");
        game_board_1.append(tr);
        return R.range(0, width).map(function (c) {
            const td = document.createElement("td");
            td.className = "unshot";
            tr.append(td);
            return td;
        });
    });
    table_cells[1] = R.range(0, height).map(function (r) {
        const tr = document.createElement("tr");
        game_board_2.append(tr);
        return R.range(0, width).map(function (c) {
            const td = document.createElement("td");
            td.className = "unshot";
            td.tabIndex = 0;
            td.onclick = function () { player_shoot(c, r); };
            td.onkeydown = function (event) {
                if (event.key === "Enter" || event.key === " ") player_shoot(c, r);
            };
            tr.append(td);
            return td;
        });
    });
};

const cells_of_ship = function (board_index, ship_name) {
    const cells = [];
    game_state[board_index].forEach(function (row, r) {
        row.forEach(function (cell, c) {
            if (Battleship.is_ship_here(cell) && cell.shipName === ship_name) {
                cells.push([c, r]);
            }
        });
    });
    return cells;
};

// ── Radar scanner that sweeps the bot board's perimeter (item 4) ──
let scanner_interval = null;
let scanner_cells = [];
let scanner_pos = 0;

const build_perimeter = function () {
    const cells = [];
    let c;
    let r;
    for (c = 0; c < width; c++) cells.push([c, 0]);              // top  →
    for (r = 1; r < height; r++) cells.push([width - 1, r]);     // right ↓
    for (c = width - 2; c >= 0; c--) cells.push([c, height - 1]); // bottom ←
    for (r = height - 2; r >= 1; r--) cells.push([0, r]);        // left ↑
    return cells;
};

const clear_scanner_classes = function () {
    if (!table_cells[1]) return;
    table_cells[1].forEach(function (row) {
        row.forEach(function (td) {
            td.classList.remove("scan-head", "scan-t1", "scan-t2", "scan-t3");
        });
    });
};

const start_scanner = function () {
    scanner_cells = build_perimeter();
    scanner_pos = 0;
    const n = scanner_cells.length;
    scanner_interval = setInterval(function () {
        clear_scanner_classes();
        const at = function (back) {
            return scanner_cells[((scanner_pos - back) % n + n) % n];
        };
        [["scan-head", 0], ["scan-t1", 1], ["scan-t2", 2], ["scan-t3", 3]]
            .forEach(function (pair) {
                const coord = at(pair[1]);
                table_cells[1][coord[1]][coord[0]].classList.add(pair[0]);
            });
        scanner_pos = (scanner_pos + 1) % n;
    }, 85);
};

const stop_scanner = function () {
    if (scanner_interval) {
        clearInterval(scanner_interval);
        scanner_interval = null;
    }
    clear_scanner_classes();
};

// The deploy status list: 5 bot ships, fading one by one as they deploy.
const build_bot_deploy_list = function () {
    const main = document.querySelector("main");
    const list = document.createElement("div");
    list.className = "bot-deploy-list";
    Battleship.ship_array.forEach(function (ship) {
        const item = document.createElement("div");
        item.className = "bot-deploy-item";
        const img = document.createElement("img");
        img.src = "./assets/player2/" + ship.name + ".png";
        img.alt = ship.name;
        item.append(img, create_ship_size_strip(ship));
        list.append(item);
    });
    main.append(list);
    return list;
};

const start_bot_deploy = function () {
    phase = "deploying";
    document.body.className = "battle-phase bot-deploying";
    set_battle_titles();

    // Bot places its fleet in secret — the board never reveals it (item 2).
    game_state[1] = bot_random_place();

    build_battle_boards();
    render_player_board();
    render_bot_board_hidden_blank();

    // Grid pulse + radar scanner make the empty board feel "alive" (items 4,5)
    const container2 = document.getElementById("game_container_2");
    container2.classList.add("scanning-pulse");
    start_scanner();

    const banner = document.getElementById("bot_deploy_banner");
    banner.textContent = "Bot is placing ships";
    banner.classList.remove("hidden");

    const deploy_list = build_bot_deploy_list();

    center_control.innerHTML = "";
    const status = document.createElement("div");
    status.className = "center-status";
    status.textContent = "Enemy AI deploying fleet…";
    center_control.append(status);

    // Deploy ships one by one: each fades from solid → 40% in the status list.
    const items = Array.from(deploy_list.children);
    let i = 0;
    const deploy_next = function () {
        if (i >= items.length) {
            // Hold on the completed state before battle begins (item 6).
            setTimeout(function () {
                stop_scanner();
                container2.classList.remove("scanning-pulse");
                banner.classList.add("hidden");
                if (deploy_list.parentElement) deploy_list.remove();
                start_battle();
            }, 800);
            return;
        }
        items[i].classList.add("deployed");
        playMissSound();
        i += 1;
        setTimeout(deploy_next, 700);
    };
    setTimeout(deploy_next, 700);
};

const render_bot_board_hidden_blank = function () {
    game_state[1].forEach(function (row, r) {
        row.forEach(function (cell, c) {
            table_cells[1][r][c].className = "unshot";
        });
    });
};

// ==========================================================================
// 4. BATTLE PHASE
// ==========================================================================
const set_battle_titles = function () {
    const you = document.querySelector("aside h2");
    const bot = document.querySelector("main h2");
    if (you) you.textContent = "You";
    if (bot) bot.textContent = "Bot";
};

// Player board: own ships always visible + damage shown.
const render_player_board = function () {
    game_state[0].forEach(function (row, r) {
        row.forEach(function (cell, c) {
            const td = table_cells[0][r][c];
            if (cell.shot) {
                td.className = Battleship.cell_state(game_state[0], cell, [c, r], 0);
            } else if (Battleship.is_ship_here(cell)) {
                td.className = "cell_with_ship";
            } else {
                td.className = "unshot";
            }
        });
    });
};

// Bot board: ships hidden — only hit / miss / sunk are revealed.
const render_bot_board = function () {
    game_state[1].forEach(function (row, r) {
        row.forEach(function (cell, c) {
            table_cells[1][r][c].className =
                Battleship.cell_state(game_state[1], cell, [c, r], 1);
        });
    });
};

const count_hits = function (board) {
    return board.reduce(function (sum, row) {
        return sum + row.filter(function (cell) {
            return cell.shot && Battleship.is_ship_here(cell);
        }).length;
    }, 0);
};

const set_turn = function (who) {
    turn = who;
    // Player attacks the bot board (main) → keep main bright (turn-p2 layout).
    // Bot attacks the player board (aside) → keep aside bright (turn-p1 layout).
    document.body.classList.toggle("turn-p2", who === "player");
    document.body.classList.toggle("turn-p1", who === "bot");
};

const render_hud = function () {
    center_control.innerHTML = "";

    const label_row = document.createElement("div");
    label_row.style.cssText =
        "display:flex;align-items:center;gap:0.5rem;justify-content:center;width:100%;";
    const dot = document.createElement("div");
    dot.className = "center-player-dot " + (turn === "player" ? "dot-p1" : "dot-p2");
    const turn_label = document.createElement("div");
    turn_label.className = "center-turn-label " + (turn === "player" ? "is-p1" : "is-p2");
    turn_label.textContent = turn === "player" ? "YOUR TURN" : "BOT'S TURN";
    label_row.append(dot, turn_label);
    center_control.append(label_row);

    const status = document.createElement("div");
    status.className = "center-status";
    status.textContent = turn === "player"
        ? "Click an enemy cell to fire."
        : "Incoming fire — hold position…";
    center_control.append(status);

    center_control.append(Object.assign(
        document.createElement("div"), { className: "center-divider" }
    ));

    // Score board: enemy ship cells each side has hit.
    const score = document.createElement("div");
    score.className = "score-board";
    [
        { cls: "score-p1", label: "You", value: count_hits(game_state[1]), active: turn === "player" },
        { cls: "score-p2", label: "Bot", value: count_hits(game_state[0]), active: turn === "bot" }
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
        tot.textContent = "of " + TOTAL_SHIP_CELLS + " hits";
        side.append(lbl, val, tot);
        score.append(side);
    });
    center_control.append(score);

    center_control.append(Object.assign(
        document.createElement("div"), { className: "center-divider" }
    ));

    const wait = document.createElement("div");
    wait.className = "center-wait-label";
    wait.textContent = "Difficulty: " + difficulty.toUpperCase();
    center_control.append(wait);
};

const start_battle = function () {
    phase = "battle";
    document.body.className = "battle-phase";
    set_turn("player");
    render_player_board();
    render_bot_board();
    render_hud();
};

// ── Combat VFX (ported from multiplayer) ──
const add_impact_strike = function (board_index, r, c) {
    const td = table_cells[board_index][r][c];
    if (!td) return;
    const strike = document.createElement("div");
    strike.className = "impact-strike";
    td.append(strike);
    setTimeout(function () { strike.remove(); }, 650);
};

const add_cell_effect = function (board_index, r, c, effect_type) {
    const td = table_cells[board_index][r][c];
    if (!td) return;
    const effect = document.createElement("div");
    effect.className = "cell-effect " + effect_type;
    const particle_count = effect_type === "sunk-explosion" ? 18 : 9;
    const base_dist = effect_type === "sunk-explosion" ? 32 : 24;
    const step_dist = effect_type === "sunk-explosion" ? 12 : 9;
    const delay_step = effect_type === "sunk-explosion" ? 18 : 22;
    R.range(0, particle_count).forEach(function (p) {
        const particle = document.createElement("span");
        particle.style.setProperty("--angle", ((360 / particle_count) * p) + "deg");
        particle.style.setProperty("--delay", (p * delay_step) + "ms");
        particle.style.setProperty("--distance", (base_dist + (p % 5) * step_dist) + "px");
        effect.append(particle);
    });
    td.append(effect);
    setTimeout(function () {
        effect.remove();
    }, effect_type === "sunk-explosion" ? 2200 : 1000);
};

const trigger_sunk_bombardment = function (board_index, r, c) {
    const ship_name = game_state[board_index][r][c].shipName;
    if (!ship_name) {
        add_cell_effect(board_index, r, c, "sunk-explosion");
        return;
    }
    cells_of_ship(board_index, ship_name).forEach(function (coord) {
        add_cell_effect(board_index, coord[1], coord[0], "sunk-explosion");
    });
};

const bump_score = function () {
    const vals = center_control.querySelectorAll(".score-value");
    vals.forEach(function (v) {
        v.classList.add("score-bump");
        setTimeout(function () { v.classList.remove("score-bump"); }, 220);
    });
};

// ── Resolve one shot, return the resulting cell state + delay ──
const resolve_shot = function (board_index, c, r) {
    game_state[board_index] = Battleship.shoot_cell(game_state[board_index], [c, r]);
    const state = Battleship.cell_state(
        game_state[board_index],
        game_state[board_index][r][c],
        [c, r],
        board_index
    );
    if (state === "sunken_ship") {
        add_impact_strike(board_index, r, c);
        trigger_sunk_bombardment(board_index, r, c);
        playSunkSound();
        return { state: state, delay: 2200 };
    }
    if (state === "hit") {
        add_impact_strike(board_index, r, c);
        add_cell_effect(board_index, r, c, "hit-bubbles");
        playHitSound();
        return { state: state, delay: 1300 };
    }
    playMissSound();
    return { state: state, delay: 900 };
};

const player_shoot = function (c, r) {
    if (phase !== "battle" || turn !== "player" || board_locked) return;
    if (game_state[1][r][c].shot) return;

    board_locked = true;
    document.body.classList.add("board-locked");

    const result = resolve_shot(1, c, r);
    render_bot_board();
    render_hud();
    bump_score();

    if (Battleship.has_player_won(game_state[1])) {
        playWinSound();
        setTimeout(function () { end_game("player"); }, result.delay);
        return;
    }
    setTimeout(function () {
        board_locked = false;
        document.body.classList.remove("board-locked");
        bot_turn();
    }, result.delay);
};

// ── Bot AI ──
const untried = function (c, r) {
    return c >= 0 && c < width && r >= 0 && r < height &&
        !game_state[0][r][c].shot;
};

const ai_pick = function () {
    if (difficulty !== "easy") {
        while (ai_queue.length) {
            const t = ai_queue.shift();
            if (untried(t[0], t[1])) return t;
        }
    }
    let candidates = [];
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            if (!untried(c, r)) continue;
            if (difficulty === "hard" && ((r + c) % 2 !== 0)) continue;
            candidates.push([c, r]);
        }
    }
    if (candidates.length === 0) {
        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                if (untried(c, r)) candidates.push([c, r]);
            }
        }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
};

const ai_learn = function (c, r, state) {
    if (difficulty === "easy") return;
    if (state === "sunken_ship") {
        ai_hits = [];
        ai_queue = [];
        return;
    }
    if (state === "hit") {
        ai_hits.push([c, r]);
        let neighbours = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
        // Hard mode: once two hits line up, only extend along that line.
        if (difficulty === "hard" && ai_hits.length >= 2) {
            const same_row = ai_hits.every((h) => h[1] === ai_hits[0][1]);
            const same_col = ai_hits.every((h) => h[0] === ai_hits[0][0]);
            if (same_row) neighbours = neighbours.filter((n) => n[1] === r);
            else if (same_col) neighbours = neighbours.filter((n) => n[0] === c);
        }
        neighbours.forEach(function (n) {
            if (untried(n[0], n[1])) ai_queue.unshift(n);
        });
    }
};

const bot_turn = function () {
    set_turn("bot");
    render_hud();
    board_locked = true;
    document.body.classList.add("board-locked");

    setTimeout(function () {
        const target = ai_pick();
        const c = target[0];
        const r = target[1];
        const result = resolve_shot(0, c, r);
        ai_learn(c, r, result.state);
        render_player_board();
        render_hud();
        bump_score();

        if (Battleship.has_player_won(game_state[0])) {
            setTimeout(function () { end_game("bot"); }, result.delay);
            return;
        }
        setTimeout(function () {
            board_locked = false;
            document.body.classList.remove("board-locked");
            set_turn("player");
            render_hud();
        }, result.delay);
    }, 750);
};

// ==========================================================================
// 5. GAME OVER
// ==========================================================================
const end_game = function (winner) {
    phase = "over";
    board_locked = true;
    document.body.classList.remove("board-locked");

    const overlay = document.createElement("div");
    overlay.className = "screen-overlay " +
        (winner === "player" ? "overlay-orange" : "overlay-blue");

    const message = document.createElement("div");
    message.className = "overlay-message";
    message.textContent = winner === "player"
        ? "Victory! Enemy fleet destroyed."
        : "Defeat. Your fleet was sunk.";
    overlay.append(message);

    const holder = document.createElement("div");
    holder.className = "overlay-action-holder";
    const again = document.createElement("button");
    again.className = "overlay-ok-button";
    again.textContent = "Play Again";
    again.onclick = function () { window.location.reload(); };
    holder.append(again);
    overlay.append(holder);

    document.body.append(overlay);
};

// ==========================================================================
// Boot
// ==========================================================================
setup_difficulty_select();
