import assert from "node:assert/strict";
import Battleship from "../BattleShip.js";

// ===========================================================================
// Test fixtures
// ---------------------------------------------------------------------------
// Boards are described with a small ASCII map so each fixture reads like the
// grid it represents. One character per cell:
//     "."  water, untouched          "o"  water that has been shot (a miss)
//     "S"  ship, untouched           "X"  ship that has been shot (a hit)
// A `ship_name` may be supplied so ship cells carry the same identity the
// engine assigns them — this is what sunk-detection reads.
// ===========================================================================
const board_from = function (rows, ship_name) {
    return rows.map(function (row) {
        return row.split("").map(function (symbol) {
            const is_ship = symbol === "S" || symbol === "X";
            const cell = {
                "ship": is_ship,
                "shot": symbol === "X" || symbol === "o"
            };
            if (is_ship && ship_name !== undefined) {
                cell.shipName = ship_name;
            }
            return cell;
        });
    });
};

// A fresh, mutable ship descriptor. place_ship flips its `placed` flag, so a
// new object is handed to every test that needs one.
const make_ship = function (name, length, orientation) {
    return {
        "name": name,
        "length": length,
        "orientation": orientation || "horizontal",
        "placed": false
    };
};

// ===========================================================================
describe("empty_board", function () {
    it("defaults to a 10x10 grid of empty water", function () {
        const board = Battleship.empty_board();
        assert.equal(board.length, 10);
        assert.equal(board[0].length, 10);
        assert.deepEqual(
            board,
            board_from(Array(10).fill(".".repeat(10)))
        );
    });

    it("honours an explicit width and height", function () {
        assert.deepEqual(
            Battleship.empty_board(2, 3),
            board_from(["..", "..", ".."])
        );
    });
});

// ===========================================================================
describe("is_ship_here", function () {
    it("is false for a cell with no ship", function () {
        assert.equal(
            Battleship.is_ship_here({"ship": false, "shot": false}),
            false
        );
    });

    it("is true for a cell containing a ship", function () {
        assert.equal(
            Battleship.is_ship_here({"ship": true, "shot": false}),
            true
        );
    });
});

// ===========================================================================
describe("place_ship", function () {
    it("places a horizontal ship and records its footprint", function () {
        const ship = make_ship("destroyer", 2, "horizontal");
        const result = Battleship.place_ship(
            Battleship.empty_board(3, 3), ship, 0, 1
        );
        assert.deepEqual(
            result,
            board_from(["...", "SS.", "..."], "destroyer")
        );
        assert.equal(ship.placed, true);
    });

    it("places a vertical ship and records its footprint", function () {
        const ship = make_ship("submarine", 2, "vertical");
        const result = Battleship.place_ship(
            Battleship.empty_board(3, 3), ship, 1, 1
        );
        assert.deepEqual(
            result,
            board_from(["...", ".S.", ".S."], "submarine")
        );
    });

    it("tags occupied cells with the ship's name", function () {
        const result = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("cruiser", 3, "horizontal"),
            0, 0
        );
        assert.equal(result[0][0].shipName, "cruiser");
        assert.equal(result[0][2].shipName, "cruiser");
    });

    it("does not tag cells when the ship has no name", function () {
        const result = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship(undefined, 2, "horizontal"),
            0, 0
        );
        assert.deepEqual(result[0][0], {"ship": true, "shot": false});
        assert.equal(Object.hasOwn(result[0][0], "shipName"), false);
    });

    it("rejects a horizontal ship that runs off the board", function () {
        const board = Battleship.empty_board(3, 3);
        const result = Battleship.place_ship(
            board, make_ship("cruiser", 3, "horizontal"), 1, 0
        );
        assert.equal(result, board); // unchanged, same reference
    });

    it("rejects a vertical ship that runs off the board", function () {
        const board = Battleship.empty_board(3, 3);
        const result = Battleship.place_ship(
            board, make_ship("cruiser", 3, "vertical"), 0, 1
        );
        assert.equal(result, board);
    });

    it("rejects a ship that overlaps an existing ship", function () {
        const board = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("a", 2, "horizontal"), 0, 0
        );
        const result = Battleship.place_ship(
            board, make_ship("b", 2, "horizontal"), 0, 0
        );
        assert.equal(result, board);
    });

    it("rejects a ship that has already been placed", function () {
        const ship = make_ship("a", 2, "horizontal");
        const once = Battleship.place_ship(
            Battleship.empty_board(3, 3), ship, 0, 0
        );
        const twice = Battleship.place_ship(once, ship, 0, 2);
        assert.equal(twice, once);
    });

    it("returns the board untouched when no ship is supplied", function () {
        const board = Battleship.empty_board(3, 3);
        assert.equal(Battleship.place_ship(board, undefined, 0, 0), board);
    });

    it("does not mutate the board it is given", function () {
        const board = Battleship.empty_board(3, 3);
        Battleship.place_ship(board, make_ship("a", 2, "horizontal"), 0, 0);
        assert.deepEqual(board, board_from(["...", "...", "..."]));
    });
});

// ===========================================================================
describe("shoot_cell", function () {
    it("marks an un-shot cell as shot", function () {
        const result = Battleship.shoot_cell(board_from(["..", ".."]), [0, 1]);
        assert.deepEqual(result, board_from(["..", "o."]));
    });

    it("returns the board untouched when the cell was already shot", function () {
        const board = board_from(["..", "o."]);
        assert.equal(Battleship.shoot_cell(board, [0, 1]), board);
    });

    it("does not mutate the board it is given", function () {
        const board = board_from(["..", ".."]);
        Battleship.shoot_cell(board, [0, 0]);
        assert.deepEqual(board, board_from(["..", ".."]));
    });
});

// ===========================================================================
describe("cell_state", function () {
    it("reports an un-shot cell as \"unshot\"", function () {
        const board = board_from(["S."]);
        assert.equal(Battleship.cell_state(board, board[0][0], [0, 0]), "unshot");
    });

    it("reports a shot empty cell as \"miss\"", function () {
        const board = board_from(["o."]);
        assert.equal(Battleship.cell_state(board, board[0][0], [0, 0]), "miss");
    });

    it("reports a hit on a still-floating ship as \"hit\"", function () {
        const board = board_from(["XS"], "cruiser");
        assert.equal(Battleship.cell_state(board, board[0][0], [0, 0]), "hit");
    });

    it("reports the killing blow as \"sunken_ship\"", function () {
        const board = board_from(["XX"], "cruiser");
        assert.equal(
            Battleship.cell_state(board, board[0][0], [0, 0]),
            "sunken_ship"
        );
    });
});

// ===========================================================================
describe("has_player_won", function () {
    it("is true once every ship cell has been shot", function () {
        assert.equal(
            Battleship.has_player_won(board_from(["X.", "X.", "XX"])),
            true
        );
    });

    it("is false while any ship cell is still afloat", function () {
        assert.equal(
            Battleship.has_player_won(board_from(["X.", "S.", "XX"])),
            false
        );
    });
});

// ===========================================================================
describe("move_ship", function () {
    it("shifts the ship one cell in the chosen direction", function () {
        const board = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("patrol", 2, "horizontal"), 0, 0
        );
        assert.deepEqual(
            Battleship.move_ship(board, "patrol", "down"),
            board_from(["...", "SS.", "..."], "patrol")
        );
    });

    it("leaves a previous hit behind as a miss and arrives un-shot", function () {
        let board = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("patrol", 2, "horizontal"), 0, 0
        );
        board = Battleship.shoot_cell(board, [0, 0]); // hit the bow
        assert.deepEqual(
            Battleship.move_ship(board, "patrol", "down"),
            board_from(["o..", "SS.", "..."], "patrol")
        );
    });

    it("refuses to move a ship off the board", function () {
        const board = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("patrol", 2, "horizontal"), 0, 0
        );
        assert.equal(Battleship.move_ship(board, "patrol", "up"), board);
    });

    it("refuses to move a ship into a different ship", function () {
        let board = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("a", 2, "horizontal"), 0, 0
        );
        board = Battleship.place_ship(board, make_ship("b", 2, "horizontal"), 0, 1);
        assert.equal(Battleship.move_ship(board, "a", "down"), board);
    });

    it("ignores a request to move a ship that is not on the board", function () {
        const board = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("a", 2, "horizontal"), 0, 0
        );
        assert.equal(Battleship.move_ship(board, "ghost", "down"), board);
    });
});

// ===========================================================================
describe("is_ship_placed", function () {
    const fleets = function (board0_placed, board1_placed) {
        return [
            [{"name": "destroyer", "length": 2, "orientation": "horizontal", "placed": board0_placed}],
            [{"name": "destroyer", "length": 2, "orientation": "horizontal", "placed": board1_placed}]
        ];
    };

    it("is true when that fleet's ship is placed", function () {
        assert.equal(Battleship.is_ship_placed("destroyer", fleets(true, false), 0), true);
    });

    it("is false when that fleet's ship is not placed", function () {
        assert.equal(Battleship.is_ship_placed("destroyer", fleets(false, false), 0), false);
    });

    it("inspects the requested board, not the opponent's", function () {
        assert.equal(Battleship.is_ship_placed("destroyer", fleets(false, true), 0), false);
    });
});
