"use strict";
/*
 * AST builders for Firebase Rules Language.
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
var util = require('./util');
var logger = require('./logger');
var errors = {
    typeMismatch: "Unexpected type: ",
    duplicatePathPart: "A path component name is duplicated: "
};
;
;
var PathPart = (function () {
    // "label", undefined - static path part
    // "$label", X - variable path part
    // X, !undefined - variable path part
    function PathPart(label, variable) {
        if (label[0] === '$' && variable === undefined) {
            variable = label;
        }
        if (variable && label[0] !== '$') {
            label = '$' + label;
        }
        this.label = label;
        this.variable = variable;
    }
    return PathPart;
}());
exports.PathPart = PathPart;
var PathTemplate = (function () {
    function PathTemplate(parts) {
        if (parts === void 0) { parts = []; }
        this.parts = parts.map(function (part) {
            if (util.isType(part, 'string')) {
                return new PathPart(part);
            }
            else {
                return part;
            }
        });
    }
    PathTemplate.prototype.copy = function () {
        var result = new PathTemplate();
        result.push(this);
        return result;
    };
    PathTemplate.prototype.getLabels = function () {
        return this.parts.map(function (part) { return part.label; });
    };
    // Mapping from variables to JSON labels
    PathTemplate.prototype.getScope = function () {
        var result = {};
        this.parts.forEach(function (part) {
            if (part.variable) {
                if (result[part.variable]) {
                    throw new Error(errors.duplicatePathPart + part.variable);
                }
                result[part.variable] = literal(part.label);
            }
        });
        return result;
    };
    PathTemplate.prototype.push = function (temp) {
        util.extendArray(this.parts, temp.parts);
    };
    PathTemplate.prototype.pop = function (temp) {
        var _this = this;
        temp.parts.forEach(function (part) {
            _this.parts.pop();
        });
    };
    PathTemplate.prototype.length = function () {
        return this.parts.length;
    };
    PathTemplate.prototype.getPart = function (i) {
        if (i > this.parts.length || i < -this.parts.length) {
            var l = this.parts.length;
            throw new Error("Path reference out of bounds: " + i +
                " [" + -l + " .. " + l + "]");
        }
        if (i < 0) {
            return this.parts[this.parts.length + i];
        }
        return this.parts[i];
    };
    return PathTemplate;
}());
exports.PathTemplate = PathTemplate;
;
var Schema = (function () {
    function Schema() {
    }
    Schema.isGeneric = function (schema) {
        return schema.params !== undefined && schema.params.length > 0;
    };
    return Schema;
}());
exports.Schema = Schema;
;
exports.string = valueGen('String');
exports.boolean = valueGen('Boolean');
exports.number = valueGen('Number');
exports.array = valueGen('Array');
exports.neg = opGen('neg', 1);
exports.not = opGen('!', 1);
exports.mult = opGen('*');
exports.div = opGen('/');
exports.mod = opGen('%');
exports.add = opGen('+');
exports.sub = opGen('-');
exports.eq = opGen('==');
exports.lt = opGen('<');
exports.lte = opGen('<=');
exports.gt = opGen('>');
exports.gte = opGen('>=');
exports.ne = opGen('!=');
exports.and = opGen('&&');
exports.or = opGen('||');
exports.ternary = opGen('?:', 3);
exports.value = opGen('value', 1);
function variable(name) {
    return { type: 'var', valueType: 'Any', name: name };
}
exports.variable = variable;
function literal(name) {
    return { type: 'literal', valueType: 'Any', name: name };
}
exports.literal = literal;
function nullType() {
    return { type: 'Null', valueType: 'Null' };
}
exports.nullType = nullType;
function reference(base, prop) {
    return {
        type: 'ref',
        valueType: 'Any',
        base: base,
        accessor: prop
    };
}
exports.reference = reference;
var reIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_]*$/;
function isIdentifierStringExp(exp) {
    return exp.type === 'String' && reIdentifier.test(exp.value);
}
exports.isIdentifierStringExp = isIdentifierStringExp;
// Shallow copy of an expression (so it can be modified and preserve
// immutability of the original expression).
function copyExp(exp) {
    exp = util.extend({}, exp);
    switch (exp.type) {
        case 'op':
        case 'call':
            var opExp = exp;
            opExp.args = util.copyArray(opExp.args);
            return opExp;
        case 'union':
            var unionExp = exp;
            unionExp.types = util.copyArray(unionExp.types);
            return unionExp;
        case 'generic':
            var genericExp = exp;
            genericExp.params = util.copyArray(genericExp.params);
            return genericExp;
        default:
            return exp;
    }
}
exports.copyExp = copyExp;
// Make a (shallow) copy of the base expression, setting (or removing) it's
// valueType.
//
// valueType is a string indicating the type of evaluating an expression (e.g.
// 'Snapshot') - used to know when type coercion is needed in the context
// of parent expressions.
function cast(base, valueType) {
    var result = copyExp(base);
    result.valueType = valueType;
    return result;
}
exports.cast = cast;
function call(ref, args) {
    if (args === void 0) { args = []; }
    return { type: 'call', valueType: 'Any', ref: ref, args: args };
}
exports.call = call;
// Return empty string if not a function.
function getFunctionName(exp) {
    if (exp.ref.type === 'ref') {
        return '';
    }
    return exp.ref.name;
}
exports.getFunctionName = getFunctionName;
// Return empty string if not a (simple) method call -- ref.fn()
function getMethodName(exp) {
    if (exp.ref.type === 'var') {
        return exp.ref.name;
    }
    if (exp.ref.type !== 'ref') {
        return '';
    }
    return getPropName(exp.ref);
}
exports.getMethodName = getMethodName;
function getPropName(ref) {
    if (ref.accessor.type !== 'String') {
        return '';
    }
    return ref.accessor.value;
}
exports.getPropName = getPropName;
// TODO: Type of function signature does not fail this declaration?
function builtin(fn) {
    return { type: 'builtin', valueType: 'Any', fn: fn };
}
exports.builtin = builtin;
function snapshotVariable(name) {
    return cast(variable(name), 'Snapshot');
}
exports.snapshotVariable = snapshotVariable;
function snapshotParent(base) {
    if (base.valueType !== 'Snapshot') {
        throw new Error(errors.typeMismatch + "expected Snapshot");
    }
    return cast(call(reference(cast(base, 'Any'), exports.string('parent'))), 'Snapshot');
}
exports.snapshotParent = snapshotParent;
function ensureValue(exp) {
    if (exp.valueType === 'Snapshot') {
        return snapshotValue(exp);
    }
    return exp;
}
exports.ensureValue = ensureValue;
// ref.val()
function snapshotValue(exp) {
    return call(reference(cast(exp, 'Any'), exports.string('val')));
}
exports.snapshotValue = snapshotValue;
// Ensure expression is a boolean (when used in a boolean context).
function ensureBoolean(exp) {
    exp = ensureValue(exp);
    if (isCall(exp, 'val')) {
        exp = exports.eq(exp, exports.boolean(true));
    }
    return exp;
}
exports.ensureBoolean = ensureBoolean;
function isCall(exp, methodName) {
    return exp.type === 'call' && exp.ref.type === 'ref' &&
        exp.ref.accessor.type === 'String' &&
        exp.ref.accessor.value === methodName;
}
exports.isCall = isCall;
// Return value generating function for a given Type.
function valueGen(typeName) {
    return function (val) {
        return {
            type: typeName,
            valueType: typeName,
            value: val // The (constant) value itself.
        };
    };
}
function regexp(pattern, modifiers) {
    if (modifiers === void 0) { modifiers = ""; }
    switch (modifiers) {
        case "":
        case "i":
            break;
        default:
            throw new Error("Unsupported RegExp modifier: " + modifiers);
    }
    return {
        type: 'RegExp',
        valueType: 'RegExp',
        value: pattern,
        modifiers: modifiers
    };
}
exports.regexp = regexp;
function cmpValues(v1, v2) {
    if (v1.type !== v2.type) {
        return false;
    }
    return v1.value === v2.value;
}
function isOp(opType, exp) {
    return exp.type === 'op' && exp.op === opType;
}
// Return a generating function to make an operator exp node.
function opGen(opType, arity) {
    if (arity === void 0) { arity = 2; }
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
        }
        if (args.length !== arity) {
            throw new Error("Operator has " + args.length +
                " arguments (expecting " + arity + ").");
        }
        return op(opType, args);
    };
}
exports.andArray = leftAssociateGen('&&', exports.boolean(true), exports.boolean(false));
exports.orArray = leftAssociateGen('||', exports.boolean(false), exports.boolean(true));
// Create an expression builder function which operates on arrays of values.
// Returns new expression like v1 op v2 op v3 ...
//
// - Any identityValue's in array input are ignored.
// - If zeroValue is found - just return zeroValue.
//
// Our function re-orders top-level op in array elements to the resulting
// expression is left-associating.  E.g.:
//
//    [a && b, c && d] => (((a && b) && c) && d)
//    (NOT (a && b) && (c && d))
function leftAssociateGen(opType, identityValue, zeroValue) {
    return function (a) {
        var i;
        function reducer(result, current) {
            if (result === undefined) {
                return current;
            }
            return op(opType, [result, current]);
        }
        // First flatten all top-level op values to one flat array.
        var flat = [];
        for (i = 0; i < a.length; i++) {
            flatten(opType, a[i], flat);
        }
        var result = [];
        for (i = 0; i < flat.length; i++) {
            // Remove identifyValues from array.
            if (cmpValues(flat[i], identityValue)) {
                continue;
            }
            // Just return zeroValue if found
            if (cmpValues(flat[i], zeroValue)) {
                return zeroValue;
            }
            result.push(flat[i]);
        }
        if (result.length === 0) {
            return identityValue;
        }
        // Return left-associative expression of opType.
        return result.reduce(reducer);
    };
}
// Flatten the top level tree of op into a single flat array of expressions.
function flatten(opType, exp, flat) {
    var i;
    if (flat === undefined) {
        flat = [];
    }
    if (!isOp(opType, exp)) {
        flat.push(exp);
        return flat;
    }
    for (i = 0; i < exp.args.length; i++) {
        flatten(opType, exp.args[i], flat);
    }
    return flat;
}
exports.flatten = flatten;
function op(opType, args) {
    return {
        type: 'op',
        valueType: 'Any',
        op: opType,
        args: args // Arguments to the operator Array<exp>
    };
}
exports.op = op;
// Warning: NOT an expression type!
function method(params, body) {
    return {
        params: params,
        body: body
    };
}
exports.method = method;
function typeType(typeName) {
    return { type: "type", valueType: "type", name: typeName };
}
exports.typeType = typeType;
function unionType(types) {
    return { type: "union", valueType: "type", types: types };
}
exports.unionType = unionType;
function genericType(typeName, params) {
    return { type: "generic", valueType: "type", name: typeName, params: params };
}
exports.genericType = genericType;
var Symbols = (function () {
    function Symbols() {
        this.functions = {};
        this.paths = [];
        this.schema = {};
        this.imports = [];
    }
    Symbols.prototype.register = function (map, typeName, name, object) {
        if (map[name]) {
            logger.error("Duplicated " + typeName + " definition: " + name + ".");
        }
        else {
            map[name] = object;
        }
        return map[name];
    };
    Symbols.prototype.registerFunction = function (name, params, body) {
        return this.register(this.functions, 'functions', name, method(params, body));
    };
    Symbols.prototype.registerImport = function (alias, data, scope) {
        // type, name, data
        var theScope = false;
        if (scope) {
            theScope = true;
        }
        var theAlias = "";
        if (alias) {
            theAlias = alias;
        }
        var i = {
            filename: data,
            alias: theAlias,
            scope: !theScope
        };
        this.imports.push(i);
        return i;
    };
    Symbols.prototype.registerPath = function (template, isType, methods) {
        if (methods === void 0) { methods = {}; }
        isType = isType || typeType('Any');
        var p = {
            template: template.copy(),
            isType: isType,
            methods: methods
        };
        this.paths.push(p);
        return p;
    };
    Symbols.prototype.registerSchema = function (name, derivedFrom, properties, methods, params) {
        if (properties === void 0) { properties = {}; }
        if (methods === void 0) { methods = {}; }
        if (params === void 0) { params = []; }
        derivedFrom = derivedFrom || typeType(Object.keys(properties).length > 0 ? 'Object' : 'Any');
        var s = {
            derivedFrom: derivedFrom,
            properties: properties,
            methods: methods,
            params: params
        };
        return this.register(this.schema, 'schema', name, s);
    };
    Symbols.prototype.isDerivedFrom = function (type, ancestor) {
        var _this = this;
        if (ancestor === 'Any') {
            return true;
        }
        switch (type.type) {
            case 'type':
            case 'generic':
                var simpleType = type;
                if (simpleType.name === ancestor) {
                    return true;
                }
                if (simpleType.name === 'Any') {
                    return false;
                }
                var schema = this.schema[simpleType.name];
                if (!schema) {
                    return false;
                }
                return this.isDerivedFrom(schema.derivedFrom, ancestor);
            case 'union':
                return type.types
                    .map(function (subType) { return _this.isDerivedFrom(subType, ancestor); })
                    .reduce(util.or);
            default:
                throw new Error("Unknown type: " + type.type);
        }
    };
    return Symbols;
}());
exports.Symbols = Symbols;
var JS_OPS = {
    'value': { rep: "", p: 18 },
    'neg': { rep: "-", p: 15 },
    '!': { p: 15 },
    '*': { p: 14 },
    '/': { p: 14 },
    '%': { p: 14 },
    '+': { p: 13 },
    '-': { p: 13 },
    '<': { p: 11 },
    '<=': { p: 11 },
    '>': { p: 11 },
    '>=': { p: 11 },
    'in': { p: 11 },
    '==': { p: 10 },
    "!=": { p: 10 },
    '&&': { p: 6 },
    '||': { p: 5 },
    '?:': { p: 4 },
    ',': { p: 0 }
};
// From an AST, decode as an expression (string).
function decodeExpression(exp, outerPrecedence) {
    if (outerPrecedence === undefined) {
        outerPrecedence = 0;
    }
    var innerPrecedence = precedenceOf(exp);
    var result = '';
    switch (exp.type) {
        case 'Boolean':
        case 'Number':
            result = JSON.stringify(exp.value);
            break;
        case 'String':
            result = util.quoteString(exp.value);
            break;
        // RegExp assumed to be in pre-quoted format.
        case 'RegExp':
            var regexp_1 = exp;
            result = '/' + regexp_1.value + '/';
            if (regexp_1.modifiers !== '') {
                result += regexp_1.modifiers;
            }
            break;
        case 'Array':
            result = '[' + decodeArray(exp.value) + ']';
            break;
        case 'Null':
            result = 'null';
            break;
        case 'var':
        case 'literal':
            result = exp.name;
            break;
        case 'ref':
            var expRef = exp;
            if (isIdentifierStringExp(expRef.accessor)) {
                result = decodeExpression(expRef.base, innerPrecedence) + '.' + expRef.accessor.value;
            }
            else {
                result = decodeExpression(expRef.base, innerPrecedence) +
                    '[' + decodeExpression(expRef.accessor) + ']';
            }
            break;
        case 'call':
            var expCall = exp;
            result = decodeExpression(expCall.ref) + '(' + decodeArray(expCall.args) + ')';
            break;
        case 'builtin':
            result = decodeExpression(exp);
            break;
        case 'op':
            var expOp = exp;
            var rep = JS_OPS[expOp.op].rep === undefined ? expOp.op : JS_OPS[expOp.op].rep;
            if (expOp.args.length === 1) {
                result = rep + decodeExpression(expOp.args[0], innerPrecedence);
            }
            else if (expOp.args.length === 2) {
                result =
                    decodeExpression(expOp.args[0], innerPrecedence) +
                        ' ' + rep + ' ' +
                        // All ops are left associative - so nudge the innerPrecendence
                        // down on the right hand side to force () for right-associating
                        // operations.
                        decodeExpression(expOp.args[1], innerPrecedence + 1);
            }
            else if (expOp.args.length === 3) {
                result =
                    decodeExpression(expOp.args[0], innerPrecedence) + ' ? ' +
                        decodeExpression(expOp.args[1], innerPrecedence) + ' : ' +
                        decodeExpression(expOp.args[2], innerPrecedence);
            }
            break;
        case 'type':
            result = exp.name;
            break;
        case 'union':
            result = exp.types.map(decodeExpression).join(' | ');
            break;
        case 'generic':
            var genericType_1 = exp;
            return genericType_1.name + '<' + decodeArray(genericType_1.params) + '>';
        default:
            result = "***UNKNOWN TYPE*** (" + exp.type + ")";
            break;
    }
    if (innerPrecedence < outerPrecedence) {
        result = '(' + result + ')';
    }
    return result;
}
exports.decodeExpression = decodeExpression;
function decodeArray(args) {
    return args.map(decodeExpression).join(', ');
}
function precedenceOf(exp) {
    var result;
    switch (exp.type) {
        case 'op':
            result = JS_OPS[exp.op].p;
            break;
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
        // lists call as 17 and ref as 18 - but how could they be anything other than left to right?
        // http://www.scriptingmaster.com/javascript/operator-precedence.asp - agrees.
        case 'call':
            result = 18;
            break;
        case 'ref':
            result = 18;
            break;
        default:
            result = 19;
            break;
    }
    return result;
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ25CLEtBQUssSUFBSTtZQUNQLE1BQU0sR0FBRyxNQUFNLENBQVUsR0FBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwQyxLQUFLLENBQUM7UUFFUixrR0FBa0c7UUFDbEcsNEZBQTRGO1FBQzVGLDhFQUE4RTtRQUM5RSxLQUFLLE1BQU07WUFDVCxNQUFNLEdBQUcsRUFBRSxDQUFDO1lBQ1osS0FBSyxDQUFDO1FBQ1IsS0FBSyxLQUFLO1lBQ1IsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUNaLEtBQUssQ0FBQztRQUNSO1lBQ0UsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUNaLEtBQUssQ0FBQztJQUNSLENBQUM7SUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJmaWxlIjoiYXN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcclxuICogQVNUIGJ1aWxkZXJzIGZvciBGaXJlYmFzZSBSdWxlcyBMYW5ndWFnZS5cclxuICpcclxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cclxuICpcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcclxuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxyXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcclxuICpcclxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG4gKlxyXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbiAqL1xyXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCc7XHJcbmltcG9ydCAqIGFzIGxvZ2dlciBmcm9tICcuL2xvZ2dlcic7XHJcblxyXG52YXIgZXJyb3JzID0ge1xyXG4gIHR5cGVNaXNtYXRjaDogXCJVbmV4cGVjdGVkIHR5cGU6IFwiLFxyXG4gIGR1cGxpY2F0ZVBhdGhQYXJ0OiBcIkEgcGF0aCBjb21wb25lbnQgbmFtZSBpcyBkdXBsaWNhdGVkOiBcIixcclxufTtcclxuXHJcbmV4cG9ydCB0eXBlIE9iamVjdCA9IHsgW3Byb3A6IHN0cmluZ106IGFueSB9O1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHAge1xyXG4gIHR5cGU6IHN0cmluZztcclxuICB2YWx1ZVR5cGU6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHBWYWx1ZSBleHRlbmRzIEV4cCB7XHJcbiAgdmFsdWU6IGFueTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBSZWdFeHBWYWx1ZSBleHRlbmRzIEV4cFZhbHVlIHtcclxuICBtb2RpZmllcnM6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHBOdWxsIGV4dGVuZHMgRXhwIHtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHBPcCBleHRlbmRzIEV4cCB7XHJcbiAgb3A6IHN0cmluZztcclxuICBhcmdzOiBFeHBbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHBWYXJpYWJsZSBleHRlbmRzIEV4cCB7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cExpdGVyYWwgZXh0ZW5kcyBFeHAge1xyXG4gIG5hbWU6IHN0cmluZztcclxufVxyXG5cclxuLy8gYmFzZVthY2Nlc3Nvcl1cclxuZXhwb3J0IGludGVyZmFjZSBFeHBSZWZlcmVuY2UgZXh0ZW5kcyBFeHAge1xyXG4gIGJhc2U6IEV4cDtcclxuICBhY2Nlc3NvcjogRXhwO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cENhbGwgZXh0ZW5kcyBFeHAge1xyXG4gIHJlZjogRXhwUmVmZXJlbmNlIHwgRXhwVmFyaWFibGU7XHJcbiAgYXJnczogRXhwW107XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFyYW1zIHsgW25hbWU6IHN0cmluZ106IEV4cDsgfTtcclxuXHJcbmV4cG9ydCB0eXBlIEJ1aWx0aW5GdW5jdGlvbiA9IChhcmdzOiBFeHBbXSwgcGFyYW1zOiBQYXJhbXMpID0+IEV4cDtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRXhwQnVpbHRpbiBleHRlbmRzIEV4cCB7XHJcbiAgZm46IEJ1aWx0aW5GdW5jdGlvbjtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgRXhwVHlwZSA9IEV4cFNpbXBsZVR5cGUgfCBFeHBVbmlvblR5cGUgfCBFeHBHZW5lcmljVHlwZTtcclxuZXhwb3J0IGludGVyZmFjZSBUeXBlUGFyYW1zIHsgW25hbWU6IHN0cmluZ106IEV4cFR5cGU7IH07XHJcblxyXG4vLyBTaW1wbGUgVHlwZSAocmVmZXJlbmNlKVxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cFNpbXBsZVR5cGUgZXh0ZW5kcyBFeHAge1xyXG4gIG5hbWU6IHN0cmluZztcclxufVxyXG5cclxuLy8gVW5pb24gVHlwZTogVHlwZTEgfCBUeXBlMiB8IC4uLlxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cFVuaW9uVHlwZSBleHRlbmRzIEV4cCB7XHJcbiAgdHlwZXM6IEV4cFR5cGVbXTtcclxufVxyXG5cclxuLy8gR2VuZXJpYyBUeXBlIChyZWZlcmVuY2UpOiBUeXBlPFR5cGUxLCBUeXBlMiwgLi4uPlxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cEdlbmVyaWNUeXBlIGV4dGVuZHMgRXhwIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgcGFyYW1zOiBFeHBUeXBlW107XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTWV0aG9kIHtcclxuICBwYXJhbXM6IHN0cmluZ1tdO1xyXG4gIGJvZHk6IEV4cDtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJbXBvcnQge1xyXG4gIGZpbGVuYW1lOiBzdHJpbmc7XHJcbiAgYWxpYXM6IHN0cmluZztcclxuICBzY29wZTogYm9vbGVhbjtcclxufVxyXG5leHBvcnQgY2xhc3MgUGF0aFBhcnQge1xyXG4gIGxhYmVsOiBzdHJpbmc7XHJcbiAgdmFyaWFibGU6IHN0cmluZztcclxuXHJcbiAgLy8gXCJsYWJlbFwiLCB1bmRlZmluZWQgLSBzdGF0aWMgcGF0aCBwYXJ0XHJcbiAgLy8gXCIkbGFiZWxcIiwgWCAtIHZhcmlhYmxlIHBhdGggcGFydFxyXG4gIC8vIFgsICF1bmRlZmluZWQgLSB2YXJpYWJsZSBwYXRoIHBhcnRcclxuICBjb25zdHJ1Y3RvcihsYWJlbDogc3RyaW5nLCB2YXJpYWJsZT86IHN0cmluZykge1xyXG4gICAgaWYgKGxhYmVsWzBdID09PSAnJCcgJiYgdmFyaWFibGUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB2YXJpYWJsZSA9IGxhYmVsO1xyXG4gICAgfVxyXG4gICAgaWYgKHZhcmlhYmxlICYmIGxhYmVsWzBdICE9PSAnJCcpIHtcclxuICAgICAgbGFiZWwgPSAnJCcgKyBsYWJlbDtcclxuICAgIH1cclxuICAgIHRoaXMubGFiZWwgPSBsYWJlbDtcclxuICAgIHRoaXMudmFyaWFibGUgPSA8c3RyaW5nPiB2YXJpYWJsZTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBQYXRoVGVtcGxhdGUge1xyXG4gIHBhcnRzOiBQYXRoUGFydFtdO1xyXG5cclxuICBjb25zdHJ1Y3RvcihwYXJ0cyA9IDwoc3RyaW5nIHwgUGF0aFBhcnQpW10+IFtdKSB7XHJcbiAgICB0aGlzLnBhcnRzID0gPFBhdGhQYXJ0W10+IHBhcnRzLm1hcCgocGFydCkgPT4ge1xyXG4gICAgICBpZiAodXRpbC5pc1R5cGUocGFydCwgJ3N0cmluZycpKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQYXRoUGFydCg8c3RyaW5nPiBwYXJ0KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gPFBhdGhQYXJ0PiBwYXJ0O1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNvcHkoKSB7XHJcbiAgICBsZXQgcmVzdWx0ID0gbmV3IFBhdGhUZW1wbGF0ZSgpO1xyXG4gICAgcmVzdWx0LnB1c2godGhpcyk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgZ2V0TGFiZWxzKCk6IHN0cmluZ1tdIHtcclxuICAgIHJldHVybiB0aGlzLnBhcnRzLm1hcCgocGFydCkgPT4gcGFydC5sYWJlbCk7XHJcbiAgfVxyXG5cclxuICAvLyBNYXBwaW5nIGZyb20gdmFyaWFibGVzIHRvIEpTT04gbGFiZWxzXHJcbiAgZ2V0U2NvcGUoKTogUGFyYW1zIHtcclxuICAgIGxldCByZXN1bHQgPSA8UGFyYW1zPiB7fTtcclxuICAgIHRoaXMucGFydHMuZm9yRWFjaCgocGFydCkgPT4ge1xyXG4gICAgICBpZiAocGFydC52YXJpYWJsZSkge1xyXG4gICAgICAgIGlmIChyZXN1bHRbcGFydC52YXJpYWJsZV0pIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuZHVwbGljYXRlUGF0aFBhcnQgKyBwYXJ0LnZhcmlhYmxlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVzdWx0W3BhcnQudmFyaWFibGVdID0gbGl0ZXJhbChwYXJ0LmxhYmVsKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHVzaCh0ZW1wOiBQYXRoVGVtcGxhdGUpIHtcclxuICAgIHV0aWwuZXh0ZW5kQXJyYXkodGhpcy5wYXJ0cywgdGVtcC5wYXJ0cyk7XHJcbiAgfVxyXG5cclxuICBwb3AodGVtcDogUGF0aFRlbXBsYXRlKSB7XHJcbiAgICB0ZW1wLnBhcnRzLmZvckVhY2goKHBhcnQpID0+IHtcclxuICAgICAgdGhpcy5wYXJ0cy5wb3AoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgbGVuZ3RoKCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy5wYXJ0cy5sZW5ndGg7XHJcbiAgfVxyXG5cclxuICBnZXRQYXJ0KGk6IG51bWJlcik6IFBhdGhQYXJ0IHtcclxuICAgIGlmIChpID4gdGhpcy5wYXJ0cy5sZW5ndGggfHwgaSA8IC10aGlzLnBhcnRzLmxlbmd0aCkge1xyXG4gICAgICBsZXQgbCA9IHRoaXMucGFydHMubGVuZ3RoO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJQYXRoIHJlZmVyZW5jZSBvdXQgb2YgYm91bmRzOiBcIiArIGkgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgXCIgW1wiICsgLWwgKyBcIiAuLiBcIiArIGwgKyBcIl1cIik7XHJcbiAgICB9XHJcbiAgICBpZiAoaSA8IDApIHtcclxuICAgICAgcmV0dXJuIHRoaXMucGFydHNbdGhpcy5wYXJ0cy5sZW5ndGggKyBpXTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnBhcnRzW2ldO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQYXRoIHtcclxuICB0ZW1wbGF0ZTogUGF0aFRlbXBsYXRlO1xyXG4gIGlzVHlwZTogRXhwVHlwZTtcclxuICBtZXRob2RzOiB7IFtuYW1lOiBzdHJpbmddOiBNZXRob2QgfTtcclxufTtcclxuXHJcbmV4cG9ydCBjbGFzcyBTY2hlbWEge1xyXG4gIGRlcml2ZWRGcm9tOiBFeHBUeXBlO1xyXG4gIHByb3BlcnRpZXM6IFR5cGVQYXJhbXM7XHJcbiAgbWV0aG9kczogeyBbbmFtZTogc3RyaW5nXTogTWV0aG9kIH07XHJcblxyXG4gIC8vIEdlbmVyaWMgcGFyYW1ldGVycyAtIGlmIGEgR2VuZXJpYyBzY2hlbWFcclxuICBwYXJhbXM/OiBzdHJpbmdbXTtcclxuICBnZXRWYWxpZGF0b3I/OiAocGFyYW1zOiBFeHBbXSkgPT4gT2JqZWN0O1xyXG5cclxuICBzdGF0aWMgaXNHZW5lcmljKHNjaGVtYTogU2NoZW1hKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gc2NoZW1hLnBhcmFtcyAhPT0gdW5kZWZpbmVkICYmIHNjaGVtYS5wYXJhbXMubGVuZ3RoID4gMDtcclxuICB9XHJcbn07XHJcblxyXG5leHBvcnQgdmFyIHN0cmluZzogKHY6IHN0cmluZykgPT4gRXhwVmFsdWUgPSB2YWx1ZUdlbignU3RyaW5nJyk7XHJcbmV4cG9ydCB2YXIgYm9vbGVhbjogKHY6IGJvb2xlYW4pID0+IEV4cFZhbHVlID0gdmFsdWVHZW4oJ0Jvb2xlYW4nKTtcclxuZXhwb3J0IHZhciBudW1iZXI6ICh2OiBudW1iZXIpID0+IEV4cFZhbHVlID0gdmFsdWVHZW4oJ051bWJlcicpO1xyXG5leHBvcnQgdmFyIGFycmF5OiAodjogQXJyYXk8YW55PikgPT4gRXhwVmFsdWUgPSB2YWx1ZUdlbignQXJyYXknKTtcclxuXHJcbmV4cG9ydCB2YXIgbmVnID0gb3BHZW4oJ25lZycsIDEpO1xyXG5leHBvcnQgdmFyIG5vdCA9IG9wR2VuKCchJywgMSk7XHJcbmV4cG9ydCB2YXIgbXVsdCA9IG9wR2VuKCcqJyk7XHJcbmV4cG9ydCB2YXIgZGl2ID0gb3BHZW4oJy8nKTtcclxuZXhwb3J0IHZhciBtb2QgPSBvcEdlbignJScpO1xyXG5leHBvcnQgdmFyIGFkZCA9IG9wR2VuKCcrJyk7XHJcbmV4cG9ydCB2YXIgc3ViID0gb3BHZW4oJy0nKTtcclxuZXhwb3J0IHZhciBlcSA9IG9wR2VuKCc9PScpO1xyXG5leHBvcnQgdmFyIGx0ID0gb3BHZW4oJzwnKTtcclxuZXhwb3J0IHZhciBsdGUgPSBvcEdlbignPD0nKTtcclxuZXhwb3J0IHZhciBndCA9IG9wR2VuKCc+Jyk7XHJcbmV4cG9ydCB2YXIgZ3RlID0gb3BHZW4oJz49Jyk7XHJcbmV4cG9ydCB2YXIgbmUgPSBvcEdlbignIT0nKTtcclxuZXhwb3J0IHZhciBhbmQgPSBvcEdlbignJiYnKTtcclxuZXhwb3J0IHZhciBvciA9IG9wR2VuKCd8fCcpO1xyXG5leHBvcnQgdmFyIHRlcm5hcnkgPSBvcEdlbignPzonLCAzKTtcclxuZXhwb3J0IHZhciB2YWx1ZSA9IG9wR2VuKCd2YWx1ZScsIDEpO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHZhcmlhYmxlKG5hbWU6IHN0cmluZyk6IEV4cFZhcmlhYmxlIHtcclxuICByZXR1cm4geyB0eXBlOiAndmFyJywgdmFsdWVUeXBlOiAnQW55JywgbmFtZTogbmFtZSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbChuYW1lOiBzdHJpbmcpOiBFeHBMaXRlcmFsIHtcclxuICByZXR1cm4geyB0eXBlOiAnbGl0ZXJhbCcsIHZhbHVlVHlwZTogJ0FueScsIG5hbWU6IG5hbWUgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG51bGxUeXBlKCk6IEV4cE51bGwge1xyXG4gIHJldHVybiB7IHR5cGU6ICdOdWxsJywgdmFsdWVUeXBlOiAnTnVsbCcgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlZmVyZW5jZShiYXNlOiBFeHAsIHByb3A6IEV4cCk6IEV4cFJlZmVyZW5jZSB7XHJcbiAgcmV0dXJuIHtcclxuICAgIHR5cGU6ICdyZWYnLFxyXG4gICAgdmFsdWVUeXBlOiAnQW55JyxcclxuICAgIGJhc2U6IGJhc2UsXHJcbiAgICBhY2Nlc3NvcjogcHJvcFxyXG4gIH07XHJcbn1cclxuXHJcbmxldCByZUlkZW50aWZpZXIgPSAvXlthLXpBLVpfJF1bYS16QS1aMC05X10qJC87XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaXNJZGVudGlmaWVyU3RyaW5nRXhwKGV4cDogRXhwKSB7XHJcbiAgcmV0dXJuIGV4cC50eXBlID09PSAnU3RyaW5nJyAmJiByZUlkZW50aWZpZXIudGVzdCgoPEV4cFZhbHVlPiBleHApLnZhbHVlKTtcclxufVxyXG5cclxuLy8gU2hhbGxvdyBjb3B5IG9mIGFuIGV4cHJlc3Npb24gKHNvIGl0IGNhbiBiZSBtb2RpZmllZCBhbmQgcHJlc2VydmVcclxuLy8gaW1tdXRhYmlsaXR5IG9mIHRoZSBvcmlnaW5hbCBleHByZXNzaW9uKS5cclxuZXhwb3J0IGZ1bmN0aW9uIGNvcHlFeHAoZXhwOiBFeHApOiBFeHAge1xyXG4gIGV4cCA9IDxFeHA+IHV0aWwuZXh0ZW5kKHt9LCBleHApO1xyXG4gIHN3aXRjaCAoZXhwLnR5cGUpIHtcclxuICBjYXNlICdvcCc6XHJcbiAgY2FzZSAnY2FsbCc6XHJcbiAgICBsZXQgb3BFeHAgPSA8RXhwT3A+IGV4cDtcclxuICAgIG9wRXhwLmFyZ3MgPSB1dGlsLmNvcHlBcnJheShvcEV4cC5hcmdzKTtcclxuICAgIHJldHVybiBvcEV4cDtcclxuXHJcbiAgY2FzZSAndW5pb24nOlxyXG4gICAgbGV0IHVuaW9uRXhwID0gPEV4cFVuaW9uVHlwZT4gZXhwO1xyXG4gICAgdW5pb25FeHAudHlwZXMgPSB1dGlsLmNvcHlBcnJheSh1bmlvbkV4cC50eXBlcyk7XHJcbiAgICByZXR1cm4gdW5pb25FeHA7XHJcblxyXG4gIGNhc2UgJ2dlbmVyaWMnOlxyXG4gICAgbGV0IGdlbmVyaWNFeHAgPSA8RXhwR2VuZXJpY1R5cGU+IGV4cDtcclxuICAgIGdlbmVyaWNFeHAucGFyYW1zID0gdXRpbC5jb3B5QXJyYXkoZ2VuZXJpY0V4cC5wYXJhbXMpO1xyXG4gICAgcmV0dXJuIGdlbmVyaWNFeHA7XHJcblxyXG4gIGRlZmF1bHQ6XHJcbiAgICAgcmV0dXJuIGV4cDtcclxuICB9XHJcbn1cclxuXHJcbi8vIE1ha2UgYSAoc2hhbGxvdykgY29weSBvZiB0aGUgYmFzZSBleHByZXNzaW9uLCBzZXR0aW5nIChvciByZW1vdmluZykgaXQnc1xyXG4vLyB2YWx1ZVR5cGUuXHJcbi8vXHJcbi8vIHZhbHVlVHlwZSBpcyBhIHN0cmluZyBpbmRpY2F0aW5nIHRoZSB0eXBlIG9mIGV2YWx1YXRpbmcgYW4gZXhwcmVzc2lvbiAoZS5nLlxyXG4vLyAnU25hcHNob3QnKSAtIHVzZWQgdG8ga25vdyB3aGVuIHR5cGUgY29lcmNpb24gaXMgbmVlZGVkIGluIHRoZSBjb250ZXh0XHJcbi8vIG9mIHBhcmVudCBleHByZXNzaW9ucy5cclxuZXhwb3J0IGZ1bmN0aW9uIGNhc3QoYmFzZTogRXhwLCB2YWx1ZVR5cGU6IHN0cmluZyk6IEV4cCB7XHJcbiAgdmFyIHJlc3VsdCA9IGNvcHlFeHAoYmFzZSk7XHJcbiAgcmVzdWx0LnZhbHVlVHlwZSA9IHZhbHVlVHlwZTtcclxuICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2FsbChyZWY6IEV4cFJlZmVyZW5jZSB8IEV4cFZhcmlhYmxlLCBhcmdzOiBFeHBbXT0gW10pOiBFeHBDYWxsIHtcclxuICByZXR1cm4geyB0eXBlOiAnY2FsbCcsIHZhbHVlVHlwZTogJ0FueScsIHJlZjogcmVmLCBhcmdzOiBhcmdzIH07XHJcbn1cclxuXHJcbi8vIFJldHVybiBlbXB0eSBzdHJpbmcgaWYgbm90IGEgZnVuY3Rpb24uXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRGdW5jdGlvbk5hbWUoZXhwOiBFeHBDYWxsKTogc3RyaW5nIHtcclxuICBpZiAoZXhwLnJlZi50eXBlID09PSAncmVmJykge1xyXG4gICAgcmV0dXJuICcnO1xyXG4gIH1cclxuICByZXR1cm4gKDxFeHBWYXJpYWJsZT4gZXhwLnJlZikubmFtZTtcclxufVxyXG5cclxuLy8gUmV0dXJuIGVtcHR5IHN0cmluZyBpZiBub3QgYSAoc2ltcGxlKSBtZXRob2QgY2FsbCAtLSByZWYuZm4oKVxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWV0aG9kTmFtZShleHA6IEV4cENhbGwpOiBzdHJpbmcge1xyXG4gIGlmIChleHAucmVmLnR5cGUgPT09ICd2YXInKSB7XHJcbiAgICByZXR1cm4gKDxFeHBWYXJpYWJsZT4gZXhwLnJlZikubmFtZTtcclxuICB9XHJcbiAgaWYgKGV4cC5yZWYudHlwZSAhPT0gJ3JlZicpIHtcclxuICAgIHJldHVybiAnJztcclxuICB9XHJcbiAgcmV0dXJuIGdldFByb3BOYW1lKDxFeHBSZWZlcmVuY2U+IGV4cC5yZWYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJvcE5hbWUocmVmOiBFeHBSZWZlcmVuY2UpOiBzdHJpbmcge1xyXG4gIGlmIChyZWYuYWNjZXNzb3IudHlwZSAhPT0gJ1N0cmluZycpIHtcclxuICAgIHJldHVybiAnJztcclxuICB9XHJcbiAgcmV0dXJuICg8RXhwVmFsdWU+IHJlZi5hY2Nlc3NvcikudmFsdWU7XHJcbn1cclxuXHJcbi8vIFRPRE86IFR5cGUgb2YgZnVuY3Rpb24gc2lnbmF0dXJlIGRvZXMgbm90IGZhaWwgdGhpcyBkZWNsYXJhdGlvbj9cclxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWx0aW4oZm46IEJ1aWx0aW5GdW5jdGlvbik6IEV4cEJ1aWx0aW4ge1xyXG4gIHJldHVybiB7IHR5cGU6ICdidWlsdGluJywgdmFsdWVUeXBlOiAnQW55JywgZm46IGZuIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzbmFwc2hvdFZhcmlhYmxlKG5hbWU6IHN0cmluZyk6IEV4cFZhcmlhYmxlIHtcclxuICByZXR1cm4gPEV4cFZhcmlhYmxlPiBjYXN0KHZhcmlhYmxlKG5hbWUpLCAnU25hcHNob3QnKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNuYXBzaG90UGFyZW50KGJhc2U6IEV4cCk6IEV4cCB7XHJcbiAgaWYgKGJhc2UudmFsdWVUeXBlICE9PSAnU25hcHNob3QnKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLnR5cGVNaXNtYXRjaCArIFwiZXhwZWN0ZWQgU25hcHNob3RcIik7XHJcbiAgfVxyXG4gIHJldHVybiBjYXN0KGNhbGwocmVmZXJlbmNlKGNhc3QoYmFzZSwgJ0FueScpLCBzdHJpbmcoJ3BhcmVudCcpKSksXHJcbiAgICAgICAgICAgICAgJ1NuYXBzaG90Jyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBlbnN1cmVWYWx1ZShleHA6IEV4cCk6IEV4cCB7XHJcbiAgaWYgKGV4cC52YWx1ZVR5cGUgPT09ICdTbmFwc2hvdCcpIHtcclxuICAgIHJldHVybiBzbmFwc2hvdFZhbHVlKGV4cCk7XHJcbiAgfVxyXG4gIHJldHVybiBleHA7XHJcbn1cclxuXHJcbi8vIHJlZi52YWwoKVxyXG5leHBvcnQgZnVuY3Rpb24gc25hcHNob3RWYWx1ZShleHA6IEV4cCk6IEV4cENhbGwge1xyXG4gIHJldHVybiBjYWxsKHJlZmVyZW5jZShjYXN0KGV4cCwgJ0FueScpLCBzdHJpbmcoJ3ZhbCcpKSk7XHJcbn1cclxuXHJcbi8vIEVuc3VyZSBleHByZXNzaW9uIGlzIGEgYm9vbGVhbiAod2hlbiB1c2VkIGluIGEgYm9vbGVhbiBjb250ZXh0KS5cclxuZXhwb3J0IGZ1bmN0aW9uIGVuc3VyZUJvb2xlYW4oZXhwOiBFeHApOiBFeHAge1xyXG4gIGV4cCA9IGVuc3VyZVZhbHVlKGV4cCk7XHJcbiAgaWYgKGlzQ2FsbChleHAsICd2YWwnKSkge1xyXG4gICAgZXhwID0gZXEoZXhwLCBib29sZWFuKHRydWUpKTtcclxuICB9XHJcbiAgcmV0dXJuIGV4cDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzQ2FsbChleHA6IEV4cCwgbWV0aG9kTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIGV4cC50eXBlID09PSAnY2FsbCcgJiYgKDxFeHBDYWxsPiBleHApLnJlZi50eXBlID09PSAncmVmJyAmJlxyXG4gICAgKDxFeHBSZWZlcmVuY2U+ICg8RXhwQ2FsbD4gZXhwKS5yZWYpLmFjY2Vzc29yLnR5cGUgPT09ICdTdHJpbmcnICYmXHJcbiAgICAoPEV4cFZhbHVlPiAoPEV4cFJlZmVyZW5jZT4gKDxFeHBDYWxsPiBleHApLnJlZikuYWNjZXNzb3IpLnZhbHVlID09PSBtZXRob2ROYW1lO1xyXG59XHJcblxyXG4vLyBSZXR1cm4gdmFsdWUgZ2VuZXJhdGluZyBmdW5jdGlvbiBmb3IgYSBnaXZlbiBUeXBlLlxyXG5mdW5jdGlvbiB2YWx1ZUdlbih0eXBlTmFtZTogc3RyaW5nKTogKCh2YWw6IGFueSkgPT4gRXhwVmFsdWUpIHtcclxuICByZXR1cm4gZnVuY3Rpb24odmFsKTogRXhwVmFsdWUge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdHlwZTogdHlwZU5hbWUsICAgICAgLy8gRXhwIHR5cGUgaWRlbnRpZnlpbmcgYSBjb25zdGFudCB2YWx1ZSBvZiB0aGlzIFR5cGUuXHJcbiAgICAgIHZhbHVlVHlwZTogdHlwZU5hbWUsIC8vIFRoZSB0eXBlIG9mIHRoZSByZXN1bHQgb2YgZXZhbHVhdGluZyB0aGlzIGV4cHJlc3Npb24uXHJcbiAgICAgIHZhbHVlOiB2YWwgICAgICAgICAgIC8vIFRoZSAoY29uc3RhbnQpIHZhbHVlIGl0c2VsZi5cclxuICAgIH07XHJcbiAgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2V4cChwYXR0ZXJuOiBzdHJpbmcsIG1vZGlmaWVycyA9IFwiXCIpOiBSZWdFeHBWYWx1ZSB7XHJcbiAgc3dpdGNoIChtb2RpZmllcnMpIHtcclxuICBjYXNlIFwiXCI6XHJcbiAgY2FzZSBcImlcIjpcclxuICAgIGJyZWFrO1xyXG4gIGRlZmF1bHQ6XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBSZWdFeHAgbW9kaWZpZXI6IFwiICsgbW9kaWZpZXJzKTtcclxuICB9XHJcbiAgcmV0dXJuIHtcclxuICAgIHR5cGU6ICdSZWdFeHAnLFxyXG4gICAgdmFsdWVUeXBlOiAnUmVnRXhwJyxcclxuICAgIHZhbHVlOiBwYXR0ZXJuLFxyXG4gICAgbW9kaWZpZXJzOiBtb2RpZmllcnNcclxuICB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBjbXBWYWx1ZXModjE6IEV4cCwgdjI6IEV4cFZhbHVlKTogYm9vbGVhbiB7XHJcbiAgaWYgKHYxLnR5cGUgIT09IHYyLnR5cGUpIHtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcbiAgcmV0dXJuICg8RXhwVmFsdWU+IHYxKS52YWx1ZSA9PT0gdjIudmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzT3Aob3BUeXBlOiBzdHJpbmcsIGV4cDogRXhwKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIGV4cC50eXBlID09PSAnb3AnICYmICg8RXhwT3A+IGV4cCkub3AgPT09IG9wVHlwZTtcclxufVxyXG5cclxuLy8gUmV0dXJuIGEgZ2VuZXJhdGluZyBmdW5jdGlvbiB0byBtYWtlIGFuIG9wZXJhdG9yIGV4cCBub2RlLlxyXG5mdW5jdGlvbiBvcEdlbihvcFR5cGU6IHN0cmluZywgYXJpdHk6IG51bWJlciA9IDIpOiAoKC4uLmFyZ3M6IEV4cFtdKSA9PiBFeHBPcCkge1xyXG4gIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKTogRXhwT3Age1xyXG4gICAgaWYgKGFyZ3MubGVuZ3RoICE9PSBhcml0eSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPcGVyYXRvciBoYXMgXCIgKyBhcmdzLmxlbmd0aCArXHJcbiAgICAgICAgICAgICAgICAgICAgICBcIiBhcmd1bWVudHMgKGV4cGVjdGluZyBcIiArIGFyaXR5ICsgXCIpLlwiKTtcclxuICAgIH1cclxuICAgIHJldHVybiBvcChvcFR5cGUsIGFyZ3MpO1xyXG4gIH07XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgYW5kQXJyYXkgPSBsZWZ0QXNzb2NpYXRlR2VuKCcmJicsIGJvb2xlYW4odHJ1ZSksIGJvb2xlYW4oZmFsc2UpKTtcclxuZXhwb3J0IHZhciBvckFycmF5ID0gbGVmdEFzc29jaWF0ZUdlbignfHwnLCBib29sZWFuKGZhbHNlKSwgYm9vbGVhbih0cnVlKSk7XHJcblxyXG4vLyBDcmVhdGUgYW4gZXhwcmVzc2lvbiBidWlsZGVyIGZ1bmN0aW9uIHdoaWNoIG9wZXJhdGVzIG9uIGFycmF5cyBvZiB2YWx1ZXMuXHJcbi8vIFJldHVybnMgbmV3IGV4cHJlc3Npb24gbGlrZSB2MSBvcCB2MiBvcCB2MyAuLi5cclxuLy9cclxuLy8gLSBBbnkgaWRlbnRpdHlWYWx1ZSdzIGluIGFycmF5IGlucHV0IGFyZSBpZ25vcmVkLlxyXG4vLyAtIElmIHplcm9WYWx1ZSBpcyBmb3VuZCAtIGp1c3QgcmV0dXJuIHplcm9WYWx1ZS5cclxuLy9cclxuLy8gT3VyIGZ1bmN0aW9uIHJlLW9yZGVycyB0b3AtbGV2ZWwgb3AgaW4gYXJyYXkgZWxlbWVudHMgdG8gdGhlIHJlc3VsdGluZ1xyXG4vLyBleHByZXNzaW9uIGlzIGxlZnQtYXNzb2NpYXRpbmcuICBFLmcuOlxyXG4vL1xyXG4vLyAgICBbYSAmJiBiLCBjICYmIGRdID0+ICgoKGEgJiYgYikgJiYgYykgJiYgZClcclxuLy8gICAgKE5PVCAoYSAmJiBiKSAmJiAoYyAmJiBkKSlcclxuZnVuY3Rpb24gbGVmdEFzc29jaWF0ZUdlbihvcFR5cGU6IHN0cmluZywgaWRlbnRpdHlWYWx1ZTogRXhwVmFsdWUsIHplcm9WYWx1ZTogRXhwVmFsdWUpIHtcclxuICByZXR1cm4gZnVuY3Rpb24oYTogRXhwW10pOiBFeHAge1xyXG4gICAgdmFyIGk6IG51bWJlcjtcclxuXHJcbiAgICBmdW5jdGlvbiByZWR1Y2VyKHJlc3VsdDogRXhwLCBjdXJyZW50OiBFeHApIHtcclxuICAgICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgcmV0dXJuIGN1cnJlbnQ7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIG9wKG9wVHlwZSwgW3Jlc3VsdCwgY3VycmVudF0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEZpcnN0IGZsYXR0ZW4gYWxsIHRvcC1sZXZlbCBvcCB2YWx1ZXMgdG8gb25lIGZsYXQgYXJyYXkuXHJcbiAgICB2YXIgZmxhdCA9IDxFeHBbXT5bXTtcclxuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGZsYXR0ZW4ob3BUeXBlLCBhW2ldLCBmbGF0KTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcmVzdWx0ID0gPEV4cFtdPltdO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IGZsYXQubGVuZ3RoOyBpKyspIHtcclxuICAgICAgLy8gUmVtb3ZlIGlkZW50aWZ5VmFsdWVzIGZyb20gYXJyYXkuXHJcbiAgICAgIGlmIChjbXBWYWx1ZXMoZmxhdFtpXSwgaWRlbnRpdHlWYWx1ZSkpIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICAvLyBKdXN0IHJldHVybiB6ZXJvVmFsdWUgaWYgZm91bmRcclxuICAgICAgaWYgKGNtcFZhbHVlcyhmbGF0W2ldLCB6ZXJvVmFsdWUpKSB7XHJcbiAgICAgICAgcmV0dXJuIHplcm9WYWx1ZTtcclxuICAgICAgfVxyXG4gICAgICByZXN1bHQucHVzaChmbGF0W2ldKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICByZXR1cm4gaWRlbnRpdHlWYWx1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBSZXR1cm4gbGVmdC1hc3NvY2lhdGl2ZSBleHByZXNzaW9uIG9mIG9wVHlwZS5cclxuICAgIHJldHVybiByZXN1bHQucmVkdWNlKHJlZHVjZXIpO1xyXG4gIH07XHJcbn1cclxuXHJcbi8vIEZsYXR0ZW4gdGhlIHRvcCBsZXZlbCB0cmVlIG9mIG9wIGludG8gYSBzaW5nbGUgZmxhdCBhcnJheSBvZiBleHByZXNzaW9ucy5cclxuZXhwb3J0IGZ1bmN0aW9uIGZsYXR0ZW4ob3BUeXBlOiBzdHJpbmcsIGV4cDogRXhwLCBmbGF0PzogRXhwW10pOiBFeHBbXSB7XHJcbiAgdmFyIGk6IG51bWJlcjtcclxuXHJcbiAgaWYgKGZsYXQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgZmxhdCA9IFtdO1xyXG4gIH1cclxuXHJcbiAgaWYgKCFpc09wKG9wVHlwZSwgZXhwKSkge1xyXG4gICAgZmxhdC5wdXNoKGV4cCk7XHJcbiAgICByZXR1cm4gZmxhdDtcclxuICB9XHJcblxyXG4gIGZvciAoaSA9IDA7IGkgPCAoPEV4cE9wPiBleHApLmFyZ3MubGVuZ3RoOyBpKyspIHtcclxuICAgIGZsYXR0ZW4ob3BUeXBlLCAoPEV4cE9wPiBleHApLmFyZ3NbaV0sIGZsYXQpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGZsYXQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBvcChvcFR5cGU6IHN0cmluZywgYXJnczogRXhwW10pOiBFeHBPcCB7XHJcbiAgcmV0dXJuIHtcclxuICAgIHR5cGU6ICdvcCcsICAgICAvLyBUaGlzIGlzIChtdWx0aS1hcmd1bWVudCkgb3BlcmF0b3IuXHJcbiAgICB2YWx1ZVR5cGU6ICdBbnknLFxyXG4gICAgb3A6IG9wVHlwZSwgICAgIC8vIFRoZSBvcGVyYXRvciAoc3RyaW5nLCBlLmcuICcrJykuXHJcbiAgICBhcmdzOiBhcmdzICAgICAgLy8gQXJndW1lbnRzIHRvIHRoZSBvcGVyYXRvciBBcnJheTxleHA+XHJcbiAgfTtcclxufVxyXG5cclxuLy8gV2FybmluZzogTk9UIGFuIGV4cHJlc3Npb24gdHlwZSFcclxuZXhwb3J0IGZ1bmN0aW9uIG1ldGhvZChwYXJhbXM6IHN0cmluZ1tdLCBib2R5OiBFeHApOiBNZXRob2Qge1xyXG4gIHJldHVybiB7XHJcbiAgICBwYXJhbXM6IHBhcmFtcyxcclxuICAgIGJvZHk6IGJvZHlcclxuICB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdHlwZVR5cGUodHlwZU5hbWU6IHN0cmluZyk6IEV4cFNpbXBsZVR5cGUge1xyXG4gIHJldHVybiB7IHR5cGU6IFwidHlwZVwiLCB2YWx1ZVR5cGU6IFwidHlwZVwiLCBuYW1lOiB0eXBlTmFtZSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdW5pb25UeXBlKHR5cGVzOiBFeHBUeXBlW10pOiBFeHBVbmlvblR5cGUge1xyXG4gIHJldHVybiB7IHR5cGU6IFwidW5pb25cIiwgdmFsdWVUeXBlOiBcInR5cGVcIiwgdHlwZXM6IHR5cGVzIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmljVHlwZSh0eXBlTmFtZTogc3RyaW5nLCBwYXJhbXM6IEV4cFR5cGVbXSk6IEV4cEdlbmVyaWNUeXBlIHtcclxuICByZXR1cm4geyB0eXBlOiBcImdlbmVyaWNcIiwgdmFsdWVUeXBlOiBcInR5cGVcIiwgbmFtZTogdHlwZU5hbWUsIHBhcmFtczogcGFyYW1zIH07XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBTeW1ib2xzIHtcclxuICBmdW5jdGlvbnM6IHsgW25hbWU6IHN0cmluZ106IE1ldGhvZCB9O1xyXG4gIHBhdGhzOiBQYXRoW107XHJcbiAgc2NoZW1hOiB7IFtuYW1lOiBzdHJpbmddOiBTY2hlbWEgfTtcclxuICBpbXBvcnRzOiBJbXBvcnRbXSA7XHJcblxyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgdGhpcy5mdW5jdGlvbnMgPSB7fTtcclxuICAgIHRoaXMucGF0aHMgPSBbXTtcclxuICAgIHRoaXMuc2NoZW1hID0ge307XHJcbiAgICB0aGlzLmltcG9ydHMgPSBbXTtcclxuICB9XHJcblxyXG4gIHJlZ2lzdGVyPFQ+KG1hcDoge1tuYW1lOiBzdHJpbmddOiBUfSwgdHlwZU5hbWU6IHN0cmluZywgbmFtZTogc3RyaW5nLCBvYmplY3Q6IFQpOiBUIHtcclxuICAgIGlmIChtYXBbbmFtZV0pIHtcclxuICAgICAgbG9nZ2VyLmVycm9yKFwiRHVwbGljYXRlZCBcIiArIHR5cGVOYW1lICsgXCIgZGVmaW5pdGlvbjogXCIgKyBuYW1lICsgXCIuXCIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbWFwW25hbWVdID0gb2JqZWN0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG1hcFtuYW1lXTtcclxuICB9XHJcblxyXG4gIHJlZ2lzdGVyRnVuY3Rpb24obmFtZTogc3RyaW5nLCBwYXJhbXM6IHN0cmluZ1tdLCBib2R5OiBFeHApOiBNZXRob2Qge1xyXG4gICAgcmV0dXJuIHRoaXMucmVnaXN0ZXI8TWV0aG9kPih0aGlzLmZ1bmN0aW9ucywgJ2Z1bmN0aW9ucycsIG5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZChwYXJhbXMsIGJvZHkpKTtcclxuICB9XHJcblxyXG4gIHJlZ2lzdGVySW1wb3J0KGFsaWFzOiBzdHJpbmcsIGRhdGE6IHN0cmluZywgc2NvcGU6IHN0cmluZyk6IEltcG9ydCB7XHJcbiAgICAvLyB0eXBlLCBuYW1lLCBkYXRhXHJcbiAgICB2YXIgdGhlU2NvcGUgPSBmYWxzZTtcclxuICAgIGlmIChzY29wZSkge1xyXG4gICAgICB0aGVTY29wZSA9IHRydWU7XHJcbiAgICB9XHJcbiAgICB2YXIgdGhlQWxpYXMgPSBcIlwiO1xyXG4gICAgaWYgKGFsaWFzKSB7XHJcbiAgICAgIHRoZUFsaWFzID0gYWxpYXM7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGk6IEltcG9ydCA9IHtcclxuICAgICAgZmlsZW5hbWUgOiBkYXRhLFxyXG4gICAgICBhbGlhczogdGhlQWxpYXMsXHJcbiAgICAgIHNjb3BlOiAhdGhlU2NvcGVcclxuICAgIH07XHJcbiAgICB0aGlzLmltcG9ydHMucHVzaChpKTtcclxuICAgIHJldHVybiBpO1xyXG4gIH1cclxuXHJcbiAgcmVnaXN0ZXJQYXRoKHRlbXBsYXRlOiBQYXRoVGVtcGxhdGUsIGlzVHlwZTogRXhwVHlwZSB8IHZvaWQsIG1ldGhvZHM6IHsgW25hbWU6IHN0cmluZ106IE1ldGhvZDsgfSA9IHt9KTogUGF0aCB7XHJcbiAgICBpc1R5cGUgPSBpc1R5cGUgfHwgdHlwZVR5cGUoJ0FueScpO1xyXG4gICAgdmFyIHA6IFBhdGggPSB7XHJcbiAgICAgIHRlbXBsYXRlOiB0ZW1wbGF0ZS5jb3B5KCksXHJcbiAgICAgIGlzVHlwZTogPEV4cFR5cGU+IGlzVHlwZSxcclxuICAgICAgbWV0aG9kczogbWV0aG9kc1xyXG4gICAgfTtcclxuICAgIHRoaXMucGF0aHMucHVzaChwKTtcclxuICAgIHJldHVybiBwO1xyXG4gIH1cclxuXHJcbiAgcmVnaXN0ZXJTY2hlbWEobmFtZTogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgIGRlcml2ZWRGcm9tPzogRXhwVHlwZSxcclxuICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzID0gPFR5cGVQYXJhbXM+IHt9LFxyXG4gICAgICAgICAgICAgICAgIG1ldGhvZHMgPSA8eyBbbmFtZTogc3RyaW5nXTogTWV0aG9kIH0+IHt9LFxyXG4gICAgICAgICAgICAgICAgIHBhcmFtcyA9IDxzdHJpbmdbXT4gW10pXHJcbiAgOiBTY2hlbWEge1xyXG4gICAgZGVyaXZlZEZyb20gPSBkZXJpdmVkRnJvbSB8fCB0eXBlVHlwZShPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5sZW5ndGggPiAwID8gJ09iamVjdCcgOiAnQW55Jyk7XHJcblxyXG4gICAgdmFyIHM6IFNjaGVtYSA9IHtcclxuICAgICAgZGVyaXZlZEZyb206IDxFeHBUeXBlPiBkZXJpdmVkRnJvbSxcclxuICAgICAgcHJvcGVydGllczogcHJvcGVydGllcyxcclxuICAgICAgbWV0aG9kczogbWV0aG9kcyxcclxuICAgICAgcGFyYW1zOiBwYXJhbXMsXHJcbiAgICB9O1xyXG4gICAgcmV0dXJuIHRoaXMucmVnaXN0ZXI8U2NoZW1hPih0aGlzLnNjaGVtYSwgJ3NjaGVtYScsIG5hbWUsIHMpO1xyXG4gIH1cclxuXHJcbiAgaXNEZXJpdmVkRnJvbSh0eXBlOiBFeHBUeXBlLCBhbmNlc3Rvcjogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoYW5jZXN0b3IgPT09ICdBbnknKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAodHlwZS50eXBlKSB7XHJcbiAgICBjYXNlICd0eXBlJzpcclxuICAgIGNhc2UgJ2dlbmVyaWMnOlxyXG4gICAgICBsZXQgc2ltcGxlVHlwZSA9IDxFeHBTaW1wbGVUeXBlPiB0eXBlO1xyXG4gICAgICBpZiAoc2ltcGxlVHlwZS5uYW1lID09PSBhbmNlc3Rvcikge1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChzaW1wbGVUeXBlLm5hbWUgPT09ICdBbnknKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICAgIGxldCBzY2hlbWEgPSB0aGlzLnNjaGVtYVtzaW1wbGVUeXBlLm5hbWVdO1xyXG4gICAgICBpZiAoIXNjaGVtYSkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdGhpcy5pc0Rlcml2ZWRGcm9tKHNjaGVtYS5kZXJpdmVkRnJvbSwgYW5jZXN0b3IpO1xyXG5cclxuICAgIGNhc2UgJ3VuaW9uJzpcclxuICAgICAgcmV0dXJuICg8RXhwVW5pb25UeXBlPiB0eXBlKS50eXBlc1xyXG4gICAgICAgIC5tYXAoKHN1YlR5cGUpID0+IHRoaXMuaXNEZXJpdmVkRnJvbShzdWJUeXBlLCBhbmNlc3RvcikpXHJcbiAgICAgICAgLnJlZHVjZSh1dGlsLm9yKTtcclxuXHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIHR5cGU6IFwiICsgdHlwZS50eXBlKTtcclxuICAgICAgfVxyXG4gIH1cclxufVxyXG5cclxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvT3BlcmF0b3JzL09wZXJhdG9yX1ByZWNlZGVuY2VcclxuaW50ZXJmYWNlIE9wUHJpb3JpdHkge1xyXG4gIHJlcD86IHN0cmluZztcclxuICBwOiBudW1iZXI7XHJcbn1cclxuXHJcbnZhciBKU19PUFM6IHsgW29wOiBzdHJpbmddOiBPcFByaW9yaXR5OyB9ID0ge1xyXG4gICd2YWx1ZSc6IHsgcmVwOiBcIlwiLCBwOiAxOCB9LFxyXG5cclxuICAnbmVnJzogeyByZXA6IFwiLVwiLCBwOiAxNX0sXHJcbiAgJyEnOiB7IHA6IDE1fSxcclxuICAnKic6IHsgcDogMTR9LFxyXG4gICcvJzogeyBwOiAxNH0sXHJcbiAgJyUnOiB7IHA6IDE0fSxcclxuICAnKyc6IHsgcDogMTMgfSxcclxuICAnLSc6IHsgcDogMTMgfSxcclxuICAnPCc6IHsgcDogMTEgfSxcclxuICAnPD0nOiB7IHA6IDExIH0sXHJcbiAgJz4nOiB7IHA6IDExIH0sXHJcbiAgJz49JzogeyBwOiAxMSB9LFxyXG4gICdpbic6IHsgcDogMTEgfSxcclxuICAnPT0nOiB7IHA6IDEwIH0sXHJcbiAgXCIhPVwiOiB7IHA6IDEwIH0sXHJcbiAgJyYmJzogeyBwOiA2IH0sXHJcbiAgJ3x8JzogeyBwOiA1IH0sXHJcbiAgJz86JzogeyBwOiA0IH0sXHJcbiAgJywnOiB7IHA6IDB9LFxyXG59O1xyXG5cclxuLy8gRnJvbSBhbiBBU1QsIGRlY29kZSBhcyBhbiBleHByZXNzaW9uIChzdHJpbmcpLlxyXG5leHBvcnQgZnVuY3Rpb24gZGVjb2RlRXhwcmVzc2lvbihleHA6IEV4cCwgb3V0ZXJQcmVjZWRlbmNlPzogbnVtYmVyKTogc3RyaW5nIHtcclxuICBpZiAob3V0ZXJQcmVjZWRlbmNlID09PSB1bmRlZmluZWQpIHtcclxuICAgIG91dGVyUHJlY2VkZW5jZSA9IDA7XHJcbiAgfVxyXG4gIHZhciBpbm5lclByZWNlZGVuY2UgPSBwcmVjZWRlbmNlT2YoZXhwKTtcclxuICB2YXIgcmVzdWx0ID0gJyc7XHJcblxyXG4gIHN3aXRjaCAoZXhwLnR5cGUpIHtcclxuICBjYXNlICdCb29sZWFuJzpcclxuICBjYXNlICdOdW1iZXInOlxyXG4gICAgcmVzdWx0ID0gSlNPTi5zdHJpbmdpZnkoKDxFeHBWYWx1ZT4gZXhwKS52YWx1ZSk7XHJcbiAgICBicmVhaztcclxuXHJcbiAgY2FzZSAnU3RyaW5nJzpcclxuICAgIHJlc3VsdCA9IHV0aWwucXVvdGVTdHJpbmcoKDxFeHBWYWx1ZT4gZXhwKS52YWx1ZSk7XHJcbiAgICBicmVhaztcclxuXHJcbiAgLy8gUmVnRXhwIGFzc3VtZWQgdG8gYmUgaW4gcHJlLXF1b3RlZCBmb3JtYXQuXHJcbiAgY2FzZSAnUmVnRXhwJzpcclxuICAgIGxldCByZWdleHAgPSA8UmVnRXhwVmFsdWU+IGV4cDtcclxuICAgIHJlc3VsdCA9ICcvJyArIHJlZ2V4cC52YWx1ZSArICcvJztcclxuICAgIGlmIChyZWdleHAubW9kaWZpZXJzICE9PSAnJykge1xyXG4gICAgICByZXN1bHQgKz0gcmVnZXhwLm1vZGlmaWVycztcclxuICAgIH1cclxuICAgIGJyZWFrO1xyXG5cclxuICBjYXNlICdBcnJheSc6XHJcbiAgICByZXN1bHQgPSAnWycgKyBkZWNvZGVBcnJheSgoPEV4cFZhbHVlPiBleHApLnZhbHVlKSArICddJztcclxuICAgIGJyZWFrO1xyXG5cclxuICBjYXNlICdOdWxsJzpcclxuICAgIHJlc3VsdCA9ICdudWxsJztcclxuICAgIGJyZWFrO1xyXG5cclxuICBjYXNlICd2YXInOlxyXG4gIGNhc2UgJ2xpdGVyYWwnOlxyXG4gICAgcmVzdWx0ID0gKDxFeHBWYXJpYWJsZT4gZXhwKS5uYW1lO1xyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ3JlZic6XHJcbiAgICBsZXQgZXhwUmVmID0gPEV4cFJlZmVyZW5jZT4gZXhwO1xyXG4gICAgaWYgKGlzSWRlbnRpZmllclN0cmluZ0V4cChleHBSZWYuYWNjZXNzb3IpKSB7XHJcbiAgICAgIHJlc3VsdCA9IGRlY29kZUV4cHJlc3Npb24oZXhwUmVmLmJhc2UsIGlubmVyUHJlY2VkZW5jZSkgKyAnLicgKyAoPEV4cFZhbHVlPiBleHBSZWYuYWNjZXNzb3IpLnZhbHVlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmVzdWx0ID0gZGVjb2RlRXhwcmVzc2lvbihleHBSZWYuYmFzZSwgaW5uZXJQcmVjZWRlbmNlKSArXHJcbiAgICAgICAgJ1snICsgZGVjb2RlRXhwcmVzc2lvbihleHBSZWYuYWNjZXNzb3IpICsgJ10nO1xyXG4gICAgfVxyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ2NhbGwnOlxyXG4gICAgbGV0IGV4cENhbGwgPSA8RXhwQ2FsbD4gZXhwO1xyXG4gICAgcmVzdWx0ID0gZGVjb2RlRXhwcmVzc2lvbihleHBDYWxsLnJlZikgKyAnKCcgKyBkZWNvZGVBcnJheShleHBDYWxsLmFyZ3MpICsgJyknO1xyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ2J1aWx0aW4nOlxyXG4gICAgcmVzdWx0ID0gZGVjb2RlRXhwcmVzc2lvbihleHApO1xyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ29wJzpcclxuICAgIGxldCBleHBPcCA9IDxFeHBPcD4gZXhwO1xyXG4gICAgdmFyIHJlcCA9IEpTX09QU1tleHBPcC5vcF0ucmVwID09PSB1bmRlZmluZWQgPyBleHBPcC5vcCA6IEpTX09QU1tleHBPcC5vcF0ucmVwO1xyXG4gICAgaWYgKGV4cE9wLmFyZ3MubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgIHJlc3VsdCA9IHJlcCArIGRlY29kZUV4cHJlc3Npb24oZXhwT3AuYXJnc1swXSwgaW5uZXJQcmVjZWRlbmNlKTtcclxuICAgIH0gZWxzZSBpZiAoZXhwT3AuYXJncy5sZW5ndGggPT09IDIpIHtcclxuICAgICAgcmVzdWx0ID1cclxuICAgICAgICBkZWNvZGVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMF0sIGlubmVyUHJlY2VkZW5jZSkgK1xyXG4gICAgICAgICcgJyArIHJlcCArICcgJyArXHJcbiAgICAgICAgLy8gQWxsIG9wcyBhcmUgbGVmdCBhc3NvY2lhdGl2ZSAtIHNvIG51ZGdlIHRoZSBpbm5lclByZWNlbmRlbmNlXHJcbiAgICAgICAgLy8gZG93biBvbiB0aGUgcmlnaHQgaGFuZCBzaWRlIHRvIGZvcmNlICgpIGZvciByaWdodC1hc3NvY2lhdGluZ1xyXG4gICAgICAgIC8vIG9wZXJhdGlvbnMuXHJcbiAgICAgICAgZGVjb2RlRXhwcmVzc2lvbihleHBPcC5hcmdzWzFdLCBpbm5lclByZWNlZGVuY2UgKyAxKTtcclxuICAgIH0gZWxzZSBpZiAoZXhwT3AuYXJncy5sZW5ndGggPT09IDMpIHtcclxuICAgICAgcmVzdWx0ID1cclxuICAgICAgICBkZWNvZGVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMF0sIGlubmVyUHJlY2VkZW5jZSkgKyAnID8gJyArXHJcbiAgICAgICAgZGVjb2RlRXhwcmVzc2lvbihleHBPcC5hcmdzWzFdLCBpbm5lclByZWNlZGVuY2UpICsgJyA6ICcgK1xyXG4gICAgICAgIGRlY29kZUV4cHJlc3Npb24oZXhwT3AuYXJnc1syXSwgaW5uZXJQcmVjZWRlbmNlKTtcclxuICAgIH1cclxuICAgIGJyZWFrO1xyXG5cclxuICBjYXNlICd0eXBlJzpcclxuICAgIHJlc3VsdCA9ICg8RXhwU2ltcGxlVHlwZT4gZXhwKS5uYW1lO1xyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ3VuaW9uJzpcclxuICAgIHJlc3VsdCA9ICg8RXhwVW5pb25UeXBlPiBleHApLnR5cGVzLm1hcChkZWNvZGVFeHByZXNzaW9uKS5qb2luKCcgfCAnKTtcclxuICAgIGJyZWFrO1xyXG5cclxuICBjYXNlICdnZW5lcmljJzpcclxuICAgIGxldCBnZW5lcmljVHlwZSA9IDxFeHBHZW5lcmljVHlwZT4gZXhwO1xyXG4gICAgcmV0dXJuIGdlbmVyaWNUeXBlLm5hbWUgKyAnPCcgKyBkZWNvZGVBcnJheShnZW5lcmljVHlwZS5wYXJhbXMpICsgJz4nO1xyXG5cclxuICBkZWZhdWx0OlxyXG4gICAgcmVzdWx0ID0gXCIqKipVTktOT1dOIFRZUEUqKiogKFwiICsgZXhwLnR5cGUgKyBcIilcIjtcclxuICAgIGJyZWFrO1xyXG4gIH1cclxuXHJcbiAgaWYgKGlubmVyUHJlY2VkZW5jZSA8IG91dGVyUHJlY2VkZW5jZSkge1xyXG4gICAgcmVzdWx0ID0gJygnICsgcmVzdWx0ICsgJyknO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVjb2RlQXJyYXkoYXJnczogRXhwW10pOiBzdHJpbmcge1xyXG4gIHJldHVybiBhcmdzLm1hcChkZWNvZGVFeHByZXNzaW9uKS5qb2luKCcsICcpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwcmVjZWRlbmNlT2YoZXhwOiBFeHApOiBudW1iZXIge1xyXG4gIGxldCByZXN1bHQ6IG51bWJlcjtcclxuXHJcbiAgc3dpdGNoIChleHAudHlwZSkge1xyXG4gIGNhc2UgJ29wJzpcclxuICAgIHJlc3VsdCA9IEpTX09QU1soPEV4cE9wPiBleHApLm9wXS5wO1xyXG4gICAgYnJlYWs7XHJcblxyXG4gIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL09wZXJhdG9ycy9PcGVyYXRvcl9QcmVjZWRlbmNlXHJcbiAgLy8gbGlzdHMgY2FsbCBhcyAxNyBhbmQgcmVmIGFzIDE4IC0gYnV0IGhvdyBjb3VsZCB0aGV5IGJlIGFueXRoaW5nIG90aGVyIHRoYW4gbGVmdCB0byByaWdodD9cclxuICAvLyBodHRwOi8vd3d3LnNjcmlwdGluZ21hc3Rlci5jb20vamF2YXNjcmlwdC9vcGVyYXRvci1wcmVjZWRlbmNlLmFzcCAtIGFncmVlcy5cclxuICBjYXNlICdjYWxsJzpcclxuICAgIHJlc3VsdCA9IDE4O1xyXG4gICAgYnJlYWs7XHJcbiAgY2FzZSAncmVmJzpcclxuICAgIHJlc3VsdCA9IDE4O1xyXG4gICAgYnJlYWs7XHJcbiAgZGVmYXVsdDpcclxuICAgIHJlc3VsdCA9IDE5O1xyXG4gICAgYnJlYWs7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gcmVzdWx0O1xyXG59XHJcbiJdfQ==
