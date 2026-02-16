// CubiX Flow - After Effects Script
// Keyframe ease application matching AE's built-in curve editor

function applyEase(x1, y1, x2, y2, keyframeType) {
    var comp = app.project.activeItem;

    if (!(comp instanceof CompItem)) {
        return JSON.stringify({ error: "No composition selected. Please select a composition." });
    }

    var selectedProps = comp.selectedProperties;

    if (selectedProps.length === 0) {
        return JSON.stringify({ error: "No property selected. Please select a property with keyframes." });
    }

    app.beginUndoGroup("CubiX Ease");

    var totalKeysAffected = 0;
    var errors = [];

    for (var i = 0; i < selectedProps.length; i++) {
        var prop = selectedProps[i];

        // Skip if not a property with keyframes
        if (!prop.isTimeVarying) continue;

        var numKeys = prop.numKeys;
        if (numKeys < 2) continue;

        // Get selected keyframe indices
        var selectedKeys = prop.selectedKeys;

        if (selectedKeys.length < 2) {
            // If fewer than 2 keys selected, apply to all consecutive pairs
            for (var k = 1; k < numKeys; k++) {
                try {
                    applyEaseToKeyPair(prop, k, k + 1, x1, y1, x2, y2, keyframeType);
                    totalKeysAffected++;
                } catch (e) {
                    errors.push("Key " + k + "-" + (k+1) + ": " + e.toString());
                }
            }
        } else {
            // Apply to selected keyframe pairs
            for (var k = 0; k < selectedKeys.length - 1; k++) {
                var key1 = selectedKeys[k];
                var key2 = selectedKeys[k + 1];

                try {
                    applyEaseToKeyPair(prop, key1, key2, x1, y1, x2, y2, keyframeType);
                    totalKeysAffected++;
                } catch (e) {
                    errors.push("Key " + key1 + "-" + key2 + ": " + e.toString());
                }
            }
        }
    }

    app.endUndoGroup();

    if (totalKeysAffected === 0) {
        return JSON.stringify({
            error: errors.length > 0 ? errors.join("; ") : "No keyframes affected. Select at least two keyframes."
        });
    }

    return JSON.stringify({ success: true, keysAffected: totalKeysAffected });
}

function applyEaseToKeyPair(prop, key1, key2, x1, y1, x2, y2, keyframeType) {
    var t1 = prop.keyTime(key1);
    var t2 = prop.keyTime(key2);
    var timeDelta = t2 - t1;

    if (timeDelta <= 0) return;

    var v1 = prop.keyValue(key1);
    var v2 = prop.keyValue(key2);

    // Handle keyframe interpolation type FIRST
    if (keyframeType === "linear") {
        try {
            prop.setInterpolationTypeAtKey(key1, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
            prop.setInterpolationTypeAtKey(key2, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
        } catch(e) {} // ignore if already set
        return; 
    } else if (keyframeType === "hold") {
        try {
            prop.setInterpolationTypeAtKey(key1, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.HOLD);
        } catch(e) {}
        return;
    } else if (keyframeType === "roving") {
        // Roving is a property of the intermediate keyframes mostly, 
        // but let's try setting it if supported.
        // Actually, roving is prop.setRovingAtKey(keyIndex, true/false);
        // But for this simple implementation, let's treat it as Linear/Bezier transition
    }

    // Ensure Bezier interpolation for easing
    try {
        prop.setInterpolationTypeAtKey(key1, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.BEZIER);
        prop.setInterpolationTypeAtKey(key2, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.LINEAR);
    } catch(e) {
        // Some properties might not support this combination, ignore
    }

    // ── Calculate AE ease parameters ──
    // influence_out at key1 = x1 * 100
    // influence_in at key2 = (1 - x2) * 100
    var influenceOut = Math.min(Math.max(x1 * 100, 0.1), 100);
    var influenceIn = Math.min(Math.max((1 - x2) * 100, 0.1), 100);

    // Determine if Spatial property (Position, Anchor Point, etc.)
    // PropertyValueType.TwoD_SPATIAL (6414) or ThreeD_SPATIAL (6415)
    var isSpatial = false;
    try {
        if (prop.propertyValueType === PropertyValueType.TwoD_SPATIAL || 
            prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {
            isSpatial = true;
        }
    } catch(e) {
        // Fallback or older AE versions
    }

    var easeOutArray = [];
    var easeInArray = [];

    if (isSpatial) {
        // Spatial properties use single speed value along the motion path
        // Calculate distance between keyframes
        var dist = 0;
        if (v1 instanceof Array && v2 instanceof Array) {
            for (var i = 0; i < v1.length; i++) {
                dist += Math.pow(v2[i] - v1[i], 2);
            }
            dist = Math.sqrt(dist);
        } else {
            dist = Math.abs(v2 - v1);
        }

        var avSpeed = dist / timeDelta;

        // Slopes
        var slopeOut = (x1 > 0.001) ? (y1 / x1) : 0;
        var slopeIn = ((1 - x2) > 0.001) ? ((1 - y2) / (1 - x2)) : 0;

        // Speed along path
        var speedOut = slopeOut * avSpeed;
        var speedIn = slopeIn * avSpeed;

        // Spatial speed is typically positive (magnitude)
        
        easeOutArray.push(new KeyframeEase(speedOut, influenceOut));
        easeInArray.push(new KeyframeEase(speedIn, influenceIn));
    } 
    else {
        // Non-spatial: Calculate per-dimension
        var isArray = (v1 instanceof Array);
        var numDims = isArray ? v1.length : 1;

        for (var d = 0; d < numDims; d++) {
            var val1 = isArray ? v1[d] : v1;
            var val2 = isArray ? v2[d] : v2;
            var valueDelta = val2 - val1;

            var avSpeed = Math.abs(valueDelta) / timeDelta;
            var slopeOut = (x1 > 0.001) ? (y1 / x1) : 0;
            var slopeIn = ((1 - x2) > 0.001) ? ((1 - y2) / (1 - x2)) : 0;

            var speedOut = slopeOut * avSpeed;
            var speedIn = slopeIn * avSpeed;

            if (valueDelta < 0) {
                speedOut = -speedOut;
                speedIn = -speedIn;
            }

            easeOutArray.push(new KeyframeEase(speedOut, influenceOut));
            easeInArray.push(new KeyframeEase(speedIn, influenceIn));
        }
    }

    // Apply outgoing ease at key1 (preserve existing incoming ease)
    var existingInKey1 = prop.keyInTemporalEase(key1);
    prop.setTemporalEaseAtKey(key1, existingInKey1, easeOutArray);

    // Apply incoming ease at key2 (preserve existing outgoing ease)
    var existingOutKey2 = prop.keyOutTemporalEase(key2);
    prop.setTemporalEaseAtKey(key2, easeInArray, existingOutKey2);
}
