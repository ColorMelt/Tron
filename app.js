var app = require('http').createServer(handler)
, io = require('socket.io').listen(app, { log: false })
, fs = require('fs');

app.listen(3700);

function handler (req, res) {
	fs.readFile(__dirname + '/index.html',
		function (err, data) {
		if (err) {
		res.writeHead(500);
		return res.end('Error loading index.html');
		}

		res.writeHead(200);
		res.end(data);
		});
}

//Game Board
var grid;
var dim = 400;
var clearGrid = function(dim){
	grid = [];
	for(var i=0; i<=dim; i++){
		grid[i] = [];
	}
}
//Clear Game
//Wait between games
var playerData = [];
var newPositions = [];
clearGrid(dim);

//Timing
var speed = 45;//ms
var lastTick = new Date().getTime(); //ms
var currTime = new Date().getTime();
var diff;
var gameLoop = function (){
	currTime = new Date().getTime();
	diff = currTime - lastTick;
	if(diff >= speed){
		movePlayers();
		lastTick = new Date().getTime(); //ms
		io.sockets.emit('newLocations', newPositions);
		newPositions = [];
	}
    setTimeout(gameLoop, speed);
}
gameLoop();

//Player Moving
var movePlayers = function(){
	for (var i=0; i<playerData.length; i++){
		switch(playerData[i].dir){
			case "DOWN":
				playerData[i].ypos += playerData[i].speed;
				break;
			case "RIGHT":
				playerData[i].xpos += playerData[i].speed;
				break;
			case "UP":
				playerData[i].ypos -= playerData[i].speed;
				break;
			case "LEFT":
				playerData[i].xpos -= playerData[i].speed;
				break;
		}
		playerData[i].lastdir = playerData[i].dir;
		playerData[i].changeColor();
		playerData[i].toroids();
		if ( !playerData[i].checkSpace() && playerData[i].alive ) {
			var obj = {pID: playerData[i].pID,
						x: playerData[i].xpos,
						y: playerData[i].ypos,
						color: playerData[i].color}
			newPositions.push(obj);
			playerData[i].tail.push(obj);
		}
		else {
			playerData[i].alive = false;
		}
		//markSpace(playerData[i].xpos, playerData[i].ypos);
	}
	for (var i=0; i<playerData.length; i++) {
		if (playerData[i].tail.length > 170) {
			var o = playerData[i].tail.shift();
			grid[o.x][o.y] = false;
		}
			playerData[i].addPositionToGrid();
	}
}

//Player Turning
var changePlayerDirection = function(i, dir){
	switch (dir) {
		case 40:
			if(playerData[i].lastdir != "UP"){
				playerData[i].dir = "DOWN";
			}
			break;
		case 39:
			if(playerData[i].lastdir != "LEFT"){
				playerData[i].dir = "RIGHT";
			}
			break;
		case 38:
			if(playerData[i].lastdir != "DOWN"){
				playerData[i].dir = "UP";
			}
			break;
		case 37:
			if(playerData[i].lastdir != "RIGHT"){
				playerData[i].dir = "LEFT";
			}
			break;
	}
}

//Player Creation
var names = ["Wilmer","Nathalie", "Lore", "Laurice",
	"Laurine", "Marlen", "Candis", "Shoshana",
	"Fransisca", "Monet", "Shanita", "Samuel",
	"Alana", "Delaine", "Reina", "Deonna",
	"Thomasena", "Susanne", "Kurt", "Laine"]

function Player(s)  {
	this.sID = s; //socketID
	this.pID = Math.floor(Math.random()*10000000);
	this.pname = names[Math.floor(Math.random()*20)];
	this.xpos = 0;
	this.ypos = 0;
	this.dir  = "DOWN";
	this.lastdir = "DOWN";
	this.speed = 5;
	this.alive = true;
	this.tail = [];
	this.tailLength = 100;
	//Random color
	this.colorRandom = function(){
		var a = Math.floor(Math.random()*3);
		var b = Math.floor(Math.random()*2);
		var c = (a + b)%3;
		var rgb = [Math.floor(Math.random()*156)+100,
			Math.floor(Math.random()*156)+100,
			Math.floor(Math.random()*156)+100];
		var sum = rgb[a] + rgb[b];
		rgb[a] = (sum < 255) ? sum : 255;
		rgb[c] = (sum < 255) ? 0 : sum - 255;
		return rgb;
	}
	this.colorCopy = function(color){
		return [color[0], color[1], color[2]];
	}
	this.color = this.colorRandom();
	this.colorStart = this.colorCopy(this.color);
	this.colorEnd = this.colorRandom();
	this.colorMaxDiff = function(){
		return Math.max(Math.abs(this.colorStart[0] - this.colorEnd[0]),
					Math.abs(this.colorStart[1] - this.colorEnd[1]),
					Math.abs(this.colorStart[2] - this.colorEnd[2]));
	}
	this.colorStep = 1;
	this.colorSteps = this.colorMaxDiff();

	this.colorInterpolation = function(i){
		var colorRatio = (this.colorStep/this.colorSteps);
		return Math.floor(colorRatio*(this.colorEnd[i] -
					this.colorStart[i])) + this.colorStart[i];
	}
	this.changeColor = function(){
		if(this.colorStep <= this.colorSteps){
			this.color = [this.colorInterpolation(0),
						this.colorInterpolation(1),
						this.colorInterpolation(2)];
			this.colorStep++;
		}
		else{
			this.colorStart = this.colorCopy(this.colorEnd);
			this.color = this.colorCopy(this.colorStart);
			this.colorEnd = this.colorRandom();
			this.colorSteps = this.colorMaxDiff();
			this.colorStep = 1;
		}
	}
	this.toroid = function(pos, min, max){
		if(pos > max)
			return min;
		if(pos < min)
			return max;
		return pos;
	}
	this.toroids = function(){
		this.xpos = this.toroid(this.xpos, 0, 400);
		this.ypos = this.toroid(this.ypos, 0, 400);
	}
	this.addPositionToGrid = function(){
		grid[this.xpos][this.ypos] = true;
	}
	this.checkSpace = function(){
		return grid[this.xpos][this.ypos];
	}
};

//Get Player ID from Socket ID
var getPlayerIndex = function(sID){
	for(var i=0; i<playerData.length; i++){
		if(sID == playerData[i].sID){
			return i;
		}
	}
	return -1;
}

var getPIDfSID = function(sID){
	for(var i=0; i<playerData.length; i++){
		if(sID == playerData[i].sID){
		}
	}
}

//Remove Player from Socket ID
var removePlayer = function(sID){
	for(var i=0; i<playerData.length; i++){
		if(sID == playerData[i].sID){
			playerData[i] = "dead";
		}
	}
}
var killPlayer = function(sID){
	for(var i=0; i<playerData.length; i++){
		if(sID == playerData[i].sID){
			playerData[i].alive = false;
		}
	}
}

function copyPlayer(p) {
	var player = {xpos : p.xpos, ypos : p.ypos, pID : p.pID,
					pname: p.pname, alive : p.alive,
					tail : p.tail, tailLength : p.tailLength}
	return player;
}

io.sockets.on('connection', function (socket) {
		console.log("  " + socket.id + " - connected!");
		for(var i = 0; i < playerData.length; i++){
			if(playerData[i].alive == true){
				socket.emit('newPlayer', copyPlayer(playerData[i]));
			}
			if (playerData[i].alive == false){
				console.log(playerData[i]);
			}
		}
		var p = new Player(socket.id);
		playerData.push(p);
		console.log(playerData[0]);
		io.sockets.emit('newPlayer', copyPlayer(p));

		socket.on('keys', function (data) {
			var pIndex = getPlayerIndex(socket.id);
			changePlayerDirection(pIndex, data.keycode);
			});

		socket.on('newPlayer', function (data) {
				console.log(socket.id);
				console.log("newPlayer id = " + data.id);
			});

		socket.on('disconnect', function () {
			console.log(socket.id + "disconnected");
			var pID = getPIDfSID(socket.id);
			removePlayer(socket.id);
			io.sockets.emit('disconnected', socket.id);
			});
	});
