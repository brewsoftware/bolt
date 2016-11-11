"use strict";
/*
 * Firebase helper functions for REST API (using Promises).
 *
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
var https = require('https');
var util = require('./util');
var querystring = require('querystring');
var uuid = require('node-uuid');
var FirebaseTokenGenerator = require('firebase-token-generator');
var FIREBASE_HOST = 'firebaseio.com';
var DEBUG_HEADER = 'x-firebase-auth-debug';
exports.RULES_LOCATION = '/.settings/rules';
exports.TIMESTAMP = { ".sv": "timestamp" };
var Client = (function () {
    function Client(appName, authToken, uid) {
        this.appName = appName;
        this.authToken = authToken;
        this.uid = uid;
        this.debug = false;
    }
    Client.prototype.setDebug = function (debug) {
        if (debug === void 0) { debug = true; }
        this.debug = debug;
        return this;
    };
    Client.prototype.get = function (location) {
        return this.request({ method: 'GET' }, location);
    };
    Client.prototype.put = function (location, content) {
        return this.request({ method: 'PUT', print: 'silent' }, location, content);
    };
    Client.prototype.request = function (opt, path, content) {
        var options = {
            hostname: this.appName + '.' + FIREBASE_HOST,
            path: path + '.json',
            method: opt.method
        };
        var query = {};
        if (opt.print) {
            query.print = opt.print;
        }
        if (this.authToken) {
            query.auth = this.authToken;
        }
        if (Object.keys(query).length > 0) {
            options.path += '?' + querystring.stringify(query);
        }
        content = util.prettyJSON(content);
        return request(options, content, this.debug)
            .then(function (body) {
            return body === '' ? null : JSON.parse(body);
        });
    };
    return Client;
}());
exports.Client = Client;
var ridNext = 0;
function request(options, content, debug) {
    ridNext += 1;
    var rid = ridNext;
    function log(s) {
        if (debug) {
            console.error("Request<" + rid + ">: " + s);
        }
    }
    log("Request: " + util.prettyJSON(options));
    if (content) {
        log("Body: '" + content + "'");
    }
    return new Promise(function (resolve, reject) {
        // TODO: Why isn't this argument typed as per https.request?
        var req = https.request(options, function (res) {
            var chunks = [];
            res.on('data', function (body) {
                chunks.push(body);
            });
            res.on('end', function () {
                var result = chunks.join('');
                log("Result (" + res.statusCode + "): '" + result + "'");
                var message = "Status = " + res.statusCode + " " + result;
                // Dump debug information if present for both successful and failed requests.
                if (res.headers[DEBUG_HEADER]) {
                    var formattedHeader = res.headers[DEBUG_HEADER].split(' /').join('\n  /');
                    log(formattedHeader);
                    message += "\n" + formattedHeader;
                }
                if (Math.floor(res.statusCode / 100) !== 2) {
                    reject(new Error(message));
                }
                else {
                    resolve(result);
                }
            });
        });
        if (content) {
            req.write(content, 'utf8');
        }
        req.end();
        req.on('error', function (error) {
            log("Request error: " + error);
            reject(error);
        });
    });
}
// opts { debug: Boolean, admin: Boolean }
function generateUidAuthToken(secret, opts) {
    opts = util.extend({ debug: false, admin: false }, opts);
    var tokenGenerator = new FirebaseTokenGenerator(secret);
    var uid = uuid.v4();
    var token = tokenGenerator.createToken({ uid: uid }, opts);
    return { uid: uid, token: token };
}
exports.generateUidAuthToken = generateUidAuthToken;
/**
 * Fancy ID generator that creates 20-character string identifiers with the following properties:
 *
 * 1. They're based on timestamp so that they sort *after* any existing ids.
 * 2. They contain 72-bits of random data after the timestamp so that IDs won't collide with other clients' IDs.
 * 3. They sort *lexicographically* (so the timestamp is converted to characters that will sort properly).
 * 4. They're monotonically increasing.  Even if you generate more than one in the same timestamp, the
 *    latter ones will sort after the former ones.  We do this by using the previous random bits
 *    but "incrementing" them by 1 (only in the case of a timestamp collision).
 */
// Modeled after base64 web-safe chars, but ordered by ASCII.
var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
// Timestamp of last push, used to prevent local collisions if you push twice in one ms.
var lastPushTime = 0;
// We generate 72-bits of randomness which get turned into 12 characters and appended to the
// timestamp to prevent collisions with other clients.  We store the last characters we
// generated because in the event of a collision, we'll use those same characters except
// "incremented" by one.
var lastRandChars = [];
function generatePushID() {
    var now = new Date().getTime();
    var duplicateTime = (now === lastPushTime);
    lastPushTime = now;
    var timeStampChars = new Array(8);
    for (var i = 7; i >= 0; i--) {
        timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
        // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
        now = Math.floor(now / 64);
    }
    if (now !== 0) {
        throw new Error('We should have converted the entire timestamp.');
    }
    var id = timeStampChars.join('');
    if (!duplicateTime) {
        for (i = 0; i < 12; i++) {
            lastRandChars[i] = Math.floor(Math.random() * 64);
        }
    }
    else {
        // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
        for (i = 11; i >= 0 && lastRandChars[i] === 63; i--) {
            lastRandChars[i] = 0;
        }
        lastRandChars[i]++;
    }
    for (i = 0; i < 12; i++) {
        id += PUSH_CHARS.charAt(lastRandChars[i]);
    }
    if (id.length !== 20) {
        throw new Error('Length should be 20.');
    }
    return id;
}
exports.generatePushID = generatePushID;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3hCLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDckIsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxNQUFNLENBQUMsRUFBRSxDQUFDO0FBQ1osQ0FBQztBQXBDZSxzQkFBYyxpQkFvQzdCLENBQUEiLCJmaWxlIjoiZmlyZWJhc2UtcmVzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qXHJcbiAqIEZpcmViYXNlIGhlbHBlciBmdW5jdGlvbnMgZm9yIFJFU1QgQVBJICh1c2luZyBQcm9taXNlcykuXHJcbiAqXHJcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXHJcbiAqXHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XHJcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cclxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XHJcbiAqXHJcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuICpcclxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxyXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXHJcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxyXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4gKi9cclxuaW1wb3J0IGh0dHBzID0gcmVxdWlyZSgnaHR0cHMnKTtcclxuaW1wb3J0IGh0dHAgPSByZXF1aXJlKCdodHRwJyk7XHJcbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnLi91dGlsJztcclxuaW1wb3J0IHF1ZXJ5c3RyaW5nID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKTtcclxubGV0IHV1aWQgPSByZXF1aXJlKCdub2RlLXV1aWQnKTtcclxudmFyIEZpcmViYXNlVG9rZW5HZW5lcmF0b3IgPSByZXF1aXJlKCdmaXJlYmFzZS10b2tlbi1nZW5lcmF0b3InKTtcclxuXHJcbnZhciBGSVJFQkFTRV9IT1NUID0gJ2ZpcmViYXNlaW8uY29tJztcclxudmFyIERFQlVHX0hFQURFUiA9ICd4LWZpcmViYXNlLWF1dGgtZGVidWcnO1xyXG5cclxuZXhwb3J0IHZhciBSVUxFU19MT0NBVElPTiA9ICAnLy5zZXR0aW5ncy9ydWxlcyc7XHJcbmV4cG9ydCB2YXIgVElNRVNUQU1QID0ge1wiLnN2XCI6IFwidGltZXN0YW1wXCJ9O1xyXG5cclxudHlwZSBSZXF1ZXN0T3B0aW9ucyA9IHtcclxuICBtZXRob2Q6IHN0cmluZyxcclxuICBwcmludD86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIENsaWVudCB7XHJcbiAgcHJpdmF0ZSBkZWJ1ZyA9IGZhbHNlO1xyXG5cclxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGFwcE5hbWU6IHN0cmluZyxcclxuICAgICAgICAgICAgICBwcml2YXRlIGF1dGhUb2tlbj86IHN0cmluZyxcclxuICAgICAgICAgICAgICBwdWJsaWMgdWlkPzogc3RyaW5nKSB7fVxyXG5cclxuICBzZXREZWJ1ZyhkZWJ1ZyA9IHRydWUpIHtcclxuICAgIHRoaXMuZGVidWcgPSBkZWJ1ZztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgZ2V0KGxvY2F0aW9uOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh7bWV0aG9kOiAnR0VUJ30sIGxvY2F0aW9uKTtcclxuICB9XHJcblxyXG4gIHB1dChsb2NhdGlvbjogc3RyaW5nLCBjb250ZW50OiBhbnkpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh7bWV0aG9kOiAnUFVUJywgcHJpbnQ6ICdzaWxlbnQnfSwgbG9jYXRpb24sIGNvbnRlbnQpO1xyXG4gIH1cclxuXHJcbiAgcmVxdWVzdChvcHQ6IFJlcXVlc3RPcHRpb25zLCBwYXRoOiBzdHJpbmcsIGNvbnRlbnQ/OiBhbnkpIHtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICBob3N0bmFtZTogdGhpcy5hcHBOYW1lICsgJy4nICsgRklSRUJBU0VfSE9TVCxcclxuICAgICAgcGF0aDogcGF0aCArICcuanNvbicsXHJcbiAgICAgIG1ldGhvZDogb3B0Lm1ldGhvZCxcclxuICAgIH07XHJcblxyXG4gICAgdmFyIHF1ZXJ5OiBhbnkgPSB7fTtcclxuICAgIGlmIChvcHQucHJpbnQpIHtcclxuICAgICAgcXVlcnkucHJpbnQgPSBvcHQucHJpbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuYXV0aFRva2VuKSB7XHJcbiAgICAgIHF1ZXJ5LmF1dGggPSB0aGlzLmF1dGhUb2tlbjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoT2JqZWN0LmtleXMocXVlcnkpLmxlbmd0aCA+IDApIHtcclxuICAgICAgb3B0aW9ucy5wYXRoICs9ICc/JyArIHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShxdWVyeSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29udGVudCA9IHV0aWwucHJldHR5SlNPTihjb250ZW50KTtcclxuXHJcbiAgICByZXR1cm4gcmVxdWVzdChvcHRpb25zLCBjb250ZW50LCB0aGlzLmRlYnVnKVxyXG4gICAgICAudGhlbihmdW5jdGlvbihib2R5OiBzdHJpbmcpIHtcclxuICAgICAgICByZXR1cm4gYm9keSA9PT0gJycgPyBudWxsIDogSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG52YXIgcmlkTmV4dCA9IDA7XHJcblxyXG5mdW5jdGlvbiByZXF1ZXN0KG9wdGlvbnM6IGFueSwgY29udGVudDogYW55LCBkZWJ1ZzogYm9vbGVhbik6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgcmlkTmV4dCArPSAxO1xyXG4gIHZhciByaWQgPSByaWROZXh0O1xyXG5cclxuICBmdW5jdGlvbiBsb2coczogc3RyaW5nKTogdm9pZCB7XHJcbiAgICBpZiAoZGVidWcpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihcIlJlcXVlc3Q8XCIgKyByaWQgKyBcIj46IFwiICsgcyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBsb2coXCJSZXF1ZXN0OiBcIiArIHV0aWwucHJldHR5SlNPTihvcHRpb25zKSk7XHJcbiAgaWYgKGNvbnRlbnQpIHtcclxuICAgIGxvZyhcIkJvZHk6ICdcIiArIGNvbnRlbnQgKyBcIidcIik7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAvLyBUT0RPOiBXaHkgaXNuJ3QgdGhpcyBhcmd1bWVudCB0eXBlZCBhcyBwZXIgaHR0cHMucmVxdWVzdD9cclxuICAgIHZhciByZXEgPSBodHRwcy5yZXF1ZXN0KG9wdGlvbnMsIGZ1bmN0aW9uKHJlczogaHR0cC5DbGllbnRSZXNwb25zZSkge1xyXG4gICAgICB2YXIgY2h1bmtzID0gPHN0cmluZ1tdPltdO1xyXG5cclxuICAgICAgcmVzLm9uKCdkYXRhJywgZnVuY3Rpb24oYm9keTogc3RyaW5nKSB7XHJcbiAgICAgICAgY2h1bmtzLnB1c2goYm9keSk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgcmVzLm9uKCdlbmQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgcmVzdWx0OiBzdHJpbmcgPSBjaHVua3Muam9pbignJyk7XHJcbiAgICAgICAgbG9nKFwiUmVzdWx0IChcIiArIHJlcy5zdGF0dXNDb2RlICsgXCIpOiAnXCIgKyByZXN1bHQgKyBcIidcIik7XHJcbiAgICAgICAgbGV0IG1lc3NhZ2UgPSBcIlN0YXR1cyA9IFwiICsgcmVzLnN0YXR1c0NvZGUgKyBcIiBcIiArIHJlc3VsdDtcclxuXHJcbiAgICAgICAgLy8gRHVtcCBkZWJ1ZyBpbmZvcm1hdGlvbiBpZiBwcmVzZW50IGZvciBib3RoIHN1Y2Nlc3NmdWwgYW5kIGZhaWxlZCByZXF1ZXN0cy5cclxuICAgICAgICBpZiAocmVzLmhlYWRlcnNbREVCVUdfSEVBREVSXSkge1xyXG4gICAgICAgICAgbGV0IGZvcm1hdHRlZEhlYWRlciA9IHJlcy5oZWFkZXJzW0RFQlVHX0hFQURFUl0uc3BsaXQoJyAvJykuam9pbignXFxuICAvJyk7XHJcbiAgICAgICAgICBsb2coZm9ybWF0dGVkSGVhZGVyKTtcclxuICAgICAgICAgIG1lc3NhZ2UgKz0gXCJcXG5cIiArIGZvcm1hdHRlZEhlYWRlcjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChNYXRoLmZsb29yKHJlcy5zdGF0dXNDb2RlIC8gMTAwKSAhPT0gMikge1xyXG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihtZXNzYWdlKSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKGNvbnRlbnQpIHtcclxuICAgICAgcmVxLndyaXRlKGNvbnRlbnQsICd1dGY4Jyk7XHJcbiAgICB9XHJcbiAgICByZXEuZW5kKCk7XHJcblxyXG4gICAgcmVxLm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycm9yOiBFcnJvcikge1xyXG4gICAgICBsb2coXCJSZXF1ZXN0IGVycm9yOiBcIiArIGVycm9yKTtcclxuICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG59XHJcblxyXG4vLyBvcHRzIHsgZGVidWc6IEJvb2xlYW4sIGFkbWluOiBCb29sZWFuIH1cclxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlVWlkQXV0aFRva2VuKHNlY3JldDogc3RyaW5nLCBvcHRzOiBhbnkpIHtcclxuICBvcHRzID0gdXRpbC5leHRlbmQoeyBkZWJ1ZzogZmFsc2UsIGFkbWluOiBmYWxzZSB9LCBvcHRzKTtcclxuXHJcbiAgdmFyIHRva2VuR2VuZXJhdG9yID0gbmV3IEZpcmViYXNlVG9rZW5HZW5lcmF0b3Ioc2VjcmV0KTtcclxuICB2YXIgdWlkID0gdXVpZC52NCgpO1xyXG4gIHZhciB0b2tlbiA9IHRva2VuR2VuZXJhdG9yLmNyZWF0ZVRva2VuKHsgdWlkOiB1aWQgfSwgb3B0cyk7XHJcbiAgcmV0dXJuIHsgdWlkOiB1aWQsIHRva2VuOiB0b2tlbiB9O1xyXG59XHJcblxyXG4vKipcclxuICogRmFuY3kgSUQgZ2VuZXJhdG9yIHRoYXQgY3JlYXRlcyAyMC1jaGFyYWN0ZXIgc3RyaW5nIGlkZW50aWZpZXJzIHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxyXG4gKlxyXG4gKiAxLiBUaGV5J3JlIGJhc2VkIG9uIHRpbWVzdGFtcCBzbyB0aGF0IHRoZXkgc29ydCAqYWZ0ZXIqIGFueSBleGlzdGluZyBpZHMuXHJcbiAqIDIuIFRoZXkgY29udGFpbiA3Mi1iaXRzIG9mIHJhbmRvbSBkYXRhIGFmdGVyIHRoZSB0aW1lc3RhbXAgc28gdGhhdCBJRHMgd29uJ3QgY29sbGlkZSB3aXRoIG90aGVyIGNsaWVudHMnIElEcy5cclxuICogMy4gVGhleSBzb3J0ICpsZXhpY29ncmFwaGljYWxseSogKHNvIHRoZSB0aW1lc3RhbXAgaXMgY29udmVydGVkIHRvIGNoYXJhY3RlcnMgdGhhdCB3aWxsIHNvcnQgcHJvcGVybHkpLlxyXG4gKiA0LiBUaGV5J3JlIG1vbm90b25pY2FsbHkgaW5jcmVhc2luZy4gIEV2ZW4gaWYgeW91IGdlbmVyYXRlIG1vcmUgdGhhbiBvbmUgaW4gdGhlIHNhbWUgdGltZXN0YW1wLCB0aGVcclxuICogICAgbGF0dGVyIG9uZXMgd2lsbCBzb3J0IGFmdGVyIHRoZSBmb3JtZXIgb25lcy4gIFdlIGRvIHRoaXMgYnkgdXNpbmcgdGhlIHByZXZpb3VzIHJhbmRvbSBiaXRzXHJcbiAqICAgIGJ1dCBcImluY3JlbWVudGluZ1wiIHRoZW0gYnkgMSAob25seSBpbiB0aGUgY2FzZSBvZiBhIHRpbWVzdGFtcCBjb2xsaXNpb24pLlxyXG4gKi9cclxuXHJcbi8vIE1vZGVsZWQgYWZ0ZXIgYmFzZTY0IHdlYi1zYWZlIGNoYXJzLCBidXQgb3JkZXJlZCBieSBBU0NJSS5cclxudmFyIFBVU0hfQ0hBUlMgPSAnLTAxMjM0NTY3ODlBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWl9hYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eic7XHJcblxyXG4vLyBUaW1lc3RhbXAgb2YgbGFzdCBwdXNoLCB1c2VkIHRvIHByZXZlbnQgbG9jYWwgY29sbGlzaW9ucyBpZiB5b3UgcHVzaCB0d2ljZSBpbiBvbmUgbXMuXHJcbnZhciBsYXN0UHVzaFRpbWUgPSAwO1xyXG5cclxuLy8gV2UgZ2VuZXJhdGUgNzItYml0cyBvZiByYW5kb21uZXNzIHdoaWNoIGdldCB0dXJuZWQgaW50byAxMiBjaGFyYWN0ZXJzIGFuZCBhcHBlbmRlZCB0byB0aGVcclxuLy8gdGltZXN0YW1wIHRvIHByZXZlbnQgY29sbGlzaW9ucyB3aXRoIG90aGVyIGNsaWVudHMuICBXZSBzdG9yZSB0aGUgbGFzdCBjaGFyYWN0ZXJzIHdlXHJcbi8vIGdlbmVyYXRlZCBiZWNhdXNlIGluIHRoZSBldmVudCBvZiBhIGNvbGxpc2lvbiwgd2UnbGwgdXNlIHRob3NlIHNhbWUgY2hhcmFjdGVycyBleGNlcHRcclxuLy8gXCJpbmNyZW1lbnRlZFwiIGJ5IG9uZS5cclxudmFyIGxhc3RSYW5kQ2hhcnMgPSA8bnVtYmVyW10+W107XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVQdXNoSUQoKTogc3RyaW5nIHtcclxuICB2YXIgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgdmFyIGR1cGxpY2F0ZVRpbWUgPSAobm93ID09PSBsYXN0UHVzaFRpbWUpO1xyXG4gIGxhc3RQdXNoVGltZSA9IG5vdztcclxuXHJcbiAgdmFyIHRpbWVTdGFtcENoYXJzID0gbmV3IEFycmF5KDgpO1xyXG4gIGZvciAodmFyIGkgPSA3OyBpID49IDA7IGktLSkge1xyXG4gICAgdGltZVN0YW1wQ2hhcnNbaV0gPSBQVVNIX0NIQVJTLmNoYXJBdChub3cgJSA2NCk7XHJcbiAgICAvLyBOT1RFOiBDYW4ndCB1c2UgPDwgaGVyZSBiZWNhdXNlIGphdmFzY3JpcHQgd2lsbCBjb252ZXJ0IHRvIGludCBhbmQgbG9zZSB0aGUgdXBwZXIgYml0cy5cclxuICAgIG5vdyA9IE1hdGguZmxvb3Iobm93IC8gNjQpO1xyXG4gIH1cclxuICBpZiAobm93ICE9PSAwKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlIHNob3VsZCBoYXZlIGNvbnZlcnRlZCB0aGUgZW50aXJlIHRpbWVzdGFtcC4nKTtcclxuICB9XHJcblxyXG4gIHZhciBpZCA9IHRpbWVTdGFtcENoYXJzLmpvaW4oJycpO1xyXG5cclxuICBpZiAoIWR1cGxpY2F0ZVRpbWUpIHtcclxuICAgIGZvciAoaSA9IDA7IGkgPCAxMjsgaSsrKSB7XHJcbiAgICAgIGxhc3RSYW5kQ2hhcnNbaV0gPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiA2NCk7XHJcbiAgICB9XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIElmIHRoZSB0aW1lc3RhbXAgaGFzbid0IGNoYW5nZWQgc2luY2UgbGFzdCBwdXNoLCB1c2UgdGhlIHNhbWUgcmFuZG9tIG51bWJlciwgZXhjZXB0IGluY3JlbWVudGVkIGJ5IDEuXHJcbiAgICBmb3IgKGkgPSAxMTsgaSA+PSAwICYmIGxhc3RSYW5kQ2hhcnNbaV0gPT09IDYzOyBpLS0pIHtcclxuICAgICAgbGFzdFJhbmRDaGFyc1tpXSA9IDA7XHJcbiAgICB9XHJcbiAgICBsYXN0UmFuZENoYXJzW2ldKys7XHJcbiAgfVxyXG4gIGZvciAoaSA9IDA7IGkgPCAxMjsgaSsrKSB7XHJcbiAgICBpZCArPSBQVVNIX0NIQVJTLmNoYXJBdChsYXN0UmFuZENoYXJzW2ldKTtcclxuICB9XHJcbiAgaWYgKGlkLmxlbmd0aCAhPT0gMjApIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignTGVuZ3RoIHNob3VsZCBiZSAyMC4nKTtcclxuICB9XHJcblxyXG4gIHJldHVybiBpZDtcclxufVxyXG4iXX0=
