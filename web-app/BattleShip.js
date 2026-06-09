import R from "./ramda.js";

/**
 * @namespace Battleship
 * @description Module for the classic Battleship board game.
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

/**
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

let ship_locations = [{}, {}];

/**
 * Returns a fresh empty board of the given dimensions.
 * @memberof Battleship
 * @function
 * @param {number} [width=10] The width of the new board
 * @param {number} [height=10] The height of the new board
 * @returns {Battleship.Board} An empty board
 */
Battleship.empty_board = function (width = 10, height = 10) {
    return R.repeat(
        R.repeat({"ship": false, "shot": false}, width),
        height
    );
};

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

const get_occupied_cells = function (board, ship, col, row) {
    if (ship.orientation === "horizontal") {
        return board[row].slice(col, col + ship.length);
    }
    if (ship.orientation === "vertical") {
        const column = board.map(function (r) {
            return r[col];
        });
        return column.slice(row, row + ship.length);
    }
};

const check_overlap = function (board, ship, col, row) {
    const cells = get_occupied_cells(board, ship, col, row);
    if (cells) {
        return get_occupied_cells(board, ship, col, row).some(
            Battleship.is_ship_here
        );
    }
};

const check_out_of_bounds = function (board, ship, col, row) {
    if (ship.orientation === "vertical") {
        return col < 0 || col > board[0].length ||
        row < 0 || row > (board.length - ship.length);
    }
    if (ship.orientation === "horizontal") {
        return col < 0 || col > (board[0].length - ship.length) ||
        row < 0 || row > board.length;
    }
};

const insert_ship_into_board = function (
    board,
    ship,
    col,
    row,
    boardIdx
) {
    ship_locations[boardIdx][ship.name] = [];
    if (ship.orientation === "horizontal") {
        R.range(0, ship.length).forEach(function (offset) {
            const cx = col + offset;
            const new_cell = Object.assign({}, board[row][cx], {
                "ship": true,
                "shipName": ship.name
            });
            const new_row = R.update(cx, new_cell, board[row]);
            board = R.update(row, new_row, board);
            ship_locations[boardIdx][ship.name].push([cx, row]);
        });
    }
    if (ship.orientation === "vertical") {
        R.range(0, ship.length).forEach(function (offset) {
            const cy = row + offset;
            const new_cell = Object.assign({}, board[cy][col], {
                "ship": true,
                "shipName": ship.name
            });
            const new_row = R.update(col, new_cell, board[cy]);
            board = R.update(cy, new_row, board);
            ship_locations[boardIdx][ship.name].push([col, cy]);
        });
    }
    return board;
};

/**
 * Places a ship on the board if all constraints are satisfied.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board The board to place on
 * @param {Battleship.Ship} ship The ship being placed
 * @param {number} x_top_left Column index of the top-left cell
 * @param {number} y_top_left Row index of the top-left cell
 * @param {(0|1)} game_board_index The board number
 * @returns {Battleship.Board} The new board with the ship placed
 */
Battleship.place_ship = function (
    board,
    ship,
    x_top_left,
    y_top_left,
    game_board_index
) {
    if (ship === undefined) {
        console.log("You haven't selected a ship yet");
        return board;
    }
    if (check_out_of_bounds(board, ship, x_top_left, y_top_left)) {
        console.log("The ship is out of bounds");
        return board;
    }
    if (check_overlap(board, ship, x_top_left, y_top_left)) {
        console.log("There is already a ship here");
        return board;
    }
    if (ship.placed === true) {
        console.log("This ship has already been placed");
        return board;
    }
    const new_board = insert_ship_into_board(
        board,
        ship,
        x_top_left,
        y_top_left,
        game_board_index
    );
    ship.placed = true;
    return new_board;
};

/**
 * Shifts a placed ship one step in the given direction.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board
 * @param {string} ship_name
 * @param {("up"|"down"|"left"|"right")} direction
 * @param {(0|1)} game_board_index
 * @returns {Battleship.Board}
 */
Battleship.move_ship = function (
    board,
    ship_name,
    direction,
    game_board_index
) {
    const delta_map = {
        "up": [0, -1],
        "down": [0, 1],
        "left": [-1, 0],
        "right": [1, 0]
    };
    const delta = delta_map[direction];
    const current_coords = ship_locations[game_board_index][ship_name];

    if (!delta || current_coords === undefined) {
        return board;
    }

    const new_coords = current_coords.map(function (cell_coords) {
        return [
            cell_coords[0] + delta[0],
            cell_coords[1] + delta[1]
        ];
    });

    if (new_coords.some(function (cell_coords) {
        return cell_coords[0] < 0 ||
            cell_coords[0] >= board[0].length ||
            cell_coords[1] < 0 ||
            cell_coords[1] >= board.length;
    })) {
        return board;
    }

    const old_coord_keys = current_coords.map(function (cell_coords) {
        return `${cell_coords[0]},${cell_coords[1]}`;
    });

    if (new_coords.some(function (cell_coords) {
        const target_cell = board[cell_coords[1]][cell_coords[0]];
        const key = `${cell_coords[0]},${cell_coords[1]}`;
        return Battleship.is_ship_here(target_cell) &&
            !R.includes(key, old_coord_keys);
    })) {
        return board;
    }

    let new_board = board.map(function (row) {
        return row.map(function (cell) {
            return Object.assign({}, cell);
        });
    });

    current_coords.forEach(function (cell_coords) {
        const x = cell_coords[0];
        const y = cell_coords[1];
        new_board[y][x] = Object.assign(
            {}, new_board[y][x], {"ship": false}
        );
        delete new_board[y][x].shipName;
    });

    new_coords.forEach(function (cell_coords) {
        const x = cell_coords[0];
        const y = cell_coords[1];
        new_board[y][x] = Object.assign({}, new_board[y][x], {
            "ship": true,
            "shipName": ship_name,
            "shot": false
        });
    });

    ship_locations[game_board_index][ship_name] = new_coords;
    return new_board;
};

const is_cell_shot = function (cell) {
    return cell.shot === true;
};

/**
 * Marks a cell as shot and returns the updated board.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board The board being played on
 * @param {number[]} cell_coords The [x, y] coordinates of the target
 * @returns {Battleship.Board} The updated board
 */
Battleship.shoot_cell = function (board, cell_coords) {
    const x = cell_coords[0];
    const y = cell_coords[1];
    const target_cell = board[y][x];
    if (is_cell_shot(target_cell)) {
        return board;
    }
    const updated_cell = Object.assign({}, target_cell, {"shot": true});
    const updated_row = R.update(x, updated_cell, board[y]);
    return R.update(y, updated_row, board);
};

const all_ships_hit_in_row = function (row) {
    const ship_cells = row.filter(Battleship.is_ship_here);
    return ship_cells.every(is_cell_shot);
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
 * Returns the display state of a cell.
 * @memberof Battleship
 * @function
 * @param {Battleship.Board} board A battleship board
 * @param {Battleship.cell} cell A cell from the board
 * @param {number[]} coords The [x, y] coordinates of the cell
 * @param {(0|1)} game_board_index The board number
 * @returns {string} "unshot", "miss", "hit", or "sunken_ship"
 */
Battleship.cell_state = function (
    board,
    cell,
    coords,
    game_board_index
) {
    if (is_cell_shot(cell)) {
        if (Battleship.is_ship_here(cell)) {
            if (is_cell_ship_sunk(board, coords, game_board_index)) {
                return "sunken_ship";
            }
            return "hit";
        }
        return "miss";
    }
    return "unshot";
};

const set_random_orientation = function (ship) {
    const options = ["horizontal", "vertical"];
    ship.orientation = options[
        Math.floor(Math.random() * options.length)
    ];
    return ship;
};

/**
 * Generates a board with all ships placed at random valid positions.
 * @memberof Battleship
 * @function
 * @returns {Battleship.Board} A board with randomly placed ships
 */
Battleship.random_board = function () {
    let board = Battleship.empty_board(10, 10);
    Battleship.ship_array.forEach(function (ship) {
        ship = set_random_orientation(ship);
        let col = Math.floor(Math.random() * (10 - ship.length));
        let row = Math.floor(Math.random() * (10 - ship.length));
        let new_board = Battleship.place_ship(
            board, ship, col, row, 0
        );
        while (new_board === board) {
            col = Math.floor(Math.random() * (10 - ship.length));
            row = Math.floor(Math.random() * (10 - ship.length));
            new_board = Battleship.place_ship(
                board, ship, col, row, 0
            );
        }
        board = new_board.map(function (r) {
            return r.map(R.identity);
        });
    });
    return board;
};
// random → not unit-testable

const all_ship_cells_shot = function (board, ship_cells_coords) {
    if (ship_cells_coords === undefined) {
    }
    const ship_cells = ship_cells_coords.map(function (cell_coords) {
        return board[cell_coords[1]][cell_coords[0]];
    });
    return ship_cells.every(is_cell_shot);
};

const find_ship_coords = function (cell_coords, game_board_index) {
    const ships = Object.entries(ship_locations[game_board_index]);
    let result = undefined;
    ships.forEach(function (ship) {
        const positions = ship[1];
        if (R.includes(cell_coords, positions)) {
            result = positions;
        }
    });
    return result;
};

const is_cell_ship_sunk = function (board, cell_coords, game_board_index) {
    return all_ship_cells_shot(
        board,
        find_ship_coords(cell_coords, game_board_index)
    );
};

// multiplayer functions and variables

/**
 * @memberof Battleship
 * @typedef {Battleship.ship_array[]} multiplayer_ship_array
 */
Battleship.multiplayer_ship_array = [
    JSON.parse(JSON.stringify(Battleship.ship_array)),
    JSON.parse(JSON.stringify(Battleship.ship_array))
];

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
    const ship = multiplayer_ship_array[
        game_board_index
    ].find(function (s) {
        return s.name === ship_name;
    });
    return ship.placed;
};

export default Object.freeze(Battleship);
