import R from "./ramda.js";

/**
 * @namespace Battleship
 * @description A pure-functional engine for the classic Battleship board game.
 * The board is the single source of truth: a ship's identity and footprint are
 * read directly from the cells (via {@link Battleship.cell|cell.shipName}),
 * so every operation depends only on its arguments — there is no hidden
 * module state to keep in sync.
 * @see https://en.wikipedia.org/wiki/Battleship_(game)
 * @author Siyi Yu
 * @version 2026
 */
const Battleship = Object.create(null);

/**
 * @memberof Battleship
 * @typedef {Object} cell
 * @property {boolean} ship Whether a ship occupies this square
 * @property {boolean} shot Whether this square has been fired upon
 * @property {string} [shipName] Identity of the occupying ship, if any
 */

/**
 * @memberof Battleship
 * @typedef {Battleship.cell[][]} Board
 * @description 2-D grid; outer array = rows, inner array = columns.
 */

/**
 * @memberof Battleship
 * @typedef {Object} Ship
 * @property {string} name
 * @property {number} length
 * @property {("horizontal"|"vertical")} orientation
 * @property {boolean} placed
 */

// ===========================================================================
// 1. FLEET DATA
// ===========================================================================

/**
 * The five standard ships of a single fleet.
 * @memberof Battleship
 * @typedef {Battleship.Ship[]} ship_array
 */
Battleship.ship_array = [
    {
        "name": "carrier",
        "length": 5,
        "orientation": "horizontal",
        "placed": false
    },
    {
        "name": "battleship",
        "length": 4,
        "orientation": "horizontal",
        "placed": false
    },
    {
        "name": "cruiser",
        "length": 3,
        "orientation": "horizontal",
        "placed": false
    },
    {
        "name": "submarine",
        "length": 3,
        "orientation": "horizontal",
        "placed": false
    },
    {
        "name": "destroyer",
        "length": 2,
        "orientation": "horizontal",
        "placed": false
    }
];

/**
 * Two independent fleets, one per player, for the two-player game.
 * @memberof Battleship
 * @typedef {Battleship.ship_array[]} multiplayer_ship_array
 */
Battleship.multiplayer_ship_array = [
    JSON.parse(JSON.stringify(Battleship.ship_array)),
    JSON.parse(JSON.stringify(Battleship.ship_array))
];

// ===========================================================================
// 2. BOARD CREATION
// ===========================================================================

/**
 * Returns a fresh empty board of the given dimensions.
 * @memberof Battleship
 * @function
 * @param {number} [width=10] The width of the new board
 * @param {number} [height=10] The height of the new board
 * @returns {Battleship.Board} An empty board
 */
Battleship.empty_board = function (width = 10, height = 10) {
    return R.repeat(R.repeat({"ship": false, "shot": false}, width), height);
};

// ===========================================================================
// 3. CELL PREDICATES
// ===========================================================================

/**
 * Returns true when the cell contains a ship.
 * @memberof Battleship
 * @function
 * @param {Battleship.cell} cell The cell to inspect
 * @returns {boolean} true if the cell contains a ship
 */
Battleship.is_ship_here = function (cell) {
    return cell.ship === true;
};

const is_cell_shot = function (cell) {
    return cell.shot === true;
};

// ===========================================================================
// 4. GEOMETRY & VALIDATION  (pure helpers)
// ===========================================================================

// The list of [x, y] cells a ship would occupy from a top-left anchor.
const ship_footprint = function (ship, col, row) {
    return R.range(0, ship.length).map(function (offset) {
        return (
            ship.orientation === "vertical"
            ? [col, row + offset]
            : [col + offset, row]
        );
    });
};

const is_in_bounds = function (board, coords) {
    return (
        coords[0] >= 0 &&
        coords[0] < board[0].length &&
        coords[1] >= 0 &&
        coords[1] < board.length
    );
};

const footprint_in_bounds = function (board, footprint) {
    return footprint.every(function (coords) {
        return is_in_bounds(board, coords);
    });
};

const footprint_overlaps = function (board, footprint) {
    return footprint.some(function (coords) {
        return Battleship.is_ship_here(board[coords[1]][coords[0]]);
    });
};

// Immutably returns a board with one cell merged with the given patch.
const update_cell = function (board, x, y, patch) {
    const merged = Object.assign({}, board[y][x], patch);
    return R.update(y, R.update(x, merged, board[y]), board);
};

// Immutably returns a board with a ship cleared from one cell (shot is kept).
const clear_ship_from_cell = function (board, x, y) {
    const cleared = Object.assign({}, board[y][x], {"ship": false});
    delete cleared.shipName;
    return R.update(y, R.update(x, cleared, board[y]), board);
};

// Every [x, y] on the board currently occupied by the named ship.
const ship_cells_of = function (board, ship_name) {
    return board.reduce(function (coords, row, y) {
        return coords.concat(row.reduce(function (in_row, cell, x) {
            return (
                cell.shipName === ship_name
                ? in_row.concat([[x, y]])
                : in_row
            );
        }, []));
    }, []);
};

// ===========================================================================
// 5. PLACEMENT
// ===========================================================================

/**
 * Places a ship on the board when in bounds, non-overlapping and not yet
 * placed. On any rule violation the original board is returned unchanged
 * (same reference), which callers can test with `result === board`.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board The board to place on
 * @param {Battleship.Ship} ship The ship being placed
 * @param {number} x_top_left Column index of the top-left cell
 * @param {number} y_top_left Row index of the top-left cell
 * @returns {Battleship.Board} A new board with the ship placed, or the
 * original board if placement was illegal
 */
Battleship.place_ship = function (board, ship, x_top_left, y_top_left) {
    if (ship === undefined) {
        return board;
    }
    const footprint = ship_footprint(ship, x_top_left, y_top_left);
    if (!footprint_in_bounds(board, footprint)) {
        return board;
    }
    if (footprint_overlaps(board, footprint)) {
        return board;
    }
    if (ship.placed === true) {
        return board;
    }
    // Only tag the cell with an identity when the ship actually has a name.
    const patch = (
        ship.name === undefined
        ? {"ship": true}
        : {"ship": true, "shipName": ship.name}
    );
    const new_board = footprint.reduce(function (acc, coords) {
        return update_cell(acc, coords[0], coords[1], patch);
    }, board);
    ship.placed = true;
    return new_board;
};

// ===========================================================================
// 6. MOVEMENT  (ghost move)
// ===========================================================================

/**
 * Shifts an already-placed ship one cell in the given direction. The vacated
 * cells keep their `shot` flag (a hit there becomes a miss), while the cells
 * the ship moves onto are reset to un-shot. Illegal moves (off-board, or
 * blocked by a different ship) return the original board unchanged.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board
 * @param {string} ship_name
 * @param {("up"|"down"|"left"|"right")} direction
 * @returns {Battleship.Board}
 */
Battleship.move_ship = function (board, ship_name, direction) {
    const deltas = {
        "up": [0, -1],
        "down": [0, 1],
        "left": [-1, 0],
        "right": [1, 0]
    };
    const delta = deltas[direction];
    const current_coords = ship_cells_of(board, ship_name);

    if (delta === undefined || current_coords.length === 0) {
        return board;
    }

    const new_coords = current_coords.map(function (coords) {
        return [coords[0] + delta[0], coords[1] + delta[1]];
    });

    if (!footprint_in_bounds(board, new_coords)) {
        return board;
    }

    // A destination is blocked only by a *different* ship, not by the cells
    // this ship is vacating.
    const old_keys = current_coords.map(function (coords) {
        return coords[0] + "," + coords[1];
    });
    const is_blocked = new_coords.some(function (coords) {
        const cell = board[coords[1]][coords[0]];
        const key = coords[0] + "," + coords[1];
        return Battleship.is_ship_here(cell) && !R.includes(key, old_keys);
    });
    if (is_blocked) {
        return board;
    }

    const cleared_board = current_coords.reduce(function (acc, coords) {
        return clear_ship_from_cell(acc, coords[0], coords[1]);
    }, board);
    return new_coords.reduce(function (acc, coords) {
        return update_cell(acc, coords[0], coords[1], {
            "ship": true,
            "shipName": ship_name,
            "shot": false
        });
    }, cleared_board);
};

/**
 * Slides the named ship {@link distance} tiles in one direction, applying one
 * tile at a time via {@link Battleship.move_ship}. The slide is all-or-nothing:
 * if any step is illegal (off the board, blocked by another ship, or the ship
 * is already sunk) the original board is returned unchanged. Callers can
 * detect failure by testing {@code result === board}.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board
 * @param {string} ship_name
 * @param {("up"|"down"|"left"|"right")} direction
 * @param {number} [distance=1] Number of tiles to slide (typically 1 or 2)
 * @returns {Battleship.Board} Updated board, or the original board on failure
 */
Battleship.ghost_slide = function (board, ship_name, direction, distance) {
    if (Battleship.is_ship_sunk_by_name(board, ship_name)) {
        return board;
    }
    const step1 = Battleship.move_ship(board, ship_name, direction);
    if (step1 === board || !distance || distance < 2) {
        return step1;
    }
    const step2 = Battleship.move_ship(step1, ship_name, direction);
    return (
        step2 === step1
        ? board
        : step2
    );
};

// ===========================================================================
// 7. SHOOTING
// ===========================================================================

/**
 * Fires at a cell. An already-shot cell leaves the board unchanged.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board The board being played on
 * @param {number[]} cell_coords The [x, y] coordinates of the target
 * @returns {Battleship.Board} The updated board
 */
Battleship.shoot_cell = function (board, cell_coords) {
    const x = cell_coords[0];
    const y = cell_coords[1];
    if (is_cell_shot(board[y][x])) {
        return board;
    }
    return update_cell(board, x, y, {"shot": true});
};

// ===========================================================================
// 8. STATE QUERIES
// ===========================================================================

// Whether the ship occupying [x, y] is fully shot. Falls back to the single
// cell when it carries no ship identity.
const is_ship_sunk_at = function (board, x, y) {
    const cell = board[y][x];
    const ship_cells = (
        cell.shipName === undefined
        ? [cell]
        : ship_cells_of(board, cell.shipName).map(function (coords) {
            return board[coords[1]][coords[0]];
        })
    );
    return ship_cells.every(is_cell_shot);
};

/**
 * Returns the display state of a cell.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board A battleship board
 * @param {Battleship.cell} cell A cell from the board
 * @param {number[]} coords The [x, y] coordinates of the cell
 * @returns {string} "unshot", "miss", "hit", or "sunken_ship"
 */
Battleship.cell_state = function (board, cell, coords) {
    if (!is_cell_shot(cell)) {
        return "unshot";
    }
    if (!Battleship.is_ship_here(cell)) {
        return "miss";
    }
    if (is_ship_sunk_at(board, coords[0], coords[1])) {
        return "sunken_ship";
    }
    return "hit";
};

const all_ships_hit_in_row = function (row) {
    return row.filter(Battleship.is_ship_here).every(is_cell_shot);
};

/**
 * Returns true when every ship cell on the board has been shot.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board The board being played on
 * @returns {boolean} true if the player has won
 */
Battleship.has_player_won = function (board) {
    return board.every(all_ships_hit_in_row);
};

/**
 * Returns true if the named ship has been placed on the given board.
 * @memberof Battleship
 * @function
 * @param {string} ship_name The name of the ship
 * @param {Battleship.multiplayer_ship_array} multiplayer_ship_array
 * The ship sets
 * @param {(0|1)} game_board_index The board number
 * @returns {boolean} true if the ship has already been placed
 */
Battleship.is_ship_placed = function (
    ship_name,
    multiplayer_ship_array,
    game_board_index
) {
    const ship = multiplayer_ship_array[game_board_index].find(
        function (candidate) {
            return candidate.name === ship_name;
        }
    );
    return ship.placed;
};

/**
 * Returns all [col, row] coordinate pairs currently occupied by the named ship.
 * Returns an empty array when the ship is not on the board.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board
 * @param {string} ship_name
 * @returns {number[][]} Array of [col, row] pairs,
 *     left-to-right or top-to-bottom
 */
Battleship.ship_cells_by_name = function (board, ship_name) {
    return ship_cells_of(board, ship_name);
};

/**
 * Returns true when every cell of the named ship has been shot.
 * Returns false when the ship is not on the board or
 * has at least one unshot cell.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board
 * @param {string} ship_name
 * @returns {boolean}
 */
Battleship.is_ship_sunk_by_name = function (board, ship_name) {
    const coords = ship_cells_of(board, ship_name);
    return coords.length > 0 && coords.every(function (coord) {
        return board[coord[1]][coord[0]].shot === true;
    });
};

/**
 * Returns true when the named ship has at least one shot cell.
 * A ship that has not been placed or has no hit cells returns false.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board
 * @param {string} ship_name
 * @returns {boolean}
 */
Battleship.is_ship_damaged = function (board, ship_name) {
    return ship_cells_of(board, ship_name).some(function (coord) {
        return board[coord[1]][coord[0]].shot === true;
    });
};

// ===========================================================================
// 9. RANDOM SETUP  (single-player convenience; not unit-tested as it is random)
// ===========================================================================

const set_random_orientation = function (ship) {
    const options = ["horizontal", "vertical"];
    ship.orientation = options[Math.floor(Math.random() * options.length)];
    return ship;
};

/**
 * Generates a board with all of {@link Battleship.ship_array} placed at random
 * valid positions.
 * @memberof Battleship
 * @function
 * @returns {Battleship.Board} A board with randomly placed ships
 */
Battleship.random_board = function () {
    return Battleship.ship_array.reduce(function (board, ship) {
        ship.placed = false;
        set_random_orientation(ship);
        let next_board = board;
        while (next_board === board) {
            const col = Math.floor(Math.random() * (10 - ship.length));
            const row = Math.floor(Math.random() * (10 - ship.length));
            next_board = Battleship.place_ship(board, ship, col, row);
        }
        return next_board;
    }, Battleship.empty_board(10, 10));
};

// ===========================================================================
// 10. SONAR SCAN
// ===========================================================================

/**
 * Counts the number of ship cells within the 3×3 area centred on (col, row).
 * Cells that fall outside the board boundary are silently ignored.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board
 * @param {number} col  Centre column (0-indexed)
 * @param {number} row  Centre row (0-indexed)
 * @returns {number} Number of ship cells in the scan area (0–9)
 */
Battleship.count_ships_in_area = function (board, col, row) {
    const scan_rows = R.range(row - 1, row + 2);
    const scan_cols = R.range(col - 1, col + 2);
    return scan_rows.reduce(function (total, r) {
        return total + scan_cols.reduce(function (sub, c) {
            if (
                r >= 0 && r < board.length &&
                c >= 0 && c < board[0].length &&
                Battleship.is_ship_here(board[r][c])
            ) {
                return sub + 1;
            }
            return sub;
        }, 0);
    }, 0);
};

// ===========================================================================
// 11. GHOST TELEPORT
// ===========================================================================

/**
 * Infers the orientation of a ship from its cell coordinate list.
 * @memberof Battleship
 * @function
 * @param {number[][]} cells Array of [col, row] pairs (e.g. from
 * {@link Battleship.ship_cells_by_name})
 * @returns {("horizontal"|"vertical")}
 */
Battleship.infer_ship_orientation = function (cells) {
    if (cells.length < 2) {
        return "horizontal";
    }
    return (
        cells[0][1] === cells[1][1]
        ? "horizontal"
        : "vertical"
    );
};

/**
 * Returns the [col, row] cell coordinates a ship of the given length would
 * occupy when placed with its top-left corner at {@link anchor}.
 * @memberof Battleship
 * @function
 * @param {number[]} anchor [col, row] of the top-left placement corner
 * @param {number} length Ship length in cells
 * @param {("horizontal"|"vertical")} orientation
 * @returns {number[][]} Array of [col, row] pairs
 */
Battleship.relocate_footprint = function (anchor, length, orientation) {
    return R.range(0, length).map(function (i) {
        return (
            orientation === "vertical"
            ? [anchor[0], anchor[1] + i]
            : [anchor[0] + i, anchor[1]]
        );
    });
};

/**
 * Returns true when all proposed footprint cells are legal for a ghost
 * teleport: within the board, not occupied by another ship, and not previously
 * shot. The relocating ship's own un-shot cells are treated as free so the
 * check is consistent with the placement it replaces.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board
 * @param {number[][]} cells Proposed [col, row] footprint
 * @param {string} moving_name Name of the ship being relocated
 * @returns {boolean}
 */
Battleship.relocate_valid = function (board, cells, moving_name) {
    return cells.every(function (cr) {
        const c = cr[0];
        const r = cr[1];
        if (c < 0 || c >= board[0].length || r < 0 || r >= board.length) {
            return false;
        }
        const cell = board[r][c];
        if (cell.shipName === moving_name) {
            return true;
        }
        return !Battleship.is_ship_here(cell) && cell.shot !== true;
    });
};

/**
 * Lifts the named ship off the board and places it, at full health, on the
 * given cells. The vacated cells retain their {@code shot} flag. All other
 * cells are untouched. Callers should validate the footprint first with
 * {@link Battleship.relocate_valid}.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board
 * @param {string} ship_name
 * @param {number[][]} cells New [col, row] footprint
 * @returns {Battleship.Board} A new board with the ship at its new position
 */
Battleship.apply_ghost_relocate = function (board, ship_name, cells) {
    const old_coords = ship_cells_of(board, ship_name);
    const cleared = old_coords.reduce(function (acc, coord) {
        return clear_ship_from_cell(acc, coord[0], coord[1]);
    }, board);
    return cells.reduce(function (acc, cr) {
        return update_cell(acc, cr[0], cr[1], {
            "ship": true,
            "shipName": ship_name,
            "shot": false
        });
    }, cleared);
};

export default Object.freeze(Battleship);
