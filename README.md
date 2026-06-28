[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/H6lPFq0J)
# Computing 2 Coursework Submission.
**CID**: [02601683]

---
## Battleship — Game Overview

A web-based Battleship game built on a pure-functional game engine. It supports three modes:

- **Single Player** — play against an AI opponent with selectable difficulty.
- **2 Player (Same Device)** — two players take turns on one shared screen.
- **2 Player (Online)** — two players connect from separate devices using a room code, powered by a Node.js + Socket.IO server.

Both two-player modes feature real-time ship placement, turn management, and two special abilities — **Sonar Scan** and **Ghost Move**. Single Player uses standard fire only.

### How to Run

**1. Install dependencies** (in the project root):
```properties
npm install
```

**2. Start the server.** Choose **one** of these methods:
- **Terminal:** run `npm run server`, then manually open `http://localhost:3001` in a browser.
- **VS Code:** open the **Run and Debug** panel, select **"Battleship: Server + Firefox"**, and press the green play button — this starts the server *and* opens the game in Firefox automatically.

You should see `Battleship server → http://localhost:3001` in the terminal.

> **Note:** use only one method at a time. Running both will cause a port conflict (port 3001 already in use).

### How to Play Online Mode

1. From the menu, choose **Two Player**, then **Online**.
2. One player creates a room and shares the **room code**; the other joins with that code.
3. Both players name themselves and place their ships, then the battle begins.
4. To test online mode locally, open two browser tabs (or two different browsers) at `http://localhost:3001`.
> **Tip for side-by-side testing:** If you open two browser windows next to each other, zoom each one to **70%** (`Ctrl −` / `Cmd −`) for the best layout. The game is fully playable at 100% zoom with scrolling.

### Single Player — AI Difficulty

The computer opponent has three difficulty levels:

- **Easy** — fires at random cells with no memory; ideal for beginners.
- **Normal** — uses a hunt-and-target strategy: after a hit, it prioritises the four neighbouring cells until the ship is sunk.
- **Hard** — adds two advanced tactics on top of Normal: a **parity search** (only scanning a checkerboard of cells, which still finds every ship while using far fewer shots), and **directional targeting** (once two hits line up, it locks onto that row or column and stops wasting shots elsewhere).

### Special Abilities (Two Player only)

In both two-player modes, two special abilities are available during battle in addition to standard fire (each use consumes a turn). These abilities revolve around hidden information and bluffing between two human players, so Single Player focuses on the core mechanics with standard fire only.

- **Sonar Scan** (2 uses) — reveals the number of ship cells within a 3×3 area.
- **Ghost Move** (1 use) — **intact ships** teleport to any valid empty position; **damaged ships** can only *slide* 1–2 tiles to escape, and the slide fails if another ship blocks the path or the move would go off the board.

---

This is the submission template for your Computing 2 Applications coursework submission.

## Checklist
### Install dependencies locally
This template relies on a a few packages from the Node Package Manager, npm.
To install them run the following commands in the terminal.
```properties
npm install
```
These won't be uploaded to your repository because of the `.gitignore`.
I'll run the same commands when I download your repos.

### Game Module – API
*You will produce an API specification, i.e. a list of function names and their signatures, for a Javascript module that represents the state of your game and the operations you can perform on it that advances the game or provides information.*

- [ ] Include a `.js ` module file in `/web-app` containing the API using `jsdoc`.
- [ ] Update `/jsdoc.json` to point to this module in `.source.include` (line 7)
- [ ] Compile jsdoc using the run configuration `Generate Docs`
- [ ] Check the generated docs have compiled correctly.

### Game Module – Implementation
*You will implement, in Javascript, the module you specified above. Such that your game can be simulated in code, e.g. in the debug console.*

- [ ] The file above should be fully implemented.

### Unit Tests – Specification
*For the Game module API you have produced, write a set of unit tests descriptions that specify the expected behaviour of one aspect of your API, e.g. you might pick the win condition, or how the state changes when a move is made.*

- [ ] Write unit test definitions in `/web-app/tests`.
- [ ] Check the headings appear in the Testing sidebar.

### Unit Tests – Implementation
*Implement in code the unit tests specified above.*

- [ ] Implement the tests above.

### Web Application
*Produce a web application that allows a user to interface with your game module.*

- Implement in `/web-app`
  - [ ] `index.html`
  - [ ] `default.css`
  - [ ] `main.js`
  - [ ] Any other files you need to include.

### Finally
- [ ] Push to GitHub.
- [ ] Sync the changes.
- [ ] Check submission on GitHub website.
