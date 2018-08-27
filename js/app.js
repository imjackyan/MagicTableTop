// App - Core application

var fs = require("fs");
var path = require("path");
var session = require(__dirname + "/session.js");
var Server = require(__dirname + "/server.js");
var Game = require(__dirname + "/game.js");


global.root_path = path.resolve(__dirname + "/../");

var interfaces = require('os').networkInterfaces();
global.addresses = [];
for (var k in interfaces) {
    for (var k2 in interfaces[k]) {
        var address = interfaces[k][k2];
        if (address.family === 'IPv4' && !address.internal) {
            global.addresses.push(address.address);
        }
    }
}
global.addresses = global.addresses.length == 0 ? ["IP-TO-MAGIC-TABLETOP"] : global.addresses;


var App = function(){
	var config;
	var games = [];
	var currentGame;
	var playersIO;
	var mainIO;

	var app; // the express object
	var io; // the socket.io object

	/* setupGames()
	 * populate the games array with data.
	 *
	 * argument express object - the express app object
	 */
	 var setupGames = function(config){
	 	for(var i in config.games){
	 		var gameConfig = config.games[i];
		 	var gameObjectPath = path.resolve(global.root_path + "/games/" + gameConfig.name + "/game.js");
	 		var game = new Game(require(gameObjectPath), session);

	 		if (typeof game != "undefined"){
	 			games.push(game);
	 		}else{
	 			console.error("Game is undefined");
	 		}
	 	}
	 }

	/* setupHTML(app)
	 * Set up responses to url requests
	 *
	 * argument express object - the express app object
	 */
	var setupHTML = function(_app){
		// Main page that is shown on mirror
		app = _app;
		app.get("/main", (req, res) => {
			if (!session.initialized || true){
				session.initialize();
				var html = fs.readFileSync(path.resolve(global.root_path + "/index.html"), {encoding: "utf8"});
				
				var fullUrl = req.protocol + '://' + global.addresses[0] + ":" + config.port;
				html = html.replace("{{FULLURL}}", fullUrl);

				var json = [];
				for (var i in games){
					json.push(games[i].toMainpageJson());
				}
				html = html.replace("{{GAMES}}", JSON.stringify(json));

				var pdata = [];
				pdata = session.players.map((p, i) => {return {
						name: p.name, 
						socketid: p.socket.id,
						clientip: p.socketip,
						connected: p.connected,
						id: p.id,
						ishost: p.host
					};});
				html = html.replace("{{PLAYERDATA}}", JSON.stringify(pdata));

				res.send(html);
			}else{
				res.send("<h1>HEY! This is not the Magic Tabletop??</h1>");
			}
		});

		// Default is player joining
		app.get("/", (req, res) => {
			if (!session.initialized){
				res.send("<h1>Main menu is not yet initialized</h1>");
			}
			else{
				if (session.ingame){
					res.send("<h1>There is already a game going on. Joined too late?</h1>");
				}
				else{
					var html = fs.readFileSync(path.resolve(global.root_path + "/join.html"), {encoding: "utf8"});
					var json = [];
					for (var i in games){
						json.push(games[i].toMainpageJson());
					}
					html = html.replace("{{GAMES}}", JSON.stringify(json));
					res.send(html);
				}
			}
		});
	}

	var startGame = function(gameName){
		var game = null;
		for(var i in games){
			if (games[i].name == gameName){
				game = games[i];
			}
		}

		if (game != null){
			console.log("Starting game " + gameName + "...");
			currentGame = game;
			game.setupHTML(app);
			game.setupSocketIO(io);
			game.startGame();
			return true;
		}else{
			return false;
		}
	}

	var updateLobbyHost = function(){
		playersIO.emit("ev-sethost", false);
		for (var i in session.players){
			var p = session.players[i];
			if (p.connected && p.host){
				// already has a valid host, return
				p.socket.emit("ev-sethost", true);
				mainIO.emit("ev-sethost", p.id);
				return;
			}
		}
		var set = false;
		for (var i in session.players){
			var p = session.players[i];
			if (p.connected && !set){
				p.host = true;
				p.socket.emit("ev-sethost", true);
				mainIO.emit("ev-sethost", p.id);
				set = true;
			}else{
				p.host = false;
			}
		}
	}

	var rejoinPlayer = function(player){
		player.connect();
		mainIO.emit("ev-playerjoin", {
			name: player.name, 
			socketid: player.socket.id,
			clientip: player.socketip,
			connected: player.connected,
			id: player.id,
			ishost: player.host
		});
		player.socket.emit("ev-joined", player.id);
		updateLobbyHost();
	}

	/* setupSocketIO(io)
	 * Set up sockets
	 *
	 * argument socket.io - the io object
	 */
	var setupSocketIO = function(_io){
		io = _io;
		playersIO = io.of("/player");
		mainIO = io.of("/main");

		// Settings IO on players
		playersIO.on("connection", function(socket){

			var p = session.findPlayerByIp(socket.request.connection.remoteAddress);
			if (p != null){
				// Updates the socket for reconnects
				p.update(socket);
				rejoinPlayer(p);
			}

			socket.on("ev-playerjoin", function(playername){
				var p = session.findPlayerByIp(socket.request.connection.remoteAddress);
				if (p == null){
					console.log(playername + " Joined");
					p = session.addPlayer(playername, socket);
				}else{
					console.log(playername + " Rejoined");
					p.name = playername;
				}

				if (p != null){
					rejoinPlayer(p);
				}
			});

			socket.on("ev-playgame", function(gameName){
				if (!session.ingame){
					if (startGame(gameName)){
						var playerUrl = `http://${global.addresses[0]}:${config.port}/${gameName}`;
						playersIO.emit("ev-playgame", playerUrl);

						var url = `http://${config.address}:${config.port}/main/${gameName}`;
						mainIO.emit("ev-playgame", url);
					}else{
						mainIO.emit("ev-error", "Game \"" + gameName + "\" does not exist.");
					}
				}
			});

			socket.on("ev-restartgame", function(payload){
				console.log("Restarting game " + currentGame.name + "...");
				mainIO.emit("ev-restartgame", true);
				playersIO.emit("ev-restartgame", true);
			});
			socket.on("ev-returnhome", function(payload){
				console.log("Returning home...");
				currentGame.endGame();
				currentGame = undefined;
				for(var i in session.players){
					var p = session.players[parseInt(i)];
					if (p.connected) p.automaticRejoin = true;
				}
				mainIO.emit("ev-returnhome", `http://${config.address}:${config.port}/main`);
				playersIO.emit("ev-returnhome", `http://${global.addresses[0]}:${config.port}`);
			});

			socket.on("disconnect", function(){
				var p = session.findPlayerByIp(socket.request.connection.remoteAddress);
				if (p != null){
					p.disconnect();
					mainIO.emit("ev-playerleave", {
						name: p.name, 
						socketid: p.socket.id,
						clientip: p.socketip
					});
					updateLobbyHost();
				}
			});
		});
	}

	/* start(callback)
	 * Start the app
	 *
	 * argumetn callback - callback function to set main.js config
	 */
	this.start = function(callback){
		console.log("Loading configuration file...");
		config = require(global.root_path + "/config.js");

		var server = new Server(config, function(app, io){
			setupGames(config, app, io);
			setupHTML(app);
			setupSocketIO(io);
		});

		if (typeof callback == "function"){
			callback(config);
		}
	}

}

module.exports = new App();