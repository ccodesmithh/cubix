// CubiX Flow - After Effects Script
// Keyframe ease application matching AE's built-in curve editor

function applyEase(x1, y1, x2, y2, keyframeType, applyContinuity) {
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
    var keyPairs = []; // Track all key pairs for continuity blending

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
                    keyPairs.push({prop: prop, key1: k, key2: k + 1});
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
                    keyPairs.push({prop: prop, key1: key1, key2: key2});
                } catch (e) {
                    errors.push("Key " + key1 + "-" + key2 + ": " + e.toString());
                }
            }
        }
    }

    // Apply continuity blending if enabled
    if (applyContinuity && keyPairs.length > 1) {
        try {
            blendConsecutiveKeyframes(keyPairs);
        } catch (e) {
            errors.push("Blending error: " + e.toString());
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

function blendConsecutiveKeyframes(keyPairs) {
    // Flow plugin-inspired blending algorithm:
    // 1. Build metadata for each pair (slopes, speeds, values)
    // 2. Blend slopes at middle keyframes
    // 3. Recalculate speeds from blended slopes
    // 4. Reapply to affected keyframes

    // Collect all pair data
    var pairsData = [];

    for (var i = 0; i < keyPairs.length; i++) {
        var pair = keyPairs[i];
        var prop = pair.prop;
        var key1 = pair.key1;
        var key2 = pair.key2;

        try {
            var t1 = prop.keyTime(key1);
            var t2 = prop.keyTime(key2);
            var timeDelta = t2 - t1;
            if (timeDelta <= 0) continue;

            var v1 = prop.keyValue(key1);
            var v2 = prop.keyValue(key2);

            var isArray = (v1 instanceof Array);
            var numDims = isArray ? v1.length : 1;

            var pairData = {
                pair: pair,
                prop: prop,
                key1: key1,
                key2: key2,
                timeDelta: timeDelta,
                v1: v1,
                v2: v2,
                isArray: isArray,
                numDims: numDims,
                easeOut: [],
                easeIn: [],
                slopesOut: [],
                slopesIn: [],
                avSpeeds: [],
                valueDelta: []
            };

            // Read available eases
            try {
                pairData.easeOut = prop.keyOutTemporalEase(key1);
                pairData.easeIn = prop.keyInTemporalEase(key2);
            } catch (e) {
                pairData.easeOut = [];
                pairData.easeIn = [];
            }

            // Calculate slopes and average speeds per dimension
            for (var d = 0; d < numDims; d++) {
                var val1 = isArray ? v1[d] : v1;
                var val2 = isArray ? v2[d] : v2;
                var vDelta = val2 - val1;
                vDelta = isArray ? vDelta : Math.abs(vDelta);
                
                var avSpeed = Math.abs(vDelta) / timeDelta;
                pairData.valueDelta[d] = vDelta;
                pairData.avSpeeds[d] = avSpeed;

                var speedOut = 0, speedIn = 0;
                if (pairData.easeOut && d < pairData.easeOut.length) {
                    speedOut = pairData.easeOut[d].speed;
                }
                if (pairData.easeIn && d < pairData.easeIn.length) {
                    speedIn = pairData.easeIn[d].speed;
                }

                // Calculate slopes: slope = speed / averageSpeed
                var slopeOut = (avSpeed > 0.001) ? (speedOut / avSpeed) : 0;
                var slopeIn = (avSpeed > 0.001) ? (speedIn / avSpeed) : 0;

                // Preserve sign for negative value deltas
                if (vDelta < 0) {
                    slopeOut = -slopeOut;
                    slopeIn = -slopeIn;
                }

                pairData.slopesOut[d] = slopeOut;
                pairData.slopesIn[d] = slopeIn;
            }

            pairsData.push(pairData);
        } catch (e) {
            // Skip on error
        }
    }

    // Blend consecutive pairs using Flow algorithm
    for (var j = 0; j < pairsData.length - 1; j++) {
        var cur = pairsData[j];
        var nxt = pairsData[j + 1];

        // Must be same property and consecutive
        if (cur.prop !== nxt.prop) continue;
        if (cur.key2 !== nxt.key1) continue;

        try {
            var len = Math.min(cur.numDims, nxt.numDims);
            len = Math.min(len, 3); // Limit to 3D

            for (var d = 0; d < len; d++) {
                // Calculate average slope at middle keyframe
                var avgSlope = (cur.slopesOut[d] + nxt.slopesIn[d]) / 2;

                // Recalculate speeds from blended slope
                var newSpeedOut = avgSlope * cur.avSpeeds[d];
                var newSpeedIn = avgSlope * nxt.avSpeeds[d];

                // Apply sign preservation
                if (cur.valueDelta[d] < 0) newSpeedOut = -newSpeedOut;
                if (nxt.valueDelta[d] < 0) newSpeedIn = -newSpeedIn;

                // Blend influences: use maximum to preserve timing
                var maxInf = Math.max(
                    (cur.easeOut && d < cur.easeOut.length) ? cur.easeOut[d].influence : 0,
                    (nxt.easeIn && d < nxt.easeIn.length) ? nxt.easeIn[d].influence : 0
                );

                // Update ease values in-place
                if (cur.easeOut && d < cur.easeOut.length) {
                    cur.easeOut[d].speed = newSpeedOut;
                    cur.easeOut[d].influence = maxInf;
                }
                if (nxt.easeIn && d < nxt.easeIn.length) {
                    nxt.easeIn[d].speed = newSpeedIn;
                    nxt.easeIn[d].influence = maxInf;
                }

                // Update slopes for next iteration
                cur.slopesOut[d] = avgSlope;
                nxt.slopesIn[d] = avgSlope;
            }
        } catch (e) {
            // Continue on error
        }
    }

    // Reapply all modified eases
    for (var i = 0; i < pairsData.length; i++) {
        var pd = pairsData[i];
        try {
            if (pd.easeOut && pd.easeOut.length > 0) {
                var inEase1 = pd.prop.keyInTemporalEase(pd.key1);
                pd.prop.setTemporalEaseAtKey(pd.key1, inEase1, pd.easeOut);
            }
            if (pd.easeIn && pd.easeIn.length > 0) {
                var outEase2 = pd.prop.keyOutTemporalEase(pd.key2);
                pd.prop.setTemporalEaseAtKey(pd.key2, pd.easeIn, outEase2);
            }
        } catch (e) {
            // Continue on error
        }
    }
}

function readFirstKeyframeEase() {
    var comp = app.project.activeItem;

    if (!(comp instanceof CompItem)) {
        return JSON.stringify({ error: "No composition selected." });
    }

    var selectedProps = comp.selectedProperties;

    if (selectedProps.length === 0) {
        return JSON.stringify({ error: "No property selected." });
    }

    var prop = selectedProps[0];

    if (!prop.isTimeVarying || prop.numKeys < 2) {
        return JSON.stringify({ error: "Property has no keyframes." });
    }

    var selectedKeys = prop.selectedKeys;

    if (selectedKeys.length < 2) {
        return JSON.stringify({ error: "Please select at least 2 keyframes." });
    }

    var key1 = selectedKeys[0];
    var key2 = selectedKeys[1];

    var t1 = prop.keyTime(key1);
    var t2 = prop.keyTime(key2);
    var timeDelta = t2 - t1;

    if (timeDelta <= 0) {
        return JSON.stringify({ error: "Invalid keyframe time." });
    }

    var v1 = prop.keyValue(key1);
    var v2 = prop.keyValue(key2);

    // Get outgoing ease from key1
    var outEase = prop.keyOutTemporalEase(key1);

    // Get incoming ease from key2
    var inEase = prop.keyInTemporalEase(key2);

    if (!outEase || !inEase || outEase.length === 0 || inEase.length === 0) {
        return JSON.stringify({ error: "No ease values found on selected keyframes." });
    }

    // Extract speed and influence from the first dimension
    var speedOut = outEase[0].speed;
    var influenceOut = outEase[0].influence;
    var speedIn = inEase[0].speed;
    var influenceIn = inEase[0].influence;

    // Check if spatial property to get average speed
    var isSpatial = false;
    try {
        if (prop.propertyValueType === PropertyValueType.TwoD_SPATIAL || 
            prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {
            isSpatial = true;
        }
    } catch(e) {}

    return JSON.stringify({
        speedOut: speedOut,
        influenceOut: influenceOut,
        speedIn: speedIn,
        influenceIn: influenceIn
    });
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
