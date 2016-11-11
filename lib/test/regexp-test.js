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
var simulator_1 = require('../simulator');
var secrets = require('../../auth-secrets');
simulator_1.rulesSuite("RegExp", function (test) {
    test.database(secrets.APP, secrets.SECRET);
    test.rules('samples/regexp');
    test("SocialSecurity", function (rules) {
        rules
            .at('/ss')
            .write('000-00-0000')
            .succeeds("All zeros.")
            .write('123-45-6789')
            .succeeds("All numbers.")
            .write('000-0a-0000')
            .fails("Contains letter.")
            .write('000-00-00000')
            .fails("Too long.")
            .write('000-0-000')
            .fails("Too short.")
            .write('00000000')
            .fails("Missing dashes.");
    });
    test("IntegerString", function (rules) {
        rules
            .at('/integer')
            .write('0')
            .succeeds("Zero.")
            .write('123')
            .succeeds("Example.")
            .write('-123')
            .succeeds("Negative Example.")
            .write('--123')
            .fails("Double negative.")
            .write('')
            .fails("Empty string.")
            .write('a')
            .fails("Alphabetic.")
            .write(' 0')
            .fails("Has spaces.")
            .write('0.0')
            .fails("Has decimal.");
    });
    test("FloatString", function (rules) {
        rules
            .at('/float')
            .write('0.0')
            .succeeds("Zero.")
            .write('123.456')
            .succeeds("Fixed point number.")
            .write('-123.456')
            .succeeds("Negative ixed point number.")
            .write('.1')
            .succeeds("No leading digits.")
            .write('1.')
            .succeeds("No trailing digits.")
            .write('-.1')
            .succeeds("Negative fraction only.")
            .write('.')
            .fails("Just decimal point.")
            .write('0')
            .succeeds("Zero.")
            .write('')
            .fails("Empty string.")
            .write('a')
            .fails("Alphabetic.")
            .write(' 0')
            .fails("Has spaces.");
    });
    test("Integer", function (rules) {
        rules
            .at('/int')
            .write(0)
            .succeeds("Zero.")
            .write(0.0)
            .succeeds("Floating Zero.")
            .write(123)
            .succeeds("Example.")
            .write(-123)
            .succeeds("Negative example.")
            .write(1.1)
            .fails("No fractional part allowed.")
            .write('0')
            .fails("String.");
    });
    test("Alpha", function (rules) {
        rules
            .at('/alpha')
            .write('a')
            .succeeds("Alpha")
            .write('A')
            .succeeds("Alpha")
            .write("hello")
            .succeeds("Word.")
            .write("123")
            .fails("Numeric.")
            .write(1)
            .fails("Number.")
            .write(true)
            .fails("Boolean.")
            .write("hello, world")
            .fails("Non-alpha.");
    });
    test("Year", function (rules) {
        rules
            .at('/year')
            .write('2015')
            .succeeds("This year.")
            .write('1900')
            .succeeds("Earliest year.")
            .write('1999')
            .succeeds("Latest in 20th century.")
            .write('2099')
            .succeeds("Latest in 21th century.")
            .write('2015 ')
            .fails("Extra space.")
            .write('2100')
            .fails("Distant future.")
            .write(1960)
            .fails("Number.")
            .write('')
            .fails("Empty string.");
    });
    test("ISODate", function (rules) {
        rules
            .at('/date')
            .write('2015-11-20')
            .succeeds("Today.")
            .write('1900-01-01')
            .succeeds("Earliest date.")
            .write('2099-12-31')
            .succeeds("Latest date.")
            .write('1899-12-31')
            .fails("Too early date.")
            .write('2100-01-01')
            .fails("Too late date.")
            .write('')
            .fails("Empty string.");
    });
    test("Slug", function (rules) {
        rules
            .at('/slug')
            .write('this-is-a-slug')
            .succeeds("Typical slug text.")
            .write('numbers-2016-ok')
            .succeeds("Number are ok.")
            .write('double--hyphen')
            .fails("Double hyphen not ok.")
            .write('-leading-hyphen')
            .fails("Leading hyphen not ok.")
            .write('trailing-hyphen-')
            .fails("Trailing hyphen not ok.")
            .write('nohyphen')
            .fails("Must have at least one hyphen.")
            .write('no-Upper')
            .fails("No upper case.")
            .write('no-special&-char')
            .fails("No special characters.")
            .write('no spaces')
            .fails("No spaces allowed.");
    });
    test("Domain", function (rules) {
        rules
            .at('/domain')
            .write('google.com')
            .succeeds("Simple domain.")
            .write('google-com')
            .fails("Not a domain.");
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QztBQUNMLENBQUMsQ0FBQyxDQUFDIiwiZmlsZSI6InRlc3QvcmVnZXhwLXRlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbmltcG9ydCB7cnVsZXNTdWl0ZX0gZnJvbSAnLi4vc2ltdWxhdG9yJztcclxubGV0IHNlY3JldHMgPSByZXF1aXJlKCcuLi8uLi9hdXRoLXNlY3JldHMnKTtcclxuXHJcbnJ1bGVzU3VpdGUoXCJSZWdFeHBcIiwgZnVuY3Rpb24odGVzdCkge1xyXG4gIHRlc3QuZGF0YWJhc2Uoc2VjcmV0cy5BUFAsIHNlY3JldHMuU0VDUkVUKTtcclxuICB0ZXN0LnJ1bGVzKCdzYW1wbGVzL3JlZ2V4cCcpO1xyXG5cclxuICB0ZXN0KFwiU29jaWFsU2VjdXJpdHlcIiwgKHJ1bGVzKSA9PiB7XHJcbiAgICBydWxlc1xyXG4gICAgICAuYXQoJy9zcycpXHJcbiAgICAgIC53cml0ZSgnMDAwLTAwLTAwMDAnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJBbGwgemVyb3MuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzEyMy00NS02Nzg5JylcclxuICAgICAgLnN1Y2NlZWRzKFwiQWxsIG51bWJlcnMuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzAwMC0wYS0wMDAwJylcclxuICAgICAgLmZhaWxzKFwiQ29udGFpbnMgbGV0dGVyLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcwMDAtMDAtMDAwMDAnKVxyXG4gICAgICAuZmFpbHMoXCJUb28gbG9uZy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMDAwLTAtMDAwJylcclxuICAgICAgLmZhaWxzKFwiVG9vIHNob3J0LlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcwMDAwMDAwMCcpXHJcbiAgICAgIC5mYWlscyhcIk1pc3NpbmcgZGFzaGVzLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiSW50ZWdlclN0cmluZ1wiLCAocnVsZXMpID0+IHtcclxuICAgIHJ1bGVzXHJcbiAgICAgIC5hdCgnL2ludGVnZXInKVxyXG4gICAgICAud3JpdGUoJzAnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJaZXJvLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcxMjMnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJFeGFtcGxlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCctMTIzJylcclxuICAgICAgLnN1Y2NlZWRzKFwiTmVnYXRpdmUgRXhhbXBsZS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnLS0xMjMnKVxyXG4gICAgICAuZmFpbHMoXCJEb3VibGUgbmVnYXRpdmUuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJycpXHJcbiAgICAgIC5mYWlscyhcIkVtcHR5IHN0cmluZy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnYScpXHJcbiAgICAgIC5mYWlscyhcIkFscGhhYmV0aWMuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJyAwJylcclxuICAgICAgLmZhaWxzKFwiSGFzIHNwYWNlcy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMC4wJylcclxuICAgICAgLmZhaWxzKFwiSGFzIGRlY2ltYWwuXCIpXHJcbiAgICA7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJGbG9hdFN0cmluZ1wiLCAocnVsZXMpID0+IHtcclxuICAgIHJ1bGVzXHJcbiAgICAgIC5hdCgnL2Zsb2F0JylcclxuICAgICAgLndyaXRlKCcwLjAnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJaZXJvLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcxMjMuNDU2JylcclxuICAgICAgLnN1Y2NlZWRzKFwiRml4ZWQgcG9pbnQgbnVtYmVyLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCctMTIzLjQ1NicpXHJcbiAgICAgIC5zdWNjZWVkcyhcIk5lZ2F0aXZlIGl4ZWQgcG9pbnQgbnVtYmVyLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcuMScpXHJcbiAgICAgIC5zdWNjZWVkcyhcIk5vIGxlYWRpbmcgZGlnaXRzLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcxLicpXHJcbiAgICAgIC5zdWNjZWVkcyhcIk5vIHRyYWlsaW5nIGRpZ2l0cy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnLS4xJylcclxuICAgICAgLnN1Y2NlZWRzKFwiTmVnYXRpdmUgZnJhY3Rpb24gb25seS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnLicpXHJcbiAgICAgIC5mYWlscyhcIkp1c3QgZGVjaW1hbCBwb2ludC5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMCcpXHJcbiAgICAgIC5zdWNjZWVkcyhcIlplcm8uXCIpXHJcblxyXG4gICAgICAud3JpdGUoJycpXHJcbiAgICAgIC5mYWlscyhcIkVtcHR5IHN0cmluZy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnYScpXHJcbiAgICAgIC5mYWlscyhcIkFscGhhYmV0aWMuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJyAwJylcclxuICAgICAgLmZhaWxzKFwiSGFzIHNwYWNlcy5cIilcclxuICAgIDtcclxuICB9KTtcclxuXHJcbiAgdGVzdChcIkludGVnZXJcIiwgKHJ1bGVzKSA9PiB7XHJcbiAgICBydWxlc1xyXG4gICAgICAuYXQoJy9pbnQnKVxyXG4gICAgICAud3JpdGUoMClcclxuICAgICAgLnN1Y2NlZWRzKFwiWmVyby5cIilcclxuXHJcbiAgICAgIC53cml0ZSgwLjApXHJcbiAgICAgIC5zdWNjZWVkcyhcIkZsb2F0aW5nIFplcm8uXCIpXHJcblxyXG4gICAgICAud3JpdGUoMTIzKVxyXG4gICAgICAuc3VjY2VlZHMoXCJFeGFtcGxlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKC0xMjMpXHJcbiAgICAgIC5zdWNjZWVkcyhcIk5lZ2F0aXZlIGV4YW1wbGUuXCIpXHJcblxyXG4gICAgICAud3JpdGUoMS4xKVxyXG4gICAgICAuZmFpbHMoXCJObyBmcmFjdGlvbmFsIHBhcnQgYWxsb3dlZC5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMCcpXHJcbiAgICAgIC5mYWlscyhcIlN0cmluZy5cIilcclxuICAgIDtcclxuICB9KTtcclxuXHJcbiAgdGVzdChcIkFscGhhXCIsIChydWxlcykgPT4ge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmF0KCcvYWxwaGEnKVxyXG4gICAgICAud3JpdGUoJ2EnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJBbHBoYVwiKVxyXG5cclxuICAgICAgLndyaXRlKCdBJylcclxuICAgICAgLnN1Y2NlZWRzKFwiQWxwaGFcIilcclxuXHJcbiAgICAgIC53cml0ZShcImhlbGxvXCIpXHJcbiAgICAgIC5zdWNjZWVkcyhcIldvcmQuXCIpXHJcblxyXG4gICAgICAud3JpdGUoXCIxMjNcIilcclxuICAgICAgLmZhaWxzKFwiTnVtZXJpYy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgxKVxyXG4gICAgICAuZmFpbHMoXCJOdW1iZXIuXCIpXHJcblxyXG4gICAgICAud3JpdGUodHJ1ZSlcclxuICAgICAgLmZhaWxzKFwiQm9vbGVhbi5cIilcclxuXHJcbiAgICAgIC53cml0ZShcImhlbGxvLCB3b3JsZFwiKVxyXG4gICAgICAuZmFpbHMoXCJOb24tYWxwaGEuXCIpXHJcbiAgICA7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJZZWFyXCIsIChydWxlcykgPT4ge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmF0KCcveWVhcicpXHJcbiAgICAgIC53cml0ZSgnMjAxNScpXHJcbiAgICAgIC5zdWNjZWVkcyhcIlRoaXMgeWVhci5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMTkwMCcpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkVhcmxpZXN0IHllYXIuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzE5OTknKVxyXG4gICAgICAuc3VjY2VlZHMoXCJMYXRlc3QgaW4gMjB0aCBjZW50dXJ5LlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcyMDk5JylcclxuICAgICAgLnN1Y2NlZWRzKFwiTGF0ZXN0IGluIDIxdGggY2VudHVyeS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMjAxNSAnKVxyXG4gICAgICAuZmFpbHMoXCJFeHRyYSBzcGFjZS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMjEwMCcpXHJcbiAgICAgIC5mYWlscyhcIkRpc3RhbnQgZnV0dXJlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKDE5NjApXHJcbiAgICAgIC5mYWlscyhcIk51bWJlci5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnJylcclxuICAgICAgLmZhaWxzKFwiRW1wdHkgc3RyaW5nLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiSVNPRGF0ZVwiLCAocnVsZXMpID0+IHtcclxuICAgIHJ1bGVzXHJcbiAgICAgIC5hdCgnL2RhdGUnKVxyXG4gICAgICAud3JpdGUoJzIwMTUtMTEtMjAnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJUb2RheS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMTkwMC0wMS0wMScpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkVhcmxpZXN0IGRhdGUuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJzIwOTktMTItMzEnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJMYXRlc3QgZGF0ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnMTg5OS0xMi0zMScpXHJcbiAgICAgIC5mYWlscyhcIlRvbyBlYXJseSBkYXRlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCcyMTAwLTAxLTAxJylcclxuICAgICAgLmZhaWxzKFwiVG9vIGxhdGUgZGF0ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnJylcclxuICAgICAgLmZhaWxzKFwiRW1wdHkgc3RyaW5nLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiU2x1Z1wiLCAocnVsZXMpID0+IHtcclxuICAgIHJ1bGVzXHJcbiAgICAgIC5hdCgnL3NsdWcnKVxyXG4gICAgICAud3JpdGUoJ3RoaXMtaXMtYS1zbHVnJylcclxuICAgICAgLnN1Y2NlZWRzKFwiVHlwaWNhbCBzbHVnIHRleHQuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJ251bWJlcnMtMjAxNi1vaycpXHJcbiAgICAgIC5zdWNjZWVkcyhcIk51bWJlciBhcmUgb2suXCIpXHJcblxyXG4gICAgICAud3JpdGUoJ2RvdWJsZS0taHlwaGVuJylcclxuICAgICAgLmZhaWxzKFwiRG91YmxlIGh5cGhlbiBub3Qgb2suXCIpXHJcblxyXG4gICAgICAud3JpdGUoJy1sZWFkaW5nLWh5cGhlbicpXHJcbiAgICAgIC5mYWlscyhcIkxlYWRpbmcgaHlwaGVuIG5vdCBvay5cIilcclxuXHJcbiAgICAgIC53cml0ZSgndHJhaWxpbmctaHlwaGVuLScpXHJcbiAgICAgIC5mYWlscyhcIlRyYWlsaW5nIGh5cGhlbiBub3Qgb2suXCIpXHJcblxyXG4gICAgICAud3JpdGUoJ25vaHlwaGVuJylcclxuICAgICAgLmZhaWxzKFwiTXVzdCBoYXZlIGF0IGxlYXN0IG9uZSBoeXBoZW4uXCIpXHJcblxyXG4gICAgICAud3JpdGUoJ25vLVVwcGVyJylcclxuICAgICAgLmZhaWxzKFwiTm8gdXBwZXIgY2FzZS5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnbm8tc3BlY2lhbCYtY2hhcicpXHJcbiAgICAgIC5mYWlscyhcIk5vIHNwZWNpYWwgY2hhcmFjdGVycy5cIilcclxuXHJcbiAgICAgIC53cml0ZSgnbm8gc3BhY2VzJylcclxuICAgICAgLmZhaWxzKFwiTm8gc3BhY2VzIGFsbG93ZWQuXCIpXHJcbiAgICA7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJEb21haW5cIiwgKHJ1bGVzKSA9PiB7XHJcbiAgICBydWxlc1xyXG4gICAgICAuYXQoJy9kb21haW4nKVxyXG4gICAgICAud3JpdGUoJ2dvb2dsZS5jb20nKVxyXG4gICAgICAuc3VjY2VlZHMoXCJTaW1wbGUgZG9tYWluLlwiKVxyXG5cclxuICAgICAgLndyaXRlKCdnb29nbGUtY29tJylcclxuICAgICAgLmZhaWxzKFwiTm90IGEgZG9tYWluLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG59KTtcclxuIl19
