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
var fileIO = require('../file-io');
var readFile = fileIO.readFile;
var logger = require('../logger');
var ast = require('../ast');
var bolt = require('../bolt');
var helper = require('./test-helper');
var sample_files_1 = require('./sample-files');
var parser = require('../rules-parser');
var parse = parser.parse;
// TODO: Test duplicated function, and schema definitions.
suite("Rules Parser Tests", function () {
    test("Empty input", function () {
        var result = parse("");
        chai_1.assert.ok(result instanceof ast.Symbols);
    });
    suite("Imports", function () {
        var tests = [
            { data: "import {'foo'}",
                expect: {
                    filename: ast.string('foo'),
                    alias: ast.string(''),
                    scope: ast.boolean(true)
                }
            },
            { data: "import {'../../foo/bar'}",
                expect: {
                    filename: ast.string('../../foo/bar'),
                    alias: ast.string(''),
                    scope: ast.boolean(false)
                }
            },
            { data: "import {'./foo/bar'}",
                expect: {
                    filename: ast.string('./foo/bar'),
                    alias: ast.string(''),
                    scope: ast.boolean(false)
                }
            },
            { data: "import {'./foo/bar'} as lol",
                expect: {
                    filename: ast.string('./foo/bar'),
                    alias: ast.string('lol'),
                    scope: ast.boolean(false)
                }
            },
            { data: "import {'./foo-bar'} as lol",
                expect: {
                    filename: ast.string('./foo-bar'),
                    alias: ast.string('lol'),
                    scope: ast.boolean(false)
                }
            }
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            console.log("******!!");
            var result = parse(data);
            console.log("******!!");
            console.log(result);
            chai_1.assert.deepEqual(result.imports[0].filename, expect.filename.value);
            chai_1.assert.deepEqual(result.imports[0].alias, expect.alias.value);
            chai_1.assert.deepEqual(result.imports[0].scope, expect.scope.value);
        });
    });
    suite("Function Samples", function () {
        var tests = [
            { data: "function f() { return true; }",
                expect: { f: { params: [], body: ast.boolean(true) } }
            },
            { data: "function longName() { return false; }",
                expect: { longName: { params: [], body: ast.boolean(false) } }
            },
            { data: "function f(){return true;} function g(){return false;}",
                expect: { f: { params: [], body: ast.boolean(true) },
                    g: { params: [], body: ast.boolean(false) } }
            }
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            chai_1.assert.deepEqual(result.functions, expect);
        });
    });
    suite("Literals", function () {
        var tests = [
            ["true", ast.boolean(true)],
            ["false", ast.boolean(false)],
            ["null", ast.nullType()],
            ["1", ast.number(1)],
            ["1.1", ast.number(1.1)],
            ["+3", ast.number(3)],
            ["-3", ast.number(-3)],
            ["0x2", ast.number(2)],
            ["[1, 2, 3]", ast.array([ast.number(1), ast.number(2), ast.number(3)])],
            ["\"string\"", ast.string("string")],
            ["'string'", ast.string("string")],
            ["''", ast.string('')],
            ["/pattern/", ast.regexp("pattern")],
            ["/pattern/i", ast.regexp("pattern", "i")],
            ["/pat\\ntern/", ast.regexp("pat\\ntern")],
            ["/pat\\/tern/", ast.regexp("pat\\/tern")],
            ["/pat\\tern/", ast.regexp("pat\\tern")],
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse("function f() { return " + data + ";}");
            chai_1.assert.deepEqual(result.functions.f.body, expect);
        });
    });
    suite("Expressions", function () {
        var tests = [
            ["a", ast.variable('a')],
            ["a.b", ast.reference(ast.variable('a'), ast.string('b'))],
            ["a['b']", ast.reference(ast.variable('a'), ast.string('b'))],
            ["a[b]", ast.reference(ast.variable('a'), ast.variable('b'))],
            ["a()", ast.call(ast.variable('a'), [])],
            ["a.b()", ast.call(ast.reference(ast.variable('a'), ast.string('b')), [])],
            ["a().b", ast.reference(ast.call(ast.variable('a'), []), ast.string('b'))],
            ["-a", ast.neg(ast.variable('a'))],
            // TODO: This should be an error - looks like pre-decrement
            ["--a", ast.neg(ast.neg(ast.variable('a')))],
            ["+a", ast.variable('a')],
            ["!a", ast.not(ast.variable('a'))],
            ["2 * a", ast.mult(ast.number(2), ast.variable('a'))],
            ["2 / a", ast.div(ast.number(2), ast.variable('a'))],
            ["a % 2", ast.mod(ast.variable('a'), ast.number(2))],
            ["1 + 1", ast.add(ast.number(1), ast.number(1))],
            ["a - 1", ast.sub(ast.variable('a'), ast.number(1))],
            // Unary precedence
            ["a - -b", ast.sub(ast.variable('a'), ast.neg(ast.variable('b')))],
            // Left associative
            ["a + b + c", ast.add(ast.add(ast.variable('a'), ast.variable('b')), ast.variable('c'))],
            // Multiplcation precedence
            ["a + b * c", ast.add(ast.variable('a'), ast.mult(ast.variable('b'), ast.variable('c')))],
            ["(a + b) * c", ast.mult(ast.add(ast.variable('a'), ast.variable('b')), ast.variable('c'))],
            ["a < 7", ast.lt(ast.variable('a'), ast.number(7))],
            ["a > 7", ast.gt(ast.variable('a'), ast.number(7))],
            ["a <= 7", ast.lte(ast.variable('a'), ast.number(7))],
            ["a >= 7", ast.gte(ast.variable('a'), ast.number(7))],
            ["a == 3", ast.eq(ast.variable('a'), ast.number(3))],
            ["a != 0", ast.ne(ast.variable('a'), ast.number(0))],
            ["a === 3", ast.eq(ast.variable('a'), ast.number(3))],
            ["a !== 0", ast.ne(ast.variable('a'), ast.number(0))],
            ["3 * a == b", ast.eq(ast.mult(ast.number(3), ast.variable('a')), ast.variable('b'))],
            ["a == 1 && b <= 2", ast.and(ast.eq(ast.variable('a'), ast.number(1)), ast.lte(ast.variable('b'), ast.number(2)))],
            ["a == 1 || b <= 2", ast.or(ast.eq(ast.variable('a'), ast.number(1)), ast.lte(ast.variable('b'), ast.number(2)))],
            // Left associative (even though execution is short-circuited!
            ["a && b && c", ast.and(ast.and(ast.variable('a'), ast.variable('b')), ast.variable('c'))],
            ["a || b || c", ast.or(ast.or(ast.variable('a'), ast.variable('b')), ast.variable('c'))],
            // && over || precendence
            ["a && b || c && d", ast.or(ast.and(ast.variable('a'), ast.variable('b')), ast.and(ast.variable('c'), ast.variable('d')))],
            ["a ? b : c", ast.ternary(ast.variable('a'), ast.variable('b'), ast.variable('c'))],
            ["a || b ? c : d", ast.ternary(ast.or(ast.variable('a'), ast.variable('b')), ast.variable('c'), ast.variable('d'))],
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse("function f() { return " + data + ";}");
            chai_1.assert.deepEqual(result.functions.f.body, expect);
        });
    });
    suite("Whitespace", function () {
        var fn = "function f() { return true; }";
        var fnAST = { params: [], body: ast.boolean(true) };
        var tests = [
            " " + fn,
            fn + " ",
            " " + fn + " ",
            "\t" + fn,
            "\n" + fn,
            "\r\n" + fn,
            fn + "\n",
            fn + "\r\n",
            "  \t" + fn + "  \r\n"
        ];
        helper.dataDrivenTest(tests, function (data) {
            chai_1.assert.deepEqual(parse(data).functions.f, fnAST);
        });
    });
    suite("Comments", function () {
        var fn = "function f() { return true; }";
        var fnAST = { params: [], body: ast.boolean(true) };
        var tests = [
            "//Single Line\n" + fn,
            fn + " // My rule",
            "// Line 1\n// Line 2\n" + fn,
            "/* inline */ " + fn,
            "/* pre */ " + fn + " /* post */"
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            chai_1.assert.deepEqual(parse(data).functions.f, fnAST);
        });
    });
    suite("Paths", function () {
        var tests = [
            { data: "path / {}",
                expect: [{ template: new ast.PathTemplate(),
                        isType: ast.typeType('Any'),
                        methods: {} }] },
            { data: "path /x {}",
                expect: [{ template: new ast.PathTemplate(['x']),
                        isType: ast.typeType('Any'),
                        methods: {} }] },
            { data: "path /p/{$q} { write() { return true;  }}",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['p', '$q']),
                        methods: { write: { params: [], body: ast.boolean(true) } } }] },
            { data: "path /p/{q} { write() { return true;  }}",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['p', new ast.PathPart('$q', 'q')]),
                        methods: { write: { params: [], body: ast.boolean(true) } } }] },
            { data: "path /x/y { read() { true } }",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x', 'y']),
                        methods: { read: { params: [], body: ast.boolean(true) } } }] },
            { data: "path /x { read() { true } /y { write() { true } }}",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x']),
                        methods: { read: { params: [], body: ast.boolean(true) } } },
                    { isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x', 'y']),
                        methods: { write: { params: [], body: ast.boolean(true) } } }] },
            { data: "path /x { read() { true } /y { write() { true } path /{$id} { validate() { false } }}}",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x']),
                        methods: { read: { params: [], body: ast.boolean(true) } } },
                    { isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x', 'y']),
                        methods: { write: { params: [], body: ast.boolean(true) } } },
                    { isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x', 'y', '$id']),
                        methods: { validate: { params: [], body: ast.boolean(false) } } },
                ] },
            { data: "path /hyphen-key {}",
                expect: [{ template: new ast.PathTemplate(['hyphen-key']),
                        isType: ast.typeType('Any'),
                        methods: {} }] },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            chai_1.assert.deepEqual(sortPaths(parse(data).paths), sortPaths(expect));
        });
    });
    suite("Schema", function () {
        var tests = [
            { data: "type Foo { a: Number }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('Number') },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Number, b: String }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('Number'),
                        b: ast.typeType('String') },
                    methods: {},
                    params: []
                } },
            { data: "type Foo extends Bar {}",
                expect: { derivedFrom: ast.typeType('Bar'),
                    properties: {},
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Number validate() { return true; }}",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('Number') },
                    methods: { validate: { params: [],
                            body: ast.boolean(true) } },
                    params: []
                } },
            { data: "type Foo { a: Number, validate() { return true; }}",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('Number') },
                    methods: { validate: { params: [],
                            body: ast.boolean(true) } },
                    params: []
                } },
            { data: "type Foo { a: Number | String }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.unionType([ast.typeType('Number'),
                            ast.typeType('String')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo extends Number | String;",
                expect: { derivedFrom: ast.unionType([ast.typeType('Number'), ast.typeType('String')]),
                    properties: {},
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Map<String, Number> }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.genericType('Map', [ast.typeType('String'),
                            ast.typeType('Number')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo extends Map<String, Number>;",
                expect: { derivedFrom: ast.genericType('Map', [ast.typeType('String'), ast.typeType('Number')]),
                    properties: {},
                    methods: {},
                    params: []
                } },
            // Alias for Map<String, Other>
            { data: "type Foo { a: Other[] }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.genericType('Map', [ast.typeType('String'),
                            ast.typeType('Other')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Multi<String, Number, Boolean> }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.genericType('Multi', [ast.typeType('String'),
                            ast.typeType('Number'),
                            ast.typeType('Boolean')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Gen1<String> }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.genericType('Gen1', [ast.typeType('String')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo<T> { a: T }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('T') },
                    methods: {},
                    params: ["T"]
                } },
            { data: "type Foo { name: String, age: Number }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { name: ast.typeType('String'),
                        age: ast.typeType('Number') },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { name: String; age: Number; }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { name: ast.typeType('String'),
                        age: ast.typeType('Number') },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { 'hyphen-prop': String }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { "hyphen-prop": ast.typeType('String') },
                    methods: {},
                    params: []
                } },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data).schema.Foo;
            chai_1.assert.deepEqual(result, expect);
        });
    });
    suite("Function variations", function () {
        var tests = [
            "function f(x) { return x + 1; }",
            "function f(x) { return x + 1 }",
            "function f(x) { x + 1; }",
            "function f(x) { x + 1 }",
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            chai_1.assert.deepEqual(result.functions.f.body, ast.add(ast.variable('x'), ast.number(1)));
        });
    });
    suite("Method variations", function () {
        var tests = [
            "validate() { return this; }",
            "validate() { return this  }",
            "validate() { this; }",
            "validate() { this }",
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse("type T {" + data + "}");
            chai_1.assert.deepEqual(result.schema.T.methods.validate.body, ast.variable('this'));
        });
    });
    suite("Path variations", function () {
        var tests = [
            "path /p/{c} {}",
            "/p/{c} {}",
            "/p/{c};",
            "path /p/{c} is String {}",
            "path /p/{c} is String;",
            "/p/{c} is String {}",
            "/p/{c} is String;",
            "/p/{c=*} is String;",
            "/p/{c = *} is String;",
            "/p/{c} { validate() { return true; } }",
            "/p/{c} { validate() { return true } }",
            "/p/{c} { validate() { true } }",
            "/p/{c} { validate() { true; } }",
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            chai_1.assert.deepEqual(result.paths[0].template, new ast.PathTemplate(['p', new ast.PathPart('$c', 'c')]));
        });
    });
    suite("Type variations", function () {
        var tests = [
            "type T extends Any {}",
            "type T extends Any;",
            "type T {}",
            "type T;"
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            chai_1.assert.deepEqual(result.schema.T, { derivedFrom: ast.typeType('Any'),
                methods: {},
                properties: {},
                params: []
            });
        });
    });
    suite("Sample files", function () {
        helper.dataDrivenTest(sample_files_1.samples, function (data) {
            var filename = 'samples/' + data + '.' + bolt.FILE_EXTENSION;
            return readFile(filename)
                .then(function (response) {
                var result = parse(response.content);
                chai_1.assert.ok(result, response.url);
                return true;
            });
        });
    });
    suite("Parser Errors", function () {
        var tests = [
            { data: "path /x/y/ is String;",
                expect: /end in a slash/ },
            { data: "path /x//y is String;",
                expect: /empty part/ },
            // BUG: Following errors should expect /empty part/ - PEG parser error?
            { data: "path //x is String;",
                expect: /./ },
            { data: "path // is String;",
                expect: /./ },
            { data: "path /x { validate() { return this.test(/a/g); } }",
                expect: /unsupported regexp modifier/i },
            { data: "path {}",
                expect: /missing path template/i },
            { data: "path / }",
                expect: /missing body of path/i },
            { data: "function foo { 7 }",
                expect: /missing parameters/i },
            { data: "foo { 7 }",
                expect: /expected.*function/i },
            { data: "foo(x)",
                expect: /missing.*body/i },
            { data: "path /x { foo(x); }",
                expect: /invalid path or method/i },
            { data: "foo(x) { x = 'a' }",
                expect: /equality/i },
            { data: "type X { bad-prop: String; }",
                expect: /invalid property or method/i },
            { data: "type { foo: String;}",
                expect: /missing type name/i },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            try {
                parse(data);
            }
            catch (e) {
                chai_1.assert.match(e.message, expect);
                return;
            }
            chai_1.assert.fail(undefined, undefined, "No exception thrown.");
        });
    });
    suite("Syntax warnings.", function () {
        var tests = [
            { data: "path /x { read() { true }; }",
                expect: /extra separator/i },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            parse(data);
            chai_1.assert.match(logger.getLastMessage(), expect);
        });
    });
    suite("Deprecation warnings.", function () {
        var tests = [
            { data: "path /x/$y is String;",
                expect: /path segment is deprecated/ },
            { data: "f(x) = x + 1;",
                expect: /fn\(x\) = exp; format is deprecated/ },
            { data: "f(x) = x + 1",
                expect: /fn\(x\) = exp; format is deprecated/ },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            parse(data);
            chai_1.assert.match(logger.getLastMessage(), expect);
        });
    });
});
function sortPaths(paths) {
    function cmpStr(a, b) {
        if (a < b) {
            return -1;
        }
        if (a > b) {
            return 1;
        }
        return 0;
    }
    paths.sort(function (a, b) {
        return cmpStr(a.template.getLabels().join('~'), b.template.getLabels().join('~'));
    });
    return paths;
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUMsQ0FBRTtZQUMxQixDQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFFO1lBQzVELENBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUU7WUFDL0QsQ0FBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUMvRCxDQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUU7WUFDMUMsQ0FBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFFO1lBQzVFLENBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUM1RSxDQUFFLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUNwQywyREFBMkQ7WUFDM0QsQ0FBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFFO1lBQzlDLENBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUU7WUFDM0IsQ0FBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUU7WUFDcEMsQ0FBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUN2RCxDQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFFO1lBQ3RELENBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUU7WUFDdEQsQ0FBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUNsRCxDQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFO1lBQ3RELG1CQUFtQjtZQUNuQixDQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUNwRSxtQkFBbUI7WUFDbkIsQ0FBRSxXQUFXLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUMxRiwyQkFBMkI7WUFDM0IsQ0FBRSxXQUFXLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUMzRixDQUFFLGFBQWEsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFFO1lBQzdGLENBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUU7WUFDckQsQ0FBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUNyRCxDQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFO1lBQ3ZELENBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUU7WUFDdkQsQ0FBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUN0RCxDQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFO1lBQ3RELENBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUU7WUFDdkQsQ0FBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUN2RCxDQUFFLFlBQVksRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFFO1lBQ3ZGLENBQUUsa0JBQWtCLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFD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QUM7SUFDWCxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFDLENBQUMsRUFBRSxDQUFDO1FBQ2QsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3BGLENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxDQUFDLEtBQUssQ0FBQztBQUNmLENBQUMiLCJmaWxlIjoidGVzdC9wYXJzZXItdGVzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qXHJcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXHJcbiAqXHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XHJcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cclxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XHJcbiAqXHJcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuICpcclxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxyXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXHJcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxyXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4gKi9cclxuaW1wb3J0IHthc3NlcnR9IGZyb20gJ2NoYWknO1xyXG5pbXBvcnQgKiBhcyBmaWxlSU8gZnJvbSAnLi4vZmlsZS1pbyc7XHJcbmxldCByZWFkRmlsZSA9IGZpbGVJTy5yZWFkRmlsZTtcclxuaW1wb3J0ICogYXMgbG9nZ2VyIGZyb20gJy4uL2xvZ2dlcic7XHJcbmltcG9ydCAqIGFzIGFzdCBmcm9tICcuLi9hc3QnO1xyXG5pbXBvcnQgKiBhcyBib2x0IGZyb20gJy4uL2JvbHQnO1xyXG5pbXBvcnQgKiBhcyBoZWxwZXIgZnJvbSAnLi90ZXN0LWhlbHBlcic7XHJcbmltcG9ydCB7c2FtcGxlc30gZnJvbSAnLi9zYW1wbGUtZmlsZXMnO1xyXG5cclxubGV0IHBhcnNlciA9IHJlcXVpcmUoJy4uL3J1bGVzLXBhcnNlcicpO1xyXG5sZXQgcGFyc2UgPSBwYXJzZXIucGFyc2U7XHJcblxyXG4vLyBUT0RPOiBUZXN0IGR1cGxpY2F0ZWQgZnVuY3Rpb24sIGFuZCBzY2hlbWEgZGVmaW5pdGlvbnMuXHJcblxyXG5zdWl0ZShcIlJ1bGVzIFBhcnNlciBUZXN0c1wiLCBmdW5jdGlvbigpIHtcclxuICB0ZXN0KFwiRW1wdHkgaW5wdXRcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgcmVzdWx0ID0gcGFyc2UoXCJcIik7XHJcbiAgICBhc3NlcnQub2socmVzdWx0IGluc3RhbmNlb2YgYXN0LlN5bWJvbHMpO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIkltcG9ydHNcIiwgZnVuY3Rpb24oKXtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgeyBkYXRhOiBcImltcG9ydCB7J2Zvbyd9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7XHJcbiAgICAgICAgICBmaWxlbmFtZTogYXN0LnN0cmluZygnZm9vJykgLFxyXG4gICAgICAgICAgYWxpYXM6IGFzdC5zdHJpbmcoJycpLFxyXG4gICAgICAgICAgc2NvcGU6IGFzdC5ib29sZWFuKHRydWUpXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICB7IGRhdGE6IFwiaW1wb3J0IHsnLi4vLi4vZm9vL2Jhcid9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7XHJcbiAgICAgICAgICBmaWxlbmFtZTogYXN0LnN0cmluZygnLi4vLi4vZm9vL2JhcicpLFxyXG4gICAgICAgICAgYWxpYXM6IGFzdC5zdHJpbmcoJycpLFxyXG4gICAgICAgICAgc2NvcGU6IGFzdC5ib29sZWFuKGZhbHNlKVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcImltcG9ydCB7Jy4vZm9vL2Jhcid9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7XHJcbiAgICAgICAgICBmaWxlbmFtZTogYXN0LnN0cmluZygnLi9mb28vYmFyJyksXHJcbiAgICAgICAgICBhbGlhczogYXN0LnN0cmluZygnJyksXHJcbiAgICAgICAgICBzY29wZTogYXN0LmJvb2xlYW4oZmFsc2UpXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICB7IGRhdGE6IFwiaW1wb3J0IHsnLi9mb28vYmFyJ30gYXMgbG9sXCIsXHJcbiAgICAgICAgZXhwZWN0OiB7XHJcbiAgICAgICAgICBmaWxlbmFtZTogYXN0LnN0cmluZygnLi9mb28vYmFyJyksXHJcbiAgICAgICAgICBhbGlhczogYXN0LnN0cmluZygnbG9sJyksXHJcbiAgICAgICAgICBzY29wZTogYXN0LmJvb2xlYW4oZmFsc2UpXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICB7IGRhdGE6IFwiaW1wb3J0IHsnLi9mb28tYmFyJ30gYXMgbG9sXCIsXHJcbiAgICAgICAgZXhwZWN0OiB7XHJcbiAgICAgICAgICBmaWxlbmFtZTogYXN0LnN0cmluZygnLi9mb28tYmFyJyksXHJcbiAgICAgICAgICBhbGlhczogYXN0LnN0cmluZygnbG9sJyksXHJcbiAgICAgICAgICBzY29wZTogYXN0LmJvb2xlYW4oZmFsc2UpXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICBdO1xyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgY29uc29sZS5sb2coXCIqKioqKiohIVwiKTtcclxuICAgICAgdmFyIHJlc3VsdCA9IHBhcnNlKGRhdGEpO1xyXG4gICAgICBjb25zb2xlLmxvZyhcIioqKioqKiEhXCIpO1xyXG4gICAgICBjb25zb2xlLmxvZyhyZXN1bHQpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC5pbXBvcnRzWzBdLmZpbGVuYW1lLCBleHBlY3QuZmlsZW5hbWUudmFsdWUpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC5pbXBvcnRzWzBdLmFsaWFzLCBleHBlY3QuYWxpYXMudmFsdWUpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC5pbXBvcnRzWzBdLnNjb3BlLCBleHBlY3Quc2NvcGUudmFsdWUpO1xyXG5cclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIkZ1bmN0aW9uIFNhbXBsZXNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHM6IGhlbHBlci5PYmplY3RTcGVjW10gPSBbXHJcbiAgICAgIHsgZGF0YTogXCJmdW5jdGlvbiBmKCkgeyByZXR1cm4gdHJ1ZTsgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBmOiB7IHBhcmFtczogW10sIGJvZHk6IGFzdC5ib29sZWFuKHRydWUpIH0gfVxyXG4gICAgICB9LFxyXG4gICAgICB7IGRhdGE6IFwiZnVuY3Rpb24gbG9uZ05hbWUoKSB7IHJldHVybiBmYWxzZTsgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBsb25nTmFtZTogeyBwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbihmYWxzZSkgfSB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHsgZGF0YTogXCJmdW5jdGlvbiBmKCl7cmV0dXJuIHRydWU7fSBmdW5jdGlvbiBnKCl7cmV0dXJuIGZhbHNlO31cIixcclxuICAgICAgICBleHBlY3Q6IHsgZjogeyBwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKSB9LFxyXG4gICAgICAgICAgICAgICAgICBnOiB7IHBhcmFtczogW10sIGJvZHk6IGFzdC5ib29sZWFuKGZhbHNlKSB9IH1cclxuICAgICAgfVxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICB2YXIgcmVzdWx0ID0gcGFyc2UoZGF0YSk7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwocmVzdWx0LmZ1bmN0aW9ucywgZXhwZWN0KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIkxpdGVyYWxzXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICBbIFwidHJ1ZVwiLCBhc3QuYm9vbGVhbih0cnVlKSBdLFxyXG4gICAgICBbIFwiZmFsc2VcIiwgYXN0LmJvb2xlYW4oZmFsc2UpIF0sXHJcbiAgICAgIFsgXCJudWxsXCIsIGFzdC5udWxsVHlwZSgpIF0sXHJcbiAgICAgIFsgXCIxXCIsIGFzdC5udW1iZXIoMSkgXSxcclxuICAgICAgWyBcIjEuMVwiLCBhc3QubnVtYmVyKDEuMSkgXSxcclxuICAgICAgWyBcIiszXCIsIGFzdC5udW1iZXIoMykgXSxcclxuICAgICAgWyBcIi0zXCIsIGFzdC5udW1iZXIoLTMpIF0sXHJcbiAgICAgIFsgXCIweDJcIiwgYXN0Lm51bWJlcigyKSBdLFxyXG4gICAgICBbIFwiWzEsIDIsIDNdXCIsIGFzdC5hcnJheShbYXN0Lm51bWJlcigxKSwgYXN0Lm51bWJlcigyKSwgYXN0Lm51bWJlcigzKV0pIF0sXHJcbiAgICAgIFsgXCJcXFwic3RyaW5nXFxcIlwiLCBhc3Quc3RyaW5nKFwic3RyaW5nXCIpIF0sXHJcbiAgICAgIFsgXCInc3RyaW5nJ1wiLCBhc3Quc3RyaW5nKFwic3RyaW5nXCIpIF0sXHJcbiAgICAgIFsgXCInJ1wiLCBhc3Quc3RyaW5nKCcnKSBdLFxyXG4gICAgICBbIFwiL3BhdHRlcm4vXCIsIGFzdC5yZWdleHAoXCJwYXR0ZXJuXCIpIF0sXHJcbiAgICAgIFsgXCIvcGF0dGVybi9pXCIsIGFzdC5yZWdleHAoXCJwYXR0ZXJuXCIsIFwiaVwiKSBdLFxyXG4gICAgICBbIFwiL3BhdFxcXFxudGVybi9cIiwgYXN0LnJlZ2V4cChcInBhdFxcXFxudGVyblwiKSBdLFxyXG4gICAgICBbIFwiL3BhdFxcXFwvdGVybi9cIiwgYXN0LnJlZ2V4cChcInBhdFxcXFwvdGVyblwiKSBdLFxyXG4gICAgICBbIFwiL3BhdFxcXFx0ZXJuL1wiLCBhc3QucmVnZXhwKFwicGF0XFxcXHRlcm5cIikgXSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHJlc3VsdCA9IHBhcnNlKFwiZnVuY3Rpb24gZigpIHsgcmV0dXJuIFwiICsgZGF0YSArIFwiO31cIik7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwocmVzdWx0LmZ1bmN0aW9ucy5mLmJvZHksIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJFeHByZXNzaW9uc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgWyBcImFcIiwgYXN0LnZhcmlhYmxlKCdhJykgXSxcclxuICAgICAgWyBcImEuYlwiLCBhc3QucmVmZXJlbmNlKGFzdC52YXJpYWJsZSgnYScpLCBhc3Quc3RyaW5nKCdiJykpIF0sXHJcbiAgICAgIFsgXCJhWydiJ11cIiwgYXN0LnJlZmVyZW5jZShhc3QudmFyaWFibGUoJ2EnKSwgYXN0LnN0cmluZygnYicpKSBdLFxyXG4gICAgICBbIFwiYVtiXVwiLCBhc3QucmVmZXJlbmNlKGFzdC52YXJpYWJsZSgnYScpLCBhc3QudmFyaWFibGUoJ2InKSkgXSxcclxuICAgICAgWyBcImEoKVwiLCBhc3QuY2FsbChhc3QudmFyaWFibGUoJ2EnKSwgW10pIF0sXHJcbiAgICAgIFsgXCJhLmIoKVwiLCBhc3QuY2FsbChhc3QucmVmZXJlbmNlKGFzdC52YXJpYWJsZSgnYScpLCBhc3Quc3RyaW5nKCdiJykpLCBbXSkgXSxcclxuICAgICAgWyBcImEoKS5iXCIsIGFzdC5yZWZlcmVuY2UoYXN0LmNhbGwoYXN0LnZhcmlhYmxlKCdhJyksIFtdKSwgYXN0LnN0cmluZygnYicpKSBdLFxyXG4gICAgICBbIFwiLWFcIiwgYXN0Lm5lZyhhc3QudmFyaWFibGUoJ2EnKSkgXSxcclxuICAgICAgLy8gVE9ETzogVGhpcyBzaG91bGQgYmUgYW4gZXJyb3IgLSBsb29rcyBsaWtlIHByZS1kZWNyZW1lbnRcclxuICAgICAgWyBcIi0tYVwiLCBhc3QubmVnKGFzdC5uZWcoYXN0LnZhcmlhYmxlKCdhJykpKSBdLFxyXG4gICAgICBbIFwiK2FcIiwgYXN0LnZhcmlhYmxlKCdhJykgXSxcclxuICAgICAgWyBcIiFhXCIsIGFzdC5ub3QoYXN0LnZhcmlhYmxlKCdhJykpIF0sXHJcbiAgICAgIFsgXCIyICogYVwiLCBhc3QubXVsdChhc3QubnVtYmVyKDIpLCBhc3QudmFyaWFibGUoJ2EnKSkgXSxcclxuICAgICAgWyBcIjIgLyBhXCIsIGFzdC5kaXYoYXN0Lm51bWJlcigyKSwgYXN0LnZhcmlhYmxlKCdhJykpIF0sXHJcbiAgICAgIFsgXCJhICUgMlwiLCBhc3QubW9kKGFzdC52YXJpYWJsZSgnYScpLCBhc3QubnVtYmVyKDIpKSBdLFxyXG4gICAgICBbIFwiMSArIDFcIiwgYXN0LmFkZChhc3QubnVtYmVyKDEpLCBhc3QubnVtYmVyKDEpKSBdLFxyXG4gICAgICBbIFwiYSAtIDFcIiwgYXN0LnN1Yihhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcigxKSkgXSxcclxuICAgICAgLy8gVW5hcnkgcHJlY2VkZW5jZVxyXG4gICAgICBbIFwiYSAtIC1iXCIsIGFzdC5zdWIoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC5uZWcoYXN0LnZhcmlhYmxlKCdiJykpKSBdLFxyXG4gICAgICAvLyBMZWZ0IGFzc29jaWF0aXZlXHJcbiAgICAgIFsgXCJhICsgYiArIGNcIiwgYXN0LmFkZChhc3QuYWRkKGFzdC52YXJpYWJsZSgnYScpLCBhc3QudmFyaWFibGUoJ2InKSksIGFzdC52YXJpYWJsZSgnYycpKSBdLFxyXG4gICAgICAvLyBNdWx0aXBsY2F0aW9uIHByZWNlZGVuY2VcclxuICAgICAgWyBcImEgKyBiICogY1wiLCBhc3QuYWRkKGFzdC52YXJpYWJsZSgnYScpLCBhc3QubXVsdChhc3QudmFyaWFibGUoJ2InKSwgYXN0LnZhcmlhYmxlKCdjJykpKSBdLFxyXG4gICAgICBbIFwiKGEgKyBiKSAqIGNcIiwgYXN0Lm11bHQoYXN0LmFkZChhc3QudmFyaWFibGUoJ2EnKSwgYXN0LnZhcmlhYmxlKCdiJykpLCBhc3QudmFyaWFibGUoJ2MnKSkgXSxcclxuICAgICAgWyBcImEgPCA3XCIsIGFzdC5sdChhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcig3KSkgXSxcclxuICAgICAgWyBcImEgPiA3XCIsIGFzdC5ndChhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcig3KSkgXSxcclxuICAgICAgWyBcImEgPD0gN1wiLCBhc3QubHRlKGFzdC52YXJpYWJsZSgnYScpLCBhc3QubnVtYmVyKDcpKSBdLFxyXG4gICAgICBbIFwiYSA+PSA3XCIsIGFzdC5ndGUoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC5udW1iZXIoNykpIF0sXHJcbiAgICAgIFsgXCJhID09IDNcIiwgYXN0LmVxKGFzdC52YXJpYWJsZSgnYScpLCBhc3QubnVtYmVyKDMpKSBdLFxyXG4gICAgICBbIFwiYSAhPSAwXCIsIGFzdC5uZShhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcigwKSkgXSxcclxuICAgICAgWyBcImEgPT09IDNcIiwgYXN0LmVxKGFzdC52YXJpYWJsZSgnYScpLCBhc3QubnVtYmVyKDMpKSBdLFxyXG4gICAgICBbIFwiYSAhPT0gMFwiLCBhc3QubmUoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC5udW1iZXIoMCkpIF0sXHJcbiAgICAgIFsgXCIzICogYSA9PSBiXCIsIGFzdC5lcShhc3QubXVsdChhc3QubnVtYmVyKDMpLCBhc3QudmFyaWFibGUoJ2EnKSksIGFzdC52YXJpYWJsZSgnYicpKSBdLFxyXG4gICAgICBbIFwiYSA9PSAxICYmIGIgPD0gMlwiLCBhc3QuYW5kKGFzdC5lcShhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcigxKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5sdGUoYXN0LnZhcmlhYmxlKCdiJyksIGFzdC5udW1iZXIoMikpKSBdLFxyXG4gICAgICBbIFwiYSA9PSAxIHx8IGIgPD0gMlwiLCBhc3Qub3IoYXN0LmVxKGFzdC52YXJpYWJsZSgnYScpLCBhc3QubnVtYmVyKDEpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QubHRlKGFzdC52YXJpYWJsZSgnYicpLCBhc3QubnVtYmVyKDIpKSkgXSxcclxuICAgICAgLy8gTGVmdCBhc3NvY2lhdGl2ZSAoZXZlbiB0aG91Z2ggZXhlY3V0aW9uIGlzIHNob3J0LWNpcmN1aXRlZCFcclxuICAgICAgWyBcImEgJiYgYiAmJiBjXCIsIGFzdC5hbmQoYXN0LmFuZChhc3QudmFyaWFibGUoJ2EnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnZhcmlhYmxlKCdiJykpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnZhcmlhYmxlKCdjJykpIF0sXHJcbiAgICAgIFsgXCJhIHx8IGIgfHwgY1wiLCBhc3Qub3IoYXN0Lm9yKGFzdC52YXJpYWJsZSgnYScpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnZhcmlhYmxlKCdiJykpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QudmFyaWFibGUoJ2MnKSkgXSxcclxuICAgICAgLy8gJiYgb3ZlciB8fCBwcmVjZW5kZW5jZVxyXG4gICAgICBbIFwiYSAmJiBiIHx8IGMgJiYgZFwiLCBhc3Qub3IoYXN0LmFuZChhc3QudmFyaWFibGUoJ2EnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC52YXJpYWJsZSgnYicpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuYW5kKGFzdC52YXJpYWJsZSgnYycpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnZhcmlhYmxlKCdkJykpKSBdLFxyXG4gICAgICBbIFwiYSA/IGIgOiBjXCIsIGFzdC50ZXJuYXJ5KGFzdC52YXJpYWJsZSgnYScpLCBhc3QudmFyaWFibGUoJ2InKSwgYXN0LnZhcmlhYmxlKCdjJykpIF0sXHJcbiAgICAgIFsgXCJhIHx8IGIgPyBjIDogZFwiLCBhc3QudGVybmFyeShhc3Qub3IoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC52YXJpYWJsZSgnYicpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QudmFyaWFibGUoJ2MnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QudmFyaWFibGUoJ2QnKSkgXSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHJlc3VsdCA9IHBhcnNlKFwiZnVuY3Rpb24gZigpIHsgcmV0dXJuIFwiICsgZGF0YSArIFwiO31cIik7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwocmVzdWx0LmZ1bmN0aW9ucy5mLmJvZHksIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJXaGl0ZXNwYWNlXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGZuID0gXCJmdW5jdGlvbiBmKCkgeyByZXR1cm4gdHJ1ZTsgfVwiO1xyXG4gICAgdmFyIGZuQVNUOiBhc3QuTWV0aG9kID0geyBwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKSB9O1xyXG5cclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgXCIgXCIgKyBmbixcclxuICAgICAgZm4gKyBcIiBcIixcclxuICAgICAgXCIgXCIgKyBmbiArIFwiIFwiLFxyXG4gICAgICBcIlxcdFwiICsgZm4sXHJcbiAgICAgIFwiXFxuXCIgKyBmbixcclxuICAgICAgXCJcXHJcXG5cIiArIGZuLFxyXG4gICAgICBmbiArIFwiXFxuXCIsXHJcbiAgICAgIGZuICsgXCJcXHJcXG5cIixcclxuICAgICAgXCIgIFxcdFwiICsgZm4gKyBcIiAgXFxyXFxuXCJcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwocGFyc2UoZGF0YSkuZnVuY3Rpb25zLmYsIGZuQVNUKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIkNvbW1lbnRzXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGZuID0gXCJmdW5jdGlvbiBmKCkgeyByZXR1cm4gdHJ1ZTsgfVwiO1xyXG4gICAgdmFyIGZuQVNUOiBhc3QuTWV0aG9kID0geyBwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKSB9O1xyXG5cclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgXCIvL1NpbmdsZSBMaW5lXFxuXCIgKyBmbixcclxuICAgICAgZm4gKyBcIiAvLyBNeSBydWxlXCIsXHJcbiAgICAgIFwiLy8gTGluZSAxXFxuLy8gTGluZSAyXFxuXCIgKyBmbixcclxuICAgICAgXCIvKiBpbmxpbmUgKi8gXCIgKyBmbixcclxuICAgICAgXCIvKiBwcmUgKi8gXCIgKyBmbiArIFwiIC8qIHBvc3QgKi9cIlxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHBhcnNlKGRhdGEpLmZ1bmN0aW9ucy5mLCBmbkFTVCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJQYXRoc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0czogaGVscGVyLk9iamVjdFNwZWNbXSA9IFtcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7fVwiLFxyXG4gICAgICAgIGV4cGVjdDogW3sgdGVtcGxhdGU6IG5ldyBhc3QuUGF0aFRlbXBsYXRlKCksXHJcbiAgICAgICAgICAgICAgICAgICBpc1R5cGU6IGFzdC50eXBlVHlwZSgnQW55JyksXHJcbiAgICAgICAgICAgICAgICAgICBtZXRob2RzOiB7fSB9XSB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAveCB7fVwiLFxyXG4gICAgICAgIGV4cGVjdDogW3sgdGVtcGxhdGU6IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFsneCddKSxcclxuICAgICAgICAgICAgICAgICAgIGlzVHlwZTogYXN0LnR5cGVUeXBlKCdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9IH1dIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC9wL3skcX0geyB3cml0ZSgpIHsgcmV0dXJuIHRydWU7ICB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogW3sgaXNUeXBlOiBhc3QudHlwZVR5cGUoJ0FueScpLFxyXG4gICAgICAgICAgICAgICAgICAgdGVtcGxhdGU6IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFsncCcsICckcSddKSxcclxuICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt3cml0ZToge3BhcmFtczogW10sIGJvZHk6IGFzdC5ib29sZWFuKHRydWUpfX19XSB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvcC97cX0geyB3cml0ZSgpIHsgcmV0dXJuIHRydWU7ICB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogW3sgaXNUeXBlOiBhc3QudHlwZVR5cGUoJ0FueScpLFxyXG4gICAgICAgICAgICAgICAgICAgdGVtcGxhdGU6IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFsncCcsIG5ldyBhc3QuUGF0aFBhcnQoJyRxJywgJ3EnKV0pLFxyXG4gICAgICAgICAgICAgICAgICAgbWV0aG9kczoge3dyaXRlOiB7cGFyYW1zOiBbXSwgYm9keTogYXN0LmJvb2xlYW4odHJ1ZSl9fX1dIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94L3kgeyByZWFkKCkgeyB0cnVlIH0gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogW3sgaXNUeXBlOiBhc3QudHlwZVR5cGUoJ0FueScpLFxyXG4gICAgICAgICAgICAgICAgICAgdGVtcGxhdGU6IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFsneCcsICd5J10pLFxyXG4gICAgICAgICAgICAgICAgICAgbWV0aG9kczoge3JlYWQ6IHtwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKX19fV0gfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3ggeyByZWFkKCkgeyB0cnVlIH0gL3kgeyB3cml0ZSgpIHsgdHJ1ZSB9IH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiBbeyBpc1R5cGU6IGFzdC50eXBlVHlwZSgnQW55JyksXHJcbiAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZTogbmV3IGFzdC5QYXRoVGVtcGxhdGUoWyd4J10pLFxyXG4gICAgICAgICAgICAgICAgICAgbWV0aG9kczoge3JlYWQ6IHtwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKX19fSxcclxuICAgICAgICAgICAgICAgICB7IGlzVHlwZTogYXN0LnR5cGVUeXBlKCdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlOiBuZXcgYXN0LlBhdGhUZW1wbGF0ZShbJ3gnLCAneSddKSxcclxuICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt3cml0ZToge3BhcmFtczogW10sIGJvZHk6IGFzdC5ib29sZWFuKHRydWUpfX19XSB9LFxyXG5cclxuICAgICAgeyBkYXRhOiBcInBhdGggL3ggeyByZWFkKCkgeyB0cnVlIH0gL3kgeyB3cml0ZSgpIHsgdHJ1ZSB9IHBhdGggL3skaWR9IHsgdmFsaWRhdGUoKSB7IGZhbHNlIH0gfX19XCIsXHJcbiAgICAgICAgZXhwZWN0OiBbeyBpc1R5cGU6IGFzdC50eXBlVHlwZSgnQW55JyksXHJcbiAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZTogbmV3IGFzdC5QYXRoVGVtcGxhdGUoWyd4J10pLFxyXG4gICAgICAgICAgICAgICAgICAgbWV0aG9kczoge3JlYWQ6IHtwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKX19fSxcclxuICAgICAgICAgICAgICAgICB7IGlzVHlwZTogYXN0LnR5cGVUeXBlKCdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlOiBuZXcgYXN0LlBhdGhUZW1wbGF0ZShbJ3gnLCAneSddKSxcclxuICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt3cml0ZToge3BhcmFtczogW10sIGJvZHk6IGFzdC5ib29sZWFuKHRydWUpfX19LFxyXG4gICAgICAgICAgICAgICAgIHsgaXNUeXBlOiBhc3QudHlwZVR5cGUoJ0FueScpLFxyXG4gICAgICAgICAgICAgICAgICAgdGVtcGxhdGU6IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFsneCcsICd5JywgJyRpZCddKSxcclxuICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt2YWxpZGF0ZToge3BhcmFtczogW10sIGJvZHk6IGFzdC5ib29sZWFuKGZhbHNlKX19fSxcclxuICAgICAgICAgICAgICAgIF0gfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL2h5cGhlbi1rZXkge31cIixcclxuICAgICAgICBleHBlY3Q6IFsgeyB0ZW1wbGF0ZTogbmV3IGFzdC5QYXRoVGVtcGxhdGUoWydoeXBoZW4ta2V5J10pLFxyXG4gICAgICAgICAgICAgICAgICAgIGlzVHlwZTogYXN0LnR5cGVUeXBlKCdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgICBtZXRob2RzOiB7fSB9XSB9LFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHNvcnRQYXRocyhwYXJzZShkYXRhKS5wYXRocyksIHNvcnRQYXRocyhleHBlY3QpKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlNjaGVtYVwiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0czogaGVscGVyLk9iamVjdFNwZWNbXSA9IFtcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgYTogTnVtYmVyIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHthOiBhc3QudHlwZVR5cGUoJ051bWJlcicpfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgYTogTnVtYmVyLCBiOiBTdHJpbmcgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBkZXJpdmVkRnJvbTogYXN0LnR5cGVUeXBlKCdPYmplY3QnKSxcclxuICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge2E6IGFzdC50eXBlVHlwZSgnTnVtYmVyJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiOiBhc3QudHlwZVR5cGUoJ1N0cmluZycpfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIGV4dGVuZHMgQmFyIHt9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ0JhcicpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgYTogTnVtYmVyIHZhbGlkYXRlKCkgeyByZXR1cm4gdHJ1ZTsgfX1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHthOiBhc3QudHlwZVR5cGUoJ051bWJlcicpfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge3ZhbGlkYXRlOiB7cGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogYXN0LmJvb2xlYW4odHJ1ZSl9fSxcclxuICAgICAgICAgICAgICAgICAgcGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgIH19LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBGb28geyBhOiBOdW1iZXIsIHZhbGlkYXRlKCkgeyByZXR1cm4gdHJ1ZTsgfX1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHthOiBhc3QudHlwZVR5cGUoJ051bWJlcicpfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge3ZhbGlkYXRlOiB7cGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogYXN0LmJvb2xlYW4odHJ1ZSl9fSxcclxuICAgICAgICAgICAgICAgICAgcGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgIH19LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBGb28geyBhOiBOdW1iZXIgfCBTdHJpbmcgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBkZXJpdmVkRnJvbTogYXN0LnR5cGVUeXBlKCdPYmplY3QnKSxcclxuICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge2E6IGFzdC51bmlvblR5cGUoW2FzdC50eXBlVHlwZSgnTnVtYmVyJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QudHlwZVR5cGUoJ1N0cmluZycpXSl9LFxyXG4gICAgICAgICAgICAgICAgICBtZXRob2RzOiB7fSxcclxuICAgICAgICAgICAgICAgICAgcGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgIH19LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBGb28gZXh0ZW5kcyBOdW1iZXIgfCBTdHJpbmc7XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudW5pb25UeXBlKFthc3QudHlwZVR5cGUoJ051bWJlcicpLCBhc3QudHlwZVR5cGUoJ1N0cmluZycpXSksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBtZXRob2RzOiB7fSxcclxuICAgICAgICAgICAgICAgICAgcGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgIH19LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBGb28geyBhOiBNYXA8U3RyaW5nLCBOdW1iZXI+IH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHthOiBhc3QuZ2VuZXJpY1R5cGUoJ01hcCcsIFthc3QudHlwZVR5cGUoJ1N0cmluZycpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnR5cGVUeXBlKCdOdW1iZXInKV0pfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIGV4dGVuZHMgTWFwPFN0cmluZywgTnVtYmVyPjtcIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC5nZW5lcmljVHlwZSgnTWFwJywgW2FzdC50eXBlVHlwZSgnU3RyaW5nJyksIGFzdC50eXBlVHlwZSgnTnVtYmVyJyldKSxcclxuICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge30sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfX0sXHJcbiAgICAgIC8vIEFsaWFzIGZvciBNYXA8U3RyaW5nLCBPdGhlcj5cclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgYTogT3RoZXJbXSB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ09iamVjdCcpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7YTogYXN0LmdlbmVyaWNUeXBlKCdNYXAnLCBbYXN0LnR5cGVUeXBlKCdTdHJpbmcnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC50eXBlVHlwZSgnT3RoZXInKV0pfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyB7IGE6IE11bHRpPFN0cmluZywgTnVtYmVyLCBCb29sZWFuPiB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ09iamVjdCcpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7YTogYXN0LmdlbmVyaWNUeXBlKCdNdWx0aScsIFthc3QudHlwZVR5cGUoJ1N0cmluZycpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QudHlwZVR5cGUoJ051bWJlcicpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QudHlwZVR5cGUoJ0Jvb2xlYW4nKV0pfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgYTogR2VuMTxTdHJpbmc+IH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHthOiBhc3QuZ2VuZXJpY1R5cGUoJ0dlbjEnLCBbYXN0LnR5cGVUeXBlKCdTdHJpbmcnKV0pfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbzxUPiB7IGE6IFQgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBkZXJpdmVkRnJvbTogYXN0LnR5cGVUeXBlKCdPYmplY3QnKSxcclxuICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge2E6IGFzdC50eXBlVHlwZSgnVCcpfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW1wiVFwiXSxcclxuICAgICAgICAgICAgICAgIH19LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBGb28geyBuYW1lOiBTdHJpbmcsIGFnZTogTnVtYmVyIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtuYW1lOiBhc3QudHlwZVR5cGUoJ1N0cmluZycpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWdlOiBhc3QudHlwZVR5cGUoJ051bWJlcicpfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgbmFtZTogU3RyaW5nOyBhZ2U6IE51bWJlcjsgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBkZXJpdmVkRnJvbTogYXN0LnR5cGVUeXBlKCdPYmplY3QnKSxcclxuICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge25hbWU6IGFzdC50eXBlVHlwZSgnU3RyaW5nJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZ2U6IGFzdC50eXBlVHlwZSgnTnVtYmVyJyl9LFxyXG4gICAgICAgICAgICAgICAgICBtZXRob2RzOiB7fSxcclxuICAgICAgICAgICAgICAgICAgcGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgIH19LFxyXG5cclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgJ2h5cGhlbi1wcm9wJzogU3RyaW5nIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcImh5cGhlbi1wcm9wXCI6IGFzdC50eXBlVHlwZSgnU3RyaW5nJyl9LFxyXG4gICAgICAgICAgICAgICAgICBtZXRob2RzOiB7fSxcclxuICAgICAgICAgICAgICAgICAgcGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgIH19LFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICB2YXIgcmVzdWx0ID0gcGFyc2UoZGF0YSkuc2NoZW1hLkZvbztcclxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbChyZXN1bHQsIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJGdW5jdGlvbiB2YXJpYXRpb25zXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICBcImZ1bmN0aW9uIGYoeCkgeyByZXR1cm4geCArIDE7IH1cIixcclxuICAgICAgXCJmdW5jdGlvbiBmKHgpIHsgcmV0dXJuIHggKyAxIH1cIixcclxuICAgICAgXCJmdW5jdGlvbiBmKHgpIHsgeCArIDE7IH1cIixcclxuICAgICAgXCJmdW5jdGlvbiBmKHgpIHsgeCArIDEgfVwiLFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICB2YXIgcmVzdWx0ID0gcGFyc2UoZGF0YSk7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwocmVzdWx0LmZ1bmN0aW9ucy5mLmJvZHksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgYXN0LmFkZChhc3QudmFyaWFibGUoJ3gnKSwgYXN0Lm51bWJlcigxKSkpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiTWV0aG9kIHZhcmlhdGlvbnNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIFwidmFsaWRhdGUoKSB7IHJldHVybiB0aGlzOyB9XCIsXHJcbiAgICAgIFwidmFsaWRhdGUoKSB7IHJldHVybiB0aGlzICB9XCIsXHJcbiAgICAgIFwidmFsaWRhdGUoKSB7IHRoaXM7IH1cIixcclxuICAgICAgXCJ2YWxpZGF0ZSgpIHsgdGhpcyB9XCIsXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSBwYXJzZShcInR5cGUgVCB7XCIgKyBkYXRhICsgXCJ9XCIpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC5zY2hlbWEuVC5tZXRob2RzLnZhbGlkYXRlLmJvZHksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgYXN0LnZhcmlhYmxlKCd0aGlzJykpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiUGF0aCB2YXJpYXRpb25zXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICBcInBhdGggL3Ave2N9IHt9XCIsXHJcbiAgICAgIFwiL3Ave2N9IHt9XCIsXHJcbiAgICAgIFwiL3Ave2N9O1wiLFxyXG4gICAgICBcInBhdGggL3Ave2N9IGlzIFN0cmluZyB7fVwiLFxyXG4gICAgICBcInBhdGggL3Ave2N9IGlzIFN0cmluZztcIixcclxuICAgICAgXCIvcC97Y30gaXMgU3RyaW5nIHt9XCIsXHJcbiAgICAgIFwiL3Ave2N9IGlzIFN0cmluZztcIixcclxuICAgICAgXCIvcC97Yz0qfSBpcyBTdHJpbmc7XCIsXHJcbiAgICAgIFwiL3Ave2MgPSAqfSBpcyBTdHJpbmc7XCIsXHJcbiAgICAgIFwiL3Ave2N9IHsgdmFsaWRhdGUoKSB7IHJldHVybiB0cnVlOyB9IH1cIixcclxuICAgICAgXCIvcC97Y30geyB2YWxpZGF0ZSgpIHsgcmV0dXJuIHRydWUgfSB9XCIsXHJcbiAgICAgIFwiL3Ave2N9IHsgdmFsaWRhdGUoKSB7IHRydWUgfSB9XCIsXHJcbiAgICAgIFwiL3Ave2N9IHsgdmFsaWRhdGUoKSB7IHRydWU7IH0gfVwiLFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICB2YXIgcmVzdWx0ID0gcGFyc2UoZGF0YSk7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwocmVzdWx0LnBhdGhzWzBdLnRlbXBsYXRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgIG5ldyBhc3QuUGF0aFRlbXBsYXRlKFsncCcsIG5ldyBhc3QuUGF0aFBhcnQoJyRjJywgJ2MnKV0pKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlR5cGUgdmFyaWF0aW9uc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgXCJ0eXBlIFQgZXh0ZW5kcyBBbnkge31cIixcclxuICAgICAgXCJ0eXBlIFQgZXh0ZW5kcyBBbnk7XCIsXHJcbiAgICAgIFwidHlwZSBUIHt9XCIsXHJcbiAgICAgIFwidHlwZSBUO1wiXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSBwYXJzZShkYXRhKTtcclxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbChyZXN1bHQuc2NoZW1hLlQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgeyBkZXJpdmVkRnJvbTogYXN0LnR5cGVUeXBlKCdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge30sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiU2FtcGxlIGZpbGVzXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHNhbXBsZXMsIGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgICAgdmFyIGZpbGVuYW1lID0gJ3NhbXBsZXMvJyArIGRhdGEgKyAnLicgKyBib2x0LkZJTEVfRVhURU5TSU9OO1xyXG4gICAgICByZXR1cm4gcmVhZEZpbGUoZmlsZW5hbWUpXHJcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcclxuICAgICAgICAgIHZhciByZXN1bHQgPSBwYXJzZShyZXNwb25zZS5jb250ZW50KTtcclxuICAgICAgICAgIGFzc2VydC5vayhyZXN1bHQsIHJlc3BvbnNlLnVybCk7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlBhcnNlciBFcnJvcnNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94L3kvIGlzIFN0cmluZztcIixcclxuICAgICAgICBleHBlY3Q6IC9lbmQgaW4gYSBzbGFzaC8gfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3gvL3kgaXMgU3RyaW5nO1wiLFxyXG4gICAgICAgIGV4cGVjdDogL2VtcHR5IHBhcnQvIH0sXHJcbiAgICAgIC8vIEJVRzogRm9sbG93aW5nIGVycm9ycyBzaG91bGQgZXhwZWN0IC9lbXB0eSBwYXJ0LyAtIFBFRyBwYXJzZXIgZXJyb3I/XHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8veCBpcyBTdHJpbmc7XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvLi8gfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLy8gaXMgU3RyaW5nO1wiLFxyXG4gICAgICAgIGV4cGVjdDogLy4vIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94IHsgdmFsaWRhdGUoKSB7IHJldHVybiB0aGlzLnRlc3QoL2EvZyk7IH0gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogL3Vuc3VwcG9ydGVkIHJlZ2V4cCBtb2RpZmllci9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIHt9XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvbWlzc2luZyBwYXRoIHRlbXBsYXRlL2kgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvbWlzc2luZyBib2R5IG9mIHBhdGgvaSB9LFxyXG4gICAgICB7IGRhdGE6IFwiZnVuY3Rpb24gZm9vIHsgNyB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvbWlzc2luZyBwYXJhbWV0ZXJzL2kgfSxcclxuICAgICAgeyBkYXRhOiBcImZvbyB7IDcgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogL2V4cGVjdGVkLipmdW5jdGlvbi9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJmb28oeClcIixcclxuICAgICAgICBleHBlY3Q6IC9taXNzaW5nLipib2R5L2kgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3ggeyBmb28oeCk7IH1cIixcclxuICAgICAgICBleHBlY3Q6IC9pbnZhbGlkIHBhdGggb3IgbWV0aG9kL2kgfSxcclxuICAgICAgeyBkYXRhOiBcImZvbyh4KSB7IHggPSAnYScgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogL2VxdWFsaXR5L2kgfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgWCB7IGJhZC1wcm9wOiBTdHJpbmc7IH1cIixcclxuICAgICAgICBleHBlY3Q6IC9pbnZhbGlkIHByb3BlcnR5IG9yIG1ldGhvZC9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIHsgZm9vOiBTdHJpbmc7fVwiLFxyXG4gICAgICAgIGV4cGVjdDogL21pc3NpbmcgdHlwZSBuYW1lL2kgfSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBwYXJzZShkYXRhKTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGFzc2VydC5tYXRjaChlLm1lc3NhZ2UsIGV4cGVjdCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGFzc2VydC5mYWlsKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBcIk5vIGV4Y2VwdGlvbiB0aHJvd24uXCIpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiU3ludGF4IHdhcm5pbmdzLlwiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3ggeyByZWFkKCkgeyB0cnVlIH07IH1cIixcclxuICAgICAgICBleHBlY3Q6IC9leHRyYSBzZXBhcmF0b3IvaSB9LFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICBwYXJzZShkYXRhKTtcclxuICAgICAgYXNzZXJ0Lm1hdGNoKGxvZ2dlci5nZXRMYXN0TWVzc2FnZSgpLCBleHBlY3QpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiRGVwcmVjYXRpb24gd2FybmluZ3MuXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICB7IGRhdGE6IFwicGF0aCAveC8keSBpcyBTdHJpbmc7XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvcGF0aCBzZWdtZW50IGlzIGRlcHJlY2F0ZWQvIH0sXHJcbiAgICAgIHsgZGF0YTogXCJmKHgpID0geCArIDE7XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvZm5cXCh4XFwpID0gZXhwOyBmb3JtYXQgaXMgZGVwcmVjYXRlZC8gfSxcclxuICAgICAgeyBkYXRhOiBcImYoeCkgPSB4ICsgMVwiLFxyXG4gICAgICAgIGV4cGVjdDogL2ZuXFwoeFxcKSA9IGV4cDsgZm9ybWF0IGlzIGRlcHJlY2F0ZWQvIH0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHBhcnNlKGRhdGEpO1xyXG4gICAgICBhc3NlcnQubWF0Y2gobG9nZ2VyLmdldExhc3RNZXNzYWdlKCksIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxufSk7XHJcblxyXG5mdW5jdGlvbiBzb3J0UGF0aHMocGF0aHM6IGFzdC5QYXRoW10pOiBhc3QuUGF0aFtdIHtcclxuICBmdW5jdGlvbiBjbXBTdHIoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiBudW1iZXIge1xyXG4gICAgaWYgKGEgPCBiKSB7XHJcbiAgICAgIHJldHVybiAtMTtcclxuICAgIH1cclxuICAgIGlmIChhID4gYikge1xyXG4gICAgICByZXR1cm4gMTtcclxuICAgIH1cclxuICAgIHJldHVybiAwO1xyXG4gIH1cclxuXHJcbiAgcGF0aHMuc29ydCgoYSwgYikgPT4ge1xyXG4gICAgcmV0dXJuIGNtcFN0cihhLnRlbXBsYXRlLmdldExhYmVscygpLmpvaW4oJ34nKSwgYi50ZW1wbGF0ZS5nZXRMYWJlbHMoKS5qb2luKCd+JykpO1xyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gcGF0aHM7XHJcbn1cclxuIl19
