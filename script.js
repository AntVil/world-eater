

var can;
var c;


var controls;
var game;

var frame;

function fitCanvas(){
    var factor = 2;
    can.width = Math.min(window.innerWidth, window.innerHeight*factor) - 10;
    can.height = can.width/factor;
    c = can.getContext("2d");
}

window.onload = function(){
    can = document.getElementById("can");
    fitCanvas();


    controls = new Controls();
    document.addEventListener("mousedown", function(){
        controls.mousePress();
    });
    document.addEventListener("mouseup", function(){
        controls.mouseReleased();
    });
    document.addEventListener("keydown", function(){
        controls.keyPress();
    });
    document.addEventListener("keyup", function(){
        controls.keyReleased();
    });
    document.addEventListener("touchstart", function(){
        controls.touchStart();
    });
    document.addEventListener("touchend", function(){
        controls.touchEnded();
    });

    game = new Game();

    frame = 0;
    loop();
}

window.onresize = fitCanvas;

window.onorientationchange = fitCanvas;





function loop(){
    c.fillStyle = "#3FB2FF";
    c.fillRect(0, 0, can.width, can.height);

    game.input(controls);
    game.update();
    game.render(c, frame, can.width, can.height);

    frame++;
    requestAnimationFrame(loop);
}


function Controls(){
    this.holdingdown = false;

    this.mousePress = function(){
        this.holdingdown = true;
    }

    this.keyPress = function(){
        this.holdingdown = true;
    }

    this.touchStart = function(){
        this.holdingdown = true;
    }

    this.mouseReleased = function(){
        this.holdingdown = false;
    }

    this.keyReleased = function(){
        this.holdingdown = false;
    }

    this.touchEnded = function(){
        this.holdingdown = false;
    }
}


function Game(){
    this.xCameraOffset = 0.15;
    this.yCameraOffset = 0.5;

	this.worm = new Worm(0, 0);
	
	this.coins = [];
	this.coins.push(new Coin(this.worm.x + 0.5, Math.random()));

    this.map = new Map();

    this.input = function(controls){
        if(controls.holdingdown){
            this.worm.dig();
        }
    }

    this.update = function(){
		this.worm.update(this.map);
		
		if(Math.random() < 0.01){
			this.coins.push(new Coin(this.worm.x + 2, Math.random()));
		}

		for(var i=this.coins.length-1;i>=0;i--){
			if(this.coins[i].touchingWorm(this.worm)){
				this.coins.splice(i, 1);
			}else if(this.coins[i].x < this.worm.x - this.xCameraOffset){
				this.coins.splice(i, 1);
			}
		}
    }

    this.render = function(c, frame, width, height){
        this.map.render(c, frame, width, height, this.worm.x, -this.worm.y, this.xCameraOffset, this.yCameraOffset);
        this.worm.renderTrail(c, frame, width, height, this.xCameraOffset, this.yCameraOffset);
        this.map.renderInverse(c, frame, width, height, this.worm.x, -this.worm.y, this.xCameraOffset, this.yCameraOffset);
		this.worm.render(c, frame, width, height, this.xCameraOffset, this.yCameraOffset);
		
		for(var i=0;i<this.coins.length;i++){
			this.coins[i].render(c, frame, width, height, this.worm.x, -this.worm.y, this.xCameraOffset, this.yCameraOffset);
		}

		this.worm.renderStats(c, frame, width, height);
    }
}


function Map(){
    this.noiseSeed = Math.random();

    this.render = function(c, frame, width, height, left, up, xCameraOffset, yCameraOffset){
        c.fillStyle = "#69472c";
        c.beginPath();
        c.moveTo(0, height);
        for(var i=0;i<1.1;i+=0.01){
            c.lineTo(width * i, (this.getHeightAt(i + left - xCameraOffset) + up + yCameraOffset) * height);
        }
        c.lineTo(width, height);
        c.fill();


        c.fillStyle = "#999999";
		//c.fillRect(0, height * (1.5 + up), width, height);
		

		c.beginPath();
        c.moveTo(0, height);
        for(var i=0;i<1.1;i+=0.01){
            c.lineTo(width * i, (this.getBedrockHeight(i + left - xCameraOffset) + up + yCameraOffset) * height);
        }
        c.lineTo(width, height);
        c.fill();
    }

    this.renderInverse = function(c, frame, width, height, left, up, xCameraOffset, yCameraOffset){
        c.fillStyle = "#3FB2FF";
        c.beginPath();
        c.moveTo(0, 0);
        for(var i=0;i<1.1;i+=0.01){
            c.lineTo(width * i, (this.getHeightAt(i + left - xCameraOffset) + up + yCameraOffset) * height);
        }
        c.lineTo(width, 0);
        c.fill();
    }

    this.getHeightAt = function(x){
        noise.seed(this.noiseSeed);
		return Math.abs(noise.perlin2(1, x)) + (noise.perlin2(5, x)+1)/2;
	}
	
	this.getBedrockHeight = function(x){
		noise.seed(this.noiseSeed);
		return (noise.perlin2(2, x)+1)/2 + 1;
	}
}


function Worm(x, y){
    this.x = x;
    this.y = y;
    this.xSpeed = 0.01;
    this.ySpeed = 0;
	this.width = 0.025;

    this.diging = false;

	this.underground = false;
	
	this.health = 1;
	this.coins = 0;

    this.history = [];
    for(var i=0;i<50;i++){
        this.history.push([this.x, this.y]);
	}
	

	//physics constants
	this.inAirDigingXSpeedAdd = 0.005;
	this.inAirDigingYSpeedAdd = -0.001;
	this.underGroundDigingYSpeedAdd = 0.002;
	this.underGroundDigingMaxYSpeed = 0.01;
	this.underGroundDigingXSpeed = 0.01;
	this.inAirYSpeedAdd = 0.0005;
	this.underGroundYSpeedAdd = -0.0025;
	this.underGroundXSpeedAdd = -0.01;
	this.slopeDistance = 0.01;
	this.slopeDivisionFactor = 50;
	this.ySpeedFriction = 0.98;
	this.minXSpeed = 0.01;

	this.healthDegeneration = 0.001;


    this.renderTrail = function(c, frame, width, height, xCameraOffset, yCameraOffset){
        c.strokeStyle = "#39170c";
        c.lineWidth = Math.round(2 * (this.width + 0.01) * width);
        c.beginPath();
        c.lineTo((this.history[0][0] - this.x + xCameraOffset) * width, (this.history[0][1]-this.y + yCameraOffset) * height);
        for(var i=0;i<this.history.length;i++){
            c.lineTo((this.history[i][0] - this.x + xCameraOffset) * width, (this.history[i][1]-this.y + yCameraOffset) * height);
        }
        c.stroke();

        c.fillStyle = "#39170c";
        c.beginPath();
        c.arc((this.history[0][0] - this.x + xCameraOffset) * width, (this.history[0][1]-this.y + yCameraOffset) * height, Math.round(2 * (this.width + 0.01) * width)/2, 0, 2*Math.PI);
        c.fill();
    }

    this.render = function(c, frame, width, height, xCameraOffset, yCameraOffset){
        c.fillStyle = "#F8C5De";
        for(var i=0;i<this.history.length;i+=5){
            c.beginPath();
            c.arc((this.history[i][0] - this.x + xCameraOffset) * width, (this.history[i][1]-this.y + yCameraOffset) * height, this.width * width * (this.history.length - i/2)/this.history.length, 0, 2*Math.PI);
            c.fill();
        }
	}
	
	this.renderStats = function(c, frame, width, height){
		c.fillStyle = "#FF0000";
		c.fillRect(width*0.33, height * 0.05, width*0.33, height*0.05);

		if(this.health > 0){
			c.fillStyle = "#00FF00";
			c.fillRect(width*0.33, height * 0.05, width*0.33*this.health, height*0.05);
		}

		c.lineWidth = height*0.01;
		c.strokeStyle = "#666666";
		c.strokeRect(width*0.33, height * 0.05, width*0.33, height*0.05);


		c.fillStyle = "#FFFFFF";
		c.font = Math.round(height * 0.05) + "px arial";
		c.fillText(this.coins, 0.025 * width, 0.05 * height);
	}

    this.update = function(map){
        if(this.diging){
            if(map.getHeightAt(this.x) - this.width > this.y){
				this.ySpeed += this.inAirDigingXSpeedAdd;
				this.xSpeed += this.inAirDigingYSpeedAdd;
            }else{
				this.underground = true;
				this.ySpeed = Math.min(this.ySpeed + this.underGroundDigingYSpeedAdd, this.underGroundDigingMaxYSpeed);
				this.xSpeed = this.underGroundDigingXSpeed;
            }
        }else{
            if(map.getHeightAt(this.x) - this.width > this.y){
				//in air
				this.ySpeed += this.inAirYSpeedAdd;
                this.underground = false;
            }else{
                if(this.underground){
					//going up
					this.ySpeed += this.underGroundYSpeedAdd;
					this.xSpeed += this.underGroundXSpeedAdd;
                }else{
					//on slope
					this.y = map.getHeightAt(this.x) - this.width;
					this.ySpeed = 0;
					this.xSpeed += (map.getHeightAt(this.x + this.slopeDistance) - map.getHeightAt(this.x)) / this.slopeDivisionFactor;
                }
            }
        }
		
		this.xSpeed = Math.max(this.minXSpeed, this.xSpeed);
        this.ySpeed *= this.ySpeedFriction;

        this.x += this.xSpeed;
        this.y += this.ySpeed;

        if(this.y > map.getBedrockHeight(this.x) - this.width){
            this.y = map.getBedrockHeight(this.x) - this.width;
            this.ySpeed = -this.underGroundDigingYSpeedAdd;
        }

        this.history.pop();
        this.history.unshift([this.x, this.y]);
		this.diging = false;
		
		this.health -= this.healthDegeneration;
    }

    this.dig = function(){
        this.diging = true;
	}
	
	this.increaseCoins = function(){
		this.coins++;
	}
}




function Coin(x, y){
	this.x = x;
	this.y = y;
	this.width = 0.025;

	this.render = function(c, frame, width, height, left, up, xCameraOffset, yCameraOffset){
		c.fillStyle = "#f7df68";
		c.beginPath();
		var mod = 25;
		c.arc((this.x + xCameraOffset - left) * width, (this.y + yCameraOffset + up) * height, this.width * width * (frame % mod)/mod, 0, 2*Math.PI);
		c.fill();
	}

	this.touchingWorm = function(worm){
		if(Math.hypot(worm.x - this.x, worm.y - this.y) < worm.width + this.width){
			worm.increaseCoins();
			return true;
		}else{
			return false;
		}
	}
}










/*
source: https://github.com/josephg/noisejs/blob/master/perlin.js
*/


/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */

(function(global){
	var module = global.noise = {};
  
	function Grad(x, y, z) {
	  this.x = x; this.y = y; this.z = z;
	}
	
	Grad.prototype.dot2 = function(x, y) {
	  return this.x*x + this.y*y;
	};
  
	Grad.prototype.dot3 = function(x, y, z) {
	  return this.x*x + this.y*y + this.z*z;
	};
  
	var grad3 = [new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),
				 new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),
				 new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)];
  
	var p = [151,160,137,91,90,15,
	131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
	190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
	88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
	77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
	102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
	135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
	5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
	223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
	129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
	251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
	49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
	138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
	// To remove the need for index wrapping, double the permutation table length
	var perm = new Array(512);
	var gradP = new Array(512);
  
	// This isn't a very good seeding function, but it works ok. It supports 2^16
	// different seed values. Write something better if you need more seeds.
	module.seed = function(seed) {
	  if(seed > 0 && seed < 1) {
		// Scale the seed out
		seed *= 65536;
	  }
  
	  seed = Math.floor(seed);
	  if(seed < 256) {
		seed |= seed << 8;
	  }
  
	  for(var i = 0; i < 256; i++) {
		var v;
		if (i & 1) {
		  v = p[i] ^ (seed & 255);
		} else {
		  v = p[i] ^ ((seed>>8) & 255);
		}
  
		perm[i] = perm[i + 256] = v;
		gradP[i] = gradP[i + 256] = grad3[v % 12];
	  }
	};
  
	module.seed(0);
  
	/*
	for(var i=0; i<256; i++) {
	  perm[i] = perm[i + 256] = p[i];
	  gradP[i] = gradP[i + 256] = grad3[perm[i] % 12];
	}*/
  
	// Skewing and unskewing factors for 2, 3, and 4 dimensions
	var F2 = 0.5*(Math.sqrt(3)-1);
	var G2 = (3-Math.sqrt(3))/6;
  
	var F3 = 1/3;
	var G3 = 1/6;
  
	// 2D simplex noise
	module.simplex2 = function(xin, yin) {
	  var n0, n1, n2; // Noise contributions from the three corners
	  // Skew the input space to determine which simplex cell we're in
	  var s = (xin+yin)*F2; // Hairy factor for 2D
	  var i = Math.floor(xin+s);
	  var j = Math.floor(yin+s);
	  var t = (i+j)*G2;
	  var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
	  var y0 = yin-j+t;
	  // For the 2D case, the simplex shape is an equilateral triangle.
	  // Determine which simplex we are in.
	  var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
	  if(x0>y0) { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
		i1=1; j1=0;
	  } else {	// upper triangle, YX order: (0,0)->(0,1)->(1,1)
		i1=0; j1=1;
	  }
	  // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
	  // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
	  // c = (3-sqrt(3))/6
	  var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
	  var y1 = y0 - j1 + G2;
	  var x2 = x0 - 1 + 2 * G2; // Offsets for last corner in (x,y) unskewed coords
	  var y2 = y0 - 1 + 2 * G2;
	  // Work out the hashed gradient indices of the three simplex corners
	  i &= 255;
	  j &= 255;
	  var gi0 = gradP[i+perm[j]];
	  var gi1 = gradP[i+i1+perm[j+j1]];
	  var gi2 = gradP[i+1+perm[j+1]];
	  // Calculate the contribution from the three corners
	  var t0 = 0.5 - x0*x0-y0*y0;
	  if(t0<0) {
		n0 = 0;
	  } else {
		t0 *= t0;
		n0 = t0 * t0 * gi0.dot2(x0, y0);  // (x,y) of grad3 used for 2D gradient
	  }
	  var t1 = 0.5 - x1*x1-y1*y1;
	  if(t1<0) {
		n1 = 0;
	  } else {
		t1 *= t1;
		n1 = t1 * t1 * gi1.dot2(x1, y1);
	  }
	  var t2 = 0.5 - x2*x2-y2*y2;
	  if(t2<0) {
		n2 = 0;
	  } else {
		t2 *= t2;
		n2 = t2 * t2 * gi2.dot2(x2, y2);
	  }
	  // Add contributions from each corner to get the final noise value.
	  // The result is scaled to return values in the interval [-1,1].
	  return 70 * (n0 + n1 + n2);
	};
  
	// 3D simplex noise
	module.simplex3 = function(xin, yin, zin) {
	  var n0, n1, n2, n3; // Noise contributions from the four corners
  
	  // Skew the input space to determine which simplex cell we're in
	  var s = (xin+yin+zin)*F3; // Hairy factor for 2D
	  var i = Math.floor(xin+s);
	  var j = Math.floor(yin+s);
	  var k = Math.floor(zin+s);
  
	  var t = (i+j+k)*G3;
	  var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
	  var y0 = yin-j+t;
	  var z0 = zin-k+t;
  
	  // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
	  // Determine which simplex we are in.
	  var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
	  var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
	  if(x0 >= y0) {
		if(y0 >= z0)	  { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
		else if(x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
		else			  { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
	  } else {
		if(y0 < z0)	  { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
		else if(x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
		else			 { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
	  }
	  // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
	  // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
	  // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
	  // c = 1/6.
	  var x1 = x0 - i1 + G3; // Offsets for second corner
	  var y1 = y0 - j1 + G3;
	  var z1 = z0 - k1 + G3;
  
	  var x2 = x0 - i2 + 2 * G3; // Offsets for third corner
	  var y2 = y0 - j2 + 2 * G3;
	  var z2 = z0 - k2 + 2 * G3;
  
	  var x3 = x0 - 1 + 3 * G3; // Offsets for fourth corner
	  var y3 = y0 - 1 + 3 * G3;
	  var z3 = z0 - 1 + 3 * G3;
  
	  // Work out the hashed gradient indices of the four simplex corners
	  i &= 255;
	  j &= 255;
	  k &= 255;
	  var gi0 = gradP[i+   perm[j+   perm[k   ]]];
	  var gi1 = gradP[i+i1+perm[j+j1+perm[k+k1]]];
	  var gi2 = gradP[i+i2+perm[j+j2+perm[k+k2]]];
	  var gi3 = gradP[i+ 1+perm[j+ 1+perm[k+ 1]]];
  
	  // Calculate the contribution from the four corners
	  var t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
	  if(t0<0) {
		n0 = 0;
	  } else {
		t0 *= t0;
		n0 = t0 * t0 * gi0.dot3(x0, y0, z0);  // (x,y) of grad3 used for 2D gradient
	  }
	  var t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
	  if(t1<0) {
		n1 = 0;
	  } else {
		t1 *= t1;
		n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
	  }
	  var t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
	  if(t2<0) {
		n2 = 0;
	  } else {
		t2 *= t2;
		n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
	  }
	  var t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
	  if(t3<0) {
		n3 = 0;
	  } else {
		t3 *= t3;
		n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
	  }
	  // Add contributions from each corner to get the final noise value.
	  // The result is scaled to return values in the interval [-1,1].
	  return 32 * (n0 + n1 + n2 + n3);
  
	};
  
	// ##### Perlin noise stuff
  
	function fade(t) {
	  return t*t*t*(t*(t*6-15)+10);
	}
  
	function lerp(a, b, t) {
	  return (1-t)*a + t*b;
	}
  
	// 2D Perlin Noise
	module.perlin2 = function(x, y) {
	  // Find unit grid cell containing point
	  var X = Math.floor(x), Y = Math.floor(y);
	  // Get relative xy coordinates of point within that cell
	  x = x - X; y = y - Y;
	  // Wrap the integer cells at 255 (smaller integer period can be introduced here)
	  X = X & 255; Y = Y & 255;
  
	  // Calculate noise contributions from each of the four corners
	  var n00 = gradP[X+perm[Y]].dot2(x, y);
	  var n01 = gradP[X+perm[Y+1]].dot2(x, y-1);
	  var n10 = gradP[X+1+perm[Y]].dot2(x-1, y);
	  var n11 = gradP[X+1+perm[Y+1]].dot2(x-1, y-1);
  
	  // Compute the fade curve value for x
	  var u = fade(x);
  
	  // Interpolate the four results
	  return lerp(
		  lerp(n00, n10, u),
		  lerp(n01, n11, u),
		 fade(y));
	};
  
	// 3D Perlin Noise
	module.perlin3 = function(x, y, z) {
	  // Find unit grid cell containing point
	  var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
	  // Get relative xyz coordinates of point within that cell
	  x = x - X; y = y - Y; z = z - Z;
	  // Wrap the integer cells at 255 (smaller integer period can be introduced here)
	  X = X & 255; Y = Y & 255; Z = Z & 255;
  
	  // Calculate noise contributions from each of the eight corners
	  var n000 = gradP[X+  perm[Y+  perm[Z  ]]].dot3(x,   y,	 z);
	  var n001 = gradP[X+  perm[Y+  perm[Z+1]]].dot3(x,   y,   z-1);
	  var n010 = gradP[X+  perm[Y+1+perm[Z  ]]].dot3(x,   y-1,   z);
	  var n011 = gradP[X+  perm[Y+1+perm[Z+1]]].dot3(x,   y-1, z-1);
	  var n100 = gradP[X+1+perm[Y+  perm[Z  ]]].dot3(x-1,   y,   z);
	  var n101 = gradP[X+1+perm[Y+  perm[Z+1]]].dot3(x-1,   y, z-1);
	  var n110 = gradP[X+1+perm[Y+1+perm[Z  ]]].dot3(x-1, y-1,   z);
	  var n111 = gradP[X+1+perm[Y+1+perm[Z+1]]].dot3(x-1, y-1, z-1);
  
	  // Compute the fade curve value for x, y, z
	  var u = fade(x);
	  var v = fade(y);
	  var w = fade(z);
  
	  // Interpolate
	  return lerp(
		  lerp(
			lerp(n000, n100, u),
			lerp(n001, n101, u), w),
		  lerp(
			lerp(n010, n110, u),
			lerp(n011, n111, u), w),
		 v);
	};
  
  })(this);
