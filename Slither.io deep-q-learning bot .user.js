/*
Copyright (c) 2016 Ermiya Eskandary & Théophile Cailliau and other contributors

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
// ==UserScript==
// @name         Slither.io deep-q-learning bot
// @namespace    http://slither.io/
// @version      0.9.6
// @description  Slither.io bot
// @author       Ermiya Eskandary & Théophile Cailliau
// @match        http://slither.io/
// @updateURL    https://github.com/ErmiyaEskandary/Slither.io-bot/raw/master/bot.meta.js
// @downloadURL  https://github.com/ErmiyaEskandary/Slither.io-bot/raw/master/bot.user.js
// @supportURL   https://github.com/ErmiyaEskandary/Slither.io-bot/issues
// @require      http://cs.stanford.edu/people/karpathy/convnetjs/build/convnet.js
// @require      https://github.com/karpathy/convnetjs/raw/master/build/util.js
// @require      https://github.com/karpathy/convnetjs/raw/master/build/vis.js
// @require      https://github.com/karpathy/convnetjs/raw/master/build/deepqlearn.js
// @grant        none
// ==/UserScript==
// Custom logging function - disabled by default
window.scores = [];

// Custom logging function - disabled by default
window.log = function() {
    if (window.logDebugging) {
        console.log.apply(console, arguments);
    }
};
window.getWidth = function() {
    return window.ww;
};
window.getHeight = function() {
    return window.hh;
};
window.getX = function() {
    return window.snake.xx;
};
window.getY = function() {
    return window.snake.yy;
};

window.getPos = function() {
    return {x:window.getX(), y:window.getY()};
};

window.getSnakeLength = function() {
    return (Math.floor(150 * (window.fpsls[window.snake.sct] + window.snake
                              .fam /
                              window.fmlts[window.snake.sct] - 1) - 50) / 10);
};
window.getSnakeWidth = function(sc) {
    sc = sc || window.snake.sc;
    return sc * 14.5;
};
window.getSnakeWidthSqr = function(sc) {
    sc = sc || window.snake.sc;
    var width = window.getSnakeWidth();
    return width*width;
};

var canvas = (function() {
    return {
        // Ratio of screen size divided by canvas size.
        canvasRatio: [window.mc.width / window.ww, window.mc.height /
                      window.hh
                     ],

        getScale: function() {
            return window.gsc;
        },

        //Screen coordinates
        // X = (0->WindowWidth)
        // Y = (0->WindowHeight)
        //
        //Mouse Coordinates
        // X = -Width  -> snake.xx -> Width
        // Y = -Height -> snake.yy -> Height
        //
        //Map Coordinates
        // X = 0 -> MapWidth
        // Y = 0 -> MapHeight
        //
        //Canvas Coordinates
        // X = 0 -> CanvasWidth
        // Y = 0 -> CanvasHeight

        // Spoofs moving the mouse to the provided coordinates.
        setMouseCoordinates: function(point) {
            window.xm = point.x;
            window.ym = point.y;
        },

        // Convert snake-relative coordinates to absolute screen coordinates.
        mouseToScreen: function(point) {
            var screenX = point.x + (window.ww / 2);
            var screenY = point.y + (window.hh / 2);
            return {
                x: screenX,
                y: screenY
            };
        },

        // Convert screen coordinates to canvas coordinates.
        screenToCanvas: function(point) {
            var canvasX = window.csc * (point.x * canvas.canvasRatio[
                0]) - parseInt(window.mc.style.left);
            var canvasY = window.csc * (point.y * canvas.canvasRatio[
                1]) - parseInt(window.mc.style.top);
            return {
                x: canvasX,
                y: canvasY
            };
        },

        // Convert map coordinates to mouse coordinates.
        mapToMouse: function(point) {
            var mouseX = (point.x - window.snake.xx) * window.gsc;
            var mouseY = (point.y - window.snake.yy) * window.gsc;
            return {
                x: mouseX,
                y: mouseY
            };
        },

        // Map cordinates to Canvas cordinate shortcut
        mapToCanvas: function(point) {
            var c = canvas.mapToMouse(point);
            c = canvas.mouseToScreen(c);
            c = canvas.screenToCanvas(c);
            return c;
        },

        // Map to Canvas coordinate conversion for drawing circles.
        // Radius also needs to scale by .gsc
        circleMapToCanvas: function(circle) {
            var newCircle = canvas.mapToCanvas(circle);
            return canvas.circle(
                newCircle.x,
                newCircle.y,
                circle.radius * window.gsc
            );
        },

        // Constructor for circle type
        circle: function(x, y, r) {
            var c = {
                x: Math.round(x),
                y: Math.round(y),
                radius: Math.round(r)
            };
            return c;
        },

        // Adjusts zoom in response to the mouse wheel.
        setZoom: function(e) {
            // Scaling ratio
            if (window.gsc) {
                window.gsc *= Math.pow(0.9, e.wheelDelta / -120 || e.detail / 2 || 0);
                window.desired_gsc = window.gsc;
            }
        },

        // Restores zoom to the default value.
        resetZoom: function() {
            window.gsc = 0.9;
            window.desired_gsc = 0.9;
        },

        // Maintains Zoom
        maintainZoom: function() {
            if (window.desired_gsc !== undefined) {
                window.gsc = window.desired_gsc;
            }
        },

        // Sets background to the given image URL.
        // Defaults to slither.io's own background.
        setBackground: function(url) {
            url = typeof url !== 'undefined' ? url : '/s/bg45.jpg';
            window.ii.src = url;
        },

        // Manual mobile rendering
        mobileRendering: function() {
            // Set render mode
            if (window.mobileRender) {
                canvas.setBackground(
                    'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs'
                );
                window.render_mode = 1;
            } else {
                canvas.setBackground();
                window.render_mode = 2;
            }
        },

        drawText: function(pos, color, txt) {
            var context = window.mc.getContext('2d');
            context.font = "10px Arial";
            context.fillStyle = color;
            context.fillText(txt,pos.x, pos.y);

            //context.fill();
        },
        // Draw a circle on the canvas.
        drawCircle: function(circle, colour, fill, alpha) {
            if (alpha === undefined) alpha = 1;
            if (circle.radius === undefined) circle.radius = 5;

            var context = window.mc.getContext('2d');
            var drawCircle = canvas.circleMapToCanvas(circle);

            context.save();
            context.globalAlpha = alpha;
            context.beginPath();
            context.strokeStyle = colour;
            context.arc(drawCircle.x, drawCircle.y, drawCircle.radius,
                        0, Math.PI * 2);
            context.stroke();
            if (fill) {
                context.fillStyle = colour;
                context.fill();
            }
            context.restore();
        },

        // Draw a rectangle
        drawRect: function(x, y, width, height, color) {
            var context = window.mc.getContext('2d');
            context.beginPath();
            context.rect(x, y, width, height);
            context.fillStyle = color;
            context.fill();
        },

        // Draw an angle.
        // @param {number} start -- where to start the angle
        // @param {number} angle -- width of the angle
        // @param {bool} danger -- green if false, red if true
        drawAngle: function(start, angle, danger) {
            var context = window.mc.getContext('2d');
            context.save();
            context.globalAlpha = 0.6;
            context.beginPath();
            context.moveTo(window.mc.width / 2, window.mc.height /
                           2);
            context.arc(window.mc.width / 2, window.mc.height / 2,
                        window.gsc * 100, start, angle);
            context.lineTo(window.mc.width / 2, window.mc.height /
                           2);
            context.closePath();
            context.fillStyle = (danger) ? 'red' : 'green';
            context.fill();
            context.stroke();
            context.restore();
        },

        // Draw a line on the canvas.
        drawLine: function(p1, p2, colour, width) {
            if (width === undefined) width = 5;
            var context = window.mc.getContext('2d');
            context.save();
            context.beginPath();
            context.lineWidth = width * window.gsc;
            context.strokeStyle = colour;
            context.moveTo(p1.x, p1.y);
            context.lineTo(p2.x, p2.y);
            context.stroke();
            context.restore();
        },

        // Draw a line on the canvas.
        drawLine2: function(x1, y1, x2, y2, width, colour) {
            var context = window.mc.getContext('2d');
            context.beginPath();
            context.lineWidth = width * canvas.getScale();
            context.strokeStyle = (colour === 'green') ? '#00FF00' : '#FF0000';
            context.moveTo(x1, y1);
            context.lineTo(x2, y2);
            context.stroke();
            context.lineWidth = 1;
        },

        // Check if a point is between two vectors.
        // The vectors have to be anticlockwise (sectorEnd on the left of sectorStart).
        isBetweenVectors: function(point, sectorStart, sectorEnd) {
            var center = [window.snake.xx, window.snake.yy];
            if (point.xx) {
                // Point coordinates relative to center
                var relPoint = {
                    x: point.xx - center[0],
                    y: point.yy - center[1]
                };
                return (!canvas.areClockwise(sectorStart, relPoint) &&
                        canvas.areClockwise(sectorEnd, relPoint));
            }
            return false;
        },

        // Angles are given in radians. The overall angle (endAngle-startAngle)
        // cannot be above Math.PI radians (180°).
        isInsideAngle: function(point, startAngle, endAngle) {
            // calculate normalized vectors from angle
            var startAngleVector = {
                x: Math.cos(startAngle),
                y: Math.sin(startAngle)
            };
            var endAngleVector = {
                x: Math.cos(endAngle),
                y: Math.sin(endAngle)
            };
            // Use isBetweenVectors to check if the point belongs to the angle
            return canvas.isBetweenVectors(point, startAngleVector,
                                           endAngleVector);
        },

        /*
         * Given two vectors, return a truthy/falsy value depending
         * on their position relative to each other.
         */
        areClockwise: function(vector1, vector2) {
            // Calculate the dot product.
            return -vector1.x * vector2.y + vector1.y * vector2.x >
                0;
        },

        // Given an object (of which properties xx and yy are not null),
        // return the object with an additional property 'distance'.
        getDistanceFromSnake: function(point) {
            point.distance = canvas.getDistance(window.snake.xx,
                                                window.snake.yy,
                                                point.xx, point.yy);
            return point;
        },

        getDistance: function(x1, y1, x2, y2) {
            var distance = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(
                y1 - y2, 2));
            return distance;
        },

        // Get distance squared
        getDistance2: function(x1, y1, x2, y2) {
            var distance2 = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2,
                                                            2);
            return distance2;
        },

        getDistance2FromSnake: function(point) {
            point.distance = canvas.getDistance2(window.snake.xx,
                                                 window.snake.yy,
                                                 point.xx, point.yy);
            return point;
        },
    };
})();


// A 2D vector utility
var Vec = function(x, y) {
    this.x = x;
    this.y = y;
};
Vec.prototype = {

    // utilities
    dist_from: function(v) { return Math.sqrt(Math.pow(this.x-v.x,2) + Math.pow(this.y-v.y,2)); },
    length: function() { return Math.sqrt(Math.pow(this.x,2) + Math.pow(this.y,2)); },

    // new vector returning operations
    add: function(v) { return new Vec(this.x + v.x, this.y + v.y); },
    sub: function(v) { return new Vec(this.x - v.x, this.y - v.y); },
    rotate: function(a) {  // CLOCKWISE
        return new Vec(this.x * Math.cos(a) + this.y * Math.sin(a),
                       -this.x * Math.sin(a) + this.y * Math.cos(a));
    },

    // in place operations
    scale: function(s) { this.x *= s; this.y *= s; },
    normalize: function() { var d = this.length(); this.scale(1.0/d); }
};
var line_intersect = function(p1,p2,p3,p4) {
    var denom = (p4.y-p3.y)*(p2.x-p1.x)-(p4.x-p3.x)*(p2.y-p1.y);
    if(denom===0.0) { return false; } // parallel lines
    var ua = ((p4.x-p3.x)*(p1.y-p3.y)-(p4.y-p3.y)*(p1.x-p3.x))/denom;
    var ub = ((p2.x-p1.x)*(p1.y-p3.y)-(p2.y-p1.y)*(p1.x-p3.x))/denom;
    if(ua>0.0&&ua<1.0&&ub>0.0&&ub<1.0) {
        var up = new Vec(p1.x+ua*(p2.x-p1.x), p1.y+ua*(p2.y-p1.y));
        return {ua:ua, ub:ub, up:up}; // up is intersection point
    }
    return false;
};
var line_point_intersect = function(p1,p2,p0,rad) {
    var v = new Vec(p2.y-p1.y,-(p2.x-p1.x)); // perpendicular vector
    var d = Math.abs((p2.x-p1.x)*(p1.y-p0.y)-(p1.x-p0.x)*(p2.y-p1.y));
    d = d / v.length();
    if(d > rad) { return false; }

    v.normalize();
    v.scale(d);
    var up = new Vec(0,0);
    up.x = p0.x + v.x;
    up.y = p0.y + v.y;
    if(Math.abs(p2.x-p1.x)>Math.abs(p2.y-p1.y)) {
        var ua = (up.x - p1.x) / (p2.x - p1.x);
    } else {
        var ua = (up.y - p1.y) / (p2.y - p1.y);
    }
    if(ua>0.0&&ua<1.0) {
        return {ua:ua, up:up};
    }
    return false;
};

// Eye sensor has a maximum range and senses walls
var Eye = function(angle) {
    this.angle = angle; // angle relative to agent its on
    this.max_range = 600;
    this.sensed_proximity = 600; // what the eye is seeing. will be set in world.tick()
    this.sensed_type = -1; // what does the eye see?
};
// A single agent
var Agent = function() {
    window.log("新規作成");
    // positional information
    this.p = new Vec(50,50);
    this.op = this.p; // old position
    this.angle = 0; // direction facing

    this.actions = [];
    this.actions.push([1,1]);
    this.actions.push([0.8,1]);
    this.actions.push([1,0.8]);
    this.actions.push([0.5,0]);
    this.actions.push([0,0.5]);

    // properties
    this.rad = 10;
    this.eyes = [];
    for(var k=0;k<9;k++) { this.eyes.push(new Eye((k-4)*0.25)); }

    // braaain
    //this.brain = new deepqlearn.Brain(this.eyes.length * 3, this.actions.length);
    var num_inputs = 27; // 9 eyes, each sees 3 numbers (wall, green, red thing proximity)
    var num_actions = 5; // 5 possible angles agent can turn
    var temporal_window = 1; // amount of temporal memory. 0 = agent lives in-the-moment :)
    var network_size = num_inputs*temporal_window + num_actions*temporal_window + num_inputs;

    // the value function network computes a value of taking any of the possible actions
    // given an input state. Here we specify one explicitly the hard way
    // but user could also equivalently instead use opt.hidden_layer_sizes = [20,20]
    // to just insert simple relu hidden layers.
    var layer_defs = [];
    layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth:network_size});
    layer_defs.push({type:'fc', num_neurons: 50, activation:'relu'});
    layer_defs.push({type:'fc', num_neurons: 50, activation:'relu'});
    layer_defs.push({type:'regression', num_neurons:num_actions});

    // options for the Temporal Difference learner that trains the above net
    // by backpropping the temporal difference learning rule.
    var tdtrainer_options = {learning_rate:0.001, momentum:0.0, batch_size:64, l2_decay:0.01};

    var opt = {};
    opt.temporal_window = temporal_window;
    opt.experience_size = 30000;
    opt.start_learn_threshold = 1000;
    opt.gamma = 0.7;
    opt.learning_steps_total = 200000;
    opt.learning_steps_burnin = 3000;
    opt.epsilon_min = 0.05;
    opt.epsilon_test_time = 0.05;
    opt.layer_defs = layer_defs;
    opt.tdtrainer_options = tdtrainer_options;

    var brain = new deepqlearn.Brain(num_inputs, num_actions, opt); // woohoo
    this.brain = brain;

    this.reward_bonus = 0.0;
    this.digestion_signal = 0.0;

    // outputs on world
    this.rot1 = 0.0; // rotation speed of 1st wheel
    this.rot2 = 0.0; // rotation speed of 2nd wheel

    this.prevactionix = -1;
    this.oldleng = 0;
};
Agent.prototype = {
    forward: function() {
        // in forward pass the agent simply behaves in the environment
        // create input to brain
        var num_eyes = this.eyes.length;
        var input_array = new Array(num_eyes * 3);
        for(var i=0;i<num_eyes;i++) {
            var e = this.eyes[i];
            input_array[i*3] = 1.0;
            input_array[i*3+1] = 1.0;
            input_array[i*3+2] = 1.0;
            if(e.sensed_type !== -1) {
                // sensed_type is 0 for wall, 1 for food and 2 for poison.
                // lets do a 1-of-k encoding into the input array
                input_array[i*3 + e.sensed_type] = e.sensed_proximity/e.max_range; // normalize to [0,1]
            }
        }

        // get action from brain
        var actionix = this.brain.forward(input_array);
        var action = this.actions[actionix];
        this.actionix = actionix; //back this up

        // demultiplex into behavior variables
        this.rot1 = action[0]*1;
        this.rot2 = action[1]*1;

        //this.rot1 = 0;
        //this.rot2 = 0;
    },
    backward: function() {
        // in backward pass agent learns.
        // compute reward 
        var proximity_reward = 0.0;
        var num_eyes = this.eyes.length;
        for(var i=0;i<num_eyes;i++) {
            var e = this.eyes[i];
            // agents dont like to see walls, especially up close
            proximity_reward += e.sensed_type === 0 ? e.sensed_proximity/e.max_range : 1.0;
            //if(e.sensed_type == 2) proximity_reward -= 0.25;
            if(e.sensed_type == 0) proximity_reward -= (e.max_range - e.sensed_proximity )/50;

        }
        proximity_reward = proximity_reward/num_eyes;
        proximity_reward = Math.min(1.0, proximity_reward * 2);

        // agents like to go straight forward
        var forward_reward = 0.0;
        if(this.actionix === 0 && proximity_reward > 0.75) forward_reward = 0.1 * proximity_reward;

        // agents like to eat good things
        var digestion_reward = this.digestion_signal;
        this.digestion_signal = 0.0;

        var leng_reward = 0;
        //if( window.getSnakeLength() - this.oldleng < 0){this.oldleng = window.getSnakeLength();console.log("He is dead");}
        leng_reward += (window.getSnakeLength() - this.oldleng)/25;
        leng_reward += window.getSnakeLength()/1000;

        if( window.getSnakeLength() - this.oldleng > 20){leng_reward += window.getSnakeLength()/50;console.log("ボーナス！");}
        if( this.oldleng - window.getSnakeLength() > 0){leng_reward -= 60.0;console.log("死亡確認");}
        this.oldleng = window.getSnakeLength();


        var reward = proximity_reward + forward_reward + digestion_reward + leng_reward;

        // pass to brain for learning
        this.brain.backward(reward);
    }
};


var bot = (function() {
    // Save the original slither.io onmousemove function so we can re enable it back later
    var original_onmousemove = window.onmousemove;
    var oldpos=0;

    return {
        ranOnce: false,
        tickCounter: 0,
        isBotRunning: false,
        isBotEnabled: true,
        collisionPoints: [],
        currentPath: [],
        radarResults: [],
        followLine: 0,

        hideTop: function () {

            var nsidivs = document.querySelectorAll('div.nsi');
            for (var i = 0; i < nsidivs.length; i++) {
                if (nsidivs[i].style.top === '4px' && nsidivs[i].style
                    .width === '300px') {
                    nsidivs[i].style.visibility = 'hidden';
                    nsidivs[i].style.zIndex = -1;
                    bot.isTopHidden = true;
                }
            }
        },

        startBot: function() {
            if (window.autoRespawn && !window.playing && bot.isBotEnabled &&
                bot.ranOnce && !bot.isBotRunning) {
                bot.connectBot();
                if (document.querySelector('div#lastscore').childNodes
                    .length > 1) {
                    window.scores.push(parseInt(document.querySelector(
                        'div#lastscore').childNodes[1].innerHTML));
                }
            }
            if (window.bso !== undefined) {
                var generalStyle =
                    '<span style = "opacity: 0.35";>';
                window.ip_overlay.innerHTML = generalStyle +
                    'Server: ' + window.bso.ip + ':' + window.bso.po;
            }
        },

        launchBot: function() {
            window.log('Starting Bot.');
            bot.isBotRunning = true;
            /*
             * Removed the onmousemove listener so we can move the snake
             * manually by setting coordinates
             */
            userInterface.onPrefChange();
            window.onmousemove = function() {};
            bot.hideTop();
            if(!bot.agents)bot.agents = new Agent();
        },

        // Stops the bot
        stopBot: function() {
            window.log('Stopping Bot.');
            window.setAcceleration(0); // Stop boosting
            // Re-enable the original onmousemove function
            window.onmousemove = original_onmousemove;
            bot.isBotRunning = false;
        },

        // Connects the bot
        connectBot: function() {
            if (!window.autoRespawn) return;
            bot.stopBot(); // Just in case
            window.log('Connecting...');

            window.connect();

            // Wait until we're playing to start the bot
            window.botCanStart = setInterval(function() {
                if (window.playing) {
                    bot.launchBot();
                    clearInterval(window.botCanStart);
                }
            }, 100);
        },

        forceConnect: function() {
            if (!window.connect) {
                return;
            }
            window.forcing = true;
            if (!window.bso) {
                window.bso = {};
            }
            window.currentIP = window.bso.ip + ':' + window.bso.po;
            var srv = window.currentIP.trim().split(':');
            window.bso.ip = srv[0];
            window.bso.po = srv[1];
            window.connect();
        },

        quickRespawn: function() {
            window.dead_mtm = 0;
            window.login_fr = 0;
            bot.forceConnect();
        },

        changeSkin: function() {
            if (window.playing && window.snake !== null) {
                var skin = window.snake.rcv;
                var max = window.max_skin_cv;
                skin++;
                if (skin > max) {
                    skin = 0;
                }
                window.setSkin(window.snake, skin);
            }
        },

        rotateSkin: function() {
            if (!window.rotateskin) {
                return;
            }
            bot.changeSkin();
            setTimeout(bot.rotateSkin, 500);
        },

        // Sorting by  property 'distance'
        sortDistance: function(a, b) {
            return a.distance - b.distance;
        },

        startlearn : function() {
            bot.agents.brain.learning = true;
        },
        stoplearn: function() {
            bot.agents.brain.learning = false;
        },

        // Sorting function for food, from property 'clusterCount'
        sortFood: function(a, b) {
            return (a.clusterScore === b.clusterScore ? 0 :
                    a.clusterScore / a.distance > b.clusterScore / b.distance ? -1 :
                    1);
        },
        computeFoodGoal: function() {
            var sortedFood = bot.getSortedFood();

            // eslint-disable-next-line no-unused-vars
            var bestClusterIndx = 0;
            var bestClusterScore = 0;
            var bestClusterAbsScore = 0;
            var bestClusterX = 20000;
            var bestClusterY = 20000;
            var clusterScore = 0;
            var clusterSize = 0;
            var clusterAbsScore = 0;
            var clusterSumX = 0;
            var clusterSumY = 0;

            // there is no need to view more points (for performance)
            var nIter = Math.min(sortedFood.length, 300);
            for (var i = 0; i < nIter; i += 2) {
                clusterScore = 0;
                clusterSize = 0;
                clusterAbsScore = 0;
                clusterSumX = 0;
                clusterSumY = 0;
                var p1 = sortedFood[i];
                for (var j = 0; j < nIter; ++j) {
                    var p2 = sortedFood[j];
                    var dist = canvas.getDistance2(p1.xx, p1.yy, p2
                                                   .xx, p2.yy);
                    if (dist < 100 * 100) {
                        clusterScore += p2.sz;
                        clusterSumX += p2.xx * p2.sz;
                        clusterSumY += p2.yy * p2.sz;
                        clusterSize += 1;
                    }
                }
                clusterAbsScore = clusterScore;
                clusterScore /= p1.distance;
                if (clusterSize > 2 && clusterScore >
                    bestClusterScore) {
                    bestClusterScore = clusterScore;
                    bestClusterAbsScore = clusterAbsScore;
                    bestClusterX = clusterSumX / clusterAbsScore;
                    bestClusterY = clusterSumY / clusterAbsScore;
                    bestClusterIndx = i;
                }
            }
            window.currentFoodX = bestClusterX;
            window.currentFoodY = bestClusterY;
            // if see a large cluster then use acceleration
            if (bestClusterAbsScore > 50) {
                window.foodAcceleration = 1;
            } else {
                window.foodAcceleration = 0;
            }
        },

        processSurround: function() {
            collisionGrid.initGrid(100, 100, 20);

            //bot.radarResults = collisionHelper.radarScan(15,1000);

        },
        getCollisionPoints: function() {
            bot.collisionPoints = [];
            var scPoint;

            for (var snake = 0, ls = window.snakes.length; snake <
                 ls; snake++) {
                scPoint = undefined;

                if (window.snakes[snake].nk !== window.snake.nk) {
                    if (window.visualDebugging) {
                        var hCircle = {
                            x: window.snakes[snake].xx,
                            y: window.snakes[snake].yy,
                            radius: window.getSnakeWidth(window
                                                         .snakes[snake].sc)
                        };
                        canvas.drawCircle(canvas.circleMapToCanvas(
                            hCircle), 'red', false);
                    }

                    for (var pts = 0, lp = window.snakes[snake].pts
                         .length; pts <
                         lp; pts++) {
                        if (!window.snakes[snake].pts[pts].dying) {
                            var collisionPoint = {
                                headxx: window.snakes[snake].xx,
                                headyy: window.snakes[snake].yy,
                                xx: window.snakes[snake].pts[
                                    pts].xx,
                                yy: window.snakes[snake].pts[
                                    pts].yy,
                                sc: window.snakes[snake].sc,
                                sp: window.snakes[snake].sp,
                                ang: window.snakes[snake].ang,
                                snake: snake
                            };

                            canvas.getDistance2FromSnake(
                                collisionPoint);

                            if (scPoint === undefined || scPoint.distance >
                                collisionPoint.distance) {
                                scPoint = collisionPoint;
                            }
                        }
                    }
                }
                if (scPoint !== undefined) {
                    bot.collisionPoints.push(scPoint);
                    if (window.visualDebugging) {
                        var cCircle = {
                            x: scPoint.xx,
                            y: scPoint.yy,
                            radius: window.getSnakeWidth(
                                scPoint.sc)
                        };
                        canvas.drawCircle(canvas.circleMapToCanvas(
                            cCircle), 'red', false);
                    }
                }
            }
            bot.collisionPoints.sort(bot.sortDistance);
        },

        stuff_collide_: function(p1, p2, check_walls, check_items) {
            var minres = false;

            // collision(type：0)
            // collide with walls
            if(check_walls) {
                bot.getCollisionPoints();
                if (bot.collisionPoints.length === 0) return false;

                for(var i=0,n=bot.collisionPoints.length;i<n;i++) {
                    var wallp = {
                        x : bot.collisionPoints[i].xx,
                        y : bot.collisionPoints[i].yy
                    };
                    var res = line_point_intersect(p1, p2, wallp ,300 );
                    if(res) {
                        res.type = 0; // 0 is wall
                        if(!minres) { minres=res; }
                        else {
                            // check if its closer
                            if(res.ua < minres.ua) {
                                // if yes replace it
                                minres = res;
                            }
                        }
                    }
                }
            }

            if(res.type != 0) {

                window.setAcceleration(0);
                bot.processSurround();

                // feed(type：1)
                // collide with items
                if(check_items) {
                    for(var j=0,k=window.foods.length;j<k;j++) {
                        if(window.foods[j]){
                            var foodPos = {x: window.foods[j].xx, y:window.foods[j].yy};

                            var res = line_point_intersect(p1, p2, foodPos, 50 );
                            if(res) {
                                res.type = 1; // store type of item
                                if(!minres) { minres=res; }
                                else { 
                                    if(res.ua < minres.ua) { minres = res; }
                                }
                            }
                        }
                    }
                }
            }


            return minres;
        },

        tickAI : function () {
            // process eyes
            var a = bot.agents;
            for(var ei=0,ne=a.eyes.length;ei<ne;ei++) {
                var e = a.eyes[ei];
                // we have a line from p to p->eyep
                var eyep = new Vec(a.p.x + e.max_range * Math.cos(a.angle + e.angle),
                                   a.p.y + e.max_range * Math.sin(a.angle + e.angle));
                var res = bot.stuff_collide_(a.p, eyep, true, true);
                if(res) {
                    // eye collided with wall
                    e.sensed_proximity = res.up.dist_from(a.p);
                    e.sensed_type = res.type;
                    //if(res.type == 0 && e.sensed_proximity < 40.0){a.digestion_signal += -6.0;console.log("-6")}
                    //if(res.type == 1 && e.sensed_proximity < 20.0){a.digestion_signal += 1.0;console.log("+1")}
                } else {
                    e.sensed_proximity = e.max_range;
                    e.sensed_type = 2;
                }
            }


            // let the agents behave in the world based on their input
            bot.agents.forward();


            // apply outputs of agents on evironment
            a.op = a.p; // back up old position
            a.oangle = a.angle; // and angle

            // steer the agent according to outputs of wheel velocities
            // There is no need to move the agent itself
            a.p = new Vec(window.snake.xx, window.snake.yy);
            a.angle = window.snake.ang;

            // Update the eye
            for(var ei=0,ne=bot.agents.eyes.length;ei<ne;ei++) {
                var e = bot.agents.eyes[ei];

                if (window.visualDebugging) {
                    var headCoord = {
                        x: a.p.x ,
                        y: a.p.y
                    };
                    var headCoord2 = {
                        x: a.p.x +  e.max_range * Math.cos(a.angle + e.angle),
                        y: a.p.y +  e.max_range * Math.sin(a.angle + e.angle)
                    };
                    var headCoord3 = {
                        x: a.p.x +  e.sensed_proximity * Math.cos(a.angle + e.angle),
                        y: a.p.y +  e.sensed_proximity * Math.sin(a.angle + e.angle)
                    };
                    //canvas.drawLine(canvas.mapToCanvas(headCoord),canvas.mapToCanvas(headCoord3),'white',1);
                    if(e.sensed_type == 0)canvas.drawLine(canvas.mapToCanvas(headCoord),canvas.mapToCanvas(headCoord3),'red',3);
                    if(e.sensed_type == 1)canvas.drawLine(canvas.mapToCanvas(headCoord),canvas.mapToCanvas(headCoord3),'green',3);
                    if(e.sensed_type == 2)canvas.drawLine(canvas.mapToCanvas(headCoord),canvas.mapToCanvas(headCoord3),'blue',3);
                }
            }

            // Action decision
            // steer the agent according to outputs of wheel velocities
            var v = new Vec(0, bot.agents.rad / 2.0);
            v = v.rotate(bot.agents.angle + Math.PI/2);
            var w1p = bot.agents.p.add(v); // positions of wheel 1 and 2
            var w2p = bot.agents.p.sub(v);
            var vv = bot.agents.p.sub(w2p);
            vv = vv.rotate(-bot.agents.rot1);
            var vv2 = bot.agents.p.sub(w1p);
            vv2 = vv2.rotate(bot.agents.rot2);
            var np = w2p.add(vv);
            np.scale(0.5);
            var np2 = w1p.add(vv2);
            np2.scale(0.5);
            var newpos = np.add(np2);

            var botangle = 0;
            botangle = bot.agents.angle;
            botangle -= bot.agents.rot1;
            if(botangle<0)botangle+=2*Math.PI;
            botangle += bot.agents.rot2;
            if(botangle>2*Math.PI)botangle-=2*Math.PI;

            //目標をセット
            var golp = {
                x : bot.agents.p.x + 300 * Math.cos(botangle),
                y : bot.agents.p.y + 300 * Math.sin(botangle)
            };
            window.goalCoordinates = golp;
            canvas.setMouseCoordinates(canvas.mapToMouse(
                window.goalCoordinates));

            // agents are given the opportunity to learn based on feedback of their action on environment
            bot.agents.backward();

        },
        // bot main
        // Called by the window loop, this is the main logic of the bot.
        thinkAboutGoals: function() {
            // If no enemies or obstacles, go after what you are going after

            window.setAcceleration(0);

            // It will not be updated while the dead
            if( oldpos.x != window.getPos().x && oldpos.y != window.getPos().y)
            {
                bot.agents.brain.learning = true;
                bot.tickAI();
            }
            else
            {
                bot.agents.brain.learning = true;
            }


            /*
            if(bot.tickCounter  > 100)
            {
                console.log(bot.agents.brain.average_reward_window.get_average());
                bot.tickCounter = 0;
            }
            */
            //bot.tickCounter++;

            oldpos = window.getPos();

            //bot.processSurround();
            //bot.astarFoodFinder();
        },

        currentState: 'findFood',

        state: {
            findFood: function() {
                if( !collisionGrid.foodGroups.length )
                    return;
                window.setAcceleration(0);
                var foodCnt = 0;
                var bestFood;
                var foodPos;
                var destpos;
                var curpos = window.getPos();
                window.goalCoordinates = window.goalCoordinates || {x:0,y:0};

                for(var i=0; i<collisionGrid.foodGroups.length; i++) {
                    bestFood = collisionGrid.foodGroups[i];
                    var foodcnt = bestFood.nodes.length;
                    foodPos = {x: bestFood.sumx / foodcnt, y:bestFood.sumy / foodcnt};
                    destpos = collisionGrid.getCellByXY(foodPos.x, foodPos.y);

                    var line = collisionGrid.lineTest(curpos.x, curpos.y, window.goalCoordinates.x, window.goalCoordinates.y,TYPE_SNAKE);
                    var linePos = collisionGrid.getCellByColRow(line.col,line.row);
                    var collisionDist = canvas.getDistance2(curpos.x, curpos.y, linePos.x, linePos.y);
                    if( collisionDist < 2500 )
                        continue;

                    if( destpos.cell && destpos.cell.type==TYPE_FOOD)
                        break;
                }

                //if( !bestFood ) {
                //    return;
                //}
                window.goalCoordinates = {x: foodPos.x, y:foodPos.y};
                canvas.setMouseCoordinates(canvas.mapToMouse(window.goalCoordinates));
                bot.followLine = true;
                bot.followTimer = setTimeout(function(){ bot.stopFollowLine(destpos); bot.setNextState('findFood'); }, 8000*bot.radarResults.pct);
                bot.setNextState('trackFood');
            },
            trackFood: function() {
                /*if( collisionGrid.snakeAggressors.length ) {
                    var aggressor = collisionGrid.snakeAggressors[0];
                    if( aggressor.distance2 < 100 ) {
                        bot.setNextState('avoidAggressor');
                        return;
                    }
                }*/
                var curpos = window.getPos();
                var currentCell = collisionGrid.getCellByXY(curpos.x, curpos.y);
                if( currentCell.cell && currentCell.cell.type == TYPE_SNAKE ) {
                    bot.setNextState('avoidBody');
                    return;
                }
                else {
                    var aggressorCnt = collisionGrid.snakeAggressors.length;

                    for(var i=0; i<aggressorCnt; i++) {
                        var aggressor = collisionGrid.snakeAggressors[i];
                        var mindist = 22500
                        if( aggressor.snk.sp > 7 ) {
                            mindist = 90000;
                        }
                        if( aggressor.snk.closest.distance2 < mindist ) {

                            bot.setNextState('avoidBody');
                            return;
                        }
                    }
                }/*
                if( bot.radarResults ) {
                    if( bot.radarResults.pct <= 0.30 || (bot.radarResults.collisions.length && bot.radarResults.collisions[0].dist < 100) ) {
                        bot.stopFollowLine(0);
                        bot.setNextState("avoidSurround");
                        return;
                    }
                }*/
                var dist = canvas.getDistance2(curpos.x, curpos.y, window.goalCoordinates.x, window.goalCoordinates.y);
                if( dist < 2500 ) {
                    bot.stopFollowLine(0);
                    bot.setNextState('findFood');
                    return;
                }
                var line = collisionGrid.lineTest(curpos.x, curpos.y, window.goalCoordinates.x, window.goalCoordinates.y,TYPE_SNAKE);
                var linePos = collisionGrid.getCellByColRow(line.col,line.row);
                var collisionDist = canvas.getDistance2(curpos.x, curpos.y, linePos.x, linePos.y);
                if( collisionDist < 2500 ) {
                    var dir = {x:0,y:0};
                    dir.x = curpos.x - linePos.x;
                    dir.y = curpos.y - linePos.y;
                    window.goalCoordinates.x = curpos.x + dir.x;
                    window.goalCoordinates.y = curpos.y + dir.y;
                    canvas.setMouseCoordinates(canvas.mapToMouse(window.goalCoordinates));
                    bot.stopFollowLine(0);
                    bot.setNextState('findFood');
                    return;
                }

                var minpath = 3;
                var cell = collisionGrid.getCellByXY(window.goalCoordinates.x, window.goalCoordinates.y);
                var path = collisionGrid.generatePath(window.getX(), window.getY(), window.goalCoordinates.x, window.goalCoordinates.y);
                if( path.length > minpath && cell.cell.type != TYPE_SNAKE ) {
                    bot.currentPath = path;
                    if( window.visualDebugging )
                        for(i=0; i<path.length; i++) {
                            if( i == minpath )
                                collisionGrid.drawCell(path[i].x, path[i].y, 'rgba(0,0,255,0.4)');
                            else
                                collisionGrid.drawCell(path[i].x, path[i].y, 'rgba(255,0,0,0.4)');
                        }

                    var cell = collisionGrid.getCellByColRow(path[minpath].x, path[minpath].y);
                    canvas.setMouseCoordinates(canvas.mapToMouse(cell));
                }
                else {
                    //var cell = collisionGrid.getCellByXY(window.goalCoordinates.x, window.goalCoordinates.y);
                    bot.stopFollowLine(cell);
                    bot.setNextState('findFood');
                }
            },
            avoidBody: function() {
                var aggressorCnt = collisionGrid.snakeAggressors.length;

                for(var i=0; i<aggressorCnt; i++) {
                    var aggressor = collisionGrid.snakeAggressors[i];
                    var mindist = 22500
                    if( aggressor.snk.sp > 7 ) {
                        mindist = 90000;
                    }
                    if( aggressor.snk.closest.distance2 < mindist ) {
                        var newcoord = {
                            x: window.snake.xx + (window.snake.xx - aggressor.snk.closest.xx),
                            y: window.snake.yy + (window.snake.yy - aggressor.snk.closest.yy)
                        };
                        canvas.setMouseCoordinates(canvas.mapToMouse(newcoord));
                        return;
                    }
                }

                bot.setNextState('findFood');

                return;
            },
            avoidAggressor: function() {
                if( collisionGrid.snakeAggressors.length ) {
                    var aggressor = collisionGrid.snakeAggressors[0];
                    if( aggressor.distance < 22500 ) {
                        var newcoord = {x:aggressor.relativePos.x + window.getX(),
                                        y:aggressor.relativePos.y + window.getY()}
                        //window.goalCoordinates.x = ;
                        //window.goalCoordinates.y = aggressor.relativePos.y + window.getY();

                        canvas.setMouseCoordinates(canvas.mapToMouse(newcoord));
                        return;
                    }
                }

                bot.setNextState('findFood');
                return;
            },

            avoidSurround: function() {
                if( !bot.radarResults ) return;
                var curpos = window.getPos();
                if( bot.radarResults.open.length == 0 ) {

                    var closest = bot.radarResults.collisions[0];
                    var cell = closest.cell;
                    var newpos = {x:curpos.x,y:curpos.y};

                    if( cell && cell.length ) {
                        console.log("moving away from snake part");
                        newpos.x += curpos.x - cell[0].part.x;
                        newpos.y += curpos.y - cell[0].part.y;
                        window.goalCoordinates.x = linePos.x;
                        window.goalCoordinates.y = linePos.y;
                        canvas.setMouseCoordinates(canvas.mapToMouse(linePos));
                        var dist = canvas.getDistance(curpos.x, curpos.y, cell[0].part.x, cell[0].part.y);
                        if( dist > 100 ) {
                            bot.setNextState('findFood');
                        }
                    }
                    bot.surroundExitLine = -1;
                } else if( bot.radarResults.pct < 0.30 ) {
                    //window.setAcceleration(1);

                    var linePos;
                    if( bot.surroundExitLine == -1 ) {
                        var randomLine = parseInt(Math.random() * bot.radarResults.open.length);
                        var line = bot.radarResults.open[randomLine];
                        linePos = collisionGrid.getCellByColRow(line.x,line.y);
                    }
                    else {
                        linePos = bot.surroundExitLine;
                    }
                    window.goalCoordinates.x = linePos.x;
                    window.goalCoordinates.y = linePos.y;
                    canvas.setMouseCoordinates(canvas.mapToMouse(linePos));
                }
                else {
                    bot.surroundExitLine = -1;
                    bot.setNextState('findFood');
                }
            }
        },

        surroundExitLine: -1,

        setNextState: function(state) {
            if( state && state != bot.currentState ) {
                bot.currentState = state;
            }
        },
        astarFoodFinder: function() {
            //setAcceleration(1);

            bot.state[bot.currentState]();
        },
        ignoreCell: {},

        followTimer: 0,
        stopFollowLine: function(cell) {
            bot.ignoreCell[cell.col+","+cell.row] = true;
            bot.followLine = false;
            clearTimeout(bot.followTimer);
        }
    };
})();

var userInterface = (function() {
    // Save the original slither.io functions so we can modify them, or reenable them later.
    var original_keydown = document.onkeydown;
    // eslint-disable-next-line no-unused-vars
    var original_onmouseDown = window.onmousedown;
    var original_oef = window.oef;

    return {
        // Save variable to local storage
        savePreference: function(item, value) {
            window.localStorage.setItem(item, value);
        },

        // Load a variable from local storage
        loadPreference: function(preference, defaultVar) {
            var savedItem = window.localStorage.getItem(preference);
            if (savedItem !== null) {
                if (savedItem === 'true') {
                    window[preference] = true;
                } else if (savedItem === 'false') {
                    window[preference] = false;
                } else {
                    window[preference] = savedItem;
                }
                window.log('Setting found for ' + preference + ': ' +
                           window[preference]);
            } else {
                window[preference] = defaultVar;
                window.log('No setting found for ' + preference +
                           '. Used default: ' + window[preference]);
            }
            return window[preference];
        },

        // Saves username when you click on "Play" button
        playButtonClickListener: function() {
            userInterface.saveNick();
            userInterface.loadPreference('autoRespawn', false);
        },

        // Preserve nickname
        saveNick: function() {
            var nick = document.getElementById('nick').value;
            userInterface.savePreference('savedNick', nick);
        },

        // Add interface elements to the page.
        // @param {string} id
        // @param {string} className
        // @param style
        appendDiv: function(id, className, style) {
            var div = document.createElement('div');
            if (id) div.id = id;
            if (className) div.className = className;
            if (style) div.style = style;
            document.body.appendChild(div);
        },

        // Store FPS data
        framesPerSecond: {
            startTime: 0,
            frameNumber: 0,
            filterStrength: 40,
            lastLoop: 0,
            frameTime: 0,
            getFPS: function() {
                var thisLoop = performance.now();
                var thisFrameTime = thisLoop - this.lastLoop;
                this.frameTime += (thisFrameTime - this.frameTime) /
                    this.filterStrength;
                this.lastLoop = thisLoop;
                return (1000 / this.frameTime).toFixed(0);
            }
        },

        onkeydown: function(e) {
            // Original slither.io onkeydown function + whatever is under it
            original_keydown(e);
            if (window.playing) {
                // Letter `T` to toggle bot
                if (e.keyCode === 84) {
                    if (bot.isBotRunning) {
                        bot.stopBot();
                        bot.isBotEnabled = false;
                    } else {
                        bot.launchBot();
                        bot.isBotEnabled = true;
                    }
                }
                // Letter 'U' to toggle debugging (console)
                if (e.keyCode === 85) {
                    window.logDebugging = !window.logDebugging;
                    console.log('Log debugging set to: ' + window.logDebugging);
                    userInterface.savePreference('logDebugging',
                                                 window.logDebugging);
                }
                // Letter 'Y' to toggle debugging (visual)
                if (e.keyCode === 89) {
                    window.visualDebugging = !window.visualDebugging;
                    console.log('Visual debugging set to: ' +
                                window.visualDebugging);
                    userInterface.savePreference('visualDebugging',
                                                 window.visualDebugging);
                }
                // Letter 'I' to toggle autorespawn
                if (e.keyCode === 73) {
                    window.autoRespawn = !window.autoRespawn;
                    console.log('Automatic Respawning set to: ' +
                                window.autoRespawn);
                    userInterface.savePreference('autoRespawn',
                                                 window.autoRespawn);
                }
                // Letter 'W' to auto rotate skin
                if (e.keyCode === 87) {
                    window.rotateskin = !window.rotateskin;
                    console.log('Auto skin rotator set to: ' +
                                window.rotateskin);
                    userInterface.savePreference('rotateskin',
                                                 window.rotateskin);
                    bot.rotateSkin();
                }
                // Letter 'O' to change rendermode (visual)
                if (e.keyCode === 79) {
                    window.mobileRender = !window.mobileRender;
                    window.log('Mobile rendering set to: ' + window.mobileRender);
                    userInterface.savePreference('mobileRender', window.mobileRender);
                    canvas.mobileRendering();
                }
                // Letter 'C' to toggle Collision detection / enemy avoidance
                if (e.keyCode === 67) {
                    window.collisionDetection = !window.collisionDetection;
                    console.log('collisionDetection set to: ' +
                                window.collisionDetection);
                    userInterface.savePreference(
                        'collisionDetection', window.collisionDetection
                    );
                }
                // Letter 'Z' to reset zoom
                if (e.keyCode === 90) {
                    canvas.resetZoom();
                }
                // Letter 'Q' to quit to main menu
                if (e.keyCode === 81) {
                    window.autoRespawn = false;
                    userInterface.quit();
                }
                // 'ESC' to quickly respawn
                if (e.keyCode === 27) {
                    bot.quickRespawn();
                }
                // Letter 'X' to change skin
                if (e.keyCode === 88) {
                    bot.changeSkin();
                }
                // Save nickname when you press "Enter"
                if (e.keyCode === 13) {
                    userInterface.saveNick();
                }
                // 'j' to seve net
                if (e.keyCode === 74) {
                    var j = bot.agents.brain.value_net.toJSON();
                    var t = JSON.stringify(j);
                    var a = document.createElement('a');
                    a.download = "net.json";
                    a.href = 'data:application/octet-stream,'+encodeURIComponent(t);
                    a.click();
                    window.log('save successful');
                }
                // 'k' to load net
                if (e.keyCode === 75) {
                    var uploadFile = document.getElementById('upload-file');
                    var file = uploadFile.files[0];
                    if (!file) alert('Please select a file');
                    var uploadData;
                    var reader = new FileReader();
                    window.log('loadading…');
                    reader.readAsText(file);
                    reader.onload = function () {
                        uploadData = JSON.parse(reader.result);
                        bot.stoplearn();
                        bot.agents.brain.value_net.fromJSON(uploadData);
                        window.log('load successful');
                    }
                }
                if (e.keyCode === 78) {
                    bot.startlearn();
                    window.log('start learn');
                }
                if (e.keyCode === 77) {
                    bot.stoplearn();
                    window.log('stop learn');
                }
                userInterface.onPrefChange(); // Update the bot status
            }
        },

        onmousedown: function(e) {
            e = e || window.event;
            original_onmouseDown(e);
            if (window.playing) {
                switch (e.which) {
                        // "Left click" to manually speed up the slither
                    case 1:
                        window.setAcceleration(1);
                        window.log('Manual boost...');
                        break;
                        // "Right click" to toggle bot in addition to the letter "T"
                    case 3:
                        if (bot.isBotRunning) {
                            bot.stopBot();
                            bot.isBotEnabled = false;
                        } else {
                            bot.launchBot();
                            bot.isBotEnabled = true;
                        }
                        break;
                }
                userInterface.onPrefChange(); // Update the bot status
            }
        },

        onPrefChange: function() {
            var generalStyle = '<span style = "opacity: 0.35";>';

            window.botstatus_overlay.innerHTML = generalStyle +
                '(T / Right Click) Bot: </span>' + userInterface.handleTextColor(
                bot.isBotRunning);
            window.visualdebugging_overlay.innerHTML = generalStyle +
                '(Y) Visual debugging: </span>' + userInterface.handleTextColor(
                window.visualDebugging);
            window.logdebugging_overlay.innerHTML = generalStyle +
                '(U) Log debugging: </span>' + userInterface.handleTextColor(
                window.logDebugging);
            window.autorespawn_overlay.innerHTML = generalStyle +
                '(I) Auto respawning: </span>' + userInterface.handleTextColor(
                window.autoRespawn);
            window.rotateskin_overlay.innerHTML = generalStyle +
                '(W) Auto skin rotator: </span>' + userInterface.handleTextColor(
                window.rotateskin);
            window.rendermode_overlay.innerHTML = generalStyle +
                '(O) Mobile rendering: </span>' + userInterface.handleTextColor(
                window.mobileRender);
            window.collision_detection_overlay.innerHTML =
                generalStyle + '(C) Collision detection: </span>' +
                userInterface.handleTextColor(window.collisionDetection);
        },

        onFrameUpdate: function() {
            // Botstatus overlay
            var generalStyle = '<span style = "opacity: 0.35";>';

            window.fps_overlay.innerHTML = generalStyle + 'FPS: ' +
                userInterface.framesPerSecond.getFPS() + '</span>';


            if (window.position_overlay && window.playing) {
                // Display the X and Y of the snake
                window.position_overlay.innerHTML = generalStyle +
                    'X: ' + (Math.round(window.snake.xx) || 0) +
                    ' Y: ' + (Math.round(window.snake.yy) || 0) +
                    '</span>';
            }

            if (window.playing && window.visualDebugging && bot.isBotRunning) {
                // Only draw the goal when a bot has a goal.
                if (window.goalCoordinates) {
                    var headCoord = {
                        x: window.snake.xx,
                        y: window.snake.yy
                    };
                    canvas.drawLine(
                        canvas.mapToCanvas(headCoord),
                        canvas.mapToCanvas(window.goalCoordinates),
                        'green');

                    canvas.drawCircle(window.goalCoordinates, 'red', true);
                }
            }
        },

        oef: function() {
            // Original slither.io oef function + whatever is under it
            // requestAnimationFrame(window.loop);
            canvas.maintainZoom();
            original_oef();
            if (bot.isBotRunning) window.loop();
            userInterface.onFrameUpdate();
        },

        // Quit to menu
        quit: function() {
            if (window.playing && window.resetGame) {
                window.want_close_socket = true;
                window.dead_mtm = 0;
                if (window.play_btn) {
                    window.play_btn.setEnabled(true);
                }
                window.resetGame();
            }
        },

        // Update the relation between the screen and the canvas.
        onresize: function() {
            window.resize();
            // Canvas different size from the screen (often bigger).
            canvas.canvasRatio = [window.mc.width / window.ww,
                                  window.mc.height / window.hh
                                 ];
        },

        handleTextColor: function(enabled) {
            return '<span style=\"opacity: 0.8; color:' + (enabled ?
                                                           'green;\">enabled' : 'red;\">disabled') +
                '</span>';
        }
    };
})();

// Loop for running the bot
window.loop = function() {
    // If the game and the bot are running
    if (window.playing && bot.isBotEnabled) {
        bot.ranOnce = true;
        bot.thinkAboutGoals();
    } else {
        bot.stopBot();
    }
};

window.sosBackup = sos;

// Main
(function() {
    // Load preferences
    userInterface.loadPreference('logDebugging', false);
    userInterface.loadPreference('visualDebugging', false);
    userInterface.loadPreference('autoRespawn', false);
    userInterface.loadPreference('mobileRender', false);
    userInterface.loadPreference('collisionDetection', true);
    userInterface.loadPreference('collisionRadiusMultiplier', 10);
    userInterface.loadPreference('rotateskin', false);
    window.nick.value = userInterface.loadPreference('savedNick',
                                                     'Slither.io-bot');

    // Overlays

    // Top left

    window.generalstyle =
        'color: #FFF; font-family: Arial, \'Helvetica Neue\',' +
        ' Helvetica, sans-serif; font-size: 14px; position: fixed; z-index: 7;';
    userInterface.appendDiv('version_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 50px;');
    userInterface.appendDiv('botstatus_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 65px;');
    userInterface.appendDiv('visualdebugging_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 80px;');
    userInterface.appendDiv('logdebugging_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 95px;');
    userInterface.appendDiv('autorespawn_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 110px;');
    userInterface.appendDiv('rendermode_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 125px;');
    userInterface.appendDiv('rotateskin_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 140px;');
    userInterface.appendDiv('collision_detection_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 155px;');
    userInterface.appendDiv('resetzoom_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 170px;');
    userInterface.appendDiv('scroll_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 185px;');
    userInterface.appendDiv('quickResp_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 200px;');
    userInterface.appendDiv('changeskin_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 215px;');
    userInterface.appendDiv('quittomenu_overlay', 'nsi', window.generalstyle +
                            'left: 30; top: 230px;');

    // Set static display options here.
    var generalStyle = '<span style = "opacity: 0.35";>';
    window.resetzoom_overlay.innerHTML = generalStyle +
        '(Z) Reset zoom </span>';
    window.scroll_overlay.innerHTML = generalStyle +
        '(Mouse Wheel) Zoom in/out </span>';
    window.quittomenu_overlay.innerHTML = generalStyle +
        '(Q) Quit to menu </span>';
    window.changeskin_overlay.innerHTML = generalStyle +
        '(X) Change skin </span>';
    window.quickResp_overlay.innerHTML = generalStyle +
        '(ESC) Quick Respawn </span>';
    // eslint-disable-next-line no-undef
    window.version_overlay.innerHTML = generalStyle + 'Version: ' + GM_info
        .script.version;

    //
    window.version_overlay.innerHTML = generalStyle +
        '<input type="file" id="upload-file" />';

    // Pref display
    userInterface.onPrefChange();

    // Bottom right
    userInterface.appendDiv('position_overlay', 'nsi', window.generalstyle +
                            'right: 30; bottom: 120px;');
    userInterface.appendDiv('ip_overlay', 'nsi', window.generalstyle +
                            'right: 30; bottom: 150px;');
    userInterface.appendDiv('fps_overlay', 'nsi', window.generalstyle +
                            'right: 30; bottom: 170px;');

    // Listener for mouse wheel scroll - used for setZoom function
    document.body.addEventListener('mousewheel', canvas.setZoom);
    document.body.addEventListener('DOMMouseScroll', canvas.setZoom);
    // Listener for the play button
    window.play_btn.btnf.addEventListener('click', userInterface.playButtonClickListener);
    // Hand over existing event listeners
    document.onkeydown = userInterface.onkeydown;
    window.onmousedown = userInterface.onmousedown;
    window.onresize = userInterface.onresize;
    // Hand over existing game function
    window.oef = userInterface.oef;

    // Apply previous mobile rendering status.
    canvas.mobileRendering();

    // Modify the redraw()-function to remove the zoom altering code.
    var original_redraw = window.redraw.toString();
    var new_redraw = original_redraw.replace(
        'gsc!=f&&(gsc<f?(gsc+=2E-4,gsc>=f&&(gsc=f)):(gsc-=2E-4,gsc<=f&&(gsc=f)))', '');
    window.redraw = new Function(new_redraw.substring(
        new_redraw.indexOf('{') + 1, new_redraw.lastIndexOf('}')));

    // Unblocks all skins without the need for FB sharing.
    window.localStorage.setItem('edttsg', '1');

    // Remove social
    window.social.remove();

    // Start!
    bot.launchBot();
    window.startInterval = setInterval(bot.startBot, 1000);
})();


/**
 *  Grid Node
 *  Types:
 *  0 = empty
 *  1 = snake
 *  2 = food
 */
var TYPE_EMPTY = 0;
var TYPE_SNAKE = 1;
var TYPE_FOOD = 2;

function GridNode(x, y, weight, type) {
    this.x = x;
    this.y = y;
    this.weight = weight;
    this.f = 0;
    this.g = 0;
    this.h = 0;
    this.visited = false;
    this.closed = false;
    this.parent = null;
    this.type = type || 0;
    this.items = [];
}

GridNode.prototype.toString = function() {
    return "[" + this.x + " " + this.y + "]";
};

GridNode.prototype.getCost = function(fromNeighbor) {
    // Take diagonal weight into consideration.
    if (fromNeighbor && fromNeighbor.x != this.x && fromNeighbor.y != this.y) {
        return this.weight * 1.41421;
    }
    return this.weight;
};

GridNode.prototype.isWall = function() {
    return this.weight === 0;
};
// javascript-astar 0.4.1
// http://github.com/bgrins/javascript-astar
// Freely distributable under the MIT License.
// Implements the astar search algorithm in javascript using a Binary Heap.
// Includes Binary Heap (with modifications) from Marijn Haverbeke.
// http://eloquentjavascript.net/appendix2.html
(function(definition) {
    /* global module, define */
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = definition();
    } else if (typeof define === 'function' && define.amd) {
        define([], definition);
    } else {
        var exports = definition();
        window.astar = exports.astar;
    }
})(function() {

    function pathTo(node) {
        var curr = node;
        var path = [];
        while (curr.parent) {
            path.unshift(curr);


            curr = curr.parent;
        }
        return path;
    }

    function getHeap() {
        return new BinaryHeap(function(node) {
            return node.f;
        });
    }

    var astar = {
        /**
  * Perform an A* Search on a graph given a start and end node.
  * @param {Graph} graph
  * @param {GridNode} start
  * @param {GridNode} end
  * @param {Object} [options]
  * @param {bool} [options.closest] Specifies whether to return the
             path to the closest node if the target is unreachable.
  * @param {Function} [options.heuristic] Heuristic function (see
  *          astar.heuristics).
  */
        search: function(start, end, options) {
            //collisionGrid.cleanDirty();
            options = options || {};
            var heuristic = options.heuristic || astar.heuristics.manhattan;
            var closest = options.closest || false;

            var openHeap = getHeap();
            var closestNode = start; // set the start node to be the closest if required

            start.h = heuristic(start, end);
            // collisionGrid.markDirty(start);
            var maxtries = 10000;
            var trynum = 0;

            openHeap.push(start);

            while (openHeap.size() > 0) {
                if( ++trynum > maxtries ) {
                    return [];
                }
                // Grab the lowest f(x) to process next.  Heap keeps this sorted for us.
                var currentNode = openHeap.pop();

                // End case -- result has been found, return the traced path.
                if (currentNode.x == end.x && currentNode.y == end.y) {
                    return pathTo(currentNode);
                }

                // Normal case -- move currentNode from open to closed, process each of its neighbors.
                currentNode.closed = true;

                // Find all neighbors for the current node.
                var neighbors = collisionGrid.neighbors(currentNode.x, currentNode.y);

                for (var i = 0, il = neighbors.length; i < il; ++i) {
                    var neighbor = neighbors[i];

                    if (neighbor.closed || neighbor.type == TYPE_SNAKE) {
                        // Not a valid node to process, skip to next neighbor.
                        continue;
                    }

                    // The g score is the shortest distance from start to current node.
                    // We need to check if the path we have arrived at this neighbor is the shortest one we have seen yet.
                    var gScore = currentNode.g + neighbor.weight;//getCost(currentNode);
                    var beenVisited = neighbor.visited;
                    if( beenVisited ) {
                        //console.log('visited ('+neighbor.x+','+neighbor.y+')');
                    }
                    if (!beenVisited || gScore < neighbor.g) {

                        // Found an optimal (so far) path to this node.  Take score for node to see how good it is.
                        neighbor.visited = true;
                        neighbor.parent = currentNode;
                        neighbor.h = neighbor.h || heuristic(neighbor, end);
                        neighbor.g = gScore;
                        neighbor.f = neighbor.g + neighbor.h;
                        // collisionGrid.markDirty(neighbor);
                        if (closest) {
                            // If the neighbour is closer than the current closestNode or if it's equally close but has
                            // a cheaper path than the current closest node then it becomes the closest node
                            if (neighbor.h < closestNode.h || (neighbor.h === closestNode.h && neighbor.g < closestNode.g)) {
                                closestNode = neighbor;
                            }
                        }

                        if (!beenVisited) {
                            // Pushing to heap will put it in proper place based on the 'f' value.
                            openHeap.push(neighbor);
                        } else {
                            // Already seen the node, but since it has been rescored we need to reorder it in the heap
                            openHeap.rescoreElement(neighbor);
                        }
                    }
                }
            }

            if (closest) {
                return pathTo(closestNode);
            }

            // No result was found - empty array signifies failure to find path.
            return [];
        },
        // See list of heuristics: http://theory.stanford.edu/~amitp/GameProgramming/Heuristics.html
        heuristics: {
            manhattan: function(pos0, pos1) {
                var d1 = Math.abs(pos1.x - pos0.x);
                var d2 = Math.abs(pos1.y - pos0.y);
                return d1 + d2;
            },
            diagonal: function(pos0, pos1) {
                var D = 1;
                var D2 = 1.41421; // 1.41421 == Math.sqrt(2)
                var d1 = Math.abs(pos1.x - pos0.x);
                var d2 = Math.abs(pos1.y - pos0.y);
                return (D * (d1 + d2)) + ((D2 - (2 * D)) * Math.min(d1, d2));
            },
            chebyshev: function(pos0, pos1) {
                var d1 = Math.abs(pos1.x - pos0.x);
                var d2 = Math.abs(pos1.y - pos0.y);
                return Math.max(d1,d2);
            }
        },
        cleanNode: function(node) {
            node.f = 0;
            node.g = 0;
            node.h = 0;
            node.visited = false;
            node.closed = false;
            node.parent = null;
        }
    };


    function BinaryHeap(scoreFunction) {
        this.content = [];
        this.scoreFunction = scoreFunction;
    }

    BinaryHeap.prototype = {
        push: function(element) {
            // Add the new element to the end of the array.
            this.content.push(element);

            // Allow it to sink down.
            this.sinkDown(this.content.length - 1);
        },
        pop: function() {
            // Store the first element so we can return it later.
            var result = this.content[0];
            // Get the element at the end of the array.
            var end = this.content.pop();
            // If there are any elements left, put the end element at the
            // start, and let it bubble up.
            if (this.content.length > 0) {
                this.content[0] = end;
                this.bubbleUp(0);
            }
            return result;
        },
        remove: function(node) {
            var i = this.content.indexOf(node);

            // When it is found, the process seen in 'pop' is repeated
            // to fill up the hole.
            var end = this.content.pop();

            if (i !== this.content.length - 1) {
                this.content[i] = end;

                if (this.scoreFunction(end) < this.scoreFunction(node)) {
                    this.sinkDown(i);
                } else {
                    this.bubbleUp(i);
                }
            }
        },
        size: function() {
            return this.content.length;
        },
        rescoreElement: function(node) {
            this.sinkDown(this.content.indexOf(node));
        },
        sinkDown: function(n) {
            // Fetch the element that has to be sunk.
            var element = this.content[n];

            // When at 0, an element can not sink any further.
            while (n > 0) {

                // Compute the parent element's index, and fetch it.
                var parentN = ((n + 1) >> 1) - 1;
                var parent = this.content[parentN];
                // Swap the elements if the parent is greater.
                if (this.scoreFunction(element) < this.scoreFunction(parent)) {
                    this.content[parentN] = element;
                    this.content[n] = parent;
                    // Update 'n' to continue at the new position.
                    n = parentN;
                }
                // Found a parent that is less, no need to sink any further.
                else {
                    break;
                }
            }
        },
        bubbleUp: function(n) {
            // Look up the target element and its score.
            var length = this.content.length;
            var element = this.content[n];
            var elemScore = this.scoreFunction(element);

            while (true) {
                // Compute the indices of the child elements.
                var child2N = (n + 1) << 1;
                var child1N = child2N - 1;
                // This is used to store the new position of the element, if any.
                var swap = null;
                var child1Score;
                // If the first child exists (is inside the array)...
                if (child1N < length) {
                    // Look it up and compute its score.
                    var child1 = this.content[child1N];
                    child1Score = this.scoreFunction(child1);

                    // If the score is less than our element's, we need to swap.
                    if (child1Score < elemScore) {
                        swap = child1N;
                    }
                }

                // Do the same checks for the other child.
                if (child2N < length) {
                    var child2 = this.content[child2N];
                    var child2Score = this.scoreFunction(child2);
                    if (child2Score < (swap === null ? elemScore : child1Score)) {
                        swap = child2N;
                    }
                }

                // If the element needs to be moved, swap it, and continue.
                if (swap !== null) {
                    this.content[n] = this.content[swap];
                    this.content[swap] = element;
                    n = swap;
                }
                // Otherwise, we are done.
                else {
                    break;
                }
            }
        }
    };

    return {
        astar: astar
    };

});


var collisionHelper = (function() {
    return {
        unitTable: [],
        toRad: Math.PI / 180,
        toDeg: 180 / Math.PI,

        init: function() {
            collisionHelper.generateUnitTable();

        },

        /**
         *  Build the unit table grouping opposite angles and in 22.5 degree increments
         *
         */
        generateUnitTable: function() {
            var offset = 0;
            for(var a=0;a<360; a++) {
                var angle = collisionHelper.toRad * offset;
                collisionHelper.unitTable.push([Math.cos(angle), Math.sin(angle)]);
                offset++;
            }
        },

        /**
         * Performs line scans in the E,N,W,S directions and rotates by 22.5 degrees * rotateCount
         *
         */
        radarScan: function(angleIncrement,scanDist) {

            var results = [];
            var collisions = [];
            var open = [];
            var curpos = window.getPos();
            for(var dir=0; dir<collisionHelper.unitTable.length; dir+=angleIncrement) {
                var pos = collisionHelper.unitTable[dir];
                var x2 = curpos.x+pos[0]*scanDist;
                var y2 = curpos.y+pos[1]*scanDist;

                var result = collisionGrid.lineTest(curpos.x,curpos.y,x2,y2,TYPE_SNAKE);
                if( result )
                    results.push(result);

                if( result.cell ) {
                    var linePos = collisionGrid.getCellByColRow(result.col, result.row);
                    var dist = canvas.getDistance2(curpos.x, curpos.y, linePos.x, linePos.y);
                    collisions.push({dist:dist, line:result});
                }
                else
                    open.push(result);

                if( window.visualDebugging ) {

                    var canvasPosA = canvas.mapToCanvas({
                        x: curpos.x,
                        y: curpos.y,
                        radius: 1
                    });
                    var canvasPosB = canvas.mapToCanvas({
                        x: x2,
                        y: y2,
                        radius: 1
                    });

                    var color = (!result.cell||result.cell.type==TYPE_EMPTY) ? 'green' : ((result.cell.type==TYPE_FOOD) ? 'blue' : 'red');
                    if( color != 'green')
                        canvas.drawLine2(canvasPosA.x, canvasPosA.y, canvasPosB.x, canvasPosB.y, 1, color);
                }
            }

            if( collisions.length )
                collisions.sort(function(a,b) {
                    return a.dist - b.dist;
                });

            var pct = 0.0;
            if( results.length )
                pct = open.length / results.length;

            return {pct:pct, open:open, collisions:collisions, results:results};
        },

        checkLineIntersection: function(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
            // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
            var denominator;
            var a;
            var b;
            var numerator1;
            var numerator2;
            var result = {
                x: null,
                y: null,
                onLine1: false,
                onLine2: false
            };
            denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
            if (denominator == 0) {
                return result;
            }
            a = line1StartY - line2StartY;
            b = line1StartX - line2StartX;
            numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
            numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
            a = numerator1 / denominator;
            b = numerator2 / denominator;

            // if we cast these lines infinitely in both directions, they intersect here:
            result.x = line1StartX + (a * (line1EndX - line1StartX));
            result.y = line1StartY + (a * (line1EndY - line1StartY));
            /*
            // it is worth noting that this should be the same as:
            x = line2StartX + (b * (line2EndX - line2StartX));
            y = line2StartX + (b * (line2EndY - line2StartY));
            */
            // if line1 is a segment and line2 is infinite, they intersect if:
            if (a > 0 && a < 1) {
                result.onLine1 = true;
            }
            // if line2 is a segment and line1 is infinite, they intersect if:
            if (b > 0 && b < 1) {
                result.onLine2 = true;
            }
            // if line1 and line2 are segments, they intersect if both of the above are true
            return result;
        }
    };
})();
/**
 * A 2d collision grid system for fast line to box collision
 *
 * - Flagged cells are occupied by object(s)
 * - Non-flagged cells are empty
 * - Cells are world space cut up into squares of X size
 */
var collisionGrid = (function() {
    collisionHelper.init();

    return {
        width: 0,
        height: 0,

        //clone for fast slicing
        grid: [],
        bgrid: [],
        cellSize: 20,
        halfCellSize: 10,
        startX: 0,
        startY: 0,
        gridWidth: 0,
        gridHeight: 0,
        endX: 0,
        endY: 0,
        astarGraph: 0,
        astarResult: 0,
        foodGroups: [],
        snakeAggressors: [],

        dirty: [],

        initGrid: function(w, h, cellsz) {
            sx = Math.floor(window.getX());
            sy = Math.floor(window.getY());
            sx = sx - (sx % cellsz);
            sy = sy - (sy % cellsz);

            collisionGrid.height = h * cellsz;
            collisionGrid.width = w * cellsz;
            collisionGrid.gridWidth = w;
            collisionGrid.gridHeight = h;
            collisionGrid.cellSize = cellsz;
            collisionGrid.halfCellSize = cellsz / 2;

            collisionGrid.startX = Math.floor(sx - ((w/2)*cellsz));
            collisionGrid.startY = Math.floor(sy - ((h/2)*cellsz));
            //collisionGrid.startX = collisionGrid.startX - (collisionGrid.startX % cellsz);
            //collisionGrid.startY = collisionGrid.startY - (collisionGrid.startY % cellsz);

            collisionGrid.endX = collisionGrid.startX + collisionGrid.width;
            collisionGrid.endY = collisionGrid.startY + collisionGrid.height;


            collisionGrid.booleanGrid = [];
            collisionGrid.grid = [];
            collisionGrid.foodGroups = [];
            collisionGrid.snakeAggressors = [];
            collisionGrid.addSnakes();
            collisionGrid.addFood();
        },

        setupGrid: function() {

        },

        // Slice out a portion of the grid for less calculations
        // callback = function(x, y, gridValue) {}
        sliceGrid: function(col, row, width, height, callback) {
            //constrain the values between 0 and width/height
            var col = Math.min(Math.max(col, 0), collisionGrid.gridWidth);
            var row = Math.min(Math.max(row, 0), collisionGrid.gridHeight);
            width = col + Math.min(collisionGrid.gridWidth, Math.max(width, 0));
            height = row + Math.min(collisionGrid.gridHeight, Math.max(height, 0));

            for(var x=col; x<width; x++) {
                for(var y=row; y<height; y++) {
                    collisionGrid.grid[x] = collisionGrid.grid[x] || [];
                    collisionGrid.grid[x][y] = collisionGrid.grid[x][y] || 0;
                    callback(x, y, collisionGrid.grid[x][y]);
                }
            }
        },

        // Find specific cell using map-space position
        getCellByXY: function(x, y) {
            //x = x;
            // y = y ;
            x = x - collisionGrid.startX;
            y = y - collisionGrid.startY;
            //x = x - (x % collisionGrid.cellSize);
            // y = y - (y % collisionGrid.cellSize);

            var col = parseInt(Math.floor(x / collisionGrid.cellSize));
            var row = parseInt(Math.floor(y / collisionGrid.cellSize));
            var col = Math.min(Math.max(col, 0), collisionGrid.gridWidth);
            var row = Math.min(Math.max(row, 0), collisionGrid.gridHeight);
            collisionGrid.grid[col] = collisionGrid.grid[col] || [];
            collisionGrid.grid[col][row] = collisionGrid.grid[col][row] || 0;
            return {col:col, row:row, cell:collisionGrid.grid[col][row]};
        },

        // Get cell's map-space position at top left corner of cell
        getCellByColRow: function(col, row) {
            var x = collisionGrid.startX + (col*collisionGrid.cellSize) + collisionGrid.halfCellSize;
            var y = collisionGrid.startY + (row*collisionGrid.cellSize) + collisionGrid.halfCellSize;
            collisionGrid.grid[col] = collisionGrid.grid[col] || [];
            collisionGrid.grid[col][row] = collisionGrid.grid[col][row] || 0;
            return {x:x, y:y, cell:collisionGrid.grid[col][row]};
        },

        // This is used to convert a width or height to the amount of cells it would occupy
        calculateMaxCellCount: function(sz) {
            return parseInt(Math.floor(sz / collisionGrid.cellSize));
        },

        // set cell size
        setCellSize: function(sz) {
            collisionGrid.cellSize = sz;
        },

        getCell: function(col,row) {
            collisionGrid.grid[col] = collisionGrid.grid[col] || [];
            collisionGrid.grid[col][row] = collisionGrid.grid[col][row] || 0;
            return collisionGrid.grid[col][row];
        },

        cellTest: function(col, row, type) {
            cell = collisionGrid.getCell(col, row);  // first point
            if( cell && cell.type == type)
                return cell;
            if( !cell && type==TYPE_EMPTY)
                return collisionGrid.markCellEmpty(col,row);
            return false;
        },

        markCell: function(col, row, weight, type) {
            collisionGrid.grid[col] = collisionGrid.grid[col] || [];
            var node = collisionGrid.grid[col][row];
            if( !node || (type==TYPE_SNAKE && node.type!=TYPE_SNAKE)) {
                node = new GridNode(col, row, weight, type);
            }
            collisionGrid.grid[col][row] = node;
            return node;
        },

        markCellWall: function(col, row, obj) {
            var node = collisionGrid.markCell(col, row, 0, TYPE_SNAKE);
            node.items.push(obj);
            return node;
        },

        markCellEmpty: function(col, row, weight) {
            weight = weight || 1000;
            var node = collisionGrid.markCell(col, row, weight, TYPE_EMPTY);
            //node.items.push(obj);
            return node;
        },

        markCellFood: function(col, row, food) {
            var node = collisionGrid.markCell(col, row, -(food.sz*food.sz), TYPE_FOOD);
            node.items.push(food);
            return node;
        },

        isWall: function(col, row) {
            return collisionGrid.grid[col] && collisionGrid.grid[col][row] && collisionGrid.grid[col][row].type == TYPE_SNAKE;
        },

        isEmpty: function(col, row) {
            return collisionGrid.grid[col] && !collisionGrid.grid[col][row];
        },

        drawCell: function(col, row, color) {

            if( !window.visualDebugging )
                return;

            color = color || 'rgba(255,255,0,0.25)';
            var pos = collisionGrid.getCellByColRow(col, row);
            var canvasPos = canvas.mapToCanvas({
                x: pos.x-collisionGrid.halfCellSize,
                y: pos.y-collisionGrid.halfCellSize
            });

            canvas.drawRect(
                canvasPos.x,
                canvasPos.y,
                collisionGrid.cellSize * canvas.getScale(),
                collisionGrid.cellSize * canvas.getScale(),
                color);
        },

        addNeighbor: function(x, y, arr) {
            collisionGrid.grid[x] = collisionGrid.grid[x] || [];

            var node = collisionGrid.grid[x][y] || collisionGrid.markCellEmpty(x,y);;
            if( node.type == TYPE_SNAKE ) {
                return;
            }
            //if( !collisionGrid.grid[x][y] )


            arr.push(collisionGrid.grid[x][y]);
        },

        neighbors: function(x, y) {
            var ret = [];
            // West
            collisionGrid.addNeighbor(x-1, y, ret);
            //East
            collisionGrid.addNeighbor(x+1, y, ret);
            //South
            collisionGrid.addNeighbor(x, y-1, ret);
            //North
            collisionGrid.addNeighbor(x, y+1, ret);

            //if (this.diagonal) {
            // Southwest
            collisionGrid.addNeighbor(x-1, y-1, ret);
            // Southeast
            collisionGrid.addNeighbor(x+1, y-1, ret);
            // Northwest
            collisionGrid.addNeighbor(x-1, y+1, ret);
            // Northeast
            collisionGrid.addNeighbor(x+1, y+1, ret);
            //}

            return ret;
        },

        generatePath: function(startX, startY, endX, endY) {
            var startCell = collisionGrid.getCellByXY(startX,startY);
            var endCell = collisionGrid.getCellByXY(endX,endY);
            var start = collisionGrid.getCell(startCell.col, startCell.row) ||
                collisionGrid.markCellEmpty(startCell.col, startCell.row);
            var end = collisionGrid.getCell(endCell.col, endCell.row) ||
                collisionGrid.markCellEmpty(endCell.col, endCell.row);

            var path = astar.search(start, end);

            return path;
        },

        addFood: function() {

            collisionGrid.foodGroups = {};
            var curpos = window.getPos();
            var center = collisionGrid.getCellByXY(curpos.x,curpos.y);

            var foodGridSize = 10;
            var foodCellSize = 100;
            var foodCellSizeHalf = foodCellSize / 2;
            curpos.x = Math.floor(curpos.x);
            curpos.y = Math.floor(curpos.y);
            curpos.x = curpos.x - (curpos.x % foodCellSize);
            curpos.y = curpos.y - (curpos.y % foodCellSize);
            var startX = Math.floor(curpos.x - ((foodGridSize/2)*foodCellSize));
            var startY = Math.floor(curpos.y - ((foodGridSize/2)*foodCellSize));
            var endX = startX + foodGridSize * foodCellSize;
            var endY = startY + foodGridSize * foodCellSize;

            var foodGroupList = [];

            for(var i=0; i<window.foods.length; i++) {

                var food = window.foods[i];
                if( food === null || food === undefined )
                    continue;

                if( food.xx < startX ||
                   food.xx > endX ||
                   food.yy < startY ||
                   food.yy > endY )
                    continue;

                var x = food.xx - startX;
                var y = food.yy - startY;
                col = parseInt(Math.floor(x / foodCellSize));
                row = parseInt(Math.floor(y / foodCellSize));
                col = Math.min(Math.max(col, 0), foodGridSize);
                row = Math.min(Math.max(row, 0), foodGridSize);

                /*
                var canvasPos = canvas.mapToCanvas({
                    x: startX + (col*foodCellSize),
                    y: startY + (row*foodCellSize)
                });

                canvas.drawRect(
                    canvasPos.x, canvasPos.y,
                    foodCellSize * canvas.getScale(),
                    foodCellSize * canvas.getScale(),
                    'rgba(0,255,0,0.25)');
*/
                var cell = collisionGrid.getCellByXY(food.xx, food.yy);
                var node = collisionGrid.markCellFood(cell.col, cell.row, food);
                if( node ) {
                    //var distance = astar.heuristics.diagonal({x:center.col,y:center.row},{x:cell.col, y:cell.row});//canvas.getDistance(food.xx, food.yy, curpos.x, curpos.y);
                    //distance = (distance + Math.abs(distance)) / 2;
                    var distance2 = canvas.getDistance2(food.xx, food.yy, curpos.x, curpos.y);
                    food.distance2 = distance2;
                    var id = col+','+row;
                    var groupid = collisionGrid.foodGroups[id]
                    || foodGroupList.length;
                    //collisionGrid.foodGroups[id] = collisionGrid.foodGroups[id]

                    var group = foodGroupList[groupid]
                    || {sumx:0, sumy:0, nodes:[], score:0, maxfood:0, distance2:-1};
                    group.nodes.push({x:food.xx, y:food.yy, distance2:distance2, node:node})
                    group.sumx += food.xx;
                    group.sumy += food.yy;
                    group.score += food.sz;
                    group.maxfood = food
                    if( !group.maxfood || food.sz > group.maxfood.sz ) {
                        group.maxfood = food.sz;
                    }
                    if( distance2 == -1 || distance2 < group.distance2 )
                        group.distance2 = distance2;
                    foodGroupList[groupid] = group;
                    collisionGrid.foodGroups[id] = groupid;
                }

            }


            //for( var key in collisionGrid.foodGroups) {
            //var score = collisionGrid.foodGroups[key].score;
            //collisionGrid.foodGroups[key].score = score*score;
            //    foodGroupList.push(collisionGrid.foodGroups[key]);
            //}

            foodGroupList.sort(function(a,b) {
                //return b.node.weight - a.node.weight;
                //var minimumDist = 500;
                //var adist = a.distance;// < minimumDist ? minimumDist : a.distance;
                //var bdist = b.distance;// < minimumDist ? minimumDist : b.distance;;
                //a.ratio = (a.score/a.distance);
                //b.ratio = (b.score/b.distance);
                return b.score - a.score;

                //return (a.score == b.score ? 0 : (a.score / a.distance) > (b.score / b.distance)  ? -1 : 1);
            });

            collisionGrid.foodGroups = foodGroupList;

        },

        // add all snake's collision parts to the grid
        addSnakes: function() {
            var myX = window.getX();
            var myY = window.getY();

            var lastAlive = 0;
            var deadCount = 0;
            var maxDeadCount = 2;
            for (var snakeid in window.snakes) {
                var snk = window.snakes[snakeid];
                if (snk.id == window.snake.id)
                    continue;
                var cnt = 0;

                snk.closest = 0;

                var relPos = {x:(myX-snk.xx), y:(myY-snk.yy)}
                var snakeDist = canvas.getDistance2(myX, myY, snk.xx, snk.yy);
                var rang = snk.ang * collisionHelper.toRad;
                collisionGrid.snakeAggressors.push({
                    snk:snk,
                    distance2:snakeDist,
                    relativePos:relPos,
                    heading:{x:Math.cos(rang),y:Math.sin(rang)}
                });

                if( snk.xx > collisionGrid.startX && snk.xx < collisionGrid.endX &&
                   snk.yy > collisionGrid.startY && snk.yy < collisionGrid.endY)
                    collisionGrid.snakePartBounds(snk,snk,2);

                for (var pts=snk.pts.length-1; pts>=0; pts--) {// in snk.pts) {
                    var part = snk.pts[pts];

                    if (part.dying) {
                        if( deadCount++ > maxDeadCount )
                            continue;
                    }


                    lastAlive = pts;
                    //only add parts that are within our grid bounds
                    if( part.xx < collisionGrid.startX || part.xx > collisionGrid.endX ||
                       part.yy < collisionGrid.startY || part.yy > collisionGrid.endY)
                        continue;


                    //canvas.drawText(canvas.mapToCanvas({x:part.xx, y:part.yy}), 'red', ''+pts);
                    collisionGrid.snakePartBounds(snk,part);
                }
                /*
                if( window.visualDebugging && snk.closest) {
                    canvas.drawCircle(canvas.circleMapToCanvas({x:snk.closest.xx, y:snk.closest.yy, radius:window.getSnakeWidth(snk.sc)}), 'orange', false);
                    canvas.drawCircle(canvas.circleMapToCanvas({x:snk.xx, y:snk.yy, radius:window.getSnakeWidth(snk.sc)}), 'red', false);
                }
                */
            }


            collisionGrid.snakeAggressors.sort(function(a,b) {
                return a.distance2 - b.distance2;
            });
        },

        findClosestPart: function(snk, part) {
            var curpos = window.getPos();
            var dist2 = canvas.getDistance2(curpos.x, curpos.y, part.xx, part.yy);
            part.distance2 = dist2 - (window.getSnakeWidthSqr() + window.getSnakeWidthSqr(snk));
            if( snk.closest == 0 ) {
                snk.closest = part;
                return;
            }
            if( dist2 < snk.closest.distance2 ) {
                snk.closest = part;
            }
        },

        snakePartBounds: function(snk, part, sizemultiplier) {
            sizemultiplier = sizemultiplier || 1;

            collisionGrid.findClosestPart(snk,part);

            //calculate grid width/height of a snake part
            var cell = collisionGrid.getCellByXY(part.xx, part.yy);
            var radius = window.getSnakeWidth(snk.sc);
            radius = Math.max(radius, 20) *sizemultiplier;

            var threat1 = radius;
            var threat2 = radius * 1.5;
            var threat3 = radius * 2;
            var threat4 = radius * 3;
            var maxthreat = radius * 5;

            var t1cellcount = collisionGrid.calculateMaxCellCount(threat1);
            var t2cellcount = collisionGrid.calculateMaxCellCount(threat2);
            var t3cellcount = collisionGrid.calculateMaxCellCount(threat3);
            var t4cellcount = collisionGrid.calculateMaxCellCount(threat4);
            var maxcellcount = collisionGrid.calculateMaxCellCount(maxthreat);
            var maxcellcount2 = maxcellcount*2;
            //if( snk.sp > 7 && sizemultiplier >)
            //    radius = radius * 2;
            //var radiusSqr = radius*radius;
            //var cellcount = collisionGrid.calculateMaxCellCount(radius);
            //var cellcount2 = cellcount*3;


            //mark cell where part's center is located
            collisionGrid.markCellWall(cell.col, cell.row, {snake:snk, part:part});
            //canvas.drawCircle(canvas.mapToCanvas({x:part.xx, y:part.yy}), 'red', true);

            //mark surrounding cells using part's radius
            collisionGrid.sliceGrid(cell.col-maxcellcount, cell.row-maxcellcount, maxcellcount2, maxcellcount2,
                                    function(col, row, val) {
                if( val && val.type != TYPE_SNAKE && val.type != TYPE_EMPTY ) return;//&& val.type!=TYPE_SNAKE ) return;
                if( col >= (cell.col-t1cellcount) && col <= (cell.col+t1cellcount*2) &&
                   row >= (cell.row-t1cellcount) && row <= (cell.row+t1cellcount*2) ) {
                    var marked = collisionGrid.markCellWall(col, row, {snake:snk, part:part});
                }
                else if( col >= (cell.col-t2cellcount) && col <= (cell.col+t2cellcount*2) &&
                        row >= (cell.row-t2cellcount) && row <= (cell.row+t2cellcount*2) ) {
                    collisionGrid.markCellEmpty(col,row,5000)
                }
                else if( col >= (cell.col-t3cellcount) && col <= (cell.col+t3cellcount*2) &&
                        row >= (cell.row-t3cellcount)&& row <= (cell.row+t3cellcount*2) ) {
                    collisionGrid.markCellEmpty(col,row,3000)
                }
                else if( col >= (cell.col-t4cellcount) && col <= (cell.col+t4cellcount*2) &&
                        row >= (cell.row-t4cellcount)&& row <= (cell.row+t4cellcount*2) ) {
                    collisionGrid.markCellEmpty(col,row,2000)
                }
                else {
                    collisionGrid.markCellEmpty(col,row,1500)
                }


                //}
                //else {
                //    var marked = collisionGrid.markCellEmpty(col,row);
                //    marked.weight = 10000;
                //}
            }
                                   );
        },




        lineTestResult: 0,
        lineTypeCheck: function(col, row, type) {
            var cell = collisionGrid.cellTest(col, row, type);
            if( cell !== false )
                collisionGrid.lineTestResult = {col:col, row:row, cell:cell};
            return collisionGrid.lineTestResult;
        },
        lineTest: function(x1, y1, x2, y2, type) {
            collisionGrid.lineTestResult = 0;
            var posA = collisionGrid.getCellByXY(x1, y1);
            var posB = collisionGrid.getCellByXY(x2, y2);
            x1 = posA.col, x2 = posB.col;
            y1 = posA.row, y2 = posB.row;
            var i;               // loop counter
            var cell;
            var ystep, xstep;    // the step on y and x axis
            var error;           // the error accumulated during the increment
            var errorprev;       // *vision the previous value of the error variable
            var y = y1, x = x1;  // the line points
            var ddy, ddx;        // compulsory variables: the double values of dy and dx
            var dx = x2 - x1;
            var dy = y2 - y1;

            if( collisionGrid.lineTypeCheck(x1, y1, type) ) return collisionGrid.lineTestResult;

            // NB the last point can't be here, because of its previous point (which has to be verified)
            if (dy < 0) {
                ystep = -1;
                dy = -dy;
            }
            else
                ystep = 1;

            if (dx < 0) {
                xstep = -1;
                dx = -dx;
            }
            else
                xstep = 1;

            ddy = 2 * dy;  // work with double values for full precision
            ddx = 2 * dx;
            if (ddx >= ddy) {  // first octant (0 <= slope <= 1)
                // compulsory initialization (even for errorprev, needed when dx==dy)
                errorprev = error = dx;  // start in the middle of the square
                for (i=0 ; i < dx ; i++) {  // do not use the first point (already done)
                    x += xstep;
                    error += ddy;
                    if (error > ddx) {  // increment y if AFTER the middle ( > )
                        y += ystep;
                        error -= ddx;
                        // three cases (octant == right->right-top for directions below):
                        if (error + errorprev < ddx) {  // bottom square also
                            //POINT (y-ystep, x);
                            if( collisionGrid.lineTypeCheck(x, y-ystep,type) ) return collisionGrid.lineTestResult;
                            //if( (cell = collisionGrid.cellTest(x, y-ystep)) !== false ) return {x:x, y:y-ystep, cell:cell};
                        }
                        else if (error + errorprev > ddx) { // left square also
                            //POINT (y, x-xstep);
                            if( collisionGrid.lineTypeCheck(x-xstep, y,type) ) return collisionGrid.lineTestResult;
                            //if( (cell = collisionGrid.cellTest(x-xstep, y)) !== false ) return {x:x-xstep, y:y, cell:cell};

                        }
                        else {  // corner: bottom and left squares also
                            if( collisionGrid.lineTypeCheck(x, y-ystep,type) ) return collisionGrid.lineTestResult;
                            if( collisionGrid.lineTypeCheck(x-xstep, y,type) ) return collisionGrid.lineTestResult;

                            //if( (cell = collisionGrid.cellTest(x, y-ystep)) !== false ) return {x:x, y:y-ystep, cell:cell};
                            //if( (cell = collisionGrid.cellTest(x-xstep, y)) !== false ) return {x:x-xstep, y:y, cell:cell};
                            //POINT (y-ystep, x);
                            //POINT (y, x-xstep);
                        }
                    }
                    //POINT (y, x);
                    if( (cell = collisionGrid.cellTest(x, y,type)) !== false ) return {x:x, y:y, cell:cell};
                    errorprev = error;
                }
            }
            else {  // the same as above
                errorprev = error = dy;
                for (i=0 ; i < dy ; i++) {
                    y += ystep;
                    error += ddx;
                    if (error > ddy) {
                        x += xstep;
                        error -= ddy;
                        if (error + errorprev < ddy) {
                            //POINT (y, x-xstep);
                            if( collisionGrid.lineTypeCheck(x-xstep, y,type) ) return collisionGrid.lineTestResult;
                            //if( (cell = collisionGrid.cellTest(x-xstep, y)) !== false ) return {x:x-xstep, y:y, cell:cell};
                        }
                        else if (error + errorprev > ddy) {
                            //POINT (y-ystep, x);
                            if( collisionGrid.lineTypeCheck(x, y-ystep,type) ) return collisionGrid.lineTestResult;
                            //if( (cell = collisionGrid.cellTest(x, y-ystep)) !== false ) return {x:x, y:y-ystep, cell:cell};
                        }
                        else {
                            //POINT (y, x-xstep);
                            //POINT (y-ystep, x);
                            if( collisionGrid.lineTypeCheck(x-xstep, y,type) ) return collisionGrid.lineTestResult;
                            if( collisionGrid.lineTypeCheck(x, y-ystep,type) ) return collisionGrid.lineTestResult;
                            //if( (cell = collisionGrid.cellTest(x-xstep, y)) !== false ) return {x:x-xstep, y:y, cell:cell};
                            //if( (cell = collisionGrid.cellTest(x, y-ystep)) !== false ) return {x:x, y:y-ystep, cell:cell};
                        }
                    }
                    //POINT (y, x);
                    if( collisionGrid.lineTypeCheck(x, y, type) ) return collisionGrid.lineTestResult;
                    //if( (cell = collisionGrid.cellTest(x, y)) !== false ) return {x:x, y:y, cell:cell};
                    errorprev = error;
                }
            }

            return {col:x, row:y, cell:0};
            // assert ((y == y2) && (x == x2));  // the last point (y2,x2) has to be the same with the last point of the algorithm
        }


    }
})();
