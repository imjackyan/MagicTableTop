// Game - game object (backend)

var Game = function(){
	// required fields
	this.name = "One Night Ultimate Werewolf";
	this.player_count = [3,10]; // min and max player inclusive
	this.playtime = "20 min"; // string indicating playtime

	this.mainHTML = "index.html";
	this.playerHTML = "player.html";

	this.mappableFolders = ["js", "css"];

	// optional	fields
	// for cover art on main hub
	this.cover_img = "https://www.mindgamesbrisbane.com/wp-content/uploads/2018/10/689070013563.jpeg"
	// game logic fields
	this.players = {};
	this.playerIDs = [];

	var initialized = false;
	var gameSettings = {
		showPastVotes: false
	};

	var ChatState = {
		// if a chat is at this state, it means pending confirm for that state
		intro: 0,
		role_reveal: 1,
		wolf: 10, robber: 11, trouble: 12, drunk: 13, 
		game: 20, vote: 21,
	}
	var GameState = {
		select: 0,
		role_reveal: 1,
		wolf: 2, // wolf, minion, mason, seer, 
		robber: 3,
		trouble: 4,
		drunk: 5, // drunk, insomniac
		game: 6, // counter begins
		vote: 7, // people votes who to kill
		end: 8,
	};
	var gameState = GameState.start;

	var roles = {
		wolf: "Werewolf",
		minion: "Minion",
		mason: "Mason",
		seer: "Seer",
		robber: "Robber",
		trouble: "Trouble Maker",
		drunk: "Drunk",
		insomniac: "Insomniac",
		villager: "Villager",
		hunter: "Hunter",
		dopple: "Doppleganger",
		tanner: "Tanner",
	};
	var rolesData = {
		default: {
			power: "None",
			win: "Wins if at least one Werewolf dies. (Even if a player on the village team dies). If no player is Werewolf, only wins if no one (exclude Minion) dies. If no Werewolf and Minion is in play, Villagers need to kill Minion.",
			min: 0, max: 1, step: 1
		},
	};
	rolesData[roles.wolf] = {
		win: "Wins if no Werewolves die. If the Tanner is in play, wins if no Werewolves die and the Tanner is still alive.",
		power: "You know the other Werewolf. If no other Werewolf is present, you can look at a card from the center pile.",
		max: 2, min: 1,
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/werewolf_2048x.png",
	};
	rolesData[roles.minion] = {
		win: "Wins with the Werewolves, even if he dies. If no player is a Werewolf, wins if any other player dies as long as he (the Minion) does not die and the Tanner is still alive.",
		power: "You know the Werewolves.",
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/Minion_2048x.png"
	};
	rolesData[roles.mason] = {
		power: "You know the other Mason.",
		max: 2, step: 2,
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/mason_2048x.png",
	};
	rolesData[roles.seer] = {
		power: "You can look at a player's role. Or you can look at two cards from the center pile.",
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/seer_2048x.png",
	};
	rolesData[roles.robber] = {
		power: "You can choose to swap role with another player. You know this new role if you do.",
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/robber_2048x.png",
	};
	rolesData[roles.trouble] = {
		power: "You can swap two other player's roles without looking at them. They do not know their new roles until the end of the game.",
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/troublemaker_2048x.png",
	};
	rolesData[roles.drunk] = {
		power: "You are so drunk you must exchange your roles with any roles in the center without looking at it.",
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/drunk_2048x.png",
	};
	rolesData[roles.insomniac] = {
		power: "You can look at your role before the night ends.",
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/insomniac_2048x.png",
	};
	rolesData[roles.villager] = {
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/villager_2048x.png",
	};
	rolesData[roles.hunter] = {
		power: "If you die, the person you point at also dies.",
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/hunter_2048x.png",
	};
	rolesData[roles.dopple] = {
		power: "You take on the role and objective of the person's role you view.",
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/doppelganger_2048x.png",
		enabled: false,
	};
	rolesData[roles.tanner] = {
		img: "https://cdn.shopify.com/s/files/1/0740/4855/products/tanner_2048x.png",
		win: "You win when you die. If you die, No one else can win.",
	}
	
	// var rolesSelected = [roles.wolf, roles.wolf, roles.villager, roles.robber, roles.seer, roles.trouble];
	// var rolesSelected = [roles.wolf, roles.seer, roles.robber, roles.trouble, roles.drunk, roles.insomniac];
	var rolesSelected = [roles.wolf, roles.robber, roles.robber, roles.insomniac, roles.insomniac, roles.insomniac];

	var rolesCenter = [];
	var roleSelect = {}; // indexed by string, counts the number of roles;
	roleSelect[roles.wolf] = 1;

	var timer = 60*10; // 10 minutes
	var timerEvent = null;

	var curHost = -1;
	// required functions
	this.initPlayers = function(players){
		for (var i in players){
			var p = players[i];
			this.players[p.id] = {
				id: p.id,
				name: p.name,
				ishost: p.host,
				// game fields
				role: [], // array of strings, element 0 is what they started with
				confirm: false,
				chat_state: ChatState.intro, // for tracking chat progress
				view: {
					center: [], player: []
				}, // for who the player viewed
				swap: [], // for who the player swapped
				chats: [], // list of chat history
			};
			this.playerIDs.push(p.id);
			if (p.host) curHost = p.id;
		}
	}
	// initPlayers would already be called
	this.initMainHTML = function(html){
		if (!initialized){
			this.initializeGame();
		}
		html = html.replace("{{ROLES}}", JSON.stringify(roles));
		html = html.replace("{{ROLESDATA}}", JSON.stringify(rolesData));
		html = html.replace("{{GAMESTATE}}", JSON.stringify(GameState));
		html = html.replace("{{ROLESELECT}}", JSON.stringify(roleSelect));
		return html;
	}
	this.initPlayerHTML = function(playerID, html){
		html = html.replace("{{PLAYERNAME}}", this.players[playerID].name);
		html = html.replace("{{PLAYERID}}", playerID);
		
		html = html.replace("{{ROLES}}", JSON.stringify(roles));
		html = html.replace("{{ROLESDATA}}", JSON.stringify(rolesData));
		html = html.replace("{{GAMESTATE}}", JSON.stringify(GameState));
		html = html.replace("{{ROLESELECT}}", JSON.stringify(roleSelect));
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
			var chats = this.constructPlayerChats(playerID);
			this.sendEventToPlayers([playerID], "CHATS", chats);
		}
	}
	this.onPlayerDisconnect = function(playerID){
		this.sendEventToMain("PLAYER_DISCONNECT", playerID);
	}
	this.onReceiveEventFromPlayer = function(playerID, event, payload){
		this.stateManager(playerID, event, payload);
	}
	this.onReceiveEventFromMain = function(event, payload){
		if (event == "EMIT"){
			this.emitData();
		}
	}

	// optional functions
	this.swapRoles = function(id1, id2){
		var ind1 = this.players[id1].role.length - 1;
		var ind2 = this.players[id2].role.length - 1;
		this.players[id1].role.push(this.players[id2].role[ind2]);
		this.players[id2].role.push(this.players[id1].role[ind1]);
	}
	this.stateManager = function(playerID, event, payload){
		// Player client side have all info, reviews are done there
		// swaps are done here (backend)

		var p = this.players[playerID];
		var increment_chat = false;
		switch(event){
			case "PLAYER_ROLES":
				// player role select
				if (playerID == curHost) {
					roleSelect = payload.role_select;
					if (payload.complete) {
						rolesSelected = [];
						for (key in payload.role_select) {
							for (var i = 0; i < payload.role_select[key]; i++) {
								rolesSelected.push(key);
							}
						}
						this.initializeRoles();
						gameState = GameState.role_reveal;
					}
					this.sendEventToMain("ROLES_SELECT", roleSelect);
				}
				break;

			case "PLAYER_WOLF":
				if (this.players[playerID].role[0] == roles.wolf){
					this.players[playerID].view = payload;
					p.confirm = true;
					increment_chat = true;
				}
				break;
			case "PLAYER_SEER":
				if (this.players[playerID].role[0] == roles.seer){
					this.players[playerID].view = payload;
					p.confirm = true;
					increment_chat = true;
					if (this.players[playerID].view.center.length == 1) {p.confirm = false; increment_chat = false;}
				}
				break;
			case "PLAYER_ROBBER":
				// if Robber or Troublemaker chooses not to swap, they submit PLAYER_CONFIRM instead
				if (this.players[playerID].role[0] == roles.robber){
					this.players[playerID].swap = [playerID, payload];
					this.swapRoles(playerID, payload);
					p.confirm = true;
					increment_chat = true;
				}
				break;
			case "PLAYER_TROUBLE":
				if (this.players[playerID].role[0] == roles.trouble){
					this.players[playerID].swap = payload;
					this.swapRoles(payload[0], payload[1]);
					p.confirm = true;
					increment_chat = true;
				}
				break;
			case "PLAYER_DRUNK":
				if (this.players[playerID].role[0] == roles.drunk){
					var index = parseInt(payload);
					this.players[playerID].role.push(rolesCenter[index]);
					rolesCenter[index] = this.players[playerID].role[this.players[playerID].role.length-2];
					this.players[playerID].swap = [index];
					p.confirm = true;
					increment_chat = true;
				}
				break;
			case "PLAYER_CONFIRM":
				// For no non swap power confirmations
				p.confirm = payload;
				increment_chat = true;
				break;
			case "PLAYER_REVEAL_ROLES":
				// Reveals final roles
				this.players[playerID].reveal = true;
				break;

			case "EMIT":
			default:
				break;
		}

		if (increment_chat){
			switch (p.chat_state){
				case ChatState.intro : p.chat_state = ChatState.role_reveal; break;
				case ChatState.role_reveal : p.chat_state = ChatState.wolf; break;
				case ChatState.wolf : p.chat_state = ChatState.robber; break;
				case ChatState.robber : p.chat_state = ChatState.trouble; break;
				case ChatState.trouble : p.chat_state = ChatState.drunk; break;
				case ChatState.drunk : p.chat_state = ChatState.game; break;
				case ChatState.game : p.chat_state = ChatState.vote; break;
			}
		}

		var all_confirmed = true;
		this.loopPlayers((id, p) => all_confirmed &= p.confirm);
		if (all_confirmed) {
			this.loopPlayers((id, p) => p.confirm = false);
			switch(gameState){
				case GameState.select: gameState = GameState.role_reveal; break; // test
				case GameState.role_reveal: gameState = GameState.wolf; break; // test
				case GameState.wolf: gameState = GameState.robber; break;
				case GameState.robber: gameState = GameState.trouble; break;
				case GameState.trouble: gameState = GameState.drunk; break;
				case GameState.drunk: gameState = GameState.game; break;
				case GameState.game: gameState = GameState.vote; break;
				case GameState.vote: gameState = GameState.end; break;
			}
		}

		this.emitData();
		this.emitChatsToPlayers();
	}
	this.constructPlayerChats = function(playerID){
		var chats = [];
		var ok_chat = { side: 1, texts: [Text("Okay")] };
		var p = this.players[playerID];
		var rdata = rolesData[p.role[0]];

		// Intro
		var action = null; // action is what player still needs to do
		var chat = {
			side: 0, // announcer
			texts: [
				Text("Hello " + p.name + ", Welcome to One Night Ultimate Werewolf!"),
				Text("I am the announcer, I will be narrating the happenings during the night."),
				Text("Tonight, the story revoles around these fine lads and ladies:"),
				Text((this.playerIDs.map((x) => this.players[x].name)).join(", ")),
			]
		}
		chats.push(chat);
		chats.push({side:0, texts:[
				Text("I will now reveal your initial role, please ensure other players cannot see it.") ]});
		var oked = false;
		if (p.chat_state == ChatState.intro){
			// side -1 indicates action, pending means player still needs to take action
			chats.push({ side: -1, type: "ok", pending:true, next_state:false}); 
		} else {
			oked = true;
			chats.push(ok_chat);
		}


		// Role Reveal
		if (gameState >= GameState.role_reveal && oked){
			chat = {
				side: 0,
				texts: [
					Text("Your role is <b>" + p.role[0] + "</b>!"),
					Img(rdata.img),
				]
			};
			if (rdata.win) chat.texts.push(Text("<b>Your win condition:</b><br>" + rdata.win));
			else chat.texts.push(Text("<b>Your win condition:</b><br>" + rolesData.default.win));
			if (rdata.power) chat.texts.push(Text("<b>Your power:</b><br>" + rdata.power));
			chat.texts.push(Text("Now, let us all go to sleep... zzzz"));
			chats.push(chat);

			if (p.chat_state == ChatState.role_reveal){
				// side -1 indicates action, pending means player still needs to take action
				chats.push({ side: -1, type: "ok", pending:true});
			} else {
				chats.push(ok_chat);
			}
		}

		// Wolf state: Wolf, Seer, Minion, Mason
		if (gameState >= GameState.wolf) {
			chat = {
				side: 0,
				texts: []
			};

			action = null;
			switch (p.role[0]){
				case roles.wolf:
					var other_wolf = null;
					this.loopPlayers((id, o) => {if (playerID != id && o.role[0] == roles.wolf) other_wolf = o;});
					if (other_wolf == null){
						chat.texts.push(Text("Looks like there is no other Werewolf present, you may look at a card from the center pile, which one would you like to see?"));
						action = { side: -1, type: "reveal-center"}
					} else {
						chat.texts.push(Text("Your Werewolf partner is <b>" + other_wolf.name + "</b>."));
						action = {side: -1, type: "ok", pending:true};
					}
					break;
				case roles.minion:
					var wolves = [];
					this.loopPlayers((id, o) => {if (o.role == roles.wolf) wolves.push(o.name);});
					var txt = "";
					if (wolves.length > 0){
						chat.texts.push(Text("The Werewolf(s) are: " + wolves.join(" ")));
						chat.texts.push(Text("Do your best to sure they don't get killed!"));
					} else {
						chat.texts.push(Text("Looks like there are no Werewolves present.. Do your best to not get killed!"));
					}
					action = {side: -1, type: "ok", pending:true};
					break;
				case roles.mason:
					var other_mason = null;
					this.loopPlayers((id, o) => {if (playerID != id && o.role[0] == roles.mason) other_mason = o;});
					if (other_mason == null){
						chat.texts.push(Text("Looks like the other Mason is not present.."));
					} else {
						chat.texts.push(Text("Your other Mason is <b>" + other_mason.name + "</b>."));
					}
					action = {side: -1, type: "ok", pending:true};
					break;
				case roles.seer:
					chat.texts.push(Text("Dear Seer, would you like to view a player's role, or two roles from the center pile?"));
					action = { side: -1, type: "reveal-both"}
					break;
				default:
					if (p.role[0] != roles.insomniac) chat.texts.push(Text("You are fast asleep.. zzz"));
					else chat.texts.push(Text("You can't sleep because you are Insomniac"));
					chat.texts.push(Text("While Werewolf, Seer, Minion, Masons are doing their thing.."));
					action = {side: -1, type: "ok", pending:true};
					break;
			}
			chats.push(chat);

			if (p.chat_state == ChatState.wolf){
				action.pending = true;
				chats.push(action);
			} else {
				action.pending = false;
				if (action.type == "ok") chats.push(ok_chat);
				else chats.push(action);
			}
		}

		// Robber state
		if (gameState >= GameState.robber){
			chat = {
				side: 0,
				texts: []
			}
			if (p.role[0] == roles.robber){
				chat.texts.push(Text("Robber, you can steal another player's role. Would you like to?"));
				chats.push(chat);
				if (p.chat_state == ChatState.robber) {
					chats.push({ side: -1, type: "rob-player", pending: true });
				} else {
					chats.push({ side: -1, type: "rob-player", pending: false });
						chat = {side:0,  texts:[ ]};
					if (p.swap.length > 0){
						chat.texts.push(Text("You stole " + this.players[p.swap[1]].name + "'s role! You are now <b>" + p.role[1] + "</b>!"));
						var new_role = p.role[1];
						var win_cond = rolesData[new_role].win ? rolesData[new_role].win : rolesData.default.win;
						chat.texts.push(Img(rolesData[new_role].img));
						chat.texts.push(Text("Your new win condition:<br>" + win_cond));
					} else {
						chat.texts.push(Text("You did not rob anyone's role.. Are you even a robber?"));
					}
					chats.push(chat);
				}

			} else {
				if (p.role[0] != roles.insomniac) chat.texts.push(Text("You are still asleep... Zzzzz..."));
				else chat.texts.push(Text("You are awake because you're Insomniac"));
				chat.texts.push(Text("As Robber sneaks around.."));
				chats.push(chat);
				if (p.chat_state == ChatState.robber) {
					chats.push({ side: -1, type: "ok", pending:true});
				} else {
					chats.push(ok_chat);
				}
			}
		}

		// Trouble Maker state
		if (gameState >= GameState.trouble){
			chat = {
				side: 0,
				texts: []
			}
			if (p.role[0] == roles.trouble){
				chat.texts.push(Text("Trouble Maker, you may swap two <i>other</i> 	 players' roles. Would you like to?"));
				chats.push(chat);
				if (p.chat_state == ChatState.trouble) {
					chats.push({ side: -1, type: "swap-player", pending: true });
				} else {
					chats.push({ side: -1, type: "swap-player", pending: false });
					chat = {side:0, texts:[ ]};
					if (p.swap.length > 0){
						chat.texts.push(Text("You swapped " + this.players[p.swap[1]].name + " and "+this.players[p.swap[0]].name+" roles!"));
						chat.texts.push(Text("Ohh you trouble maker you~"));
					} else {
						chat.texts.push(Text("You did not swap anyone's roles.. Guess you changed for the better?"));
					}
					chats.push(chat);
				}
			} else {
				var dreams = ["donuts", "losing weight", "gaining weight", "that cringe moment back in highschool",
				"the square root of -1", "the stove you forgot to turn off", "the pee currently in your bladder",
				"cakes", "sake bombs", "soju bombs", "bombs", "fine wine", "the werewolf on your left",
				"the traitor on your right", "the dummy in front of you", "the snake from the last round"];
				if (p.role[0] != roles.insomniac) chat.texts.push(Text("You are dreaming about " + (dreams[randInt(0,dreams.length)])));
				else chat.texts.push(Text("You feel tired because you are Insomniac"));
				chat.texts.push(Text("As Trouble Maker stirs up troubles."));
				chats.push(chat);
				if (p.chat_state == ChatState.trouble) {
					chats.push({ side: -1, type: "ok", pending:true});
				} else {
					chats.push(ok_chat);
				}
			}
		}

		// Drunk & Insomniac state
		if (gameState >= GameState.drunk){
			chat = {
				side: 0,
				texts: []
			}
			if (p.role[0] == roles.drunk){
				chat.texts.push(Text("Drunk, you are so drunk you lost your true self, you must swap your role with a random card in the center pile."));
				chat.texts.push(Text("Also.. You do not know your new role.."));
				chats.push(chat);
				if (p.chat_state == ChatState.drunk) {
					chats.push({ side: -1, type: "swap-center", pending: true });
				} else {
					chats.push({ side: -1, type: "swap-center", pending: false });
				}
			} 
			else if (p.role[0] == roles.insomniac) {
				chat.texts.push(Text("Insomniac, you cannot sleep.. So you wake up to find your new self to be..."));
				var new_role = p.role[p.role.length - 1];
				if (new_role == roles.insomniac) {
					chat.texts.push(Text("Insomniac! You are still Insomniac~"));
				} else {
					chat.texts.push(Text(new_role + "! You are now <b>" + new_role + "</b>!"));
					var win_cond = rolesData[new_role].win ? rolesData[new_role].win : rolesData.default.win;
					chat.texts.push(Img(rolesData[new_role].img));
					chat.texts.push(Text("Your new win condition:<br>" + win_cond));
				}
				chats.push(chat);
				if (p.chat_state == ChatState.drunk) {
					chats.push({ side: -1, type: "ok", pending:true});
				} else {
					chats.push(ok_chat);
				}
			}
			else {
				chat.texts.push(Text("..ZzZ"));
				chat.texts.push(Text("As Insomniac wakes up to find their new identity, the Drunk goes to the bar and gets wasted."));
				chats.push(chat);
				if (p.chat_state == ChatState.drunk) {
					chats.push({ side: -1, type: "ok", pending:true});
				} else {
					chats.push(ok_chat);
				}
			}
		}

		// Game state
		if (gameState >= GameState.game){
			if (timerEvent == null){
				timerEvent =  setInterval(() => {
					timer -= 1;
					timer = timer < 0 ? 0 : timer;
					this.sendEventToAll("TIMER", timer);
				}, 1000);
			}

			chat = {
				side: 0,
				texts: [
					Text("Everyone! It's time to wake up!"),
					Text("You have 10 minutes to discuss amongst yourselves."),
					Text("At the end, you must each vote on who to kill. And you win or lose depending on who is killed!"),
					Text("You may press the button to all reveal roles now."),
				]
			};
			chats.push(chat);
			chat = {
				side: -1, type: "final-reveal", pending: (p.reveal ? false : true)
			}
			chats.push(chat);

			if (p.reveal){
				chat = {
					side: 1, texts: [Text("When everybody is ready, please reveal me my final role.")]
				}
				chats.push(chat);
			}

			var all_reveal = true;
			this.loopPlayers((id, o) => all_reveal &= (o.reveal ? true : false));
			if (all_reveal) {
				var new_role = p.role[p.role.length-1];
				chat = {
					side: 0,
					texts: [
						Text("Your final role is <b>" + new_role +"</b>!"),
						Img(rolesData[new_role].img)
					]
				};
				chats.push(chat);
				if (curHost == p.id){
					chat = {
						side: -1, type: "restart", pending: true
					}
					chats.push(chat);
				}
			}
		}
		var index = p.chats.length;
		while (index < chats.length){
			p.chats.push(chats[index]);
			index++;
		}
		for (var i = 0; i < p.chats.length; i++) {
			if (p.chats[i].pending) p.chats[i] = chats[i];
		}

		return p.chats;
	}
	var Text = function(string){
		return {text: string};
	}
	var Img = function(url){
		return {img: url};
	}

	this.emitChatsToPlayers = function(){
		this.loopPlayers((id, p) => {
			this.sendEventToPlayers([id], "CHATS", this.constructPlayerChats(id));
		});
	}
	this.emitData = function(){
		// send game data to all
		var data = {
			gameState: gameState,
			rolesCenter: rolesCenter,
			rolesSelected: rolesSelected,
			players: this.playerIDs.map((k) => {
				var temp = copy(this.players[k]);
				delete temp.chats;
				return temp;
			})
		}
		this.sendEventToPlayers(Object.keys(this.players), "EMIT", data);
		this.sendEventToMain("EMIT", data);
	}
	this.loopPlayers = function(callback){
		if (typeof callback != "function") return;
		for(var i = 0; i < this.playerIDs.length; i++){
			var id = this.playerIDs[i]
			callback(id, this.players[id]);
		}
	}
	var copy = function(c){
		return JSON.parse(JSON.stringify(c));
	}
	var randInt = function(l, h){
		// inclusive, exclusive
		return Math.floor(Math.random() * (h - l));
	}
	var spliceRandom = function(array){
		var index = randInt(0, array.length);
		return array.splice(index, 1)[0];
	}

	// In this game, game logic will be handled in the back end (here) instead of main
	this.initializeGame = function(){
		// get players to choose available roles
		initialized = true;
		gameState = GameState.select;
	}
	this.startGame = function(){

	}
	this.endGame = function(){
		clearInterval(timerEvent);
		timerEvent = null;
	}

	this.initializeRoles = function(){
		var available_roles = copy(rolesSelected);
		this.loopPlayers((id, p) => p.role = [spliceRandom(available_roles)]);
		rolesCenter = available_roles;
	}

}

module.exports = Game;