require("dotenv").config();
const express = require("express");
const cors = require("cors-anywhere");
const Ably = require("ably");
const app = express();
const fetch = require("node-fetch");

// app settings
const port = process.env.PORT || 8080;
const corsPort = process.env.CORS_PORT || 9090;
const corsHost = process.env.CORS_HOST || "127.0.0.1";
const AblyKey = process.env.ABLY_KEY;
const RT = new Ably.Realtime({ key: AblyKey });
const gameChannelName = "launch-duckly";

const Messages = {
  Enter: "enter",
  Leave: "leave",
  StartGame: "startGame",
  LaunchSprites: "launchSprites",
  Hit: "hit",
  GameOver: "gameOver",
  Leaderboard: "leaderboard"
};

let gameChannel = null;
let players = new Map();
let playerChannels = new Map();
let leaderboard = [];

app.use(express.static("public"));

app.get("/auth", (req, res) => {
  const tokenParams = { clientId: uniqueId() };
  RT.auth.createTokenRequest(tokenParams, function (err, tokenRequest) {
    if (err) {
      res.status(500).send("Error requesting token: " + JSON.stringify(err));
    } else {
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(tokenRequest));
    }
  });
});

app.get("/nickname", (req, res) => {
  const colors = [
    { bg: "#EB3F86", text: "#ffffff" },
    { bg: "#405AFF", text: "#ffffff" },
    { bg: "#E9FF38", text: "#000000" },
    { bg: "#A44CE3", text: "#ffffff" },
    { bg: "#A7E22E", text: "#000000" },
    { bg: "#a34fde", text: "#ffffff" },
    { bg: "#8EDD0A", text: "#000000" }
  ];
  const color = colors[Math.floor(Math.random() * colors.length)];
  let suffix = Math.floor(Math.random() * 1000) + 1;
  let nickname = `player-${suffix}`;
  fetch(`http://${corsHost}:${corsPort}/https://plarium.com/services/api/nicknames/new/create?group=4&gender=2`, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Content-type": "application/x-www-form-urlencoded"
    }
  }).then(resp => {
    if (resp.ok) { return resp.json(); }
  }).then(json => {
    if (json) { nickname = json[Math.floor(Math.random() * json.length)]; } 
  }).catch(e => {
    console.error('Unable to create nickname', e);
  }).finally(() => {
    res.json({ nickname: nickname, color: color });
  });
});

app.get("/players", (req, res) => {
  res.send(JSON.stringify({ count: players.size }));
});

RT.connection.once("connected", () => {
  console.log("Realtime messaging: connected");
  gameChannel = RT.channels.get(gameChannelName);

  gameChannel.presence.subscribe(Messages.Enter, (msg) => {
    const player = { id: msg.clientId, nickname: msg.data.player.nickname, color: msg.data.player.color, score: 0 };
    players.set(player.id, player);
    subscribeToPlayerMessages(player.id);
    gameChannel.publish(Messages.Enter, { player: player });
    gameChannel.publish(Messages.Leaderboard, { leaderboard: leaderboard });
  });

  gameChannel.presence.subscribe(Messages.Leave, (msg) => {
    publishTopScores();
    const player = players.get(msg.clientId);
    if (player != undefined) {
      gameChannel.publish(Messages.Leave, { player: player });
      players.delete(player.id);
    }
  });
});

function subscribeToPlayerMessages(playerId) {
  playerChannels.set(playerId, RT.channels.get("player-" + playerId));
  const channel = playerChannels.get(playerId);

  channel.subscribe(Messages.LaunchSprites, (msg) => {
    gameChannel.publish(Messages.LaunchSprites, { player: players.get(msg.clientId), count: msg.data.count });
  });

  channel.subscribe(Messages.Hit, (msg) => {
    players.get(msg.clientId).score++;
    gameChannel.publish(Messages.Hit, { player: players.get(msg.clientId) });
  });

  channel.subscribe(Messages.GameOver, (msg) => {
    const player = players.get(msg.clientId);
    gameChannel.publish(Messages.GameOver, { player: player });
    publishTopScores();
    player.score = 0;
  });
}

function publishTopScores() {
  players.forEach((player, key) => {
    if (player.score > 0) {
      const leader = leaderboard.find(l => l.nickname == player.nickname);
      if (leader) { //player is already on the leaderboard
        if (player.score > leader.score) {
          leader.score = player.score;
        }
      } else {
        leaderboard.push({ nickname: player.nickname, score: player.score });
      }
    }
  });

  leaderboard.sort((a, b) => { return b.score - a.score; });
  leaderboard = leaderboard.slice(0, 5);
  gameChannel.publish(Messages.Leaderboard, { leaderboard: leaderboard });
}

function uniqueId() {
  return "id-" + Math.random().toString(36).substring(2, 16);
}

app.listen(port, () => { console.log(`Serving ${gameChannelName} on port ${port}`); });
cors.createServer({ originWhitelist: [] }).listen(corsPort, corsHost, () => { console.log(`Running CORS on ${corsHost}:${corsPort}`) });