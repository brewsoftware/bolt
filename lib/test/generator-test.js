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
var bolt = require('../bolt');
var parse = bolt.parse;
var generator = require('../rules-generator');
var ast = require('../ast');
var fileio = require('../file-io');
var logger = require('../logger');
var helper = require('./test-helper');
var sample_files_1 = require('./sample-files');
var chai = require('chai');
chai.config.truncateThreshold = 1000;
var assert = chai.assert;
// TODO: Test duplicated function, and schema definitions.
// TODO: Test other parser errors - appropriate messages (exceptions).
suite("Rules Generator Tests", function () {
    suite("Basic Samples", function () {
        var tests = [
            { data: "path / {read() { true } write() { true }}",
                expect: { rules: { ".read": "true", ".write": "true" } }
            },
            { data: "path / { write() { true }}",
                expect: { rules: { ".write": "true" } }
            },
            { data: "path / { create() { true }}",
                expect: { rules: { ".write": "data.val() == null" } }
            },
            { data: "path / { update() { true }}",
                expect: { rules: { ".write": "data.val() != null && newData.val() != null" } }
            },
            { data: "path / { delete() { true }}",
                expect: { rules: { ".write": "data.val() != null && newData.val() == null" } }
            },
            { data: "path / {read() { true }}",
                expect: { rules: { ".read": "true" } }
            },
            { data: "path / { read() { false }}",
                expect: { rules: {} }
            },
            { data: "path / {index() { return ['a', 'b']; }}",
                expect: { rules: { ".indexOn": ["a", "b"] } }
            },
            { data: "path / { validate() { return this > 0; }}",
                expect: { rules: { ".validate": "newData.val() > 0" } }
            },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            assert.ok(result);
            var gen = new bolt.Generator(result);
            var json = gen.generateRules();
            assert.deepEqual(json, expect);
        });
    });
    suite("Sample files", function () {
        helper.dataDrivenTest(sample_files_1.samples, function (filename) {
            filename = 'samples/' + filename + '.' + bolt.FILE_EXTENSION;
            return fileio.readFile(filename)
                .then(function (response) {
                var result = parse(response.content);
                assert.ok(result, response.url);
                var gen = new bolt.Generator(result);
                var json = gen.generateRules();
                assert.ok('rules' in json, response.url + " has rules");
                return fileio.readJSONFile(response.url.replace('.' + bolt.FILE_EXTENSION, '.json'))
                    .then(function (response2) {
                    assert.deepEqual(json, response2);
                });
            })
                .catch(function (error) {
                assert.ok(false, error.message);
            });
        });
    });
    suite("Partial evaluation", function () {
        var tests = [
            { f: "function f(a) { return true == a; }", x: "f(a == b)", expect: "true == (a == b)" },
            { f: "function f(a) { return a == true; }", x: "f(a == b)", expect: "a == b == true" },
            { f: "function f(a) { return a + 3; }", x: "f(1 + 2)", expect: "1 + 2 + 3" },
            { f: "function f(a) { return a + 3; }", x: "f(1 * 2)", expect: "1 * 2 + 3" },
            { f: "function f(a) { return a * 3; }", x: "f(1 + 2)", expect: "(1 + 2) * 3" },
            { f: "function f(a) { return a + 1; }", x: "f(a + a)", expect: "a + a + 1" },
            { f: "function f(a) { return g(a); } function g(a) { return a == true; }",
                x: "f(123)", expect: "123 == true" },
            { f: "function f(a, b) { return g(a) == g(b); } function g(a) { return a == true; }",
                x: "f(1, 2)", expect: "1 == true == (2 == true)" },
            // Highler level function works as long as returns a constant function
            { f: "function f() { return g; } function g(a) { return a == true; }",
                x: "f()(123)", expect: "123 == true" },
            { f: "function f(a) { return a + 1; }", x: "a[f(123)]", expect: "a[123 + 1]" },
            { f: "", x: "this", expect: "newData.val() == true" },
            { f: "", x: "!this", expect: "!(newData.val() == true)" },
            { f: "", x: "this.prop", expect: "newData.child('prop').val() == true" },
            { f: "", x: "!this.prop", expect: "!(newData.child('prop').val() == true)" },
            { f: "", x: "this.foo.parent()", expect: "newData.child('foo').parent().val() == true" },
            { f: "",
                x: "this.foo || this.bar",
                expect: "newData.child('foo').val() == true || newData.child('bar').val() == true" },
            // TODO: Don't support snapshot functions beyond parent.
            // TODO: Should warn user not to use Firebase builtins!
            // { f: "", x: "this.isString()", expect: "newData.child('isString').val() == true" },
            { f: "function f(a) { return a == '123'; }", x: "f(this)", expect: "newData.val() == '123'" },
            { f: "function f(a) { return a == '123'; }",
                x: "f(this.foo)", expect: "newData.child('foo').val() == '123'" },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var symbols = parse(data.f + " path /x { write() { return " + data.x + "; }}");
            var gen = new bolt.Generator(symbols);
            // Make sure local Schema initialized.
            var json = gen.generateRules();
            assert.equal(json['rules']['x']['.write'], expect);
        });
    });
    suite("String methods", function () {
        var tests = [
            { data: "this.length",
                expect: "newData.val().length" },
            { data: "this.length < 100",
                expect: "newData.val().length < 100" },
            { data: "'abc'.length",
                expect: "'abc'.length" },
            { data: "'abc'.includes('b')",
                expect: "'abc'.contains('b')" },
            { data: "this.includes('b')",
                expect: "newData.val().contains('b')" },
            { data: "'abc'.includes(this)",
                expect: "'abc'.contains(newData.val())" },
            { data: "'abc'.startsWith(this)",
                expect: "'abc'.beginsWith(newData.val())" },
            { data: "'abc'.endsWith(this)",
                expect: "'abc'.endsWith(newData.val())" },
            { data: "'abc'.replace(this.a, this.b)",
                expect: "'abc'.replace(newData.child('a').val(), newData.child('b').val())" },
            { data: "'ABC'.toLowerCase()",
                expect: "'ABC'.toLowerCase()" },
            { data: "'abc'.toUpperCase()",
                expect: "'abc'.toUpperCase()" },
            { data: "this.toUpperCase()",
                expect: "newData.val().toUpperCase()" },
            { data: "'ababa'.test(/bab/)",
                expect: "'ababa'.matches(/bab/)" },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var symbols = parse("path /x { write() { return " + data + "; }}");
            var gen = new bolt.Generator(symbols);
            // Make sure local Schema initialized.
            var json = gen.generateRules();
            assert.equal(json['rules']['x']['.write'], expect);
        });
    });
    suite("Builtin validation functions", function () {
        var tests = [
            ['String', 'this.isString()'],
            ['Number', 'this.isNumber()'],
            ['Boolean', 'this.isBoolean()'],
            ['Object', 'this.hasChildren()'],
            ['Null', 'false'],
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var symbols = parse("path / {}");
            var gen = new bolt.Generator(symbols);
            gen.ensureValidator(ast.typeType(data));
            var terms = gen.validators[data]['.validate'];
            var result = bolt.decodeExpression(ast.andArray(terms));
            assert.deepEqual(result, expect);
        });
    });
    suite("Schema Validation", function () {
        var tests = [
            { data: "type T {}",
                expect: undefined },
            { data: "type T extends Object {}",
                expect: { '.validate': "newData.hasChildren()" } },
            { data: "type T extends String {}",
                expect: { '.validate': "newData.isString()" } },
            { data: "type T extends String { validate() { return this.length > 0; } }",
                expect: { '.validate': "newData.isString() && newData.val().length > 0" } },
            { data: "type NonEmpty extends String { validate() { return this.length > 0; } } \
            type T { prop: NonEmpty }",
                expect: { '.validate': "newData.hasChildren(['prop'])",
                    prop: {
                        '.validate': 'newData.isString() && newData.val().length > 0'
                    },
                    '$other': { '.validate': "false" }
                } },
            { data: "type T {n: Number}",
                expect: { '.validate': "newData.hasChildren(['n'])",
                    n: { '.validate': "newData.isNumber()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {s: String}",
                expect: { '.validate': "newData.hasChildren(['s'])",
                    s: { '.validate': "newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {b: Boolean}",
                expect: { '.validate': "newData.hasChildren(['b'])",
                    b: { '.validate': "newData.isBoolean()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {x: Object}",
                expect: { '.validate': "newData.hasChildren(['x'])",
                    x: { '.validate': "newData.hasChildren()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {x: Number|String}",
                expect: { '.validate': "newData.hasChildren(['x'])",
                    x: { '.validate': "newData.isNumber() || newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T { $key: Number }",
                expect: { '.validate': "newData.hasChildren()",
                    '$key': { '.validate': "newData.isNumber()" } } },
            { data: "type T { 'a b': Number }",
                expect: { '.validate': "newData.hasChildren(['a b'])",
                    'a b': { '.validate': "newData.isNumber()" },
                    '$other': { '.validate': 'false' } } },
            { data: "type T {a: Number, b: String}",
                expect: { '.validate': "newData.hasChildren(['a', 'b'])",
                    a: { '.validate': "newData.isNumber()" },
                    b: { '.validate': "newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {x: Number|Null}",
                expect: { '.validate': "newData.hasChildren()",
                    x: { '.validate': "newData.isNumber()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {n: Number, validate() {return this.n < 7;}}",
                expect: { '.validate': "newData.hasChildren(['n']) && newData.child('n').val() < 7",
                    n: { '.validate': "newData.isNumber()" },
                    '$other': { '.validate': "false" } } },
            { data: "type Bigger extends Number {validate() { return this > prior(this); }}" +
                    "type T { ts: Bigger }",
                expect: { '.validate': "newData.hasChildren(['ts'])",
                    ts: { '.validate': "newData.isNumber() && newData.val() > data.val()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {a: String, b: String, c: String}",
                expect: { '.validate': "newData.hasChildren(['a', 'b', 'c'])",
                    a: { '.validate': "newData.isString()" },
                    b: { '.validate': "newData.isString()" },
                    c: { '.validate': "newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type B { foo: Number } type T extends B { bar: String }",
                expect: { '.validate': "newData.hasChildren(['foo', 'bar'])",
                    foo: { '.validate': "newData.isNumber()" },
                    bar: { '.validate': "newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {n: Number, x: Map<String, Number>}",
                expect: { '.validate': "newData.hasChildren(['n'])",
                    n: { '.validate': "newData.isNumber()" },
                    x: { '$key1': { '.validate': "newData.isNumber()" },
                        '.validate': "newData.hasChildren()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {x: Map<String, Number>}",
                expect: { '.validate': "newData.hasChildren()",
                    x: { '$key1': { '.validate': "newData.isNumber()" },
                        '.validate': "newData.hasChildren()" },
                    '$other': { '.validate': "false" } } },
            { data: "type SmallString extends String { validate() { this.length < 32 } } " +
                    "type T {x: Map<SmallString, Number>}",
                expect: { '.validate': "newData.hasChildren()",
                    x: { '$key1': { '.validate': "$key1.length < 32 && newData.isNumber()" },
                        '.validate': "newData.hasChildren()" },
                    '$other': { '.validate': "false" } } },
            { data: "type M extends Map<String, Number>; type T { x: M }",
                expect: { '.validate': "newData.hasChildren()",
                    '$other': { '.validate': "false" },
                    'x': { '$key1': { '.validate': "newData.isNumber()" },
                        '.validate': "newData.hasChildren()" } } },
            { data: "type Pair<X, Y> { first: X, second: Y } type T extends Pair<String, Number>;",
                expect: { '.validate': "newData.hasChildren(['first', 'second'])",
                    'first': { '.validate': "newData.isString()" },
                    'second': { '.validate': "newData.isNumber()" },
                    '$other': { '.validate': "false" } } },
            { data: "type X { a: Number, validate() { this.a == key() } } type T extends X[];",
                expect: { '$key1': { '.validate': "newData.hasChildren(['a']) && newData.child('a').val() == $key1",
                        'a': { '.validate': "newData.isNumber()" },
                        '$other': { '.validate': "false" } },
                    '.validate': "newData.hasChildren()"
                } },
            { data: "type X { a: Number, validate() { this.a == key() } } type T { x: X }",
                expect: { 'x': { '.validate': "newData.hasChildren(['a']) && newData.child('a').val() == 'x'",
                        'a': { '.validate': "newData.isNumber()" },
                        '$other': { '.validate': "false" } },
                    '$other': { '.validate': "false" },
                    '.validate': "newData.hasChildren(['x'])"
                } },
            { data: "type T extends String { validate() { root == 'new' && prior(root) == 'old' } }" +
                    "path /t/x is Any { read() { root == 'old' } }",
                expect: { '.validate': "newData.isString() && newData.parent().val() == 'new' && root.val() == 'old'",
                    'x': { '.read': "root.val() == 'old'" }
                } },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var symbols = parse(data + " path /t is T;");
            var gen = new bolt.Generator(symbols);
            var rules = gen.generateRules();
            if (expect === undefined) {
                assert.deepEqual(rules, { "rules": {} });
            }
            else {
                assert.deepEqual(rules, { "rules": { t: expect } });
            }
        });
    });
    suite("extendValidator", function () {
        var tests = [
            { data: { target: {}, src: {} },
                expect: {} },
            { data: { target: {}, src: { '.x': [1] } },
                expect: { '.x': [1] } },
            { data: { target: { '.x': [1] }, src: { '.x': [2] } },
                expect: { '.x': [1, 2] } },
            { data: { target: { '.x': [1] }, src: { '.x': [2], c: { '.x': [3] } } },
                expect: { '.x': [1, 2], c: { '.x': [3] } } },
            { data: { target: { '.x': [1], c: { '.x': [2] } }, src: { c: { '.x': [3] } } },
                expect: { '.x': [1], c: { '.x': [2, 3] } } },
            { data: { target: {}, src: { a: { b: { c: { d: { '.x': [1], e: { '.x': [2] } } } } } } },
                expect: { a: { b: { c: { d: { '.x': [1], e: { '.x': [2] } } } } } } },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            generator.extendValidator(data.target, data.src);
            assert.deepEqual(data.target, expect);
        });
    });
    suite("mapValidator", function () {
        var tests = [
            { data: { '.x': 'a' }, expect: { '.x': 'a+' } },
            { data: { '.x': 'b' }, expect: {} },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            generator.mapValidator(data, function (value, prop) {
                if (value === 'b') {
                    return undefined;
                }
                return value + '+';
            });
            assert.deepEqual(data, expect);
        });
    });
    suite("Schema Generation Errors", function () {
        var tests = [
            { data: "",
                expect: /at least one path/ },
            { data: "type Simple extends String {a: String} path /x is Simple;",
                expect: /properties.*extend/ },
            { data: "path /y { index() { return 1; }}",
                expect: /index.*string/i },
            { data: "path /x { write() { return undefinedFunc(); }}",
                expect: /undefined.*function/i },
            { data: "path /x is NoSuchType {}",
                expect: /No type.*NoSuchType/ },
            { data: "path /x { unsupported() { true } }",
                warn: /unsupported method/i },
            { data: "path /x { validate() { return this.test(123); } }",
                expect: /convert value/i },
            { data: "path /x { validate() { return this.test('a/'); } }",
                expect: /convert value/i },
            { data: "path /x { validate() { return this.test('/a/'); } }",
                expect: /convert value/i },
            { data: "function f(a) { return f(a); } path / { validate() { return f(1); }}",
                expect: /recursive/i },
            { data: "type X { $n: Number, $s: String } path / is X;",
                expect: /wild property/ },
            { data: "type X { $$n: Number } path / is X;",
                expect: /property names/i },
            { data: "type X { '\x01': Number } path / is X;",
                expect: /property names/i },
            { data: "path / is Map;",
                expect: /No type.*non-generic/ },
            { data: "type Pair<X, Y> {a: X, b: Y} path / is Pair;",
                expect: /No type.*non-generic/ },
            { data: "path / is String<Number>;",
                expect: /No type.*generic/ },
            { data: "path / is Map<Object, Number>;",
                expect: /must derive from String/ },
            { data: "path / { write() { true } create() { true } }",
                expect: /write-aliasing.*create/i },
            { data: "path / { write() { true } update() { true } }",
                expect: /write-aliasing.*update/i },
            { data: "path / { write() { true } delete() { true } }",
                expect: /write-aliasing.*delete/i },
        ];
        helper.dataDrivenTest(tests, function (data, expect, t) {
            logger.reset();
            logger.silent();
            var symbols = parse(data);
            var gen = new bolt.Generator(symbols);
            var lastError;
            try {
                gen.generateRules();
            }
            catch (e) {
                if (!expect) {
                    throw e;
                }
                lastError = logger.getLastMessage() || e.message;
                assert.match(lastError, expect);
                return;
            }
            if (expect) {
                assert.fail(undefined, undefined, "No exception thrown.");
            }
            if (t.warn) {
                assert.match(logger.getLastMessage(), t.warn);
            }
        });
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvZ2VuZXJhdG9yLXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBQ0gsSUFBWSxJQUFJLFdBQU0sU0FBUyxDQUFDLENBQUE7QUFDaEMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUN2QixJQUFZLFNBQVMsV0FBTSxvQkFBb0IsQ0FBQyxDQUFBO0FBQ2hELElBQVksR0FBRyxXQUFNLFFBQVEsQ0FBQyxDQUFBO0FBQzlCLElBQVksTUFBTSxXQUFNLFlBQVksQ0FBQyxDQUFBO0FBQ3JDLElBQVksTUFBTSxXQUFNLFdBQVcsQ0FBQyxDQUFBO0FBQ3BDLElBQVksTUFBTSxXQUFNLGVBQWUsQ0FBQyxDQUFBO0FBQ3hDLDZCQUFzQixnQkFBZ0IsQ0FBQyxDQUFBO0FBRXZDLElBQVksSUFBSSxXQUFNLE1BQU0sQ0FBQyxDQUFBO0FBQzdCLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO0FBQ3JDLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7QUFFekIsMERBQTBEO0FBQzFELHNFQUFzRTtBQUV0RSxLQUFLLENBQUMsdUJBQXVCLEVBQUU7SUFDN0IsS0FBSyxDQUFDLGVBQWUsRUFBRTtRQUNyQixJQUFJLEtBQUssR0FBRztZQUNWLEVBQUUsSUFBSSxFQUFFLDJDQUEyQztnQkFDakQsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFDLEVBQUU7YUFDdkQ7WUFDRCxFQUFFLElBQUksRUFBRSw0QkFBNEI7Z0JBQ2xDLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUMsRUFBRTthQUN0QztZQUNELEVBQUUsSUFBSSxFQUFFLDZCQUE2QjtnQkFDbkMsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUMsUUFBUSxFQUFFLG9CQUFv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RUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxFQUFFO1lBQ3ZCLEVBQUUsSUFBSSxFQUFFLEVBQUMsTUFBTSxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxHQUFHLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxFQUFDO2dCQUM3QyxNQUFNLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUMsRUFBRTtZQUMxQixFQUFFLElBQUksRUFBRSxFQUFDLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBQyxFQUFDO2dCQUM3RCxNQUFNLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBQyxFQUFFO1lBQzFDLEVBQUUsSUFBSSxFQUFFLEVBQUMsTUFBTSxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBQyxFQUFFLEdBQUcsRUFBRSxFQUFDLENBQUMsRUFBRSxFQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUMsRUFBQztnQkFDbEUsTUFBTSxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFDLEVBQUMsRUFBRTtZQUMxQyxFQUFFLElBQUksRUFBRSxFQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUMs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QUM7Z0JBQ1gsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUNaLE1BQU0sQ0FBQyxDQUFDO2dCQUNWLENBQUM7Z0JBQ0QsU0FBUyxHQUFHLE1BQU0sQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUNqRCxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDaEMsTUFBTSxDQUFDO1lBQ1QsQ0FBQztZQUNELEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLHNCQUFzQixDQUFDLENBQUM7WUFDNUQsQ0FBQztZQUNELEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNYLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwiZmlsZSI6InRlc3QvZ2VuZXJhdG9yLXRlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbmltcG9ydCAqIGFzIGJvbHQgZnJvbSAnLi4vYm9sdCc7XHJcbmxldCBwYXJzZSA9IGJvbHQucGFyc2U7XHJcbmltcG9ydCAqIGFzIGdlbmVyYXRvciBmcm9tICcuLi9ydWxlcy1nZW5lcmF0b3InO1xyXG5pbXBvcnQgKiBhcyBhc3QgZnJvbSAnLi4vYXN0JztcclxuaW1wb3J0ICogYXMgZmlsZWlvIGZyb20gJy4uL2ZpbGUtaW8nO1xyXG5pbXBvcnQgKiBhcyBsb2dnZXIgZnJvbSAnLi4vbG9nZ2VyJztcclxuaW1wb3J0ICogYXMgaGVscGVyIGZyb20gJy4vdGVzdC1oZWxwZXInO1xyXG5pbXBvcnQge3NhbXBsZXN9IGZyb20gJy4vc2FtcGxlLWZpbGVzJztcclxuXHJcbmltcG9ydCAqIGFzIGNoYWkgZnJvbSAnY2hhaSc7XHJcbmNoYWkuY29uZmlnLnRydW5jYXRlVGhyZXNob2xkID0gMTAwMDtcclxubGV0IGFzc2VydCA9IGNoYWkuYXNzZXJ0O1xyXG5cclxuLy8gVE9ETzogVGVzdCBkdXBsaWNhdGVkIGZ1bmN0aW9uLCBhbmQgc2NoZW1hIGRlZmluaXRpb25zLlxyXG4vLyBUT0RPOiBUZXN0IG90aGVyIHBhcnNlciBlcnJvcnMgLSBhcHByb3ByaWF0ZSBtZXNzYWdlcyAoZXhjZXB0aW9ucykuXHJcblxyXG5zdWl0ZShcIlJ1bGVzIEdlbmVyYXRvciBUZXN0c1wiLCBmdW5jdGlvbigpIHtcclxuICBzdWl0ZShcIkJhc2ljIFNhbXBsZXNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8ge3JlYWQoKSB7IHRydWUgfSB3cml0ZSgpIHsgdHJ1ZSB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBydWxlczoge1wiLnJlYWRcIjogXCJ0cnVlXCIsIFwiLndyaXRlXCI6IFwidHJ1ZVwifSB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8geyB3cml0ZSgpIHsgdHJ1ZSB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBydWxlczoge1wiLndyaXRlXCI6IFwidHJ1ZVwifSB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8geyBjcmVhdGUoKSB7IHRydWUgfX1cIixcclxuICAgICAgICBleHBlY3Q6IHsgcnVsZXM6IHtcIi53cml0ZVwiOiBcImRhdGEudmFsKCkgPT0gbnVsbFwifSB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8geyB1cGRhdGUoKSB7IHRydWUgfX1cIixcclxuICAgICAgICBleHBlY3Q6IHsgcnVsZXM6IHtcIi53cml0ZVwiOiBcImRhdGEudmFsKCkgIT0gbnVsbCAmJiBuZXdEYXRhLnZhbCgpICE9IG51bGxcIn0gfVxyXG4gICAgICB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvIHsgZGVsZXRlKCkgeyB0cnVlIH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IHJ1bGVzOiB7XCIud3JpdGVcIjogXCJkYXRhLnZhbCgpICE9IG51bGwgJiYgbmV3RGF0YS52YWwoKSA9PSBudWxsXCJ9IH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7cmVhZCgpIHsgdHJ1ZSB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBydWxlczoge1wiLnJlYWRcIjogXCJ0cnVlXCJ9IH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7IHJlYWQoKSB7IGZhbHNlIH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IHJ1bGVzOiB7fSB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8ge2luZGV4KCkgeyByZXR1cm4gWydhJywgJ2InXTsgfX1cIixcclxuICAgICAgICBleHBlY3Q6IHsgcnVsZXM6IHtcIi5pbmRleE9uXCI6IFtcImFcIiwgXCJiXCJdfSB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8geyB2YWxpZGF0ZSgpIHsgcmV0dXJuIHRoaXMgPiAwOyB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBydWxlczogeyBcIi52YWxpZGF0ZVwiOiBcIm5ld0RhdGEudmFsKCkgPiAwXCIgfSB9XHJcbiAgICAgIH0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSBwYXJzZShkYXRhKTtcclxuICAgICAgYXNzZXJ0Lm9rKHJlc3VsdCk7XHJcbiAgICAgIHZhciBnZW4gPSBuZXcgYm9sdC5HZW5lcmF0b3IocmVzdWx0KTtcclxuICAgICAgdmFyIGpzb24gPSBnZW4uZ2VuZXJhdGVSdWxlcygpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKGpzb24sIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJTYW1wbGUgZmlsZXNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3Qoc2FtcGxlcywgZnVuY3Rpb24oZmlsZW5hbWUpIHtcclxuICAgICAgZmlsZW5hbWUgPSAnc2FtcGxlcy8nICsgZmlsZW5hbWUgKyAnLicgKyBib2x0LkZJTEVfRVhURU5TSU9OO1xyXG4gICAgICByZXR1cm4gZmlsZWlvLnJlYWRGaWxlKGZpbGVuYW1lKVxyXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICB2YXIgcmVzdWx0ID0gcGFyc2UocmVzcG9uc2UuY29udGVudCk7XHJcbiAgICAgICAgICBhc3NlcnQub2socmVzdWx0LCByZXNwb25zZS51cmwpO1xyXG4gICAgICAgICAgdmFyIGdlbiA9IG5ldyBib2x0LkdlbmVyYXRvcihyZXN1bHQpO1xyXG4gICAgICAgICAgdmFyIGpzb24gPSBnZW4uZ2VuZXJhdGVSdWxlcygpO1xyXG4gICAgICAgICAgYXNzZXJ0Lm9rKCdydWxlcycgaW4ganNvbiwgcmVzcG9uc2UudXJsICsgXCIgaGFzIHJ1bGVzXCIpO1xyXG4gICAgICAgICAgcmV0dXJuIGZpbGVpby5yZWFkSlNPTkZpbGUocmVzcG9uc2UudXJsLnJlcGxhY2UoJy4nICsgYm9sdC5GSUxFX0VYVEVOU0lPTiwgJy5qc29uJykpXHJcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlMikge1xyXG4gICAgICAgICAgICAgIGFzc2VydC5kZWVwRXF1YWwoanNvbiwgcmVzcG9uc2UyKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgICAgIGFzc2VydC5vayhmYWxzZSwgZXJyb3IubWVzc2FnZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJQYXJ0aWFsIGV2YWx1YXRpb25cIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIHRydWUgPT0gYTsgfVwiLCB4OiBcImYoYSA9PSBiKVwiLCBleHBlY3Q6IFwidHJ1ZSA9PSAoYSA9PSBiKVwiIH0sXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIGEgPT0gdHJ1ZTsgfVwiLCB4OiBcImYoYSA9PSBiKVwiLCBleHBlY3Q6IFwiYSA9PSBiID09IHRydWVcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhKSB7IHJldHVybiBhICsgMzsgfVwiLCB4OiBcImYoMSArIDIpXCIsIGV4cGVjdDogXCIxICsgMiArIDNcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhKSB7IHJldHVybiBhICsgMzsgfVwiLCB4OiBcImYoMSAqIDIpXCIsIGV4cGVjdDogXCIxICogMiArIDNcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhKSB7IHJldHVybiBhICogMzsgfVwiLCB4OiBcImYoMSArIDIpXCIsIGV4cGVjdDogXCIoMSArIDIpICogM1wiIH0sXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIGEgKyAxOyB9XCIsIHg6IFwiZihhICsgYSlcIiwgZXhwZWN0OiBcImEgKyBhICsgMVwiIH0sXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIGcoYSk7IH0gZnVuY3Rpb24gZyhhKSB7IHJldHVybiBhID09IHRydWU7IH1cIixcclxuICAgICAgICB4OiBcImYoMTIzKVwiLCBleHBlY3Q6IFwiMTIzID09IHRydWVcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhLCBiKSB7IHJldHVybiBnKGEpID09IGcoYik7IH0gZnVuY3Rpb24gZyhhKSB7IHJldHVybiBhID09IHRydWU7IH1cIixcclxuICAgICAgICB4OiBcImYoMSwgMilcIiwgZXhwZWN0OiBcIjEgPT0gdHJ1ZSA9PSAoMiA9PSB0cnVlKVwiIH0sXHJcbiAgICAgIC8vIEhpZ2hsZXIgbGV2ZWwgZnVuY3Rpb24gd29ya3MgYXMgbG9uZyBhcyByZXR1cm5zIGEgY29uc3RhbnQgZnVuY3Rpb25cclxuICAgICAgeyBmOiBcImZ1bmN0aW9uIGYoKSB7IHJldHVybiBnOyB9IGZ1bmN0aW9uIGcoYSkgeyByZXR1cm4gYSA9PSB0cnVlOyB9XCIsXHJcbiAgICAgICAgeDogXCJmKCkoMTIzKVwiLCBleHBlY3Q6IFwiMTIzID09IHRydWVcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhKSB7IHJldHVybiBhICsgMTsgfVwiLCB4OiBcImFbZigxMjMpXVwiLCBleHBlY3Q6IFwiYVsxMjMgKyAxXVwiIH0sXHJcbiAgICAgIHsgZjogXCJcIiwgeDogXCJ0aGlzXCIsIGV4cGVjdDogXCJuZXdEYXRhLnZhbCgpID09IHRydWVcIiB9LFxyXG4gICAgICB7IGY6IFwiXCIsIHg6IFwiIXRoaXNcIiwgZXhwZWN0OiBcIiEobmV3RGF0YS52YWwoKSA9PSB0cnVlKVwiIH0sXHJcbiAgICAgIHsgZjogXCJcIiwgeDogXCJ0aGlzLnByb3BcIiwgZXhwZWN0OiBcIm5ld0RhdGEuY2hpbGQoJ3Byb3AnKS52YWwoKSA9PSB0cnVlXCIgfSxcclxuICAgICAgeyBmOiBcIlwiLCB4OiBcIiF0aGlzLnByb3BcIiwgZXhwZWN0OiBcIiEobmV3RGF0YS5jaGlsZCgncHJvcCcpLnZhbCgpID09IHRydWUpXCIgfSxcclxuICAgICAgeyBmOiBcIlwiLCB4OiBcInRoaXMuZm9vLnBhcmVudCgpXCIsIGV4cGVjdDogXCJuZXdEYXRhLmNoaWxkKCdmb28nKS5wYXJlbnQoKS52YWwoKSA9PSB0cnVlXCIgfSxcclxuICAgICAgeyBmOiBcIlwiLFxyXG4gICAgICAgIHg6IFwidGhpcy5mb28gfHwgdGhpcy5iYXJcIixcclxuICAgICAgICBleHBlY3Q6IFwibmV3RGF0YS5jaGlsZCgnZm9vJykudmFsKCkgPT0gdHJ1ZSB8fCBuZXdEYXRhLmNoaWxkKCdiYXInKS52YWwoKSA9PSB0cnVlXCJ9LFxyXG4gICAgICAvLyBUT0RPOiBEb24ndCBzdXBwb3J0IHNuYXBzaG90IGZ1bmN0aW9ucyBiZXlvbmQgcGFyZW50LlxyXG4gICAgICAvLyBUT0RPOiBTaG91bGQgd2FybiB1c2VyIG5vdCB0byB1c2UgRmlyZWJhc2UgYnVpbHRpbnMhXHJcbiAgICAgIC8vIHsgZjogXCJcIiwgeDogXCJ0aGlzLmlzU3RyaW5nKClcIiwgZXhwZWN0OiBcIm5ld0RhdGEuY2hpbGQoJ2lzU3RyaW5nJykudmFsKCkgPT0gdHJ1ZVwiIH0sXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIGEgPT0gJzEyMyc7IH1cIiwgeDogXCJmKHRoaXMpXCIsIGV4cGVjdDogXCJuZXdEYXRhLnZhbCgpID09ICcxMjMnXCIgfSxcclxuICAgICAgeyBmOiBcImZ1bmN0aW9uIGYoYSkgeyByZXR1cm4gYSA9PSAnMTIzJzsgfVwiLFxyXG4gICAgICAgIHg6IFwiZih0aGlzLmZvbylcIiwgZXhwZWN0OiBcIm5ld0RhdGEuY2hpbGQoJ2ZvbycpLnZhbCgpID09ICcxMjMnXCIgfSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHN5bWJvbHMgPSBwYXJzZShkYXRhLmYgKyBcIiBwYXRoIC94IHsgd3JpdGUoKSB7IHJldHVybiBcIiArIGRhdGEueCArIFwiOyB9fVwiKTtcclxuICAgICAgdmFyIGdlbiA9IG5ldyBib2x0LkdlbmVyYXRvcihzeW1ib2xzKTtcclxuICAgICAgLy8gTWFrZSBzdXJlIGxvY2FsIFNjaGVtYSBpbml0aWFsaXplZC5cclxuICAgICAgdmFyIGpzb24gPSA8YW55PiBnZW4uZ2VuZXJhdGVSdWxlcygpO1xyXG4gICAgICBhc3NlcnQuZXF1YWwoanNvblsncnVsZXMnXVsneCddWycud3JpdGUnXSwgZXhwZWN0KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlN0cmluZyBtZXRob2RzXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICB7IGRhdGE6IFwidGhpcy5sZW5ndGhcIixcclxuICAgICAgICBleHBlY3Q6IFwibmV3RGF0YS52YWwoKS5sZW5ndGhcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwidGhpcy5sZW5ndGggPCAxMDBcIixcclxuICAgICAgICBleHBlY3Q6IFwibmV3RGF0YS52YWwoKS5sZW5ndGggPCAxMDBcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwiJ2FiYycubGVuZ3RoXCIsXHJcbiAgICAgICAgZXhwZWN0OiBcIidhYmMnLmxlbmd0aFwiIH0sXHJcbiAgICAgIHsgZGF0YTogXCInYWJjJy5pbmNsdWRlcygnYicpXCIsXHJcbiAgICAgICAgZXhwZWN0OiBcIidhYmMnLmNvbnRhaW5zKCdiJylcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwidGhpcy5pbmNsdWRlcygnYicpXCIsXHJcbiAgICAgICAgZXhwZWN0OiBcIm5ld0RhdGEudmFsKCkuY29udGFpbnMoJ2InKVwiIH0sXHJcbiAgICAgIHsgZGF0YTogXCInYWJjJy5pbmNsdWRlcyh0aGlzKVwiLFxyXG4gICAgICAgIGV4cGVjdDogXCInYWJjJy5jb250YWlucyhuZXdEYXRhLnZhbCgpKVwiIH0sXHJcbiAgICAgIHsgZGF0YTogXCInYWJjJy5zdGFydHNXaXRoKHRoaXMpXCIsXHJcbiAgICAgICAgZXhwZWN0OiBcIidhYmMnLmJlZ2luc1dpdGgobmV3RGF0YS52YWwoKSlcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwiJ2FiYycuZW5kc1dpdGgodGhpcylcIixcclxuICAgICAgICBleHBlY3Q6IFwiJ2FiYycuZW5kc1dpdGgobmV3RGF0YS52YWwoKSlcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwiJ2FiYycucmVwbGFjZSh0aGlzLmEsIHRoaXMuYilcIixcclxuICAgICAgICBleHBlY3Q6IFwiJ2FiYycucmVwbGFjZShuZXdEYXRhLmNoaWxkKCdhJykudmFsKCksIG5ld0RhdGEuY2hpbGQoJ2InKS52YWwoKSlcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwiJ0FCQycudG9Mb3dlckNhc2UoKVwiLFxyXG4gICAgICAgIGV4cGVjdDogXCInQUJDJy50b0xvd2VyQ2FzZSgpXCIgfSxcclxuICAgICAgeyBkYXRhOiBcIidhYmMnLnRvVXBwZXJDYXNlKClcIixcclxuICAgICAgICBleHBlY3Q6IFwiJ2FiYycudG9VcHBlckNhc2UoKVwiIH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0aGlzLnRvVXBwZXJDYXNlKClcIixcclxuICAgICAgICBleHBlY3Q6IFwibmV3RGF0YS52YWwoKS50b1VwcGVyQ2FzZSgpXCIgfSxcclxuICAgICAgeyBkYXRhOiBcIidhYmFiYScudGVzdCgvYmFiLylcIixcclxuICAgICAgICBleHBlY3Q6IFwiJ2FiYWJhJy5tYXRjaGVzKC9iYWIvKVwiIH0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHZhciBzeW1ib2xzID0gcGFyc2UoXCJwYXRoIC94IHsgd3JpdGUoKSB7IHJldHVybiBcIiArIGRhdGEgKyBcIjsgfX1cIik7XHJcbiAgICAgIHZhciBnZW4gPSBuZXcgYm9sdC5HZW5lcmF0b3Ioc3ltYm9scyk7XHJcbiAgICAgIC8vIE1ha2Ugc3VyZSBsb2NhbCBTY2hlbWEgaW5pdGlhbGl6ZWQuXHJcbiAgICAgIHZhciBqc29uID0gPGFueT4gZ2VuLmdlbmVyYXRlUnVsZXMoKTtcclxuICAgICAgYXNzZXJ0LmVxdWFsKGpzb25bJ3J1bGVzJ11bJ3gnXVsnLndyaXRlJ10sIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJCdWlsdGluIHZhbGlkYXRpb24gZnVuY3Rpb25zXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICBbICdTdHJpbmcnLCAndGhpcy5pc1N0cmluZygpJ10sXHJcbiAgICAgIFsgJ051bWJlcicsICd0aGlzLmlzTnVtYmVyKCknXSxcclxuICAgICAgWyAnQm9vbGVhbicsICd0aGlzLmlzQm9vbGVhbigpJ10sXHJcbiAgICAgIFsgJ09iamVjdCcsICd0aGlzLmhhc0NoaWxkcmVuKCknXSxcclxuICAgICAgWyAnTnVsbCcsICdmYWxzZSddLFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICB2YXIgc3ltYm9scyA9IHBhcnNlKFwicGF0aCAvIHt9XCIpO1xyXG4gICAgICB2YXIgZ2VuID0gbmV3IGJvbHQuR2VuZXJhdG9yKHN5bWJvbHMpO1xyXG4gICAgICBnZW4uZW5zdXJlVmFsaWRhdG9yKGFzdC50eXBlVHlwZShkYXRhKSk7XHJcblxyXG4gICAgICB2YXIgdGVybXMgPSA8YXN0LkV4cFtdPiBnZW4udmFsaWRhdG9yc1tkYXRhXVsnLnZhbGlkYXRlJ107XHJcbiAgICAgIHZhciByZXN1bHQgPSBib2x0LmRlY29kZUV4cHJlc3Npb24oYXN0LmFuZEFycmF5KHRlcm1zKSk7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwocmVzdWx0LCBleHBlY3QpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiU2NoZW1hIFZhbGlkYXRpb25cIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQge31cIixcclxuICAgICAgICBleHBlY3Q6IHVuZGVmaW5lZCB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIGV4dGVuZHMgT2JqZWN0IHt9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbigpXCJ9IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQgZXh0ZW5kcyBTdHJpbmcge31cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzU3RyaW5nKClcIn0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCBleHRlbmRzIFN0cmluZyB7IHZhbGlkYXRlKCkgeyByZXR1cm4gdGhpcy5sZW5ndGggPiAwOyB9IH1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzU3RyaW5nKCkgJiYgbmV3RGF0YS52YWwoKS5sZW5ndGggPiAwXCJ9IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIE5vbkVtcHR5IGV4dGVuZHMgU3RyaW5nIHsgdmFsaWRhdGUoKSB7IHJldHVybiB0aGlzLmxlbmd0aCA+IDA7IH0gfSBcXFxyXG4gICAgICAgICAgICB0eXBlIFQgeyBwcm9wOiBOb25FbXB0eSB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ3Byb3AnXSlcIixcclxuICAgICAgICAgICAgICAgICBwcm9wOiB7XHJcbiAgICAgICAgICAgICAgICAgICAnLnZhbGlkYXRlJzogJ25ld0RhdGEuaXNTdHJpbmcoKSAmJiBuZXdEYXRhLnZhbCgpLmxlbmd0aCA+IDAnXHJcbiAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9XHJcbiAgICAgICAgICAgICAgICB9IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQge246IE51bWJlcn1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsnbiddKVwiLFxyXG4gICAgICAgICAgICAgICAgIG46IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCB7czogU3RyaW5nfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWydzJ10pXCIsXHJcbiAgICAgICAgICAgICAgICAgczogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNTdHJpbmcoKVwifSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHtiOiBCb29sZWFufVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWydiJ10pXCIsXHJcbiAgICAgICAgICAgICAgICAgYjogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNCb29sZWFuKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCB7eDogT2JqZWN0fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWyd4J10pXCIsXHJcbiAgICAgICAgICAgICAgICAgeDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oKVwifSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHt4OiBOdW1iZXJ8U3RyaW5nfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWyd4J10pXCIsXHJcbiAgICAgICAgICAgICAgICAgeDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKSB8fCBuZXdEYXRhLmlzU3RyaW5nKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQgeyAka2V5OiBOdW1iZXIgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oKVwiLFxyXG4gICAgICAgICAgICAgICAgICcka2V5JzogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKVwifX0gfSxcclxuXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQgeyAnYSBiJzogTnVtYmVyIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsnYSBiJ10pXCIsXHJcbiAgICAgICAgICAgICAgICAgJ2EgYic6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogJ2ZhbHNlJ319IH0sXHJcblxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHthOiBOdW1iZXIsIGI6IFN0cmluZ31cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsnYScsICdiJ10pXCIsXHJcbiAgICAgICAgICAgICAgICAgYTogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKVwifSxcclxuICAgICAgICAgICAgICAgICBiOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc1N0cmluZygpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQge3g6IE51bWJlcnxOdWxsfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oKVwiLFxyXG4gICAgICAgICAgICAgICAgIHg6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCB7bjogTnVtYmVyLCB2YWxpZGF0ZSgpIHtyZXR1cm4gdGhpcy5uIDwgNzt9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWyduJ10pICYmIG5ld0RhdGEuY2hpbGQoJ24nKS52YWwoKSA8IDdcIixcclxuICAgICAgICAgICAgICAgICBuOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEJpZ2dlciBleHRlbmRzIE51bWJlciB7dmFsaWRhdGUoKSB7IHJldHVybiB0aGlzID4gcHJpb3IodGhpcyk7IH19XCIgK1xyXG4gICAgICAgIFwidHlwZSBUIHsgdHM6IEJpZ2dlciB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ3RzJ10pXCIsXHJcbiAgICAgICAgICAgICAgICAgdHM6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKCkgJiYgbmV3RGF0YS52YWwoKSA+IGRhdGEudmFsKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCB7YTogU3RyaW5nLCBiOiBTdHJpbmcsIGM6IFN0cmluZ31cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsnYScsICdiJywgJ2MnXSlcIixcclxuICAgICAgICAgICAgICAgICBhOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc1N0cmluZygpXCJ9LFxyXG4gICAgICAgICAgICAgICAgIGI6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzU3RyaW5nKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgYzogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNTdHJpbmcoKVwifSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBCIHsgZm9vOiBOdW1iZXIgfSB0eXBlIFQgZXh0ZW5kcyBCIHsgYmFyOiBTdHJpbmcgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWydmb28nLCAnYmFyJ10pXCIsXHJcbiAgICAgICAgICAgICAgICAgZm9vOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgIGJhcjogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNTdHJpbmcoKVwifSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG5cclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCB7bjogTnVtYmVyLCB4OiBNYXA8U3RyaW5nLCBOdW1iZXI+fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWyduJ10pXCIsXHJcbiAgICAgICAgICAgICAgICAgbjogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKVwifSxcclxuICAgICAgICAgICAgICAgICB4OiB7JyRrZXkxJzogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKVwifSxcclxuICAgICAgICAgICAgICAgICAgICAgJy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbigpXCIgfSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHt4OiBNYXA8U3RyaW5nLCBOdW1iZXI+fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oKVwiLFxyXG4gICAgICAgICAgICAgICAgIHg6IHsnJGtleTEnOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICAgICAnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKClcIiB9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFNtYWxsU3RyaW5nIGV4dGVuZHMgU3RyaW5nIHsgdmFsaWRhdGUoKSB7IHRoaXMubGVuZ3RoIDwgMzIgfSB9IFwiICtcclxuICAgICAgICAgICAgICBcInR5cGUgVCB7eDogTWFwPFNtYWxsU3RyaW5nLCBOdW1iZXI+fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oKVwiLFxyXG4gICAgICAgICAgICAgICAgIHg6IHsnJGtleTEnOiB7Jy52YWxpZGF0ZSc6IFwiJGtleTEubGVuZ3RoIDwgMzIgJiYgbmV3RGF0YS5pc051bWJlcigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICAgICAnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKClcIiB9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIE0gZXh0ZW5kcyBNYXA8U3RyaW5nLCBOdW1iZXI+OyB0eXBlIFQgeyB4OiBNIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKClcIixcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9LFxyXG4gICAgICAgICAgICAgICAgICd4Jzogeycka2V5MSc6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgJy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbigpXCIgfX0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgUGFpcjxYLCBZPiB7IGZpcnN0OiBYLCBzZWNvbmQ6IFkgfSB0eXBlIFQgZXh0ZW5kcyBQYWlyPFN0cmluZywgTnVtYmVyPjtcIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsnZmlyc3QnLCAnc2Vjb25kJ10pXCIsXHJcbiAgICAgICAgICAgICAgICAgJ2ZpcnN0JzogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNTdHJpbmcoKVwifSxcclxuICAgICAgICAgICAgICAgICAnc2Vjb25kJzogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKVwifSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG5cclxuICAgICAgeyBkYXRhOiBcInR5cGUgWCB7IGE6IE51bWJlciwgdmFsaWRhdGUoKSB7IHRoaXMuYSA9PSBrZXkoKSB9IH0gdHlwZSBUIGV4dGVuZHMgWFtdO1wiLFxyXG4gICAgICAgIGV4cGVjdDogeycka2V5MSc6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsnYSddKSAmJiBuZXdEYXRhLmNoaWxkKCdhJykudmFsKCkgPT0gJGtleTFcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2EnOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSxcclxuICAgICAgICAgICAgICAgICAnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKClcIlxyXG4gICAgICAgICAgICAgICAgfSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBYIHsgYTogTnVtYmVyLCB2YWxpZGF0ZSgpIHsgdGhpcy5hID09IGtleSgpIH0gfSB0eXBlIFQgeyB4OiBYIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsneCc6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsnYSddKSAmJiBuZXdEYXRhLmNoaWxkKCdhJykudmFsKCkgPT0gJ3gnXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgJ2EnOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn0sXHJcbiAgICAgICAgICAgICAgICAgJy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ3gnXSlcIlxyXG4gICAgICAgICAgICAgICAgfSB9LFxyXG5cclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCBleHRlbmRzIFN0cmluZyB7IHZhbGlkYXRlKCkgeyByb290ID09ICduZXcnICYmIHByaW9yKHJvb3QpID09ICdvbGQnIH0gfVwiICtcclxuICAgICAgICAgICAgICBcInBhdGggL3QveCBpcyBBbnkgeyByZWFkKCkgeyByb290ID09ICdvbGQnIH0gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNTdHJpbmcoKSAmJiBuZXdEYXRhLnBhcmVudCgpLnZhbCgpID09ICduZXcnICYmIHJvb3QudmFsKCkgPT0gJ29sZCdcIixcclxuICAgICAgICAgICAgICAgICAneCc6IHsnLnJlYWQnOiBcInJvb3QudmFsKCkgPT0gJ29sZCdcIn1cclxuICAgICAgICAgICAgICAgIH0gfSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHN5bWJvbHMgPSBwYXJzZShkYXRhICsgXCIgcGF0aCAvdCBpcyBUO1wiKTtcclxuICAgICAgdmFyIGdlbiA9IG5ldyBib2x0LkdlbmVyYXRvcihzeW1ib2xzKTtcclxuICAgICAgdmFyIHJ1bGVzID0gZ2VuLmdlbmVyYXRlUnVsZXMoKTtcclxuICAgICAgaWYgKGV4cGVjdCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgYXNzZXJ0LmRlZXBFcXVhbChydWxlcywge1wicnVsZXNcIjoge319KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBhc3NlcnQuZGVlcEVxdWFsKHJ1bGVzLCB7XCJydWxlc1wiOiB7dDogZXhwZWN0fX0pO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJleHRlbmRWYWxpZGF0b3JcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YToge3RhcmdldDoge30sIHNyYzoge319LFxyXG4gICAgICAgIGV4cGVjdDoge30gfSxcclxuICAgICAgeyBkYXRhOiB7dGFyZ2V0OiB7fSwgc3JjOiB7Jy54JzogWzFdfX0sXHJcbiAgICAgICAgZXhwZWN0OiB7Jy54JzogWzFdfSB9LFxyXG4gICAgICB7IGRhdGE6IHt0YXJnZXQ6IHsnLngnOiBbMV19LCBzcmM6IHsnLngnOiBbMl19fSxcclxuICAgICAgICBleHBlY3Q6IHsnLngnOiBbMSwgMl19IH0sXHJcbiAgICAgIHsgZGF0YToge3RhcmdldDogeycueCc6IFsxXX0sIHNyYzogeycueCc6IFsyXSwgYzogeycueCc6IFszXX19fSxcclxuICAgICAgICBleHBlY3Q6IHsnLngnOiBbMSwgMl0sIGM6IHsnLngnOiBbM119fSB9LFxyXG4gICAgICB7IGRhdGE6IHt0YXJnZXQ6IHsnLngnOiBbMV0sIGM6IHsnLngnOiBbMl19fSwgc3JjOiB7YzogeycueCc6IFszXX19fSxcclxuICAgICAgICBleHBlY3Q6IHsnLngnOiBbMV0sIGM6IHsnLngnOiBbMiwgM119fSB9LFxyXG4gICAgICB7IGRhdGE6IHt0YXJnZXQ6IHt9LCBzcmM6IHthOiB7Yjoge2M6IHtkOiB7Jy54JzogWzFdLCBlOiB7Jy54JzogWzJdfX19fX19fSxcclxuICAgICAgICBleHBlY3Q6IHthOiB7Yjoge2M6IHtkOiB7Jy54JzogWzFdLCBlOiB7Jy54JzogWzJdfX19fX19IH0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIGdlbmVyYXRvci5leHRlbmRWYWxpZGF0b3IoZGF0YS50YXJnZXQsIGRhdGEuc3JjKTtcclxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbChkYXRhLnRhcmdldCwgZXhwZWN0KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIm1hcFZhbGlkYXRvclwiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgeyBkYXRhOiB7Jy54JzogJ2EnfSwgZXhwZWN0OiB7Jy54JzogJ2ErJ30gfSxcclxuICAgICAgeyBkYXRhOiB7Jy54JzogJ2InfSwgZXhwZWN0OiB7fSB9LFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICBnZW5lcmF0b3IubWFwVmFsaWRhdG9yKGRhdGEsIGZ1bmN0aW9uKHZhbHVlLCBwcm9wKSB7XHJcbiAgICAgICAgaWYgKHZhbHVlID09PSAnYicpIHtcclxuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB2YWx1ZSArICcrJztcclxuICAgICAgfSk7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwoZGF0YSwgZXhwZWN0KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlNjaGVtYSBHZW5lcmF0aW9uIEVycm9yc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgeyBkYXRhOiBcIlwiLFxyXG4gICAgICAgIGV4cGVjdDogL2F0IGxlYXN0IG9uZSBwYXRoLyB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBTaW1wbGUgZXh0ZW5kcyBTdHJpbmcge2E6IFN0cmluZ30gcGF0aCAveCBpcyBTaW1wbGU7XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvcHJvcGVydGllcy4qZXh0ZW5kLyB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAveSB7IGluZGV4KCkgeyByZXR1cm4gMTsgfX1cIixcclxuICAgICAgICBleHBlY3Q6IC9pbmRleC4qc3RyaW5nL2kgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3ggeyB3cml0ZSgpIHsgcmV0dXJuIHVuZGVmaW5lZEZ1bmMoKTsgfX1cIixcclxuICAgICAgICBleHBlY3Q6IC91bmRlZmluZWQuKmZ1bmN0aW9uL2kgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3ggaXMgTm9TdWNoVHlwZSB7fVwiLFxyXG4gICAgICAgIGV4cGVjdDogL05vIHR5cGUuKk5vU3VjaFR5cGUvIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94IHsgdW5zdXBwb3J0ZWQoKSB7IHRydWUgfSB9XCIsXHJcbiAgICAgICAgd2FybjogL3Vuc3VwcG9ydGVkIG1ldGhvZC9pIH0sXHJcblxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAveCB7IHZhbGlkYXRlKCkgeyByZXR1cm4gdGhpcy50ZXN0KDEyMyk7IH0gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogL2NvbnZlcnQgdmFsdWUvaSB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAveCB7IHZhbGlkYXRlKCkgeyByZXR1cm4gdGhpcy50ZXN0KCdhLycpOyB9IH1cIixcclxuICAgICAgICBleHBlY3Q6IC9jb252ZXJ0IHZhbHVlL2kgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3ggeyB2YWxpZGF0ZSgpIHsgcmV0dXJuIHRoaXMudGVzdCgnL2EvJyk7IH0gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogL2NvbnZlcnQgdmFsdWUvaSB9LFxyXG5cclxuICAgICAgeyBkYXRhOiBcImZ1bmN0aW9uIGYoYSkgeyByZXR1cm4gZihhKTsgfSBwYXRoIC8geyB2YWxpZGF0ZSgpIHsgcmV0dXJuIGYoMSk7IH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvcmVjdXJzaXZlL2kgfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgWCB7ICRuOiBOdW1iZXIsICRzOiBTdHJpbmcgfSBwYXRoIC8gaXMgWDtcIixcclxuICAgICAgICBleHBlY3Q6IC93aWxkIHByb3BlcnR5LyB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBYIHsgJCRuOiBOdW1iZXIgfSBwYXRoIC8gaXMgWDtcIixcclxuICAgICAgICBleHBlY3Q6IC9wcm9wZXJ0eSBuYW1lcy9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFggeyAnXFx4MDEnOiBOdW1iZXIgfSBwYXRoIC8gaXMgWDtcIixcclxuICAgICAgICBleHBlY3Q6IC9wcm9wZXJ0eSBuYW1lcy9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8gaXMgTWFwO1wiLFxyXG4gICAgICAgIGV4cGVjdDogL05vIHR5cGUuKm5vbi1nZW5lcmljLyB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBQYWlyPFgsIFk+IHthOiBYLCBiOiBZfSBwYXRoIC8gaXMgUGFpcjtcIixcclxuICAgICAgICBleHBlY3Q6IC9ObyB0eXBlLipub24tZ2VuZXJpYy8gfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyBpcyBTdHJpbmc8TnVtYmVyPjtcIixcclxuICAgICAgICBleHBlY3Q6IC9ObyB0eXBlLipnZW5lcmljLyB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvIGlzIE1hcDxPYmplY3QsIE51bWJlcj47XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvbXVzdCBkZXJpdmUgZnJvbSBTdHJpbmcvIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8geyB3cml0ZSgpIHsgdHJ1ZSB9IGNyZWF0ZSgpIHsgdHJ1ZSB9IH1cIixcclxuICAgICAgICBleHBlY3Q6IC93cml0ZS1hbGlhc2luZy4qY3JlYXRlL2kgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7IHdyaXRlKCkgeyB0cnVlIH0gdXBkYXRlKCkgeyB0cnVlIH0gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogL3dyaXRlLWFsaWFzaW5nLip1cGRhdGUvaSB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvIHsgd3JpdGUoKSB7IHRydWUgfSBkZWxldGUoKSB7IHRydWUgfSB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvd3JpdGUtYWxpYXNpbmcuKmRlbGV0ZS9pIH0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0LCB0KSB7XHJcbiAgICAgIGxvZ2dlci5yZXNldCgpO1xyXG4gICAgICBsb2dnZXIuc2lsZW50KCk7XHJcbiAgICAgIGxldCBzeW1ib2xzID0gcGFyc2UoZGF0YSk7XHJcbiAgICAgIGxldCBnZW4gPSBuZXcgYm9sdC5HZW5lcmF0b3Ioc3ltYm9scyk7XHJcbiAgICAgIGxldCBsYXN0RXJyb3I6IHN0cmluZztcclxuXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgZ2VuLmdlbmVyYXRlUnVsZXMoKTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGlmICghZXhwZWN0KSB7XHJcbiAgICAgICAgICB0aHJvdyBlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsYXN0RXJyb3IgPSBsb2dnZXIuZ2V0TGFzdE1lc3NhZ2UoKSB8fCBlLm1lc3NhZ2U7XHJcbiAgICAgICAgYXNzZXJ0Lm1hdGNoKGxhc3RFcnJvciwgZXhwZWN0KTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGV4cGVjdCkge1xyXG4gICAgICAgIGFzc2VydC5mYWlsKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBcIk5vIGV4Y2VwdGlvbiB0aHJvd24uXCIpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICh0Lndhcm4pIHtcclxuICAgICAgICBhc3NlcnQubWF0Y2gobG9nZ2VyLmdldExhc3RNZXNzYWdlKCksIHQud2Fybik7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH0pO1xyXG59KTtcclxuIl19
