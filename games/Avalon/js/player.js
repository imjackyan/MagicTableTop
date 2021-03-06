var game_settings = {};
var players = [
	{
		name: "Jack", id:0, role: "Servant"
	},
	{
		name: "Salman", id:4, role: ""
	},
	{
		name: "Jim", id:2, role: "Merlin"
	},
	{
		name: "Bran", id:3, role: "Merlin"
	},
	{
		name: "Farhat", id:1, role: ""
	},
];
var player = {};
var cur_role_count = 0;
var playerIsGood = false;

var voting_results = { // indexing is player id
	0: false, 1: true, 2: true, 3: true, 4: false 
};
var kingSelectedPlayers = []; // list of indices
var kingSelectableNum = 0;
var assassinSelectedPlayers = -1; // the index of target
var king_players_template = "";
var lady_players_template = "";
var ass_players_template = "";
var other_players_template = "";
var voting_result_template = "";
var past_vote_template = "";
var socket;
$(document).ready(function(){
	socket = new MTSocket("player");
	socket.onReceiveEvent("VOTING_RESULT", function(payload){
		voting_results = payload;
		UIUpdateVotingResult();
	});
	socket.onReceiveEvent("GAME_STATE", function(payload){
		console.log(payload);
		UIUpdateGameStatus(payload.ev, payload.load);
	});
	socket.onReceiveEvent("PLAYERS_INFO", function(payload){
		players = payload.players;
		console.log(players);
		updatePlayerVar();
		UIUpdateOtherPlayers();
		UIUpdatePlayerRole();
		
		UIUpdateKingPlayers();
		UIUpdateLadyPlayers();
		UIUpdateAssassinPlayers();
	});
	socket.onReceiveEvent("EMIT", function(payload){
		console.log(payload);
		voting_results = payload.last_voting_result;
		past_votes = payload.past_votes;
		game_settings = payload.game_settings;
		UIUpdateVotingResult();
		if (payload.game_state == GameState.end && isHost){
			sendGameStatus("END",0);
		}
	});
	socket.onReceiveEvent("ROLES_INFO", function(payload){
		rolesCount = payload;
	});
	socket.onReceiveEvent("GAME_START", function(payload){
		console.log("Game starting..")
		$(".game-frame").removeClass("hidden");
		$("#role_selection").addClass("hidden");
	});

	if (typeof backendPlayers != "undefined"){
		players = backendPlayers;
	}

	UIUpdateGameStatus();

	updatePlayerVar();
	
	king_players_template = $("#king .player.template").parent().html();
	$("#king .player.template").parent().html("");
	
	lady_players_template = $("#lady .player.template").parent().html();
	$("#lady .player.template").parent().html("");

	ass_players_template = $("#assassinate .player.template").parent().html();
	$("#assassinate .player.template").parent().html("");

	other_players_template = $("#other-players #pallies").html();
	$("#other-players #pallies").html("");

	voting_result_template = $("#voting_result").html();
	$("#voting_result").html("");

	if (isHost && initializingState == GameState.selecting_roles){
		var $role = $("#role_selection");
		$role.removeClass("hidden");
		$role.find(".num_players").html(players.length);
		var $ul = $role.find("#available_roles");
		var html = ""
		var role_names = Object.keys(roles);
		role_names = role_names.sort((x, y)=>roles[x].alignment - roles[y].alignment);
		$.each(role_names, function(i, r){
			var role = roles[r];
			var align = role.alignment == 0 ? "good" : "evil";
			html += "<li class='list-group-item'>";
			html += "<h4 class='name "+align+"'><span class='num'>"+rolesCount[r].count+"</span> | "+r+"</h4>";
			html += "<div class='role'><div onclick='removeRole(this,\""+r+"\")'><h4>-</h4></div>";
			html += "<div onclick='addRole(this,\""+r+"\")'><h4>+</h4></div></div>";
			html += "</li>"
		})
		$ul.html(html);
		if (rolesCount.count == players.length){
			$("#role_selection .btn").attr("disabled", false);
		}else{
			$("#role_selection .btn").attr("disabled", true);
		}
	}else if(initializingState != GameState.selecting_roles){
		$(".game-frame").removeClass("hidden");
		$("#role_selection").addClass("hidden");
	}

});
function updatePlayerVar(){
	$.each(players, function(i, p){
		if (p.id == myID){
			player = p;
		}
	});
	if (typeof player.role != "undefined" && roles[player.role].alignment == 0){
		// Player is good, cannot fail quests
		playerIsGood = true;
	}
}
function UIUpdateGameStatus(ev, payload){
	$("#game-state .item").addClass("hidden");
	$("#game-state .card-body").removeClass("hidden");
	switch(ev){
		case "KING":
			$("#game-state #king").removeClass("hidden");
			kingSelectableNum = Math.abs(parseInt(payload));
			$("#game-state #king .num").html(kingSelectableNum);
			break;
		case "LADY":
			$("#game-state #lady").removeClass("hidden");
			break;
		case "VOTE":
			$("#game-state #vote").removeClass("hidden");
			var string = ""
			$.each(payload, function(i, p){
				string += "<li><h5>>"+p+"</h5></li>";
			});
			$("#game-state #vote ul").html(string);
			voting_results = {};
			UIUpdateVotingResult();
			break;
		case "QUEST":
			$("#game-state #onquest").removeClass("hidden");
			break;
		case "ASSASSINATE":
			if (player.role == "Assassin"){
				$("#game-state #assassinate").removeClass("hidden");
			}
			break;
		default:
			$("#game-state .card-body").addClass("hidden");
			break;
	}
}

function UIUpdateKingPlayers(){
	var $list = $("#king .row");
	kingSelectedPlayers = [];
	$list.html("");
	$.each(players, function(i, player){
		$list.append(king_players_template);
		var $player = $list.find(".player:last");
		$player.attr("p-name", player.name)
		$player.attr("p-id", player.id)
		$player.find("h3").html(player.name);
	});
}

function UIUpdateLadyPlayers(){
	var $list = $("#lady .row");
	$list.html("");
	$.each(players, function(i, p){
		if (p.id != player.id){
			$list.append(lady_players_template);
			var $player = $list.find(".player:last");
			$player.attr("p-name", p.name)
			$player.attr("p-id", p.id)
			$player.find("h3").html(p.name);
		}
	});
}

function UIUpdateAssassinPlayers(){
	var $list = $("#assassinate .row");
	$("#assassinate .btn").attr("disabled", true);
	assassinSelectedPlayers = -1;
	$list.html("");
	$.each(players, function(i, p){
		if (p.id != player.id){
			$list.append(ass_players_template);
			var $player = $list.find(".player:last");
			$player.attr("p-name", p.name)
			$player.attr("p-id", p.id)
			$player.find("h3").html(p.name);
		}
	});
}

function UIUpdateOtherPlayers(){
	var $list = $("#pallies");
	$list.html("");
	$.each(players, function(i, player){
		if (myID != player.id){
			$list.append(other_players_template);
			var $player = $list.find("li:last");
			if (player.role){
				$player.find(".name").html(player.name);
				$player.find(".role").html(player.role);
			}
			else{
				$player.find(".name").html(player.name);
				$player.find(".role").html("?");
			}
		}
	});	
}

function UIUpdatePlayerRole(){
	if (player.role){
		if (typeof roles[player.role].img != "string"){
			$("#player-card #pcard img").attr("src", roles[player.role].img[randInt(0,roles[player.role].img.length)]);
		}else{
			$("#player-card #pcard img").attr("src", roles[player.role].img);
		}
		$("#player-card #pcard .role").html(player.role);
		$("#player-card #pcard .description").html(roles[player.role].description);
		var align = roles[player.role].alignment == 1 ? "(Evil)" : "(Good)";
		$("#player-card #pcard .align").html(align);
	}
}

function UIUpdateVotingResult(){
	var show = false;
	if (players.length == Object.keys(voting_results).length) show = true;
	
	$list = $("#voting_result");
	$list.html("");	
	$.each(players, function(i, p){
		$list.append(voting_result_template);
		$li = $list.find("li:last");
		$li.find(".name").html(p.name);
		$li.removeClass("hidden");
		$r = $li.find(".role");
		$r.addClass("unknown");
		if (show && p.id in voting_results){
			$r.removeClass("unknown");
			if (voting_results[p.id]){
				$r.removeClass("reject").addClass("accept");
			}else{
				$r.removeClass("accept").addClass("reject");
			}
		}else{
			//$li.addClass("hidden");
		}
	});

	if (game_settings.showPastVotes)
		UIUpdatePastVotes();
	else{
		$("#past-votes").addClass("hidden");
	}
}

function UIUpdatePastVotes(){
	if (past_vote_template == "") {
		past_vote_template = $("#pvotes li.template").parent().html();
		$("#pvotes li.template").parent().html("");
	}

	$list = $("ul#pvotes");
	$list.html("");

	for (var i = 0; i < past_votes.length; i++) {
		$list.append(past_vote_template);
		var $li = $list.find("li:last");
		$li.find(".sub-header").html("Quest " + (i+1));
		UIUpdatePastVotesTable($li.find(".table"), past_votes[i]);
	}
}
function UIUpdatePastVotesTable($table, iterations){
	$table.html("");
	var s = "";
	s += "<tr><th></th>";
	for (var i = 0; i < iterations.length; i++){
		s += "<th>" + (i+1) + "</th>";
	}
	s += "/<tr>";
	for (var i = 0; i < players.length; i++){
		s += "<tr><td>" + players[i].name + "</td>";
		for (var j = 0; j < iterations.length; j++){
			var c = iterations[j][players[i].id] ? "accept" : "reject";
			s += "<td class='" + c + "'></td>";
		}
		s += "/<tr>";
	}
	$table.html(s);
}

function randInt(l, h){
		// inclusive, exclusive
		return Math.floor(Math.random() * (h - l));	
}

function hideID(id){
	var $obj = $("#" + id);
	if ($obj.hasClass("hidden")){
		$obj.removeClass("hidden");
	}else{
		$obj.addClass("hidden");
	}
}

function selectPlayer(obj){
	var p_id = $(obj).attr("p-id");
	var king_ind = kingSelectedPlayers.indexOf(p_id);
	
	if($(obj).hasClass("selected")){
		$(obj).removeClass("selected");
		if (king_ind >= 0) kingSelectedPlayers.splice(king_ind, 1);
	}else{
		$(obj).addClass("selected");
		if (king_ind < 0) kingSelectedPlayers.push(p_id);
	}

	if (kingSelectedPlayers.length == kingSelectableNum && kingSelectableNum != 0){
		$("#king .btn").attr("disabled", false);
	}else{
		$("#king .btn").attr("disabled", true);
	}
}
function selectPlayerLoyalty(obj){
	var p_id = $(obj).attr("p-id");
	sendGameStatus("LADY", parseInt(p_id));
}

function selectTarget(obj){
	var p_id = $(obj).attr("p-id");
	
	$("#assassinate .row div").removeClass("selected");
	$(obj).addClass("selected");
	
	assassinSelectedPlayers = p_id;
	$("#assassinate .btn").attr("disabled", false);
}

function sendGameStatus(ev, load){
	$popup = $("#popup");
	$popup.find(".no").removeClass("hidden");
	$popup.find(".yes").removeClass("hidden");
	$popup.removeClass("hidden");
	
	switch(ev){
		case "KING":
			$popup.find(".header").html("King");
			var body = "You want to send these players on quest?<br>";
			for (var i = 0; i < players.length; i++){
				if (kingSelectedPlayers.indexOf(players[i].id.toString()) >= 0) {
					body += " > " + players[i].name + "<br>";
				}
			}
			$popup.find(".body").html(body);
			$popup.find(".yes").attr("onclick", "sendSelectedPlayers()");
			$popup.find(".no").attr("onclick", '{$("#popup").addClass("hidden");}');
			break;
		case "LADY":
			$popup.find(".header").html("Lady");
			var p;
			for (var i = 0; i < players.length; i++) {
				if (players[i].id == load) p = players[i];
			}
			$popup.find(".body").html("You want to see " + p.name + "'s loyalty? Result will show up in <b>Other Roles</b>");
			$popup.find(".yes").attr("onclick", "revealPlayerLoyalty("+load+")");
			$popup.find(".no").attr("onclick", '{$("#popup").addClass("hidden");}');
			break;
		case "VOTE":
			$popup.find(".header").html("Voting");
			$popup.find(".body").html("You are " + (load ? "ACCEPTING" : "REJECTING"));
			$popup.find(".yes").attr("onclick", "sendVote("+load+")");
			$popup.find(".no").attr("onclick", '{$("#popup").addClass("hidden");}');
			break;
		case "QUEST":
			$popup.find(".header").html("Questing");
			if (!load && playerIsGood){
				// Good Player is trying to fail
				$popup.find(".body").html("You are good, you cannot FAIL a quest.");
				$popup.find(".yes").attr("onclick", '{$("#popup").addClass("hidden");}');
				$popup.find(".no").addClass("hidden");
			} else {			
				$popup.find(".body").html("You want to " + (load ? "PASS" : "FAIL") + " the quest?");
				$popup.find(".yes").attr("onclick", "sendQuestResult("+load+")");	
				$popup.find(".no").attr("onclick", '{$("#popup").addClass("hidden");}');
			}
			break;
		case "ASSASSINATE":
			$popup.find(".header").html("Assassination");
			var name = "";
			for (var i = 0; i < players.length; i++){
				if (players[i].id == assassinSelectedPlayers) name = players[i].name;
			}
			$popup.find(".body").html("You want to assassinate " + name + "?");
			$popup.find(".yes").attr("onclick", "sendAssasinate("+ assassinSelectedPlayers +")");
			$popup.find(".no").attr("onclick", '{$("#popup").addClass("hidden");}');
			break;
		case "END":
			$popup.find(".header").html("GAME OVER");
			$popup.find(".body").html("Would you like to restart or go home.")
			$popup.find(".yes").html("Restart").attr("onclick", "{socket.restartGame()}");
			$popup.find(".no").html("Home").attr("onclick", "{socket.returnHome()}");
			break;
	}
}

function sendSelectedPlayers(){
	// king selected players.
	$("#popup").addClass("hidden");
	socket.sendEvent("PLAYER_KING_SELECT", kingSelectedPlayers);
	UIUpdateGameStatus();
}
function revealPlayerLoyalty(selectedID){
	$("#popup").addClass("hidden");
	socket.sendEvent("PLAYER_LADY_SELECT", selectedID);
	UIUpdateGameStatus();
}
function sendVote(vote){
	$("#popup").addClass("hidden");
	socket.sendEvent("PLAYER_VOTE", vote);
	UIUpdateGameStatus();
}
function sendQuestResult(res){
	$("#popup").addClass("hidden");
	socket.sendEvent("PLAYER_QUEST", res);
	UIUpdateGameStatus();
}
function sendAssasinate(playerID){
	// used by Assassin only.
	$("#popup").addClass("hidden");
	$("#assassinate").addClass("hidden");
	socket.sendEvent("PLAYER_ASSASSINATE", playerID);
}
function sendRequestEmit(){
	socket.sendEvent("EMIT", 1);
}

function numOfAlignment(a){
	// a: 0=good, 1=evil
	return rolesCount.alignment[a];
}
function sendRoles(){
	socket.sendEvent("PLAYER_ROLES", {
		ev: "CONFIRM"
	});
}
function addRole(obj, role){
	var pcount = players.length;
	pcount = pcount < 5 ? 5 : pcount;
	if (rolesCount.count < players.length){
		if (rolesCount[role].count < rolesCount[role].max &&
			numOfAlignment(roles[role].alignment) < rolesCount.distribution[pcount][roles[role].alignment]){
			rolesCount[role].count += 1;
			rolesCount.count += 1;
			rolesCount.alignment[roles[role].alignment] += 1;
			socket.sendEvent("PLAYER_ROLES", {
				ev: "ADD",
				role: role
			});
		}		
		$(obj).closest(".list-group-item").find(".num").html(rolesCount[role].count);
	}
	if (rolesCount.count == players.length){
		$("#role_selection .btn").attr("disabled", false);
	}else{
		$("#role_selection .btn").attr("disabled", true);
	}
}

function removeRole(obj, role){
	if (rolesCount[role].count > rolesCount[role].min &&
		numOfAlignment(roles[role].alignment) > 0){
		rolesCount[role].count -= 1;
		rolesCount.count -= 1;
		rolesCount.alignment[roles[role].alignment] -= 1;
		$(obj).closest(".list-group-item").find(".num").html(rolesCount[role].count);
		socket.sendEvent("PLAYER_ROLES", {
			ev: "REMOVE",
			role: role
		});
	}

	if (rolesCount.count == players.length){
		$("#role_selection .btn").attr("disabled", false);
	}else{
		$("#role_selection .btn").attr("disabled", true);
	}
}

function changeSettings(obj, key){
	game_settings[key] = obj.checked;
	console.log(game_settings);
	socket.sendEvent("PLAYER_SETTINGS", game_settings);
}
