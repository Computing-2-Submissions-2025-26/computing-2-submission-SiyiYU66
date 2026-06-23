// online.js — lobby matchmaking + name sync (Phase 2A)

// Guard: socket.io only loads when served via `npm run server`
if (typeof io === "undefined") {
    document.getElementById("conn-status-hud").textContent = "SERVER NOT RUNNING";
    const panel = document.getElementById("panel-lobby");
    panel.innerHTML =
        "<p class='ob-error ob-error-big'>" +
        "⚠ The Battleship server is not running.<br><br>" +
        "Start it with:<br><code>npm run server</code><br><br>" +
        "Then open <strong>http://localhost:3001</strong></p>" +
        "<a href='./index.html' class='ob-back-link'>← BACK TO MENU</a>";
    throw new Error("socket.io not available — server not running");
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const socket = io();

let my_seat = null;         // 0 = host (P1·orange), 1 = guest (P2·blue)
let current_code = null;
let current_panel = "lobby";
let my_name = null;
let name_submitted = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────

const panels = {
    lobby:        document.getElementById("panel-lobby"),
    waiting:      document.getElementById("panel-waiting"),
    naming:       document.getElementById("panel-naming"),
    disconnected: document.getElementById("panel-disconnected")
};

const btn_create     = document.getElementById("btn-create");
const btn_join       = document.getElementById("btn-join");
const btn_copy       = document.getElementById("btn-copy");
const btn_cancel     = document.getElementById("btn-cancel");
const btn_leave      = document.getElementById("btn-leave");
const btn_retry      = document.getElementById("btn-retry");
const btn_ready      = document.getElementById("btn-ready");
const input_code     = document.getElementById("input-code");
const input_name     = document.getElementById("input-name");
const join_error     = document.getElementById("join-error");
const display_code   = document.getElementById("display-code");
const naming_faction = document.getElementById("naming-faction");
const naming_status  = document.getElementById("naming-status");
const hud_status     = document.getElementById("conn-status-hud");

// ── Helpers ───────────────────────────────────────────────────────────────────

const show_panel = function (name) {
    Object.keys(panels).forEach(function (key) {
        if (panels[key]) { panels[key].hidden = key !== name; }
    });
    current_panel = name;
};

const set_hud = function (text) {
    if (hud_status) { hud_status.textContent = text; }
};

// ── Socket events ─────────────────────────────────────────────────────────────

socket.on("connect", function () {
    set_hud("CONNECTED");
});

socket.on("disconnect", function () {
    set_hud("DISCONNECTED");
});

socket.on("room_created", function (data) {
    current_code = data.code;
    my_seat = 0;
    display_code.textContent = data.code;
    show_panel("waiting");
});

socket.on("room_joined", function (data) {
    current_code = data.code;
    my_seat = 1;
    // both_connected fires immediately after on both sockets
});

socket.on("both_connected", function () {
    const faction = my_seat === 0 ? "ORANGE FACTION · P1" : "BLUE FACTION · P2";
    const panel_naming = document.getElementById("panel-naming");
    if (panel_naming) {
        panel_naming.classList.remove("faction-p1", "faction-p2");
        panel_naming.classList.add(my_seat === 0 ? "faction-p1" : "faction-p2");
    }
    if (naming_faction) {
        naming_faction.textContent = "YOU ARE: " + faction;
        naming_faction.className = "ob-label " + (my_seat === 0 ? "ob-faction-p1" : "ob-faction-p2");
    }
    if (naming_status)  { naming_status.textContent = "Waiting for opponent to enter their name…"; }
    show_panel("naming");
    set_hud("CONNECTED — ENTER NAME");
    if (input_name) {
        input_name.value = "";
        input_name.focus();
    }
    name_submitted = false;
    my_name = null;
});

socket.on("join_error", function (data) {
    join_error.textContent = data.reason;
});

socket.on("opponent_left", function () {
    if (current_panel !== "lobby") {
        show_panel("disconnected");
        set_hud("DISCONNECTED");
    }
});

socket.on("game_start", function (data) {
    // Both players named — store session and navigate to the game screen
    const opp_name = data.names[1 - my_seat];
    sessionStorage.setItem("online_session", JSON.stringify({
        room:     current_code,
        seat:     my_seat,
        my_name:  my_name,
        opp_name: opp_name
    }));
    set_hud("LAUNCHING…");
    if (naming_status) { naming_status.textContent = "Launching battle stations…"; }
    setTimeout(function () {
        window.location.href = "./Human_VS_Human.html";
    }, 500);
});

// ── Button handlers ───────────────────────────────────────────────────────────

btn_create.addEventListener("click", function () {
    socket.emit("create_room");
});

btn_join.addEventListener("click", function () {
    const code = input_code.value.trim().toUpperCase();
    if (code.length === 0) {
        join_error.textContent = "Please enter a room code.";
        return;
    }
    join_error.textContent = "";
    socket.emit("join_room", code);
});

input_code.addEventListener("keydown", function (event) {
    if (event.key === "Enter") { btn_join.click(); }
});

input_code.addEventListener("input", function () {
    input_code.value = input_code.value.toUpperCase();
});

btn_copy.addEventListener("click", function () {
    if (!current_code) { return; }
    navigator.clipboard.writeText(current_code).then(function () {
        const orig = btn_copy.textContent;
        btn_copy.textContent = "COPIED!";
        setTimeout(function () { btn_copy.textContent = orig; }, 1500);
    });
});

btn_cancel.addEventListener("click", function () {
    socket.disconnect();
    window.location.reload();
});

// "READY" — submit player name
const submit_name = function () {
    if (name_submitted) { return; }
    const name = input_name ? input_name.value.trim() : "";
    if (!name) {
        if (input_name) { input_name.classList.add("ob-input-error"); }
        return;
    }
    name_submitted = true;
    my_name = name;
    if (btn_ready)      { btn_ready.disabled = true; btn_ready.textContent = "WAITING…"; }
    if (input_name)     { input_name.disabled = true; }
    if (naming_status)  { naming_status.textContent = "Waiting for opponent…"; }
    socket.emit("player_name", name);
};

if (btn_ready) {
    btn_ready.addEventListener("click", submit_name);
}
if (input_name) {
    input_name.addEventListener("keydown", function (event) {
        if (event.key === "Enter") { submit_name(); }
        input_name.classList.remove("ob-input-error");
    });
}

if (btn_leave) {
    btn_leave.addEventListener("click", function () {
        socket.disconnect();
        window.location.reload();
    });
}

btn_retry.addEventListener("click", function () {
    window.location.reload();
});
