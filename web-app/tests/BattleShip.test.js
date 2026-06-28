/*global structuredClone*/
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
            board_from(new Array(10).fill(".".repeat(10)))
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

    it("returns the board untouched when the cell was already shot",
            function () {
        const board = board_from(["..", "o."]);
        assert.equal(Battleship.shoot_cell(board, [0, 1]), board);
    });

    it("does not mutate the board it is given", function () {
        const board = board_from(["..", ".."]);
        Battleship.shoot_cell(board, [0, 0]);
        assert.deepEqual(board, board_from(["..", ".."]));
    });

    it("marks a ship cell as shot while keeping the ship present", function () {
        const board = board_from(["SS"], "patrol");
        const result = Battleship.shoot_cell(board, [0, 0]);
        assert.equal(result[0][0].shot, true);
        assert.equal(result[0][0].ship, true);
    });
});

// ===========================================================================
describe("cell_state", function () {
    it("reports an un-shot cell as \"unshot\"", function () {
        const board = board_from(["S."]);
        assert.equal(
            Battleship.cell_state(board, board[0][0], [0, 0]),
            "unshot"
        );
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

    it(
        "reports a shot cell with no shipName as \"sunken_ship\"" +
        " (single-cell fallback)",
        function () {
        // When a ship has no name the engine falls back to checking only
        // that one cell — a shot unnamed ship cell is considered sunk.
        const board = board_from(["X."]);  // no ship_name → no shipName
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

    it("is true on a board with no ships at all (vacuous win)", function () {
        // All-water board — every() over an empty ship set is vacuously true.
        // Callers are responsible for ensuring ships exist before checking.
        assert.equal(Battleship.has_player_won(Battleship.empty_board()), true);
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

    it("leaves a previous hit behind as a miss and arrives un-shot",
            function () {
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
        board = Battleship.place_ship(
            board, make_ship("b", 2, "horizontal"), 0, 1
        );
        assert.equal(Battleship.move_ship(board, "a", "down"), board);
    });

    it("ignores a request to move a ship that is not on the board",
            function () {
        const board = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("a", 2, "horizontal"), 0, 0
        );
        assert.equal(Battleship.move_ship(board, "ghost", "down"), board);
    });

    it("ignores an unrecognised direction string", function () {
        const board = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("a", 2, "horizontal"), 0, 0
        );
        assert.equal(Battleship.move_ship(board, "a", "diagonal"), board);
    });

    it("does not mutate the board it is given", function () {
        const before = Battleship.place_ship(
            Battleship.empty_board(3, 3),
            make_ship("a", 2, "horizontal"), 0, 0
        );
        const snapshot = board_from(["SS.", "...", "..."], "a");
        Battleship.move_ship(before, "a", "down");
        assert.deepEqual(before, snapshot);
    });
});

// ===========================================================================
// ship repositioning (pickup + re-place)
// ---------------------------------------------------------------------------
// Repositioning is a two-step operation used in the placement phase:
//   1. pickup  — remove the ship from the board, reset ship.placed = false
//   2. place_ship — put it down at the new location
//
// The game UI validates the new position BEFORE calling pickup, so an invalid
// target never causes the old placement to be lost.
// ===========================================================================
describe("ship repositioning (pickup + re-place)", function () {
    // Mirrors the UI's pickup_ship: wipes the ship from the board so
    // place_ship will accept it again at a new location.
    const pickup = function (board, ship) {
        return board.map(function (row) {
            return row.map(function (cell) {
                if (cell.shipName !== ship.name) { return cell; }
                const c = Object.assign({}, cell);
                c.ship = false;
                delete c.shipName;
                return c;
            });
        });
    };

    it("clears the original cells after pickup and re-place", function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const placed = Battleship.place_ship(
            Battleship.empty_board(4, 4), ship, 0, 0
        );
        const picked = pickup(placed, ship);
        const moved  = Battleship.place_ship(picked, ship, 0, 2);

        // Original row 0 must now be empty water.
        assert.equal(Battleship.is_ship_here(moved[0][0]), false);
        assert.equal(Battleship.is_ship_here(moved[0][1]), false);
    });

    it("occupies the new cells after re-placement", function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const placed = Battleship.place_ship(
            Battleship.empty_board(4, 4), ship, 0, 0
        );
        const picked = pickup(placed, ship);
        const moved  = Battleship.place_ship(picked, ship, 0, 2);

        assert.equal(moved[2][0].ship, true);
        assert.equal(moved[2][0].shipName, "patrol");
        assert.equal(moved[2][1].ship, true);
        assert.equal(moved[2][1].shipName, "patrol");
    });

    it("ship cells exist only at the new position, not at both old and new",
            function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const placed = Battleship.place_ship(
            Battleship.empty_board(4, 4), ship, 0, 0
        );
        const picked = pickup(placed, ship);
        const moved  = Battleship.place_ship(picked, ship, 0, 2);

        let total = 0;
        moved.forEach(function (row) {
            row.forEach(function (cell) {
                if (cell.ship) { total += 1; }
            });
        });
        assert.equal(total, ship.length);   // exactly 2 cells, not 4
    });

    it("preserves the original placement when the new position is invalid",
            function () {
        // The game checks validity BEFORE calling pickup, so an invalid target
        // means pickup is never called and ship.placed stays true.  Calling
        // place_ship on an already-placed ship is the engine's own guard:
        // it returns the board unchanged.
        const ship    = make_ship("patrol", 2, "horizontal");
        const blocker = make_ship("wall",   2, "horizontal");
        let board = Battleship.place_ship(
            Battleship.empty_board(4, 4), ship, 0, 0
        );
        board     = Battleship.place_ship(board, blocker, 0, 2);

        // No pickup called → ship is still on the board → place_ship rejects.
        const result = Battleship.place_ship(board, ship, 0, 2);
        assert.equal(result, board);            // same reference, unchanged
        assert.equal(board[0][0].shipName, "patrol"); // patrol still at orig
        assert.equal(board[0][1].shipName, "patrol");
        assert.equal(board[2][0].shipName, "wall"); // blocker also untouched
    });
});

// ===========================================================================
describe("is_ship_placed", function () {
    const placed_board = board_from(["SS"], "destroyer");
    const bare_board = Battleship.empty_board(2, 1);

    it("is true when the ship occupies cells on the board", function () {
        assert.equal(
            Battleship.is_ship_placed("destroyer", placed_board),
            true
        );
    });

    it("is false when the ship is absent from the board", function () {
        assert.equal(Battleship.is_ship_placed("destroyer", bare_board), false);
    });

    it("is false when only a different ship occupies the board", function () {
        const cruiser_board = board_from(["SS"], "cruiser");
        assert.equal(
            Battleship.is_ship_placed("destroyer", cruiser_board),
            false
        );
    });
});

// ===========================================================================
// count_ships_in_area  (sonar scan logic)
// ---------------------------------------------------------------------------
// Counts ship cells in the 3×3 area centred on a given coordinate.
// Cells outside the board are ignored (edge clipping).
// ===========================================================================
describe("count_ships_in_area", function () {
    it("returns 0 when there are no ships near the target cell", function () {
        // Ship is in the bottom-left corner; scan is in the top-right corner.
        const ship = make_ship("a", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 4
        );
        assert.equal(Battleship.count_ships_in_area(board, 4, 0), 0);
    });

    it("counts every ship cell that falls inside the 3×3 area", function () {
        // 3-cell cruiser across cols 0-2, row 2; scan centre (1, 2) covers all.
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5),
            make_ship("cruiser", 3, "horizontal"), 0, 2
        );
        assert.equal(Battleship.count_ships_in_area(board, 1, 2), 3);
    });

    it("clips the scan area at the board edge (corner case)", function () {
        // Ship at top-left corner (0,0) and (1,0); scanning centre (0,0)
        // gives only a 2×2 in-bounds area — both ship cells are in it.
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5),
            make_ship("a", 2, "horizontal"), 0, 0
        );
        assert.equal(Battleship.count_ships_in_area(board, 0, 0), 2);
    });

    it("counts cells from two different ships that both fall in the scan area",
            function () {
        // Ship A at row 1 (cols 0-1), ship B at row 3 (cols 0-1).
        // Scanning centre (0, 2) covers rows 1-3, cols 0-1 → 4 cells total.
        const ship_a = make_ship("a", 2, "horizontal");
        const ship_b = make_ship("b", 2, "horizontal");
        let board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship_a, 0, 1
        );
        board     = Battleship.place_ship(board, ship_b, 0, 3);
        assert.equal(Battleship.count_ships_in_area(board, 0, 2), 4);
    });

    it(
        "does not count ghost-scar cells (ship moved away, history remains)",
        function () {
        // A ghost scar is {ship: false, shot: true} — "o" in board_from.
        // The scan must ignore it because is_ship_here returns false.
        const board = board_from(["o..", "...", "..."]);
        assert.equal(Battleship.count_ships_in_area(board, 0, 0), 0);
    });

    it(
        "counts the ship at its new position after a ghost move, not old one",
        function () {
        // Simulate post-ghost-move state:
        //   row 0 → ghost scars ("o" = ship: false, shot: true)
        //   row 2 → ship at new position ("S" = ship: true, shot: false)
        const board = board_from([
            "oo.",   // old position: ghost scars
            "...",
            "SS."    // new position: ship
        ], "patrol");

        // Scan centred on old position — should find nothing.
        assert.equal(Battleship.count_ships_in_area(board, 1, 0), 0);
        // Scan centred on new position — should find both ship cells.
        assert.equal(Battleship.count_ships_in_area(board, 1, 2), 2);
    });
});

// ===========================================================================
// ship_cells_by_name
// ===========================================================================
describe("ship_cells_by_name", function () {
    it("returns an empty array when the ship is not on the board", function () {
        assert.deepEqual(
            Battleship.ship_cells_by_name(
                Battleship.empty_board(5, 5), "ghost"
            ),
            []
        );
    });

    it("returns the correct [col, row] pairs for a horizontal ship",
            function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 1, 3
        );
        assert.deepEqual(
            Battleship.ship_cells_by_name(board, "patrol"),
            [[1, 3], [2, 3]]
        );
    });

    it("returns the correct [col, row] pairs for a vertical ship", function () {
        const ship = make_ship("patrol", 3, "vertical");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 2, 0
        );
        assert.deepEqual(
            Battleship.ship_cells_by_name(board, "patrol"),
            [[2, 0], [2, 1], [2, 2]]
        );
    });
});

// ===========================================================================
// is_ship_sunk_by_name
// ===========================================================================
describe("is_ship_sunk_by_name", function () {
    it("is false when the ship is not on the board", function () {
        assert.equal(
            Battleship.is_ship_sunk_by_name(
                Battleship.empty_board(5, 5), "ghost"
            ),
            false
        );
    });

    it("is false when the ship has no hits at all", function () {
        const board = board_from(["SS."], "patrol");
        assert.equal(Battleship.is_ship_sunk_by_name(board, "patrol"), false);
    });

    it("is false when the ship is only partially hit", function () {
        const board = board_from(["XS."], "patrol");
        assert.equal(Battleship.is_ship_sunk_by_name(board, "patrol"), false);
    });

    it("is true when every cell of the ship has been shot", function () {
        const board = board_from(["XX."], "patrol");
        assert.equal(Battleship.is_ship_sunk_by_name(board, "patrol"), true);
    });
});

// ===========================================================================
// is_ship_damaged
// ===========================================================================
describe("is_ship_damaged", function () {
    it("is false when the ship is not on the board", function () {
        assert.equal(
            Battleship.is_ship_damaged(Battleship.empty_board(5, 5), "ghost"),
            false
        );
    });

    it("is false when the ship is fully intact (no hits)", function () {
        const board = board_from(["SSS"], "cruiser");
        assert.equal(Battleship.is_ship_damaged(board, "cruiser"), false);
    });

    it("is true when the ship has at least one hit cell", function () {
        const board = board_from(["XSS"], "cruiser");
        assert.equal(Battleship.is_ship_damaged(board, "cruiser"), true);
    });

    it("is true even when every cell is hit (sunk ships are also damaged)",
            function () {
        const board = board_from(["XXX"], "cruiser");
        assert.equal(Battleship.is_ship_damaged(board, "cruiser"), true);
    });
});

// ===========================================================================
// ghost_slide  (multi-step all-or-nothing slide)
// ===========================================================================
describe("ghost_slide", function () {
    it("moves the ship one tile in the given direction", function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 0
        );
        const moved = Battleship.ghost_slide(board, "patrol", "down", 1);
        assert.equal(Battleship.is_ship_here(moved[1][0]), true);
        assert.equal(Battleship.is_ship_here(moved[0][0]), false);
    });

    it(
        "returns the original board when the slide is blocked by the edge",
        function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 0
        );
        const result = Battleship.ghost_slide(board, "patrol", "up", 1);
        assert.equal(result, board);
    });

    it("returns the original board when the ship is sunk", function () {
        const board = board_from(["XX."], "patrol");
        const result = Battleship.ghost_slide(board, "patrol", "right", 1);
        assert.equal(result, board);
    });

    it("slides two tiles when both steps are clear", function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 0
        );
        const moved = Battleship.ghost_slide(board, "patrol", "down", 2);
        assert.equal(Battleship.is_ship_here(moved[2][0]), true);
        assert.equal(Battleship.is_ship_here(moved[0][0]), false);
    });

    it("returns original board if the second step of a 2-tile slide is blocked",
            function () {
        // patrol at row 0, wall at row 2 — one step down is fine, two blocked.
        const ship   = make_ship("patrol", 2, "horizontal");
        const wall   = make_ship("wall",   2, "horizontal");
        let board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 0
        );
        board     = Battleship.place_ship(board, wall, 0, 2);
        const result = Battleship.ghost_slide(board, "patrol", "down", 2);
        assert.equal(result, board);
    });

    it("does not mutate the input board", function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 0
        );
        const snapshot = structuredClone(board);
        Battleship.ghost_slide(board, "patrol", "down", 1);
        assert.deepEqual(board, snapshot);
    });
});

// ===========================================================================
// infer_ship_orientation
// ===========================================================================
describe("infer_ship_orientation", function () {
    it("returns horizontal for a single cell", function () {
        assert.equal(Battleship.infer_ship_orientation([[2, 3]]), "horizontal");
    });

    it("returns horizontal when cells share the same row", function () {
        assert.equal(
            Battleship.infer_ship_orientation([[0, 1], [1, 1], [2, 1]]),
            "horizontal"
        );
    });

    it("returns vertical when cells share the same column", function () {
        assert.equal(
            Battleship.infer_ship_orientation([[3, 0], [3, 1], [3, 2]]),
            "vertical"
        );
    });
});

// ===========================================================================
// relocate_footprint
// ===========================================================================
describe("relocate_footprint", function () {
    it("produces the correct horizontal footprint", function () {
        assert.deepEqual(
            Battleship.relocate_footprint([2, 1], 3, "horizontal"),
            [[2, 1], [3, 1], [4, 1]]
        );
    });

    it("produces the correct vertical footprint", function () {
        assert.deepEqual(
            Battleship.relocate_footprint([1, 0], 3, "vertical"),
            [[1, 0], [1, 1], [1, 2]]
        );
    });
});

// ===========================================================================
// relocate_valid
// ===========================================================================
describe("relocate_valid", function () {
    it("is true when all target cells are empty unshot water", function () {
        const cells = [[0, 0], [1, 0]];
        assert.equal(
            Battleship.relocate_valid(
                Battleship.empty_board(5, 5), cells, "patrol"
            ),
            true
        );
    });

    it("is false when a target cell is occupied by another ship", function () {
        const blocker = make_ship("wall", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), blocker, 0, 0
        );
        assert.equal(
            Battleship.relocate_valid(board, [[0, 0], [1, 0]], "patrol"),
            false
        );
    });

    it("is false when a target cell is out of bounds", function () {
        assert.equal(
            Battleship.relocate_valid(
                Battleship.empty_board(5, 5), [[-1, 0], [0, 0]], "patrol"
            ),
            false
        );
    });

    it("is false when a target cell was previously shot (miss)", function () {
        const board = board_from(["o...."], "");
        assert.equal(
            Battleship.relocate_valid(board, [[0, 0]], "patrol"),
            false
        );
    });

    it("is true when overlapping the moving ship's own un-shot cells",
            function () {
        // Ship at (0,0)-(1,0); relocating to (0,0)-(1,0) is same spot — valid.
        const ship = make_ship("patrol", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 0
        );
        assert.equal(
            Battleship.relocate_valid(board, [[0, 0], [1, 0]], "patrol"),
            true
        );
    });
});

// ===========================================================================
// apply_ghost_relocate
// ===========================================================================
describe("apply_ghost_relocate", function () {
    it("places the ship at the new cells with shot: false", function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 0
        );
        const result = Battleship.apply_ghost_relocate(
            board, "patrol", [[0, 2], [1, 2]]
        );
        assert.equal(result[2][0].ship, true);
        assert.equal(result[2][0].shipName, "patrol");
        assert.equal(result[2][0].shot, false);
        assert.equal(result[2][1].ship, true);
    });

    it("clears the old cells (ship removed, shot flag preserved)", function () {
        // Start with a hit on the ship, then relocate.
        const board = board_from(["XS."], "patrol");
        const result = Battleship.apply_ghost_relocate(
            board, "patrol", [[0, 0], [1, 0]]
        );
        // After relocate to same spot: cells reset to ship: true, shot: false.
        // But if we relocate to a DIFFERENT spot:
        const board2 = board_from(["XS.", "...", "..."], "patrol");
        const moved  = Battleship.apply_ghost_relocate(
            board2, "patrol", [[0, 2], [1, 2]]
        );
        // Old row 0: ship cells cleared; hit cell keeps shot: true (scar).
        assert.equal(moved[0][0].ship, false);
        assert.equal(moved[0][0].shot, true);   // scar preserved
        assert.equal(moved[0][1].ship, false);
    });

    it("does not mutate the input board", function () {
        const ship = make_ship("patrol", 2, "horizontal");
        const board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 0
        );
        Battleship.apply_ghost_relocate(board, "patrol", [[0, 2], [1, 2]]);
        assert.equal(board[0][0].ship, true);   // original untouched
    });

    it("leaves all other ships untouched", function () {
        const ship    = make_ship("patrol", 2, "horizontal");
        const other   = make_ship("other",  2, "horizontal");
        let board = Battleship.place_ship(
            Battleship.empty_board(5, 5), ship, 0, 0
        );
        board     = Battleship.place_ship(board, other, 0, 4);
        const result = Battleship.apply_ghost_relocate(
            board, "patrol", [[0, 2], [1, 2]]
        );
        assert.equal(result[4][0].shipName, "other");
        assert.equal(result[4][1].shipName, "other");
    });
});
