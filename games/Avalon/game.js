// Game - game object (backend)

var Game = function(){
	// required fields
	this.name = "Avalon";
	this.player_count = [5,10]; // min and max player inclusive
	this.playtime = "20+ min"; // string indicating playtime

	this.mainHTML = "index.html";
	this.playerHTML = "player.html";

	this.mappableFolders = ["js", "css"];

	// optional	fields
	// for cover art on main hub
	this.cover_img = "https://cf.geekdo-images.com/itemrep/img/yottt6aVvGBSOp3D0k4dno5_n3Y=/fit-in/246x300/pic1398895.jpg",
	// game logic fields
	this.players = {};
	this.playerIDs = [];
	var GameState = {
		selecting_roles: -1,
		lady: 0,
		king: 1,
		vote: 2,
		quest: 3,
		assassinate: 4,
		end: 5
	}
	var gameState = GameState.selecting_roles;
	
	var currentKing = -1; // id of current king
	var currentLady = -1; // id of current lady
	var currentHammer = -1;
	var currentNominated = []; // IDs of players nomiated to go on quest
	var currentQuesting = []; // IDs of players who go on questing
	var currentVoting = []; // IDs of players currently still have yet to vote

	var questDistribution = {
		4: [-2,-2,2,2,2], // For testing purposes
		5: [2,3,2,3,3],
		6: [2,3,3,3,4],
		7: [2,3,3,-4,4], // -ve means need 2 fails
		8: [3,4,4,-5,5], // this is for 8+
	}
	var questNumber = [2,3,2,3,3] // how many players required for each quest
	var questResults = [0,0,0,0,0] // negative means success, positive is failure. (the abs value is number of fails)
	var currQuest = 0;

	var lastVotingResult = {};
	var pastVotes = [];
	var numRejects = 0;
	var ladyMap = {}; // <int, int> pair: <lady, selected>

	var initialized = false;
	var gameSettings = {
		showPastVotes: false
	};

	// a player should pick available roles in the start
	var roleAssassin = "Assassin";
	var roleMerlin = "Merlin";
	var availableRoles = [roleMerlin, roleAssassin];
	var rolesCount = {
		Merlin: {
			count: 1, alignment: 0,
			min: 1, max: 1
		},
		Assassin: {
			count: 1, alignment: 1,
			min: 1, max: 1
		},
		Percival: {
			count: 0, alignment: 0,
			min: 0, max: 1
		},
		Arthur: {
			count: 0, alignment: 0,
			min: 0, max: 1
		},
		Morgana: {
			count: 0, alignment: 1,
			min: 0, max: 1
		},
		Oberon: {
			count: 0, alignment: 1,
			min: 0, max: 1
		},
		Mordred: {
			count: 0, alignment: 1,
			min: 0, max: 1
		},
		Servant: {
			count: 0, alignment: 0,
			min: 0, max: 10
		},
		Minion: {
			count: 0, alignment: 1,
			min: 0, max: 10
		},
		count: 2,
		alignment: [1, 1],
		distribution: {
			// [good, evil]
			5: [3, 2],
			6: [4, 2],
			7: [4, 3],
			8: [5, 3],
			9: [6, 3],
			10: [6, 4],
		}
	}

	// required functions
	this.initPlayers = function(players){
		for (var i in players){
			var p = players[i];
			this.players[p.id] = {
				id: p.id,
				name: p.name,
				ishost: p.host,
				// game fields
				isKing: false,
				vote: undefined, // bool
				quest: undefined, // bool
				role: undefined, // string
			};
			this.playerIDs.push(p.id);
		}
	}
	// initPlayers would already be called
	this.initMainHTML = function(html){
		if (!initialized){
			this.initializeGame();
		}
		html = html.replace("{{PLAYERS}}", JSON.stringify(this.players));
		html = html.replace("{{GAMESTATE}}", gameState);
		html = html.replace("{{ROLESCOUNT}}", JSON.stringify(rolesCount));
		html = html.replace("{{AVAILABLEROLES}}", JSON.stringify(availableRoles));
		return html;
	}
	this.initPlayerHTML = function(playerID, html){
		html = html.replace("{{PLAYERNAME}}", this.players[playerID].name);
		html = html.replace("{{ISHOST}}", this.players[playerID].ishost);
		html = html.replace("{{PLAYERID}}", playerID);
		html = html.replace("{{PLAYERS}}", JSON.stringify(this.getPlayersData(playerID)));
		html = html.replace("{{ROLESCOUNT}}", JSON.stringify(rolesCount));
		html = html.replace("{{GAMESTATE}}", gameState);
		return html;
	}

	this.sendEventToPlayers = function(players, event, payload){
		// players = list of int representing player id (the p.id in initPlayers)
		// leave this function empty (will be filled at run time)
	}
	this.sendEventToMain = function(event, payload){
		// leave this function empty (will be filled at run time)
	}
	this.sendEventToAll = function(event, payload){
		// leave this function empty (will be filled at run time)
	}

	// Fill these out
	this.onPlayerConnect = function(playerID){
		this.sendEventToMain("PLAYER_CONNECT", playerID);
		// broadcast data to this player
		if(initialized){
			this.emitData();
			this.emitPlayerData(playerID);

			if (gameState == GameState.king && playerID == currentKing){
				this.notifyKing();
			}
			if (gameState == GameState.lady && playerID == currentLady){
				this.notifyLady();
			}
			else if (gameState == GameState.vote && typeof this.players[playerID].vote == "undefined"){
				this.sendEventToPlayers([playerID], "GAME_STATE", {
					ev: "VOTE",
					load: currentQuesting.map((id) => this.players[id].name)
				});
			}
			else if(gameState == GameState.quest && 
					currentQuesting.indexOf(playerID) >= 0 &&
					typeof this.players[playerID].quest == "undefined"){
				this.sendEventToPlayers([playerID], "GAME_STATE", {
					ev: "QUEST",
					load: 1
				});
			}
			else if(gameState == GameState.assassinate && 
					this.players[playerID].role == roleAssassin){
				this.sendEventToPlayers([playerID], "GAME_STATE", {
					ev: "ASSASSINATE",
					load: 1
				});
			}
		}
	}
	this.onPlayerDisconnect = function(playerID){
		this.sendEventToMain("PLAYER_DISCONNECT", playerID);
	}
	this.onReceiveEventFromPlayer = function(playerID, event, payload){
		switch(event){
			case "PLAYER_ROLES":
				switch(payload.ev){
					case "ADD":
						var role = payload.role;
						var a = rolesCount[role].alignment;
						var pcount = this.playerIDs.length;
						pcount = pcount < 5 ? 5 : pcount; // for testing purposes
						if (rolesCount.count < pcount){
							if (rolesCount[role].count < rolesCount[role].max &&
								rolesCount.alignment[a] < rolesCount.distribution[pcount][a]){
								rolesCount[role].count += 1;
								rolesCount.count += 1;
								rolesCount.alignment[a] += 1;
								availableRoles.push(payload.role);
								this.sendEventToMain("ROLES", availableRoles);
							}		
						}
						break;
					case "REMOVE":
						var role = payload.role;
						var a = rolesCount[role].alignment;
						var pcount = this.playerIDs.length;
						if (rolesCount[role].count > rolesCount[role].min &&
							rolesCount.alignment[a] > 0){
							rolesCount[role].count -= 1;
							rolesCount.count -= 1;
							rolesCount.alignment[a] -= 1;
							availableRoles.splice(availableRoles.indexOf(payload.role), 1);
							this.sendEventToMain("ROLES", availableRoles);
						}
						break;
					case "CONFIRM":
						this.startGame();
						break;
				}
				break;
			case "PLAYER_SETTINGS":
				gameSettings = payload;
				break;
			case "PLAYER_KING_SELECT":
				// payload is a list of IDs
				// king selected a list of players
				currentQuesting = payload.map((id) => parseInt(id));
				currentNominated = currentQuesting;
				currentVoting = Object.keys(this.players).map((id) => parseInt(id));
				gameState = GameState.vote;
				this.loopPlayers((id, p) => {p.vote = undefined;});		
				this.sendEventToAll("GAME_STATE", {
					ev: "VOTE",
					load: currentQuesting.map((id) => this.players[id].name)
				});
				lastVotingResult = {};
				break;
			case "PLAYER_LADY_SELECT":
				// lady selects a player they want to see
				// payload is id of player lady wants to see
				if (playerID == currentLady && gameState == GameState.lady){
					ladyMap[playerID] = payload;
					currentLady = payload;
					gameState = GameState.king;
					this.emitPlayerData(playerID);
					this.emitData();
					this.notifyKing();
				}
				break;
			case "PLAYER_VOTE":
				// payload is bool
				this.players[playerID].vote = payload;
				var index = currentVoting.indexOf(playerID)
				if (index >= 0){
					currentVoting.splice(index, 1);
				}
				var allvote = true;
				var voteresult = 0;
				this.loopPlayers((id, p) => {
					if (typeof p.vote == "undefined"){
						allvote = false;
					}else{
						voteresult += p.vote ? 1 : -1;
						lastVotingResult[p.id] = p.vote;
					}
				});
				if (allvote){
					if (currQuest >= pastVotes.length) pastVotes.push([]);
					pastVotes[currQuest].push(lastVotingResult);

					if (voteresult <= 0){
						// voting did not pass
						numRejects += 1;
						if (numRejects >= 5){
							// evils win when number of rejects pass 5
							this.sendEventToMain("GAME_END", {winner:1, msg:"There are 5 rejected votes."});
							gameState = GameState.end;
						}else{
							this.incrementKing();
							gameState = GameState.king;
							this.notifyKing();
						}
						this.emitData();
					}else{
						// voting passed
						numRejects = 0; // ?? Does reject reset on a pass
						gameState = GameState.quest;
						this.loopPlayers((id, p) => {p.quest = undefined;});
						this.sendEventToPlayers(currentQuesting, "GAME_STATE", {
							ev: "QUEST",
							load: 0
						})
					}
					var load = {};
					this.loopPlayers((id, p) => {load[id] = p.vote});
					this.sendEventToAll("VOTING_RESULT", load);
				}
				this.emitData();
				break;
			case "PLAYER_QUEST":
				// payload is bool
				this.players[playerID].quest = payload;
				var allvote = true;
				var failures = 0;
				this.loopPlayers((id, p) => {
					if (currentQuesting.indexOf(id) >= 0){
						if (typeof p.quest == "undefined"){
							allvote = false;
						}else{
							failures += p.quest ? 0 : 1;
						}
					}
				})
				if (allvote){
					this.incrementKing();
					gameState = GameState.king;

					if (failures > 0){
						if (questNumber[currQuest] < 0){
							if (failures >= 2) questResults[currQuest] = failures;
							else questResults[currQuest] = -failures; // use -ve to indicate success, but x failed
						}else if(questNumber[currQuest] > 0){
							questResults[currQuest] = failures;
						}
					}else{
						questResults[currQuest] = 0; // 0 means 0 failures (pass)
					}

					// this.sendEventToMain("QUEST_RESULT", {
					// 	num_failures: failures,
					// 	quest_failed: questResults[currQuest] > 0
					// });

					currQuest += 1;
					if (questResults.reduce((acc, x)=>acc + (x > 0 ? 1 : 0), 0) > 2){
						// evils win
						this.sendEventToMain("GAME_END", {winner:1, msg:"There are 3 failed quests."});
						gameState = GameState.end;
					}else if(questResults.slice(0, currQuest).reduce((acc, x)=>acc + (x <= 0 ? 1 : 0), 0) > 2){
						// good wins. Assassin can choose to assassinate a person TODO
						gameState = GameState.assassinate;
						this.sendEventToMain("ASSASSINATE", {});						
						this.sendEventToAll("GAME_STATE", {
							ev: "ASSASSINATE",
							load: 1
						});
					}else{
						if (currentLady >= 0 && currQuest > 1){
							gameState = GameState.lady;
							this.notifyLady();
						}
						else{
							this.notifyKing();
						}
					}
					this.emitData();
				}
				break;
			case "PLAYER_ASSASSINATE":
				// payload is the ID of the target
				var assassin = this.players[playerID];
				var target = this.players[parseInt(payload)];
				if (assassin.role == roleAssassin){
					if (target.role == roleMerlin){
						// evils win
						this.sendEventToMain("GAME_END", {winner:1, msg:"Assassin("+assassin.name+") killed Merlin("+target.name+")!"});
						gameState = GameState.end;
					} else {
						// goods win
						this.sendEventToMain("GAME_END", {winner:0, msg:"Assassin("+assassin.name+") failed to kill Merlin thanks to "+target.role+"'s sacrifice ("+target.name+")."});
						gameState = GameState.end;						
					}
				}
				break;
			case "EMIT":
				this.emitData();
				this.emitPlayerData(playerID);
		}
	}
	this.onReceiveEventFromMain = function(event, payload){
		if (event == "EMIT"){
			this.emitData();
		}
	}

	// optional functions
	this.emitData = function(){
		// send game data to all
		var data = {
			current_quest: currQuest,
			all_quests: questNumber,
			quest_results: questResults,
			game_state: gameState,
			current_king: currentKing,
			current_lady: currentLady,
			current_hammer: currentHammer,
			players_onquest: currentQuesting,
			players_nominated: currentNominated,
			players_voting: currentVoting,
			last_voting_result: lastVotingResult,
			past_votes: pastVotes,
			roles_count: rolesCount,
			num_rejects: numRejects,
			game_settings: gameSettings,
			players: this.playerIDs.map((k) => {
				var temp = copy(this.players[k]);
				temp.role = undefined;
				return temp;
			})
		}
		this.sendEventToPlayers(Object.keys(this.players), "EMIT", data);
		this.sendEventToMain("EMIT", data);
	}
	this.emitPlayerData = function(playerID){
		var data = {
			players: this.getPlayersData(playerID)
		}
		this.sendEventToPlayers([playerID], "PLAYERS_INFO", data);
	}
	this.loopPlayers = function(callback){
		if (typeof callback != "function") return;
		for(var i = 0; i < this.playerIDs.length; i++){
			var id = this.playerIDs[i]
			callback(id, this.players[id]);
		}
	}
	this.getPlayersData = function(playerID){
		var p = this.players[playerID];
		var knows = {}
		switch (p.role){
			case "Minion":
			case "Mordred":
			case "Morgana":
			case "Assassin":
				knows["Assassin"] = "Evil";
				knows["Morgana"] = "Evil";
				knows["Minion"] = "Evil";
				knows["Mordred"] = "Evil";
				break;
			case "Merlin":
				knows["Assassin"] = "Evil";
				knows["Morgana"] = "Evil";
				knows["Oberon"] = "Evil";
				knows["Minion"] = "Evil";
				break;
			case "Percival":
				knows["Merlin"] = "Merlin";
				knows["Morgana"] = "Merlin";
				break;
			case "Arthur":
				knows["Percival"] = "Percival";
				break;
			case "Oberon":
			case "Servant":
			default:
				break;
		}

		var players = Object.keys(this.players).map((k) => {
			var temp = copy(this.players[k]);
			if (temp.id != playerID){
				var new_role = "";
				if (temp.role in knows){
					new_role = knows[temp.role];
				}else{
					new_role = "";
				}

				if (currentLady >= 0 && playerID in ladyMap && ladyMap[playerID] == temp.id && new_role == ""){
					// playing with lady
					new_role = rolesCount[temp.role].alignment == 1 ? "L:Evil" : "L:Good";
				} 
				temp.role = new_role;
			}
			return temp;
		})
		return players;
	}
	var copy = function(c){
		return JSON.parse(JSON.stringify(c));
	}
	var randInt = function(l, h){
		// inclusive, exclusive
		return Math.floor(Math.random() * (h - l));
	}
	// In Avalon, game logic will be handled in the back end (here) instead of main
	this.initializeGame = function(){
		// get players to choose available roles
		initialized = true;
		questNumber = [2,3,2,3,3];
		gameState = GameState.selecting_roles;
	}
	this.startGame = function(){
		// called when roles are selected
		if (availableRoles.length == this.playerIDs.length){
			gameState = GameState.king;
			this.initializeRoles();
			this.initializeKing();
			// set initial quests
			var p = this.playerIDs.length;
			if (p < 9 && p in questDistribution){
				questNumber = questDistribution[p];
			}else if (p > 8){
				questNumber = questDistribution[8];
			}else if (p < 5){
				questNumber = questDistribution[4];
			}

			this.sendEventToAll("GAME_START", 1);
			this.emitData();
			for(var i in this.playerIDs){
				var id = parseInt(this.playerIDs[i]);
				this.emitPlayerData(id);
			}
			this.notifyKing();
		}
	}

	this.initializeRoles = function(){
		if (this.playerIDs.length in rolesCount.distribution || true){
			for (var i = 0; i < this.playerIDs.length; i++){
				var p = this.players[this.playerIDs[i]];
				p.role = availableRoles.splice(randInt(0, availableRoles.length), 1)[0];
			}
		}
	}
	this.initializeKing = function(){
		var players = this.players;
		var chosen_index = randInt(0, this.playerIDs.length);
		var id = this.playerIDs[chosen_index];
		players[id].isKing = true;
		currentKing = id;
		this.incrementKing();
		if (gameSettings.LadyOfTheLake){
			var lady_index = chosen_index;
			lady_index = lady_index < 0 ? this.playerIDs.length-1 : lady_index;
			currentLady = this.playerIDs[lady_index];
		}
	}

	this.incrementKing = function(){
		var players = this.players;
		for (var i = 0; i < this.playerIDs.length; i++){
			if(players[this.playerIDs[i]].isKing){
				players[this.playerIDs[i]].isKing = false;
				var k = i + 1;
				k = k >= this.playerIDs.length ? 0 : k;
				players[this.playerIDs[k]].isKing = true;
				currentKing = this.playerIDs[k];
				break;
			}
		}
		// Find hammer
		for (var i = 0; i < this.playerIDs.length; i++){
			if(players[this.playerIDs[i]].isKing){
				var k = i;
				for (var j = 0; j < 5 - numRejects; j++){
					k = k >= this.playerIDs.length ? 0 : k;
					currentHammer = this.playerIDs[k];
					k += 1;
				}
				break;
			}
		}
	}

	this.notifyKing = function(){
		this.sendEventToPlayers([currentKing], "GAME_STATE", {
			ev: "KING",
			load: questNumber[currQuest]
		});
	}
	this.notifyLady = function(){
		this.sendEventToPlayers([currentLady], "GAME_STATE", {
			ev: "LADY",
			load: 1
		});
	}

}

module.exports = Game;