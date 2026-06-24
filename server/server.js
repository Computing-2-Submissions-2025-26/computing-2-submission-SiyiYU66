import express from "express";
import {createServer} from "node:http";
import {Server} from "socket.io";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import Battleship from "../web-app/BattleShip.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const http_server = createServer(app);
const io = new Server(http_server);

app.use(express.static(join(__dirname, "..", "web-app")));
app.use("/node_modules/ramda", express.static(join(__dirname, "..", "node_modules", "ramda")));

// ── Room state ────────────────────────────────────────────────────────────────

const rooms = new Map();

// Immutably removes a named ship from a board (used when a player repositions).
const remove_ship_from_board = function (board, ship_name) {
    return board.map(function (row) {
        return row.map(function (cell) {
            if (cell.shipName !== ship_name) { return cell; }
            const c = Object.assign({}, cell);
            c.ship = false;
            delete c.shipName;
            return c;
        });
    });
};

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const make_room_code = function () {
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    return rooms.has(code) ? make_room_code() : code;
};

// ── Socket events ─────────────────────────────────────────────────────────────

io.on("connection", function (socket) {
    let room_code = null;
    let seat = null;    // 0 = host (P1·orange), 1 = guest (P2·blue)

    socket.on("create_room", function () {
        room_code = make_room_code();
        seat = 0;
        rooms.set(room_code, {
            seats: [socket.id, null],
            names:  [null, null],
            ready:  [false, false],
            started: false,
            in_battle: false,
            turn: 0,
            sonar_scans_left: [2, 2],
            ghost_moves_left: [1, 1],
            boards: [Battleship.empty_board(10, 10), Battleship.empty_board(10, 10)]
        });
        socket.join(room_code);
        socket.emit("room_created", {code: room_code});
        console.log(`[room] created ${room_code}`);
    });

    socket.on("join_room", function (raw_code) {
        const code = String(raw_code).toUpperCase().trim();
        const room = rooms.get(code);

        if (!room) {
            socket.emit("join_error", {reason: "Room not found."});
            return;
        }
        if (room.seats[1] !== null) {
            socket.emit("join_error", {reason: "Room is full."});
            return;
        }

        room.seats[1] = socket.id;
        room_code = code;
        seat = 1;
        socket.join(code);
        socket.emit("room_joined", {code, seat: 1});
        io.to(code).emit("both_connected", {code});
        console.log(`[room] ${code} — both players connected`);
    });

    // ── Phase 2A: name sync ───────────────────────────────────────────────────

    socket.on("player_name", function (raw_name) {
        const room = rooms.get(room_code);
        if (!room || seat === null) { return; }
        room.names[seat] = String(raw_name).trim().slice(0, 14) || "Player " + (seat + 1);
        console.log(`[room] ${room_code} seat ${seat} named "${room.names[seat]}"`);
        if (room.names[0] && room.names[1]) {
            room.started = true;
            io.to(room_code).emit("game_start", {names: room.names});
            console.log(`[room] ${room_code} — game start: ${room.names}`);
        }
    });

    // ── Phase 2A: rejoin after page navigation ────────────────────────────────

    socket.on("rejoin_room", function (data) {
        const code = String(data && data.room || "").toUpperCase();
        const requested_seat = Number(data && data.seat);
        const room = rooms.get(code);
        if (!room) {
            socket.emit("rejoin_failed", {reason: "Room no longer exists."});
            return;
        }
        room.seats[requested_seat] = socket.id;
        room_code = code;
        seat = requested_seat;
        socket.join(code);
        socket.emit("rejoined", {code, seat: requested_seat});
        console.log(`[room] ${code} — seat ${requested_seat} rejoined`);
    });

    // ── Phase 2B-1: per-ship placement sync ──────────────────────────────────

    socket.on("place_ship", function (data) {
        const room = rooms.get(room_code);
        // Ignore after the player has already confirmed deployment.
        if (!room || seat === null || room.ready[seat]) { return; }

        const ship_name  = String(data && data.shipName || "");
        const col        = Number(data && data.col);
        const row        = Number(data && data.row);
        const orientation = (data && data.orientation === "vertical")
            ? "vertical" : "horizontal";

        // Look up the ship template so we know its length.
        const template = Battleship.ship_array.find(function (s) {
            return s.name === ship_name;
        });
        if (!template) { return; }

        const ship = Object.assign({}, template, {orientation, placed: false});

        // If the ship is already on the board the player is repositioning it —
        // clear the old position before validating the new one.
        let board = room.boards[seat];
        if (Battleship.ship_cells_by_name(board, ship_name).length > 0) {
            board = remove_ship_from_board(board, ship_name);
        }

        // Validate and place using the shared BattleShip.js engine.
        const new_board = Battleship.place_ship(board, ship, col, row);
        if (new_board === board) {
            console.log(`[room] ${room_code} seat ${seat}: rejected ${ship_name} @ (${col},${row})`);
            return;
        }

        room.boards[seat] = new_board;
        console.log(`[room] ${room_code} seat ${seat}: placed ${ship_name} @ (${col},${row}) ${orientation}`);
    });

    // ── Phase 2A: ship placement complete ────────────────────────────────────

    socket.on("placement_done", function () {
        const room = rooms.get(room_code);
        if (!room || seat === null) { return; }
        if (room.ready[seat]) {
            console.log(`[room] ${room_code} seat ${seat} placement_done ignored (already ready)`);
            return;
        }
        room.ready[seat] = true;
        console.log(`[room] ${room_code} seat ${seat} placement done`);
        if (room.ready[0] && room.ready[1]) {
            if (room.in_battle) {
                console.log(`[room] ${room_code} battle_ready suppressed (already in_battle)`);
                return;
            }
            room.in_battle = true;
            const b0_ships = room.boards[0].flat().filter(function (c) { return c && c.ship; }).length;
            const b1_ships = room.boards[1].flat().filter(function (c) { return c && c.ship; }).length;
            console.log(`[room] ${room_code} — emitting battle_ready`, {
                board0_ship_cells: b0_ships,
                board1_ship_cells: b1_ships,
                payload_keys: Object.keys({boards: room.boards})
            });
            io.to(room_code).emit("battle_ready", {boards: room.boards});
            console.log(`[room] ${room_code} — battle ready`);
        }
    });

    // ── Phase 2C-1: standard-fire shot ───────────────────────────────────────

    socket.on("shoot", function (data) {
        const room = rooms.get(room_code);
        if (!room || seat === null || !room.in_battle) { return; }
        if (room.turn % 2 !== seat) { return; }

        const col = Number(data && data.col);
        const row = Number(data && data.row);
        if (!Number.isFinite(col) || col < 0 || col > 9) { return; }
        if (!Number.isFinite(row) || row < 0 || row > 9) { return; }

        const enemy_board_idx = 1 - seat;
        const enemy_board = room.boards[enemy_board_idx];
        const target_cell = enemy_board[row] && enemy_board[row][col];
        if (!target_cell || target_cell.shot) { return; }

        const had_ship = Battleship.is_ship_here(target_cell);
        const ship_name = had_ship ? target_cell.shipName : null;
        const new_board = Battleship.shoot_cell(enemy_board, [col, row]);
        room.boards[enemy_board_idx] = new_board;

        const sunk_ship = (ship_name && Battleship.is_ship_sunk_by_name(new_board, ship_name))
            ? ship_name : null;
        const won = Battleship.has_player_won(new_board);

        room.turn += 1;

        io.to(room_code).emit("shot_result", {
            shooter_seat: seat,
            col,
            row,
            hit: had_ship,
            sunk_ship,
            won,
            next_turn: room.turn
        });

        console.log(
            `[room] ${room_code} seat ${seat} shot (${col},${row})` +
            ` ${had_ship ? "HIT" : "MISS"}` +
            `${sunk_ship ? " SUNK:" + sunk_ship : ""}` +
            `${won ? " — WON" : ""}`
        );
    });

    // ── Phase 2C-2: sonar scan ────────────────────────────────────────────────

    socket.on("sonar", function (data) {
        const room = rooms.get(room_code);
        if (!room || seat === null || !room.in_battle) { return; }
        if (room.turn % 2 !== seat) {
            console.log(`[sonar] ${room_code} seat ${seat} REJECTED — not their turn (turn=${room.turn})`);
            return;
        }
        if (room.sonar_scans_left[seat] <= 0) {
            console.log(`[sonar] ${room_code} seat ${seat} REJECTED — no scans left`);
            return;
        }

        const col = Number(data && data.col);
        const row = Number(data && data.row);
        if (!Number.isFinite(col) || col < 0 || col > 9) { return; }
        if (!Number.isFinite(row) || row < 0 || row > 9) { return; }

        room.sonar_scans_left[seat] -= 1;
        room.turn += 1;

        console.log(
            `[sonar] ${room_code} seat ${seat} scanned (${col},${row})` +
            ` scans_left=[${room.sonar_scans_left}] next_turn=${room.turn}`
        );

        io.to(room_code).emit("sonar_result", {
            shooter_seat: seat,
            col,
            row,
            next_turn: room.turn
        });
    });

    // ── Phase 2C-3: ghost slide (damaged ship 1–2 tile escape) ───────────────

    socket.on("ghost_slide", function (data) {
        const room = rooms.get(room_code);
        if (!room || seat === null || !room.in_battle) { return; }
        if (room.turn % 2 !== seat) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_slide — not their turn`);
            return;
        }
        if (room.ghost_moves_left[seat] <= 0) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_slide — no moves left`);
            return;
        }

        const ship_name = String(data && data.ship_name || "");
        const direction = String(data && data.direction || "");
        const distance  = Number(data && data.distance);

        const valid_ship = Battleship.ship_array.some(function (s) { return s.name === ship_name; });
        if (!valid_ship) { return; }
        if (!["up", "down", "left", "right"].includes(direction)) { return; }
        if (distance !== 1 && distance !== 2) { return; }

        const own_board = room.boards[seat];
        if (Battleship.ship_cells_by_name(own_board, ship_name).length === 0) { return; }
        if (Battleship.is_ship_sunk_by_name(own_board, ship_name)) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_slide — ship sunk`);
            return;
        }
        if (!Battleship.is_ship_damaged(own_board, ship_name)) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_slide — ship not damaged`);
            return;
        }

        const new_board = Battleship.ghost_slide(own_board, ship_name, direction, distance);
        if (new_board === own_board) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_slide — move blocked`);
            return;
        }

        room.boards[seat] = new_board;
        room.ghost_moves_left[seat] -= 1;
        room.turn += 1;

        console.log(
            `[ghost] ${room_code} seat ${seat} slid ${ship_name} ${direction}×${distance}` +
            ` moves_left=[${room.ghost_moves_left}] next_turn=${room.turn}`
        );

        io.to(room_code).emit("ghost_slide_result", {
            shooter_seat: seat,
            ship_name,
            direction,
            distance,
            next_turn: room.turn,
            ghost_moves_left: room.ghost_moves_left.slice()
        });
    });

    // ── Phase 2C-3: ghost relocate (intact ship teleport) ────────────────────

    socket.on("ghost_relocate", function (data) {
        const room = rooms.get(room_code);
        if (!room || seat === null || !room.in_battle) { return; }
        if (room.turn % 2 !== seat) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_relocate — not their turn`);
            return;
        }
        if (room.ghost_moves_left[seat] <= 0) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_relocate — no moves left`);
            return;
        }

        const ship_name   = String(data && data.ship_name || "");
        const anchor_col  = Number(data && data.anchor_col);
        const anchor_row  = Number(data && data.anchor_row);
        const orientation = (data && data.orientation === "vertical") ? "vertical" : "horizontal";

        const valid_ship = Battleship.ship_array.some(function (s) { return s.name === ship_name; });
        if (!valid_ship) { return; }
        if (!Number.isFinite(anchor_col) || anchor_col < 0 || anchor_col > 9) { return; }
        if (!Number.isFinite(anchor_row) || anchor_row < 0 || anchor_row > 9) { return; }

        const own_board = room.boards[seat];
        const ship_len = Battleship.ship_cells_by_name(own_board, ship_name).length;
        if (ship_len === 0) { return; }
        if (Battleship.is_ship_sunk_by_name(own_board, ship_name)) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_relocate — ship sunk`);
            return;
        }
        if (Battleship.is_ship_damaged(own_board, ship_name)) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_relocate — ship damaged`);
            return;
        }

        const cells = Battleship.relocate_footprint([anchor_col, anchor_row], ship_len, orientation);
        if (!Battleship.relocate_valid(own_board, cells, ship_name)) {
            console.log(`[ghost] ${room_code} seat ${seat} REJECTED ghost_relocate — invalid footprint`);
            return;
        }

        room.boards[seat] = Battleship.apply_ghost_relocate(own_board, ship_name, cells);
        room.ghost_moves_left[seat] -= 1;
        room.turn += 1;

        console.log(
            `[ghost] ${room_code} seat ${seat} teleported ${ship_name} to` +
            ` (${anchor_col},${anchor_row}) ${orientation}` +
            ` moves_left=[${room.ghost_moves_left}] next_turn=${room.turn}`
        );

        io.to(room_code).emit("ghost_relocate_result", {
            shooter_seat: seat,
            ship_name,
            anchor_col,
            anchor_row,
            orientation,
            next_turn: room.turn,
            ghost_moves_left: room.ghost_moves_left.slice()
        });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    socket.on("disconnect", function (reason) {
    console.log(`[disconnect] seat=${seat} room=${room_code} reason="${reason}"`);
    if (!room_code) { return; }
    const room = rooms.get(room_code);
    if (!room) { room_code = null; seat = null; return; }

    // Ignore stale socket disconnects.
    // A newer socket has already taken over this seat.
    if (room.seats[seat] !== socket.id) {
        room_code = null;
        seat = null;
        return;
    }

    if (room.started && !room.in_battle) {
        // Page navigation in progress — keep room alive for the rejoin
        room.seats[seat] = null;
        console.log(`[room] ${room_code} seat ${seat} temp-disconnected (started)`);
    } else {
        socket.to(room_code).emit("opponent_left");
        rooms.delete(room_code);
        console.log(`[room] ${room_code} closed (disconnect${room.in_battle ? " during battle" : ""})`);
    }
    room_code = null;
    seat = null;
    });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
http_server.listen(PORT, function () {
    console.log(`\nBattleship server → http://localhost:${PORT}\n`);
});
