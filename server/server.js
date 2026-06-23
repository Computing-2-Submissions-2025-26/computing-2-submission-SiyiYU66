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
        room.ready[seat] = true;
        console.log(`[room] ${room_code} seat ${seat} placement done`);
        if (room.ready[0] && room.ready[1]) {
            io.to(room_code).emit("battle_ready");
            console.log(`[room] ${room_code} — battle ready`);
        }
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    socket.on("disconnect", function () {
        if (!room_code) { return; }
        const room = rooms.get(room_code);
        if (!room) { room_code = null; seat = null; return; }

        if (room.started) {
            // Page navigation in progress — keep room alive for the rejoin
            room.seats[seat] = null;
            console.log(`[room] ${room_code} seat ${seat} temp-disconnected (started)`);
        } else {
            socket.to(room_code).emit("opponent_left");
            rooms.delete(room_code);
            console.log(`[room] ${room_code} closed (disconnect)`);
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
