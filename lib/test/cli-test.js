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
var chai_1 = require('chai');
var helper = require('./test-helper');
var proc = require('child_process');
var fs = require('fs');
var TMP_DIR = 'tmp/';
suite("firebase-bolt CLI", function () {
    suiteSetup(function () {
        try {
            fs.mkdirSync(TMP_DIR);
        }
        catch (e) {
        }
    });
    var tests = [
        // Simple options tests.
        { data: "--help",
            expect: { out: /^$/, err: /helpful message/ } },
        { data: "--h",
            expect: { out: /^$/, err: /helpful message/ } },
        { data: "--version",
            expect: { out: /^Firebase Bolt v\d+\.\d+\.\d+\n$/, err: /^$/ } },
        { data: "--v",
            expect: { out: /^Firebase Bolt v\d+\.\d+\.\d+\n$/, err: /^$/ } },
        // Reading from stdin
        { label: "stdin -> stdout",
            data: { stdin: "path / is String;" },
            expect: { out: /newData\.isString/, err: /^$/ } },
        { label: "stdin -> file",
            data: { stdin: "path / is String;", args: "--o " + TMP_DIR + "test" },
            expect: { out: /^$/, err: new RegExp("^bolt: Generating " + TMP_DIR + "test") } },
        // Reading from a file
        { data: "samples/all_access",
            expect: { out: /^$/, err: /^bolt: Generating samples\/all_access.json\.\.\.\n$/ } },
        { data: "samples/all_access.bolt",
            expect: { out: /^$/, err: /^bolt: Generating samples\/all_access.json\.\.\.\n$/ } },
        { data: "samples/all_access --output " + TMP_DIR + "all_access",
            expect: { out: /^$/, err: new RegExp("^bolt: Generating " + TMP_DIR + "all_access.json\\.\\.\\.\\n$") } },
        { data: "samples/all_access.json",
            expect: { out: /^$/, err: /bolt: Cannot overwrite/ } },
        // Argument errors
        { data: "--output",
            expect: { out: /^$/, err: /^bolt: Missing output file name/ } },
        { data: "nosuchfile",
            expect: { out: /^$/, err: /bolt: Could not read file: nosuchfile.bolt/ } },
        { data: "two files",
            expect: { out: /^$/, err: /bolt: Can only compile a single file/ } },
    ];
    helper.dataDrivenTest(tests, function (data, expect) {
        return new Promise(function (resolve, reject) {
            var args;
            if (typeof (data) === 'string') {
                args = data;
            }
            else {
                args = data.args || '';
            }
            var child = proc.exec('bin/firebase-bolt ' + args, function (error, stdout, stderr) {
                if (expect.err) {
                    chai_1.assert.isTrue(expect.err.test(stderr), "Unexpected message: '" + stderr + "'");
                }
                if (expect.out) {
                    chai_1.assert.isTrue(expect.out.test(stdout), "Unexpected output: '" + stdout + "'");
                }
                resolve();
            });
            if (data.stdin) {
                child.stdin.write(data.stdin);
                child.stdin.end();
            }
        });
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LENBQUM7Z0JBQ2hGLENBQUM7Z0JBQ0QsT0FBTyxFQUFFLENBQUM7WUFDWixDQUFDLENBQUMsQ0FBQztZQUNILEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUNmLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDOUIsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNwQixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwiZmlsZSI6InRlc3QvY2xpLXRlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbmltcG9ydCB7YXNzZXJ0fSBmcm9tICdjaGFpJztcclxuaW1wb3J0ICogYXMgaGVscGVyIGZyb20gJy4vdGVzdC1oZWxwZXInO1xyXG5pbXBvcnQgKiBhcyBwcm9jIGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xyXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XHJcblxyXG52YXIgVE1QX0RJUiA9ICd0bXAvJztcclxuXHJcbnN1aXRlKFwiZmlyZWJhc2UtYm9sdCBDTElcIiwgZnVuY3Rpb24oKSB7XHJcbiAgc3VpdGVTZXR1cCgoKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBmcy5ta2RpclN5bmMoVE1QX0RJUik7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIC8vIGRvIG5vdGhpbmdcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgdmFyIHRlc3RzID0gW1xyXG4gICAgLy8gU2ltcGxlIG9wdGlvbnMgdGVzdHMuXHJcbiAgICB7IGRhdGE6IFwiLS1oZWxwXCIsXHJcbiAgICAgIGV4cGVjdDoge291dDogL14kLywgZXJyOiAvaGVscGZ1bCBtZXNzYWdlL30gfSxcclxuICAgIHsgZGF0YTogXCItLWhcIixcclxuICAgICAgZXhwZWN0OiB7b3V0OiAvXiQvLCBlcnI6IC9oZWxwZnVsIG1lc3NhZ2UvfSB9LFxyXG4gICAgeyBkYXRhOiBcIi0tdmVyc2lvblwiLFxyXG4gICAgICBleHBlY3Q6IHtvdXQ6IC9eRmlyZWJhc2UgQm9sdCB2XFxkK1xcLlxcZCtcXC5cXGQrXFxuJC8sIGVycjogL14kL30gfSxcclxuICAgIHsgZGF0YTogXCItLXZcIixcclxuICAgICAgZXhwZWN0OiB7b3V0OiAvXkZpcmViYXNlIEJvbHQgdlxcZCtcXC5cXGQrXFwuXFxkK1xcbiQvLCBlcnI6IC9eJC99IH0sXHJcblxyXG4gICAgLy8gUmVhZGluZyBmcm9tIHN0ZGluXHJcbiAgICB7IGxhYmVsOiBcInN0ZGluIC0+IHN0ZG91dFwiLFxyXG4gICAgICBkYXRhOiB7IHN0ZGluOiBcInBhdGggLyBpcyBTdHJpbmc7XCIgfSxcclxuICAgICAgZXhwZWN0OiB7b3V0OiAvbmV3RGF0YVxcLmlzU3RyaW5nLywgZXJyOiAvXiQvfSB9LFxyXG4gICAgeyBsYWJlbDogXCJzdGRpbiAtPiBmaWxlXCIsXHJcbiAgICAgIGRhdGE6IHsgc3RkaW46IFwicGF0aCAvIGlzIFN0cmluZztcIiwgYXJnczogXCItLW8gXCIgKyBUTVBfRElSICsgXCJ0ZXN0XCIgfSxcclxuICAgICAgZXhwZWN0OiB7b3V0OiAvXiQvLCBlcnI6IG5ldyBSZWdFeHAoXCJeYm9sdDogR2VuZXJhdGluZyBcIiArIFRNUF9ESVIgKyBcInRlc3RcIil9IH0sXHJcblxyXG4gICAgLy8gUmVhZGluZyBmcm9tIGEgZmlsZVxyXG4gICAgeyBkYXRhOiBcInNhbXBsZXMvYWxsX2FjY2Vzc1wiLFxyXG4gICAgICBleHBlY3Q6IHtvdXQ6IC9eJC8sIGVycjogL15ib2x0OiBHZW5lcmF0aW5nIHNhbXBsZXNcXC9hbGxfYWNjZXNzLmpzb25cXC5cXC5cXC5cXG4kL30gfSxcclxuICAgIHsgZGF0YTogXCJzYW1wbGVzL2FsbF9hY2Nlc3MuYm9sdFwiLFxyXG4gICAgICBleHBlY3Q6IHtvdXQ6IC9eJC8sIGVycjogL15ib2x0OiBHZW5lcmF0aW5nIHNhbXBsZXNcXC9hbGxfYWNjZXNzLmpzb25cXC5cXC5cXC5cXG4kL30gfSxcclxuICAgIHsgZGF0YTogXCJzYW1wbGVzL2FsbF9hY2Nlc3MgLS1vdXRwdXQgXCIgKyBUTVBfRElSICsgXCJhbGxfYWNjZXNzXCIsXHJcbiAgICAgIGV4cGVjdDoge291dDogL14kLywgZXJyOiBuZXcgUmVnRXhwKFwiXmJvbHQ6IEdlbmVyYXRpbmcgXCIgKyBUTVBfRElSICsgXCJhbGxfYWNjZXNzLmpzb25cXFxcLlxcXFwuXFxcXC5cXFxcbiRcIil9IH0sXHJcbiAgICB7IGRhdGE6IFwic2FtcGxlcy9hbGxfYWNjZXNzLmpzb25cIixcclxuICAgICAgZXhwZWN0OiB7b3V0OiAvXiQvLCBlcnI6IC9ib2x0OiBDYW5ub3Qgb3ZlcndyaXRlL30gfSxcclxuXHJcbiAgICAvLyBBcmd1bWVudCBlcnJvcnNcclxuICAgIHsgZGF0YTogXCItLW91dHB1dFwiLFxyXG4gICAgICBleHBlY3Q6IHtvdXQ6IC9eJC8sIGVycjogL15ib2x0OiBNaXNzaW5nIG91dHB1dCBmaWxlIG5hbWUvfSB9LFxyXG4gICAgeyBkYXRhOiBcIm5vc3VjaGZpbGVcIixcclxuICAgICAgZXhwZWN0OiB7b3V0OiAvXiQvLCBlcnI6IC9ib2x0OiBDb3VsZCBub3QgcmVhZCBmaWxlOiBub3N1Y2hmaWxlLmJvbHQvfSB9LFxyXG4gICAgeyBkYXRhOiBcInR3byBmaWxlc1wiLFxyXG4gICAgICBleHBlY3Q6IHtvdXQ6IC9eJC8sIGVycjogL2JvbHQ6IENhbiBvbmx5IGNvbXBpbGUgYSBzaW5nbGUgZmlsZS99IH0sXHJcbiAgXTtcclxuXHJcbiAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgbGV0IGFyZ3M6IHN0cmluZztcclxuXHJcbiAgICAgIGlmICh0eXBlb2YoZGF0YSkgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgYXJncyA9IGRhdGE7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYXJncyA9IGRhdGEuYXJncyB8fCAnJztcclxuICAgICAgfVxyXG4gICAgICBsZXQgY2hpbGQgPSBwcm9jLmV4ZWMoJ2Jpbi9maXJlYmFzZS1ib2x0ICcgKyBhcmdzLCBmdW5jdGlvbihlcnJvciwgc3Rkb3V0LCBzdGRlcnIpIHtcclxuICAgICAgICBpZiAoZXhwZWN0LmVycikge1xyXG4gICAgICAgICAgYXNzZXJ0LmlzVHJ1ZShleHBlY3QuZXJyLnRlc3Qoc3RkZXJyKSwgXCJVbmV4cGVjdGVkIG1lc3NhZ2U6ICdcIiArIHN0ZGVyciArIFwiJ1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGV4cGVjdC5vdXQpIHtcclxuICAgICAgICAgIGFzc2VydC5pc1RydWUoZXhwZWN0Lm91dC50ZXN0KHN0ZG91dCksIFwiVW5leHBlY3RlZCBvdXRwdXQ6ICdcIiArIHN0ZG91dCArIFwiJ1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICB9KTtcclxuICAgICAgaWYgKGRhdGEuc3RkaW4pIHtcclxuICAgICAgICBjaGlsZC5zdGRpbi53cml0ZShkYXRhLnN0ZGluKTtcclxuICAgICAgICBjaGlsZC5zdGRpbi5lbmQoKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn0pO1xyXG4iXX0=
