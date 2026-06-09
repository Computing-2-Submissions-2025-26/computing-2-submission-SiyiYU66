import Battleship from "../BattleShip.js";
import R from "../ramda.js";

const empty_board = Battleship.empty_board;
describe("Empty board", function () {
    it(`Given no width and height,
    When creating a new board
    Returns a 10 by 10 array of arrays of ship objects`, function () {
        const result = empty_board();
        const expected = [
            [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false},
                {"ship": false, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `For an empty input,` +
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
    it(`Given a positive width and height,
    When creating a new board,
    Returns an array of arrays of ship objects
    with given width and height`, function () {
        const width = 2;
        const height = 3;
        const result = empty_board(2, 3);
        const expected = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `For an input of width=${width}, height=${height},` +
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
});

const place_ship = Battleship.place_ship;

describe("Place ship", function () {

    it(`Given a board with a ship in an x,y spot,
    When trying to place another horizontal ship in that spot,
    Returns the initial board`, function () {
        const board = [
            [
                {"ship": true, "shot": false}, {"ship": true, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        const ship = {"length": 2, "orientation": "horizontal"};
        const x_top_left = 0;
        const y_top_left = 0;
        const game_board_index = 0;
        const result = place_ship(
            board,
            ship,
            x_top_left,
            y_top_left,
            game_board_index
        );
        const expected = [
            [
                {"ship": true, "shot": false}, {"ship": true, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
    it(`Given a board with a ship in an x,y spot,
    When trying to place another vertical ship in that spot,
    Returns the initial board`, function () {
        const board = [
            [
                {"ship": true, "shot": false}, {"ship": true, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        const ship = {"length": 2, "orientation": "vertical"};
        const x_top_left = 0;
        const y_top_left = 0;
        const game_board_index = 0;
        const result = place_ship(
            board,
            ship,
            x_top_left,
            y_top_left,
            game_board_index
        );
        const expected = [
            [
                {"ship": true, "shot": false}, {"ship": true, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });

    it(`Given a board and a horizontal ship,
    When trying to place the ship in coordinates that would make it
    extend past the left/right of the board,
    Returns the initial board`, function () {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        const ship = {"length": 2, "orientation": "horizontal"};
        const x_top_left = 1;
        const y_top_left = 0;
        const game_board_index = 0;
        const result = place_ship(
            board,
            ship,
            x_top_left,
            y_top_left,
            game_board_index
        );
        const expected = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });

    it(`Given a board and a vertical ship,
    When trying to place the ship in coordinates that would make it
    extend past the top/bottom of the board,
    Returns the initial board`, function () {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        const ship = {"length": 3, "orientation": "vertical"};
        const x_top_left = 0;
        const y_top_left = 1;
        const game_board_index = 0;
        const result = place_ship(
            board,
            ship,
            x_top_left,
            y_top_left,
            game_board_index
        );
        const expected = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });

    it(`Given a board and a horizontal ship,
    When trying to place the ship in coordinates that are not overlapping
    another ship or out of bounds,
    Returns an updated board with the ship placed in it`, function () {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        const ship = {"length": 2, "orientation": "horizontal"};
        const x_top_left = 0;
        const y_top_left = 1;
        const game_board_index = 0;
        const result = place_ship(
            board,
            ship,
            x_top_left,
            y_top_left,
            game_board_index
        );
        const expected = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": true, "shot": false}, {"ship": true, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });

    it(`Given a board and a vertical ship,
    When trying to place the ship in coordinates that are not overlapping
    another ship or out of bounds,
    Returns an updated board with the ship placed in it`, function () {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ]
        ];
        const ship = {"length": 2, "orientation": "vertical"};
        const x_top_left = 1;
        const y_top_left = 1;
        const game_board_index = 0;
        const result = place_ship(
            board,
            ship,
            x_top_left,
            y_top_left,
            game_board_index
        );
        const expected = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": true, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": true, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
});

const shoot_cell = Battleship.shoot_cell;

describe("Shoot cell", function () {

    it(`Given a board and a cell that has not yet been shot,
    When shooting the cell,
    Returns an updated board with cell "shot" property set to true`, function (
    ) {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": true}
            ], [
                {"ship": false, "shot": true}, {"ship": false, "shot": false}
            ]
        ];
        const square = [0, 1];
        const result = shoot_cell(board, square);
        const expected = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": true}, {"ship": false, "shot": true}
            ], [
                {"ship": false, "shot": true}, {"ship": false, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });

    it(`Given a board and a cell that has already been shot,
    When shooting the cell,
    Returns the initial board`, function () {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": true}
            ], [
                {"ship": false, "shot": true}, {"ship": false, "shot": false}
            ]
        ];
        const square = [1, 1];
        const result = shoot_cell(board, square);
        const expected = [
            [
                {"ship": false, "shot": false}, {"ship": false, "shot": false}
            ], [
                {"ship": false, "shot": false}, {"ship": false, "shot": true}
            ], [
                {"ship": false, "shot": true}, {"ship": false, "shot": false}
            ]
        ];
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
});

const has_player_won = Battleship.has_player_won;

describe("Has the player won", function () {

    it(`Given a board where all the ships have been shot,
    When checking if the player has won,
    Returns true`, function () {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": true, "shot": true}
            ], [
                {"ship": false, "shot": false}, {"ship": true, "shot": true}
            ], [
                {"ship": true, "shot": true}, {"ship": true, "shot": true}
            ]
        ];
        const result = has_player_won(board);
        const expected = true;
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });

    it(`Given a board where not all the ships have been shot,
    When checking if the player has won,
    Returns false`, function () {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": true, "shot": true}
            ], [
                {"ship": false, "shot": false}, {"ship": true, "shot": true}
            ], [
                {"ship": true, "shot": false}, {"ship": true, "shot": true}
            ]
        ];
        const result = has_player_won(board);
        const expected = false;
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
});

const cell_state = Battleship.cell_state;


describe("Cell of the state", function () {
    it(`Given a cell containing a ship,
    When the cell has been shot,
    Returns hit`, function () {
        const board = empty_board(3, 3);
        const game_board_index = 0;
        const new_board = Battleship.place_ship(
            board,
            {
                "name": "destroyer",
                "length": 2,
                "orientation": "horizontal",
                "placed": false
            },
            0,
            0,
            game_board_index
        );
        const coords = [1, 0];
        const cell = new_board[coords[1]][coords[0]];
        cell.shot = true;
        const result = cell_state(new_board, cell, coords, game_board_index);
        const expected = "hit";
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
    it(`Given a cell that doesn't contain a ship,
    When the cell has been shot,
    Returns miss`, function () {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": true, "shot": true}
            ], [
                {"ship": false, "shot": false}, {"ship": true, "shot": true}
            ], [
                {"ship": false, "shot": true}, {"ship": true, "shot": true}
            ]
        ];
        const coords = [0, 2];
        const game_board_index = 0;
        const result = cell_state(
            board,
            board[coords[1]][coords[0]],
            coords,
            game_board_index
        );
        const expected = "miss";
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });

    it(`Given a cell,
    When the cell hasn't been shot,
    Returns unshot`, function () {
        const board = [
            [
                {"ship": false, "shot": false}, {"ship": true, "shot": true}
            ], [
                {"ship": false, "shot": false}, {"ship": true, "shot": true}
            ], [
                {"ship": false, "shot": true}, {"ship": true, "shot": true}
            ]
        ];
        const coords = [0, 0];
        const game_board_index = 0;
        const result = cell_state(
            board,
            board[coords[1]][coords[0]],
            coords,
            game_board_index
        );
        const expected = "unshot";
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });

    it(`Given a cell containing a ship,
    When the ship is fully hit,
    Returns sunken_ship`, function () {
        const board = empty_board(3, 3);
        const game_board_index = 0;
        const new_board = Battleship.place_ship(
            board,
            {
                "name": "destroyer",
                "length": 2,
                "orientation": "horizontal",
                "placed": false
            },
            0,
            0,
            game_board_index
        );
        const coords = [1, 0];
        const cell_1 = new_board[0][0];
        const cell_2 = new_board[0][1];
        cell_1.shot = true;
        cell_2.shot = true;
        const result = cell_state(new_board, cell_1, coords, game_board_index);
        const expected = "sunken_ship";
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
});

const is_ship_here = Battleship.is_ship_here;

describe("Is there a ship in this cell", function () {
    it(`Given a cell with no ship, returns false`, function () {
        const cell = {"ship": false, "shot": false};
        const result = is_ship_here(cell);
        const expected = false;
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });

    it(`Given a cell with a ship, returns false`, function () {
        const cell = {"ship": true, "shot": false};
        const result = is_ship_here(cell);
        const expected = true;
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
});

const is_ship_placed = Battleship.is_ship_placed;

describe("Is this ship already placed", function () {
    it(`Given one of the two boards with a destroyer in it,
    When trying to place another destroyer in that board,
    Returns true`, function () {
        const multiplayer_ship_array = [
            [{
                "name": "submarine",
                "length": 3,
                "orientation": "horizontal",
                "placed": false
            }, {
                "name": "destroyer",
                "length": 2,
                "orientation": "horizontal",
                "placed": true
            }],
            [{
                "name": "submarine",
                "length": 3,
                "orientation": "horizontal",
                "placed": false
            }, {
                "name": "destroyer",
                "length": 2,
                "orientation": "horizontal",
                "placed": false
            }]
        ];
        const result = is_ship_placed("destroyer", multiplayer_ship_array, 0);
        const expected = true;
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
    it(`Given two boards with no destroyers in them,
    When trying to place a destroyer
    Returns false`, function () {
        const multiplayer_ship_array = [
            [{
                "name": "submarine",
                "length": 3,
                "orientation": "horizontal",
                "placed": false
            }, {
                "name": "destroyer",
                "length": 2,
                "orientation": "horizontal",
                "placed": false
            }],
            [{
                "name": "submarine",
                "length": 3,
                "orientation": "horizontal",
                "placed": false
            }, {
                "name": "destroyer",
                "length": 2,
                "orientation": "horizontal",
                "placed": false
            }]
        ];
        const result = is_ship_placed("destroyer", multiplayer_ship_array, 0);
        const expected = false;
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
    it(`Given two boards with a destroyers in one of them,
    When trying to place a destroyer in the other board,
    Returns false`, function () {
        const multiplayer_ship_array = [
            [{
                "name": "submarine",
                "length": 3,
                "orientation": "horizontal",
                "placed": false
            }, {
                "name": "destroyer",
                "length": 2,
                "orientation": "horizontal",
                "placed": false
            }],
            [{
                "name": "submarine",
                "length": 3,
                "orientation": "horizontal",
                "placed": false
            }, {
                "name": "destroyer",
                "length": 2,
                "orientation": "horizontal",
                "placed": true
            }]
        ];
        const result = is_ship_placed("destroyer", multiplayer_ship_array, 0);
        const expected = false;
        if (!R.equals(result, expected)) {
            throw new Error(
                `${JSON.stringify(result)} was returned,` +
                `when ${JSON.stringify(expected)} was expected`
            );
        }
    });
});