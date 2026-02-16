// CubiX Flow - main.js
// Curve editor matching After Effects' built-in graph editor

var cs = new CSInterface();

// Canvas elements
var canvas, ctx;
var speedCanvas, speedCtx;

// Logical (CSS) dimensions for coordinate mapping
var logicalW = 320;
var logicalH = 200;
var speedLogicalW = 320;
var speedLogicalH = 80;

// Control points (normalized 0-1 for X, unclamped Y for overshoot)
var p1 = { x: 0.33, y: 0 };
var p2 = { x: 0.67, y: 1 };

// State
var dragging = null;
var dragStartPos = null; // for Shift constraint
var dragStartPoint = null;
var selectedPreset = 'easeInOut';
var selectedKeyframeType = 'keyframe';

// HIT RADIUS for easier touch control (normalized distance)
// Increased from 0.08 to 0.15 for better usability on small screens
const HIT_RADIUS = 0.15;

// Presets matching AE's actual defaults
// In AE's normalized space: P0=(0,0), P3=(1,1)
// x = influence/100, y = slope * x (for outgoing) or 1 - slope*(1-x) (for incoming)
const presets = {
    linear: {
        name: 'Linear',
        p1: { x: 0, y: 0 },
        p2: { x: 1, y: 1 }
    },
    easeIn: {
        name: 'Ease In',
        p1: { x: 0.33, y: 0.33 },
        p2: { x: 0.67, y: 1 }
    },
    easeOut: {
        name: 'Ease Out',
        p1: { x: 0.33, y: 0 },
        p2: { x: 0.67, y: 0.67 }
    },
    easeInOut: {
        name: 'Ease',
        p1: { x: 0.33, y: 0 },
        p2: { x: 0.67, y: 1 }
    },
    hold: {
        name: 'Hold',
        p1: { x: 0.33, y: 0 },
        p2: { x: 0.67, y: 0 }
    },
    bounce: {
        name: 'Bounce',
        p1: { x: 0.17, y: 0.88 }, // Adjusted to create an overshoot
        p2: { x: 0.28, y: 1.25 }, // Adjusted to create an overshoot
        custom: true
    },
    elastic: {
        name: 'Elastic',
        p1: { x: 0.68, y: -0.55 },
        p2: { x: 0.27, y: 1.55 },
        custom: true
    }
};

// Keyframe types
const keyframeTypes = {
    keyframe: 'Keyframe',
    roving: 'Roving',
    linear: 'Linear'
};

window.onload = function() {
    // Splash Screen Logic
    var splashScreen = document.getElementById('splashScreen');
    var splashVideo = document.getElementById('splashVideo');

    // Make sure splash screen is visible initially
    splashScreen.classList.remove('hidden');

    // Function to hide the splash screen
    function hideSplashScreen() {
        if (splashScreen && !splashScreen.classList.contains('hidden')) {
            splashScreen.classList.add('hidden');
            // Remove event listener to prevent double triggers
            if (splashVideo) { // Check if splashVideo exists
                splashVideo.removeEventListener('ended', hideSplashScreen);
            }
            // Optionally remove the splash screen from DOM after transition
            setTimeout(() => {
                if (splashScreen.parentNode) {
                    splashScreen.parentNode.removeChild(splashScreen);
                }
                // Remove splash-active class from body to reveal main content
                document.body.classList.remove('splash-active');
            }, 500); // Matches CSS transition duration
        }
    }

    // Hide splash screen when video ends
    if (splashVideo) { // Check if splashVideo exists
        splashVideo.addEventListener('ended', hideSplashScreen);
        // Fallback: Hide splash screen after a maximum duration (e.g., 5 seconds)
        // This also ensures the video stops looping if it plays successfully
        setTimeout(() => {
            hideSplashScreen();
        }, 5000); // 5 seconds fallback
    } else {
        // If no video, hide splash screen immediately or after a short delay
        setTimeout(hideSplashScreen, 100);
    }

    canvas = document.getElementById("curveCanvas");
    ctx = canvas.getContext("2d");
    speedCanvas = document.getElementById("speedCanvas");
    speedCtx = speedCanvas.getContext("2d");

    // Mouse Event listeners
    canvas.addEventListener("mousedown", onPointerDown);
    document.addEventListener("mousemove", onPointerMove); // Listen on document for global dragging
    document.addEventListener("mouseup", onPointerUp);

    // Touch Event listeners
    canvas.addEventListener("touchstart", onPointerDown, { passive: false });
    document.addEventListener("touchmove", onPointerMove, { passive: false });
    document.addEventListener("touchend", onPointerUp);

    // Double click to reset handle
    canvas.addEventListener("dblclick", onDoubleClick);

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectPreset(this.dataset.preset);
        });
    });

    // Keyframe type buttons
    document.querySelectorAll('.keyframe-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectKeyframeType(this.dataset.type);
        });
    });

    // Editable input fields
    setupEditableInputs();

    // Responsive canvases
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    // Initialize drawing
    draw();
    updateInfoDisplay();

    if (!cs) {
        updateStatus('Preview mode — open inside After Effects to apply');
        document.querySelector('.apply-btn').disabled = false;
    }
};

// ─── Editable Inputs ─────────────────────────────────────────────
function setupEditableInputs() {
    var inputs = document.querySelectorAll('.handle-input');
    inputs.forEach(function(input) {
        input.addEventListener('change', onInputChange);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });
    });
}

function onInputChange(e) {
    var id = e.target.id;
    var val = parseFloat(e.target.value);
    if (isNaN(val)) return;

    if (id === 'inputSpeedIn') {
        var slope = Math.max(val, 0);
        p1.y = slope * p1.x;
    } else if (id === 'inputInfluenceIn') {
        var inf = Math.min(Math.max(val, 0.1), 100);
        p1.x = inf / 100;
    } else if (id === 'inputSpeedOut') {
        var slope = Math.max(val, 0);
        p2.y = 1 - slope * (1 - p2.x);
    } else if (id === 'inputInfluenceOut') {
        var inf = Math.min(Math.max(val, 0.1), 100);
        p2.x = 1 - inf / 100;
    }

    selectedPreset = null;
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    draw();
    updateInfoDisplay();
}

// ─── Canvas Setup ────────────────────────────────────────────────
function resizeCanvases() {
    var dpi = window.devicePixelRatio || 1;

    // Value canvas
    var container = canvas.parentElement;
    logicalW = container.clientWidth || 320;
    logicalH = container.clientHeight || 160; // Use wrapper height
    canvas.width = Math.floor(logicalW * dpi);
    canvas.height = Math.floor(logicalH * dpi);
    canvas.style.width = logicalW + 'px';
    canvas.style.height = logicalH + 'px';
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0);

    // Speed canvas
    var speedContainer = speedCanvas.parentElement;
    speedLogicalW = speedContainer.clientWidth || 320;
    speedLogicalH = parseInt(getComputedStyle(speedCanvas).height, 10) || 48;
    speedCanvas.width = Math.floor(speedLogicalW * dpi);
    speedCanvas.height = Math.floor(speedLogicalH * dpi);
    speedCanvas.style.width = speedLogicalW + 'px';
    speedCanvas.style.height = speedLogicalH + 'px';
    speedCtx.setTransform(dpi, 0, 0, dpi, 0, 0);

    draw();
}

// ─── Drawing ─────────────────────────────────────────────────────
function draw() {
    drawValueCurve();
    drawSpeedCurve();
    updateInfoDisplay();
}

function drawValueCurve() {
    var w = logicalW;
    var h = logicalH;

    ctx.clearRect(0, 0, w, h);

    // Background & grid
    drawGrid(ctx, w, h);

    // Padding for the drawing area
    var pad = 24;
    var drawW = w - pad * 2;
    var drawH = h - pad * 2;

    // Helper: normalized coords to canvas coords
    function toCanvasX(nx) { return pad + nx * drawW; }
    function toCanvasY(ny) { return pad + (1 - ny) * drawH; }

    // Determine Y range for overshoot support
    var minY = Math.min(0, p1.y, p2.y);
    var maxY = Math.max(1, p1.y, p2.y);
    var rangeY = maxY - minY;
    if (rangeY < 1) rangeY = 1;
    var yPad = rangeY * 0.15; // Increased visual padding
    var viewMinY = minY - yPad;
    var viewMaxY = maxY + yPad;
    var viewRange = viewMaxY - viewMinY;

    function toCanvasYScaled(ny) {
        var norm = (ny - viewMinY) / viewRange;
        return pad + (1 - norm) * drawH;
    }

    // Diagonal reference line (linear)
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), toCanvasYScaled(0));
    ctx.lineTo(toCanvasX(1), toCanvasYScaled(1));
    ctx.stroke();
    ctx.setLineDash([]);

    // Y=0 and Y=1 reference lines if overshoot
    if (minY < 0 || maxY > 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        if (minY < 0) {
            var y0Line = toCanvasYScaled(0);
            ctx.beginPath();
            ctx.moveTo(pad, y0Line);
            ctx.lineTo(pad + drawW, y0Line);
            ctx.stroke();
        }
        if (maxY > 1) {
            var y1Line = toCanvasYScaled(1);
            ctx.beginPath();
            ctx.moveTo(pad, y1Line);
            ctx.lineTo(pad + drawW, y1Line);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    // Bézier curve
    ctx.strokeStyle = "#3a8dde";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), toCanvasYScaled(0));

    var cp1x = toCanvasX(p1.x);
    var cp1y = toCanvasYScaled(p1.y);
    var cp2x = toCanvasX(p2.x);
    var cp2y = toCanvasYScaled(p2.y);

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toCanvasX(1), toCanvasYScaled(1));
    ctx.stroke();

    // Start and end keyframe diamonds
    drawDiamond(ctx, toCanvasX(0), toCanvasYScaled(0), 5, "#fff");
    drawDiamond(ctx, toCanvasX(1), toCanvasYScaled(1), 5, "#fff");

    // Handle lines — P1 from start anchor, P2 from end anchor
    // P1 handle: start (0,0) → P1
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), toCanvasYScaled(0));
    ctx.lineTo(cp1x, cp1y);
    ctx.stroke();
    ctx.setLineDash([]);

    // P2 handle: end (1,1) → P2
    ctx.strokeStyle = "#2ecc71";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(1), toCanvasYScaled(1));
    ctx.lineTo(cp2x, cp2y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Control points
    // Larger radius if dragging or hovered
    var p1Radius = (dragging === p1) ? 9 : 7;
    var p2Radius = (dragging === p2) ? 9 : 7;
    
    drawControlPoint(ctx, cp1x, cp1y, "#e74c3c", p1Radius);
    drawControlPoint(ctx, cp2x, cp2y, "#2ecc71", p2Radius);

    // Axis labels
    ctx.fillStyle = "#555";
    ctx.font = "9px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time →", w / 2, h - 4);
    ctx.save();
    ctx.translate(10, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Value →", 0, 0);
    ctx.restore();

    // Store drawing params for mouse interaction
    canvas._drawParams = {
        pad: pad,
        drawW: drawW,
        drawH: drawH,
        viewMinY: viewMinY,
        viewRange: viewRange
    };
}

function drawSpeedCurve() {
    var w = speedLogicalW;
    var h = speedLogicalH;

    speedCtx.clearRect(0, 0, w, h);

    // Background
    speedCtx.fillStyle = "#0d0d0d";
    speedCtx.fillRect(0, 0, w, h);

    var pad = 12;
    var drawW = w - pad * 2;
    var drawH = h - pad * 2;

    // Calculate speed values first to find range
    var steps = 80;
    var speeds = [];
    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        speeds.push(calculateSpeed(t));
    }

    var maxSpeed = 0;
    for (var i = 0; i < speeds.length; i++) {
        if (speeds[i] > maxSpeed) maxSpeed = speeds[i];
    }
    if (maxSpeed < 0.01) maxSpeed = 1;

    // Center baseline
    var baseY = pad + drawH;

    // Grid line at midpoint
    speedCtx.strokeStyle = "#1a1a1a";
    speedCtx.lineWidth = 1;
    speedCtx.beginPath();
    speedCtx.moveTo(pad, pad + drawH / 2);
    speedCtx.lineTo(pad + drawW, pad + drawH / 2);
    speedCtx.stroke();

    // Speed curve
    speedCtx.strokeStyle = "#f39c12";
    speedCtx.lineWidth = 2;
    speedCtx.beginPath();

    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var normalized = speeds[i] / maxSpeed;
        var x = pad + t * drawW;
        var y = baseY - normalized * drawH;

        if (i === 0) {
            speedCtx.moveTo(x, y);
        } else {
            speedCtx.lineTo(x, y);
        }
    }
    speedCtx.stroke();

    // Keyframe markers
    speedCtx.fillStyle = "#888";
    speedCtx.font = "8px -apple-system, sans-serif";
    speedCtx.textAlign = "left";
    speedCtx.fillText("Speed | AE Graph Preview", pad + 2, pad + 8);
}

function drawGrid(context, width, height) {
    context.fillStyle = "#0d0d0d";
    context.fillRect(0, 0, width, height);

    // Grid lines
    context.strokeStyle = "#181818";
    context.lineWidth = 0.5;

    var gridSize = 20;
    for (var x = 0; x <= width; x += gridSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
    }
    for (var y = 0; y <= height; y += gridSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
    }

    // Border
    context.strokeStyle = "#2a2a2a";
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, width - 1, height - 1);
}

function drawDiamond(context, x, y, size, color) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y - size);
    context.lineTo(x + size, y);
    context.lineTo(x, y + size);
    context.lineTo(x - size, y);
    context.closePath();
    context.fill();
}

function drawControlPoint(context, x, y, color, radius) {
    // Outer glow
    context.shadowColor = color;
    context.shadowBlur = 8;

    // Fill circle
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    // Inner highlight
    context.shadowBlur = 0;
    context.fillStyle = "rgba(255,255,255,0.6)";
    context.beginPath();
    context.arc(x, y, radius * 0.35, 0, Math.PI * 2);
    context.fill();
}

// ─── Bézier Math ─────────────────────────────────────────────────
function bezierDerivativeX(t) {
    var mt = 1 - t;
    return 3 * mt * mt * p1.x +
           6 * mt * t * (p2.x - p1.x) +
           3 * t * t * (1 - p2.x);
}

function bezierDerivativeY(t) {
    var mt = 1 - t;
    return 3 * mt * mt * p1.y +
           6 * mt * t * (p2.y - p1.y) +
           3 * t * t * (1 - p2.y);
}

function calculateSpeed(t) {
    var dx = bezierDerivativeX(t);
    var dy = bezierDerivativeY(t);
    if (Math.abs(dx) < 0.0001) return 0;
    return Math.abs(dy / dx);
}

// ─── Pointer Handlers (Mouse & Touch) ────────────────────────────
function onPointerDown(e) {
    // Prevent scrolling on touch
    if (e.type === 'touchstart') e.preventDefault();
    
    var pos = getPointerPos(e);

    // Check hit with LARGER radius
    if (distance(pos, p1) < HIT_RADIUS) {
        dragging = p1;
        dragStartPoint = { x: p1.x, y: p1.y };
    } else if (distance(pos, p2) < HIT_RADIUS) {
        dragging = p2;
        dragStartPoint = { x: p2.x, y: p2.y };
    }

    if (dragging) {
        dragStartPos = pos;
        canvas.style.cursor = 'grabbing';
        draw(); // Redraw immediately to show active state
    }
}

function onPointerMove(e) {
    if (!dragging) {
        // Show cursor hint (hover effect)
        var pos = getPointerPos(e);
        if (distance(pos, p1) < HIT_RADIUS || distance(pos, p2) < HIT_RADIUS) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
        return;
    }

    if (e.type === 'touchmove') e.preventDefault();

    var pos = getPointerPos(e);

    // Shift key constraint
    // For touch, maybe verify multi-touch? But standard is modifier key usually.
    // If holding Shift, lock to horizontal or vertical axis relative to start drag
    if (e.shiftKey && dragStartPos && dragStartPoint) {
        var dx = Math.abs(pos.x - dragStartPos.x);
        var dy = Math.abs(pos.y - dragStartPos.y);

        if (dx > dy) {
            // Horizontal lock: restore original Y
            pos.y = dragStartPoint.y;
        } else {
            // Vertical lock: restore original X
            pos.x = dragStartPoint.x;
        }
    }

    // X clamped to [0.01, 0.99], Y clamped to a reasonable range like [-0.5, 1.5]
    dragging.x = Math.min(Math.max(pos.x, 0.01), 0.99);
    dragging.y = Math.min(Math.max(pos.y, -0.5), 1.5); 

    // Deselect preset
    selectedPreset = null;
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));

    draw();
}

function onPointerUp(e) {
    if (dragging) {
        canvas.style.cursor = 'default';
    }
    dragging = null;
    dragStartPos = null;
    dragStartPoint = null;
    draw(); // Redraw to clear active state
}

function onDoubleClick(e) {
    var pos = getPointerPos(e);
    
    // Check if double clicking near a point to reset it
    if (distance(pos, p1) < HIT_RADIUS) {
        // Reset P1 to default (linear-ish)
        p1 = { x: 0.33, y: 0.33 };
        draw();
        updateInfoDisplay();
    } else if (distance(pos, p2) < HIT_RADIUS) {
        // Reset P2
        p2 = { x: 0.67, y: 0.67 };
        draw();
        updateInfoDisplay();
    }
}

function getPointerPos(e) {
    // Normalise mouse or touch event
    var clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        // For touchend
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    var rect = canvas.getBoundingClientRect();
    var params = canvas._drawParams;

    if (!params) {
        return {
            x: (clientX - rect.left) / rect.width,
            y: 1 - (clientY - rect.top) / rect.height
        };
    }

    var mouseX = clientX - rect.left;
    var mouseY = clientY - rect.top;

    var nx = (mouseX - params.pad) / params.drawW;
    var ny = params.viewMinY + (1 - (mouseY - params.pad) / params.drawH) * params.viewRange;

    return { x: nx, y: ny };
}

function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ─── Preset Selection ────────────────────────────────────────────
function selectPreset(presetName) {
    var preset = presets[presetName];
    if (!preset) return;

    selectedPreset = presetName;
    p1 = { x: preset.p1.x, y: preset.p1.y };
    p2 = { x: preset.p2.x, y: preset.p2.y };

    // Update UI
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === presetName);
    });

    draw();
}

// ─── Keyframe Type Selection ─────────────────────────────────────
function selectKeyframeType(type) {
    selectedKeyframeType = type;

    document.querySelectorAll('.keyframe-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
}

// ─── Info Display ────────────────────────────────────────────────
function updateInfoDisplay() {
    // AE influence: how far the handle extends as % of time span
    var influenceIn = p1.x * 100;
    var influenceOut = (1 - p2.x) * 100;

    // Normalized speed (slope dy/dx at the keyframe)
    // At start (t=0): slope = p1.y / p1.x
    // At end (t=1): slope = (1 - p2.y) / (1 - p2.x)
    var speedIn = (p1.x > 0.001) ? (p1.y / p1.x) : 0;
    var speedOut = ((1 - p2.x) > 0.001) ? ((1 - p2.y) / (1 - p2.x)) : 0;

    // Update display
    var elSpeedIn = document.getElementById('inputSpeedIn');
    var elInfluenceIn = document.getElementById('inputInfluenceIn');
    var elSpeedOut = document.getElementById('inputSpeedOut');
    var elInfluenceOut = document.getElementById('inputInfluenceOut');

    if (elSpeedIn && document.activeElement !== elSpeedIn) {
        elSpeedIn.value = speedIn.toFixed(2);
    }
    if (elInfluenceIn && document.activeElement !== elInfluenceIn) {
        elInfluenceIn.value = influenceIn.toFixed(1);
    }
    if (elSpeedOut && document.activeElement !== elSpeedOut) {
        elSpeedOut.value = speedOut.toFixed(2);
    }
    if (elInfluenceOut && document.activeElement !== elInfluenceOut) {
        elInfluenceOut.value = influenceOut.toFixed(1);
    }
}

// ─── Apply to After Effects ──────────────────────────────────────
function applyEase() {
    if (!cs || typeof cs.evalScript !== 'function') {
        updateStatus('Cannot apply — host not connected. Open inside After Effects.');
        return;
    }

    updateStatus('Applying...');
    document.querySelector('.apply-btn').disabled = true;

    var script = 'applyEase(' + p1.x + ', ' + p1.y + ', ' + p2.x + ', ' + p2.y + ', "' + selectedKeyframeType + '")';
    cs.evalScript(script, function(result) {
        document.querySelector('.apply-btn').disabled = false;

        if (!result) {
            updateStatus('No response from host.');
            return;
        }

        // Try to parse JSON string from ExtendScript
        try {
            var res = JSON.parse(result);
            if (res.error) {
                updateStatus('Error: ' + res.error);
            } else if (res.success) {
                updateStatus('Applied to ' + (res.keysAffected || '') + ' keyframe pair(s)!');
                setTimeout(function() { updateStatus('Ready'); }, 2500);
            } else {
                updateStatus('Done.');
            }
        } catch (e) {
            if (result.indexOf('error') !== -1) {
                updateStatus('Error: ' + result);
            } else {
                updateStatus('Applied');
                setTimeout(function() { updateStatus('Ready'); }, 2000);
            }
        }
    });
}

function updateStatus(text) {
    document.getElementById('statusText').textContent = text;
}

// Export for HTML access
window.selectPreset = selectPreset;
window.selectKeyframeType = selectKeyframeType;
window.applyEase = applyEase;
