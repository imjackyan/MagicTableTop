var print = console.log;
var socket;
var game;

var test = true;
$(document).ready(function(){
	socket = new MTSocket("main");
	game = new Game();
	game.initialize();
	game.startGame();

	socket.onReceiveEvent("PLAYER_ACTION", function(data){
		game.onReceiveEvent("", data);
	})

	if(test){
		$(document).keydown(function(ev){
			if(ev.keyCode == 38){
				//up
				game.onReceiveEvent("adfs", {p2:{y:1, id:game.p2ID}});
			}else if(ev.keyCode == 40){
				//down
				game.onReceiveEvent("adfs", {p2:{y:-1, id:game.p2ID}});
			}
		})
		$(document).keyup(function(ev){
			if(ev.keyCode == 38 || ev.keyCode == 40){
				game.onReceiveEvent("adfs", {p2:{y:0, id:game.p2ID}});
			}
		})
	}
});

function random(lower, upper){
	// [inclusive, exclusive]
	return Math.floor(Math.random() * (upper - lower)) + lower;
}

function Game(){
	// these fields contain info about x,y,rect(width,height,x1,y1,x2,y2)
	// speed,
	this.p1 = {};
	this.p2 = {};
	this.ball = {};
	this.window = {};
	this.walls = [{},{},{},{}];
	this.p1Score = 0;
	this.p2Score = 0;

	// these fields (prefixed with $) is the dom object
	this.$window;
	this.$canvas;
	this.ctx;

	//
	this.ballSpeed = 30;
	this.playerSpeed = 20;
	this.fps = 30;
	this.dT = 1000 / this.fps; // time since last frame in ms
	this.engine;

	this.initialize = function(){
		this.$window = $("#game-frame");
		this.$canvas = this.$window.find("canvas");

		this.$canvas.attr("width", this.$window.css("width"));
		this.$canvas.attr("height", this.$window.css("height"));
		this.ctx = this.$canvas[0].getContext("2d");

		this.window = {
			height: this.$window.height(),
			width: this.$window.width()
		}

		this.resetObjs();

		var buffer = 5;
		this.walls[0] = {x1: 0, x2: this.window.width,
						y1: buffer, y2: buffer}; //top
		this.walls[1] = {x1: this.window.width - buffer, x2: this.window.width - buffer,
						y1: 0, y2: this.window.height}; //right
		this.walls[2] = {x1: 0, x2: this.window.width,
						y1: this.window.height - buffer, y2: this.window.height - buffer}; //bottom
		this.walls[3] = {x1: buffer, x2: buffer,
						y1: 0, y2: this.window.height}; //left

		this.p1ID = p1ID;
		this.p2ID = p2ID;
	}

	this.getRect = function(o, w, h){
		var ret = {}
		ret.x1 = o.x - w/2;
		ret.x2 = ret.x1 + w;
		ret.y1 = o.y - h/2;
		ret.y2 = ret.y1 + h;
		ret.width = w;
		ret.height = h;
		return ret;
	}

	this.resetObjs = function(){
		this.p1 = {
			x: 50, y: this.window.height/2, color: "#FFFFFF",
		}
		this.p2 = {
			x: this.window.width-50, y: this.window.height/2, color: "#FFFFFF",
		}
		this.ball = {
			x: this.window.width / 2, y: this.window.height/2, color: "#FFFFFF", radius: 15
		}
		this.p1.rect = this.getRect(this.p1, 30, 200);
		this.p2.rect = this.getRect(this.p2, 30, 200);
		this.ball.rect = this.getRect(this.ball, this.ball.radius * 2, this.ball.radius * 2);

		this.p1.speed = this.playerSpeed;
		this.p2.speed = this.playerSpeed;
		this.ball.speed = this.ballSpeed;
	}

	this.startGame = function(){
		this.ball.dx = this.ballSpeed;
		this.ball.dy = this.ballSpeed * 0;
		this.p1.dx = 0; this.p1.dy = 0;
		this.p2.dx = 0; this.p2.dy = 0;
		this.engine = setInterval(() => this.update(), this.dT);
	}
	this.restartRound = function(){
		this.stopGame();
		this.resetObjs();
		this.startGame();
	}

	this.stopGame = function(){
		clearInterval(this.engine);
	}

	this.update = function(dT){
		dT = typeof dT == "undefined" ? this.dT : dT;

		this.updateMovement();
		this.updateCollision();
		this.updateDom(); // could use canvas instead?
	}

	this.updateCollision = function(){
		var maxAngleDeviate = 75 * Math.PI / 180; // depending on where the ball hits player, deviate angle
		var against = [this.p1, this.p2];
		for(var i = 0; i < against.length; i++){
			var p = against[i];
			var cRect = this.checkCollision(this.ball.rect, p.rect);
			if (cRect.width && 
				((this.ball.dx > 0 && this.ball.rect.x2 > this.p2.rect.x1) ||
				(this.ball.dx < 0 && this.ball.rect.x1 < this.p1.rect.x2))){
				var yCenter = cRect.y1 + (cRect.height / 2);
				var normalAngle = (p.y - yCenter) / (p.rect.height/2) * maxAngleDeviate;
				this.ball.dx = Math.abs(Math.cos(normalAngle) * this.ball.speed /this.ball.dx) * -this.ball.dx;
				this.ball.dy = Math.sin(normalAngle) * this.ball.speed;
				if(isNaN(this.ball.dx)){
					print("NAN");
				}
			}
		}

		// Check wall collision
		if (this.ball.rect.y1 < this.walls[0].y1 || this.ball.rect.y2 > this.walls[2].y2){
			this.ball.dy *= -1;
		}
		if (this.ball.rect.x1 < this.walls[3].x1){
			this.restartRound();
			this.p2Score += 1; 
		}
		if (this.ball.rect.x2 > this.walls[1].x2){
			this.restartRound();
			this.p1Score += 1; 
		}

		// Check player against updown wall
		if (this.p1.rect.y1 < 0){
			this.p1.y = this.p1.rect.height / 2; this.p1.rect.y1 = 0; 
			this.p1.rect.y2 = this.p1.rect.height;
			this.p1.dy = 0;
		}else if(this.p1.rect.y2 > this.window.height){
			this.p1.y = this.window.height - this.p1.rect.height / 2; 
			this.p1.rect.y1 = this.window.height - this.p1.rect.height;
			this.p1.rect.y2 = this.window.height; 
			this.p1.dy = 0;			
		}
		if (this.p2.rect.y1 < 0){
			this.p2.y = this.p2.rect.height / 2; this.p2.rect.y1 = 0; 
			this.p2.rect.y2 = this.p2.rect.height;
			this.p2.dy = 0;
		}else if(this.p2.rect.y2 > this.window.height){
			this.p2.y = this.window.height - this.p2.rect.height / 2; 
			this.p2.rect.y1 = this.window.height - this.p2.rect.height;
			this.p2.rect.y2 = this.window.height;
			this.p2.dy = 0;			
		}
	}

	this.checkCollision = function(r1, r2){
		var cRect = {};
		var overlap = true;
		if (r1.x1 > r2.x2 || r2.x1 > r1.x2 || r1.y1 > r2.y2 || r2.y1 > r1.y2){
			overlap = false;
		}
		if (overlap){
			cRect.x1 = (r2.x1 >= r1.x1 && r2.x1 <= r1.x2) ? r2.x1 : r1.x1;
			cRect.y1 = (r2.y1 >= r1.y1 && r2.y1 <= r1.y2) ? r2.y1 : r1.y1;
			cRect.x2 = (r1.x2 >= r2.x1 && r1.x2 <= r2.x2) ? r1.x2 : r2.x2;
			cRect.y2 = (r1.y2 >= r2.y1 && r1.y2 <= r2.y2) ? r1.y2 : r2.y2;
			cRect.width = cRect.x2 - cRect.x1;
			cRect.height = cRect.y2 - cRect.y1;
		}

		return cRect;
	}

	this.updateMovement = function(){
		var objs = [this.ball, this.p1, this.p2];
		for(var i = 0; i < objs.length; i++){
			var t = objs[i];
			t.x += t.dx;
			t.y -= t.dy;
			t.rect.x1 += t.dx;
			t.rect.y1 -= t.dy;
			t.rect.x2 += t.dx;
			t.rect.y2 -= t.dy;
		}
	}

	this.updateDom = function(){
		this.ctx.clearRect(0,0, this.$canvas[0].width, this.$canvas[0].height);
		this.drawRect(this.p1.rect.x1, this.p1.rect.y1, this.p1.rect.width, this.p1.rect.height, this.p1.color);
		this.drawRect(this.p2.rect.x1, this.p2.rect.y1, this.p2.rect.width, this.p2.rect.height, this.p2.color);
		this.drawCircle(this.ball.x, this.ball.y, this.ball.radius, this.ball.color);
		this.drawText(50, 70, this.p1Score, "white");
		this.drawText(this.window.width - 60, 70, this.p2Score, "white");
	}

	this.drawRect = function(x1, y1, w, h, clr){
		this.ctx.fillStyle = clr;
		this.ctx.fillRect(x1,y1,w,h);
	}

	this.drawCircle = function(x, y, r, clr){
		this.ctx.fillStyle = clr;
	    this.ctx.beginPath();
	    this.ctx.arc(x, y, r, 0, 2 * Math.PI);
	    this.ctx.fill();
	}
	this.drawText = function(x, y, text, clr){
		this.ctx.font = "50px Arial";
		this.ctx.fillStyle = "clr";
		this.ctx.fillText(text, x, y);
	}

	this.onReceiveEvent = function(ev, data){
		if (data.p1 && data.p1.id == this.p1ID){
			this.p1.dy = data.p1.y * this.playerSpeed;
		}
		if (data.p2 && data.p2.id == this.p2ID){
			this.p2.dy = -data.p2.y * this.playerSpeed;
		}
	}

}