"use strict";
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var lastError;
var lastMessage;
var errorCount;
var silenceOutput;
var DEBUG = false;
var getContext = function () { return ({}); };
reset();
function reset() {
    lastError = undefined;
    lastMessage = undefined;
    errorCount = 0;
    silenceOutput = false;
}
exports.reset = reset;
function setDebug(debug) {
    if (debug === void 0) { debug = true; }
    DEBUG = debug;
}
exports.setDebug = setDebug;
function silent(f) {
    if (f === void 0) { f = true; }
    silenceOutput = f;
}
exports.silent = silent;
function setContext(fn) {
    getContext = fn;
}
exports.setContext = setContext;
function error(s) {
    var err = errorString(s);
    // De-dup identical messages
    if (err === lastMessage) {
        return;
    }
    lastMessage = err;
    lastError = lastMessage;
    if (!silenceOutput) {
        console.error(lastError);
        if (DEBUG) {
            var e = new Error("Stack trace");
            console.error(e.stack);
        }
    }
    errorCount += 1;
}
exports.error = error;
function warn(s) {
    var err = errorString(s);
    // De-dup identical messages
    if (err === lastMessage) {
        return;
    }
    lastMessage = err;
    if (!silenceOutput) {
        console.warn(lastMessage);
    }
}
exports.warn = warn;
function getLastMessage() {
    return lastMessage;
}
exports.getLastMessage = getLastMessage;
function errorString(s) {
    var ctx = getContext();
    if (ctx.line !== undefined && ctx.column !== undefined) {
        return 'bolt:' + ctx.line + ':' + ctx.column + ': ' + s;
    }
    else {
        return 'bolt: ' + s;
    }
}
function hasErrors() {
    return errorCount > 0;
}
exports.hasErrors = hasErrors;
function errorSummary() {
    if (errorCount === 1) {
        return lastError;
    }
    if (errorCount !== 0) {
        return "Fatal errors: " + errorCount;
    }
    return "";
}
exports.errorSummary = errorSummary;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxvZ2dlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSCxJQUFJLFNBQTZCLENBQUM7QUFDbEMsSUFBSSxXQUErQixDQUFDO0FBQ3BDLElBQUksVUFBa0IsQ0FBQztBQUN2QixJQUFJLGFBQXNCLENBQUM7QUFFM0IsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBRWxCLElBQUksVUFBVSxHQUFHLGNBQU0sT0FBQSxDQUFnQixFQUFFLENBQUMsRUFBbkIsQ0FBbUIsQ0FBQztBQUUzQyxLQUFLLEVBQUUsQ0FBQztBQUVSO0lBQ0UsU0FBUyxHQUFHLFNBQVMsQ0FBQztJQUN0QixXQUFXLEdBQUcsU0FBUyxDQUFDO0lBQ3hCLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDZixhQUFhLEdBQUcsS0FBSyxDQUFDO0FBQ3hCLENBQUM7QUFMZSxhQUFLLFFBS3BCLENBQUE7QUFFRCxrQkFBeUIsS0FBWTtJQUFaLHFCQUFZLEdBQVosWUFBWTtJQUNuQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBQ2hCLENBQUM7QUFGZSxnQkFBUSxXQUV2QixDQUFBO0FBRUQsZ0JBQXVCLENBQVE7SUFBUixpQkFBUSxHQUFSLFFBQVE7SUFDN0IsYUFBYSxHQUFHLENBQUMsQ0FBQztBQUNwQixDQUFDO0FBRmUsY0FBTSxTQUVyQixDQUFBO0FBT0Qsb0JBQTJCLEVBQXNCO0lBQy9DLFVBQVUsR0FBRyxFQUFFLENBQUM7QUFDbEIsQ0FBQztBQUZlLGtCQUFVLGFBRXpCLENBQUE7QUFFRCxlQUFzQixDQUFTO0lBQzdCLElBQUksR0FBRyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN6Qiw0QkFBNEI7SUFDNUIsRUFBRSxDQUFDLENBQUMsR0FBRyxLQUFNLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDekIsTUFBTSxDQUFDO0lBQ1QsQ0FBQztJQUNELFdBQVcsR0FBRyxHQUFHLENBQUM7SUFDbEIsU0FBUyxHQUFHLFdBQVcsQ0FBQztJQUN4QixFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFDbkIsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN6QixFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ1YsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDakMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDekIsQ0FBQztJQUNILENBQUM7SUFDRCxVQUFVLElBQUksQ0FBQyxDQUFDO0FBQ2xCLENBQUM7QUFoQmUsYUFBSyxRQWdCcEIsQ0FBQTtBQUVELGNBQXFCLENBQVM7SUFDNUIsSUFBSSxHQUFHLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pCLDRCQUE0QjtJQUM1QixFQUFFLENBQUMsQ0FBQyxHQUFHLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQztRQUN4QixNQUFNLENBQUM7SUFDVCxDQUFDO0lBQ0QsV0FBVyxHQUFHLEdBQUcsQ0FBQztJQUNsQixFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFDbkIsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM1QixDQUFDO0FBQ0gsQ0FBQztBQVZlLFlBQUksT0FVbkIsQ0FBQTtBQUVEO0lBQ0UsTUFBTSxDQUFDLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBRmUsc0JBQWMsaUJBRTdCLENBQUE7QUFFRCxxQkFBcUIsQ0FBUztJQUM1QixJQUFJLEdBQUcsR0FBRyxVQUFVLEVBQUUsQ0FBQztJQUN2QixFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUMsSUFBSSxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUFDLElBQUksQ0FBQyxDQUFDO1FBQ04sTUFBTSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7SUFDdEIsQ0FBQztBQUNILENBQUM7QUFFRDtJQUNFLE1BQU0sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCLENBQUM7QUFGZSxpQkFBUyxZQUV4QixDQUFBO0FBRUQ7SUFDRSxFQUFFLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyQixNQUFNLENBQVUsU0FBUyxDQUFDO0lBQzVCLENBQUM7SUFFRCxFQUFFLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyQixNQUFNLENBQUMsZ0JBQWdCLEdBQUcsVUFBVSxDQUFDO0lBQ3ZDLENBQUM7SUFDRCxNQUFNLENBQUMsRUFBRSxDQUFDO0FBQ1osQ0FBQztBQVRlLG9CQUFZLGVBUzNCLENBQUEiLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcclxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cclxuICpcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcclxuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxyXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcclxuICpcclxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG4gKlxyXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbiAqL1xyXG5sZXQgbGFzdEVycm9yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcbmxldCBsYXN0TWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xyXG5sZXQgZXJyb3JDb3VudDogbnVtYmVyO1xyXG5sZXQgc2lsZW5jZU91dHB1dDogYm9vbGVhbjtcclxuXHJcbmxldCBERUJVRyA9IGZhbHNlO1xyXG5cclxubGV0IGdldENvbnRleHQgPSAoKSA9PiAoPEVycm9yQ29udGV4dD4ge30pO1xyXG5cclxucmVzZXQoKTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZXNldCgpIHtcclxuICBsYXN0RXJyb3IgPSB1bmRlZmluZWQ7XHJcbiAgbGFzdE1lc3NhZ2UgPSB1bmRlZmluZWQ7XHJcbiAgZXJyb3JDb3VudCA9IDA7XHJcbiAgc2lsZW5jZU91dHB1dCA9IGZhbHNlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2V0RGVidWcoZGVidWcgPSB0cnVlKSB7XHJcbiAgREVCVUcgPSBkZWJ1ZztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNpbGVudChmID0gdHJ1ZSkge1xyXG4gIHNpbGVuY2VPdXRwdXQgPSBmO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEVycm9yQ29udGV4dCB7XHJcbiAgbGluZT86IG51bWJlcjtcclxuICBjb2x1bW4/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzZXRDb250ZXh0KGZuOiAoKSA9PiBFcnJvckNvbnRleHQpIHtcclxuICBnZXRDb250ZXh0ID0gZm47XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBlcnJvcihzOiBzdHJpbmcpIHtcclxuICBsZXQgZXJyID0gZXJyb3JTdHJpbmcocyk7XHJcbiAgLy8gRGUtZHVwIGlkZW50aWNhbCBtZXNzYWdlc1xyXG4gIGlmIChlcnIgID09PSBsYXN0TWVzc2FnZSkge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBsYXN0TWVzc2FnZSA9IGVycjtcclxuICBsYXN0RXJyb3IgPSBsYXN0TWVzc2FnZTtcclxuICBpZiAoIXNpbGVuY2VPdXRwdXQpIHtcclxuICAgIGNvbnNvbGUuZXJyb3IobGFzdEVycm9yKTtcclxuICAgIGlmIChERUJVRykge1xyXG4gICAgICBsZXQgZSA9IG5ldyBFcnJvcihcIlN0YWNrIHRyYWNlXCIpO1xyXG4gICAgICBjb25zb2xlLmVycm9yKGUuc3RhY2spO1xyXG4gICAgfVxyXG4gIH1cclxuICBlcnJvckNvdW50ICs9IDE7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3YXJuKHM6IHN0cmluZykge1xyXG4gIGxldCBlcnIgPSBlcnJvclN0cmluZyhzKTtcclxuICAvLyBEZS1kdXAgaWRlbnRpY2FsIG1lc3NhZ2VzXHJcbiAgaWYgKGVyciA9PT0gbGFzdE1lc3NhZ2UpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgbGFzdE1lc3NhZ2UgPSBlcnI7XHJcbiAgaWYgKCFzaWxlbmNlT3V0cHV0KSB7XHJcbiAgICBjb25zb2xlLndhcm4obGFzdE1lc3NhZ2UpO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldExhc3RNZXNzYWdlKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XHJcbiAgcmV0dXJuIGxhc3RNZXNzYWdlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBlcnJvclN0cmluZyhzOiBzdHJpbmcpIHtcclxuICBsZXQgY3R4ID0gZ2V0Q29udGV4dCgpO1xyXG4gIGlmIChjdHgubGluZSAhPT0gdW5kZWZpbmVkICYmIGN0eC5jb2x1bW4gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuICdib2x0OicgKyBjdHgubGluZSArICc6JyArIGN0eC5jb2x1bW4gKyAnOiAnICsgcztcclxuICB9IGVsc2Uge1xyXG4gICAgcmV0dXJuICdib2x0OiAnICsgcztcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBoYXNFcnJvcnMoKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIGVycm9yQ291bnQgPiAwO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZXJyb3JTdW1tYXJ5KCk6IHN0cmluZyB7XHJcbiAgaWYgKGVycm9yQ291bnQgPT09IDEpIHtcclxuICAgIHJldHVybiA8c3RyaW5nPiBsYXN0RXJyb3I7XHJcbiAgfVxyXG5cclxuICBpZiAoZXJyb3JDb3VudCAhPT0gMCkge1xyXG4gICAgcmV0dXJuIFwiRmF0YWwgZXJyb3JzOiBcIiArIGVycm9yQ291bnQ7XHJcbiAgfVxyXG4gIHJldHVybiBcIlwiO1xyXG59XHJcbiJdfQ==
