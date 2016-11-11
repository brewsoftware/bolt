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
var util = require('./util');
var ast = require('./ast');
var logger_1 = require('./logger');
var parser = require('./rules-parser');
var parse_util_1 = require('./parse-util');
var errors = {
    badIndex: "The index function must return a String or an array of Strings.",
    noPaths: "Must have at least one path expression.",
    nonObject: "Type contains properties and must extend 'Object'.",
    missingSchema: "Missing definition for type.",
    recursive: "Recursive function call.",
    mismatchParams: "Incorrect number of function arguments.",
    generateFailed: "Could not generate JSON: ",
    noSuchType: "No type definition for: ",
    badSchemaMethod: "Unsupported method name in type statement: ",
    badPathMethod: "Unsupported method name in path statement: ",
    badWriteAlias: "Cannot have both a write() method and a write-aliasing method: ",
    coercion: "Cannot convert value: ",
    undefinedFunction: "Undefined function: ",
    application: "Bolt application error: ",
    invalidGeneric: "Invalid generic schema usage: ",
    invalidMapKey: "Map<Key, T> - Key must derive from String type.",
    invalidWildChildren: "Types can have at most one $wild property and cannot mix with other properties.",
    invalidPropertyName: "Property names cannot contain any of: . $ # [ ] / or control characters: "
};
var INVALID_KEY_REGEX = /[\[\].#$\/\u0000-\u001F\u007F]/;
;
var builtinSchemaNames = ['Any', 'Null', 'String', 'Number', 'Boolean', 'Object'];
// Method names allowed in Bolt files.
var valueMethods = ['length', 'includes', 'startsWith', 'beginsWith', 'endsWith',
    'replace', 'toLowerCase', 'toUpperCase', 'test', 'contains',
    'matches'];
// TODO: Make sure users don't call internal methods...make private to impl.
var snapshotMethods = ['parent', 'child', 'hasChildren', 'val', 'isString', 'isNumber',
    'isBoolean'].concat(valueMethods);
var writeAliases = {
    'create': parse_util_1.parseExpression('prior(this) == null'),
    'update': parse_util_1.parseExpression('prior(this) != null && this != null'),
    'delete': parse_util_1.parseExpression('prior(this) != null && this == null')
};
// Usage:
//   json = bolt.generate(bolt-text)
function generate(symbols) {
    if (typeof symbols === 'string') {
        symbols = parser.parse(symbols);
    }
    var gen = new Generator(symbols);
    return gen.generateRules();
}
exports.generate = generate;
// Symbols contains:
//   functions: {}
//   schema: {}
//   paths: {}
var Generator = (function () {
    function Generator(symbols) {
        this.symbols = symbols;
        this.validators = {};
        this.rules = {};
        this.errorCount = 0;
        this.runSilently = false;
        this.allowUndefinedFunctions = false;
        this.keyIndex = 0;
        // TODO: globals should be part of this.symbols (nested scopes)
        this.globals = {
            "root": ast.call(ast.variable('@root'))
        };
        this.registerBuiltinSchema();
    }
    // Return Firebase compatible Rules JSON for a the given symbols definitions.
    Generator.prototype.generateRules = function () {
        var _this = this;
        this.errorCount = 0;
        var paths = this.symbols.paths;
        var schema = this.symbols.schema;
        var name;
        paths.forEach(function (path) {
            _this.validateMethods(errors.badPathMethod, path.methods, ['validate', 'read', 'write', 'index']);
        });
        for (name in schema) {
            if (!util.arrayIncludes(builtinSchemaNames, name)) {
                this.validateMethods(errors.badSchemaMethod, schema[name].methods, ['validate', 'read', 'write']);
            }
        }
        if (paths.length === 0) {
            this.fatal(errors.noPaths);
        }
        paths.forEach(function (path) { return _this.updateRules(path); });
        this.convertExpressions(this.rules);
        if (this.errorCount !== 0) {
            throw new Error(errors.generateFailed + this.errorCount + " errors.");
        }
        util.deletePropName(this.rules, '.scope');
        util.pruneEmptyChildren(this.rules);
        return {
            rules: this.rules
        };
    };
    Generator.prototype.validateMethods = function (m, methods, allowed) {
        var _this = this;
        if (util.arrayIncludes(allowed, 'write')) {
            allowed = allowed.concat(Object.keys(writeAliases));
        }
        for (var method in methods) {
            if (!util.arrayIncludes(allowed, method)) {
                logger_1.warn(m + util.quoteString(method) +
                    " (allowed: " + allowed.map(util.quoteString).join(', ') + ")");
            }
        }
        if ('write' in methods) {
            Object.keys(writeAliases).forEach(function (alias) {
                if (alias in methods) {
                    _this.fatal(errors.badWriteAlias + alias);
                }
            });
        }
    };
    Generator.prototype.registerBuiltinSchema = function () {
        var self = this;
        var thisVar = ast.variable('this');
        function registerAsCall(name, methodName) {
            self.symbols.registerSchema(name, ast.typeType('Any'), undefined, {
                validate: ast.method(['this'], ast.call(ast.reference(ast.cast(thisVar, 'Any'), ast.string(methodName))))
            });
        }
        this.symbols.registerSchema('Any', ast.typeType('Any'), undefined, {
            validate: ast.method(['this'], ast.boolean(true))
        });
        registerAsCall('Object', 'hasChildren');
        // Because of the way firebase treats Null values, there is no way to
        // write a validation rule, that will EVER be called with this == null
        // (firebase allows values to be deleted no matter their validation rules).
        // So, comparing this == null will always return false -> that is what
        // we do here, which will be optimized away if ORed with other validations.
        this.symbols.registerSchema('Null', ast.typeType('Any'), undefined, {
            validate: ast.method(['this'], ast.boolean(false))
        });
        self.symbols.registerSchema('String', ast.typeType('Any'), undefined, {
            validate: ast.method(['this'], ast.call(ast.reference(ast.cast(thisVar, 'Any'), ast.string('isString')))),
            includes: ast.method(['this', 's'], ast.call(ast.reference(ast.value(thisVar), ast.string('contains')), [ast.value(ast.variable('s'))])),
            startsWith: ast.method(['this', 's'], ast.call(ast.reference(ast.value(thisVar), ast.string('beginsWith')), [ast.value(ast.variable('s'))])),
            endsWith: ast.method(['this', 's'], ast.call(ast.reference(ast.value(thisVar), ast.string('endsWith')), [ast.value(ast.variable('s'))])),
            replace: ast.method(['this', 's', 'r'], ast.call(ast.reference(ast.value(thisVar), ast.string('replace')), [ast.value(ast.variable('s')), ast.value(ast.variable('r'))])),
            test: ast.method(['this', 'r'], ast.call(ast.reference(ast.value(thisVar), ast.string('matches')), [ast.call(ast.variable('@RegExp'), [ast.variable('r')])]))
        });
        registerAsCall('Number', 'isNumber');
        registerAsCall('Boolean', 'isBoolean');
        this.symbols.registerFunction('@RegExp', ['r'], ast.builtin(this.ensureType.bind(this, 'RegExp')));
        var map = this.symbols.registerSchema('Map', ast.typeType('Any'), undefined, undefined, ['Key', 'Value']);
        map.getValidator = this.getMapValidator.bind(this);
    };
    // type Map<Key, Value> => {
    //   $key: {
    //     '.validate': $key instanceof Key and this instanceof Value;
    //   '.validate': 'newData.hasChildren()'
    // }
    // Key must derive from String
    Generator.prototype.getMapValidator = function (params) {
        var keyType = params[0];
        var valueType = params[1];
        if (keyType.type !== 'type' || !this.symbols.isDerivedFrom(keyType, 'String')) {
            throw new Error(errors.invalidMapKey + "  (" + ast.decodeExpression(keyType) + " does not)");
        }
        var validator = {};
        var index = this.uniqueKey();
        validator[index] = {};
        extendValidator(validator, this.ensureValidator(ast.typeType('Object')));
        // First validate the key (omit terminal String type validation).
        while (keyType.name !== 'String') {
            var schema = this.symbols.schema[keyType.name];
            if (schema.methods['validate']) {
                var exp = this.partialEval(schema.methods['validate'].body, { 'this': ast.literal(index) });
                extendValidator(validator[index], { '.validate': [exp] });
            }
            keyType = schema.derivedFrom;
        }
        extendValidator(validator[index], this.ensureValidator(valueType));
        return validator;
    };
    Generator.prototype.uniqueKey = function () {
        this.keyIndex += 1;
        return '$key' + this.keyIndex;
    };
    // Collection schema has exactly one $wildchild property
    Generator.prototype.isCollectionSchema = function (schema) {
        var props = Object.keys(schema.properties);
        var result = props.length === 1 && props[0][0] === '$';
        return result;
    };
    // Ensure we have a definition for a validator for the given schema.
    Generator.prototype.ensureValidator = function (type) {
        var key = ast.decodeExpression(type);
        if (!this.validators[key]) {
            this.validators[key] = { '.validate': ast.literal('***TYPE RECURSION***') };
            var allowSave = this.allowUndefinedFunctions;
            this.allowUndefinedFunctions = true;
            this.validators[key] = this.createValidator(type);
            this.allowUndefinedFunctions = allowSave;
        }
        return this.validators[key];
    };
    Generator.prototype.createValidator = function (type) {
        var _this = this;
        switch (type.type) {
            case 'type':
                return this.createValidatorFromSchemaName(type.name);
            case 'union':
                var union_1 = {};
                type.types.forEach(function (typePart) {
                    // Make a copy
                    var singleType = extendValidator({}, _this.ensureValidator(typePart));
                    mapValidator(singleType, ast.andArray);
                    extendValidator(union_1, singleType);
                });
                mapValidator(union_1, ast.orArray);
                return union_1;
            case 'generic':
                var genericType = type;
                return this.createValidatorFromGeneric(genericType.name, genericType.params);
            default:
                throw new Error(errors.application + "invalid internal type: " + type.type);
        }
    };
    Generator.prototype.createValidatorFromGeneric = function (schemaName, params) {
        var schema = this.symbols.schema[schemaName];
        if (schema === undefined || !ast.Schema.isGeneric(schema)) {
            throw new Error(errors.noSuchType + schemaName + " (generic)");
        }
        var schemaParams = schema.params;
        if (params.length !== schemaParams.length) {
            throw new Error(errors.invalidGeneric + " expected <" + schemaParams.join(', ') + ">");
        }
        // Call custom validator, if given.
        if (schema.getValidator) {
            return schema.getValidator(params);
        }
        var bindings = {};
        for (var i = 0; i < params.length; i++) {
            bindings[schemaParams[i]] = params[i];
        }
        // Expand generics and generate validator from schema.
        schema = this.replaceGenericsInSchema(schema, bindings);
        return this.createValidatorFromSchema(schema);
    };
    Generator.prototype.replaceGenericsInSchema = function (schema, bindings) {
        var _this = this;
        var expandedSchema = {
            derivedFrom: this.replaceGenericsInExp(schema.derivedFrom, bindings),
            properties: {},
            methods: {}
        };
        var props = Object.keys(schema.properties);
        props.forEach(function (prop) {
            expandedSchema.properties[prop] =
                _this.replaceGenericsInExp(schema.properties[prop], bindings);
        });
        var methods = Object.keys(schema.methods);
        methods.forEach(function (methodName) {
            expandedSchema.methods[methodName] = _this.replaceGenericsInMethod(schema.methods[methodName], bindings);
        });
        return expandedSchema;
    };
    Generator.prototype.replaceGenericsInExp = function (exp, bindings) {
        var self = this;
        function replaceGenericsInArray(exps) {
            return exps.map(function (expPart) {
                return self.replaceGenericsInExp(expPart, bindings);
            });
        }
        switch (exp.type) {
            case 'op':
            case 'call':
                var opType = ast.copyExp(exp);
                opType.args = replaceGenericsInArray(opType.args);
                return opType;
            case 'type':
                var simpleType = exp;
                return bindings[simpleType.name] || simpleType;
            case 'union':
                var unionType = exp;
                return ast.unionType(replaceGenericsInArray(unionType.types));
            case 'generic':
                var genericType = exp;
                return ast.genericType(genericType.name, replaceGenericsInArray(genericType.params));
            default:
                return exp;
        }
    };
    Generator.prototype.replaceGenericsInMethod = function (method, bindings) {
        var expandedMethod = {
            params: method.params,
            body: method.body
        };
        expandedMethod.body = this.replaceGenericsInExp(method.body, bindings);
        return expandedMethod;
    };
    Generator.prototype.createValidatorFromSchemaName = function (schemaName) {
        var schema = this.symbols.schema[schemaName];
        if (!schema) {
            throw new Error(errors.noSuchType + schemaName);
        }
        if (ast.Schema.isGeneric(schema)) {
            throw new Error(errors.noSuchType + schemaName + " used as non-generic type.");
        }
        return this.createValidatorFromSchema(schema);
    };
    Generator.prototype.createValidatorFromSchema = function (schema) {
        var _this = this;
        var hasProps = Object.keys(schema.properties).length > 0 &&
            !this.isCollectionSchema(schema);
        if (hasProps && !this.symbols.isDerivedFrom(schema.derivedFrom, 'Object')) {
            this.fatal(errors.nonObject + " (is " + ast.decodeExpression(schema.derivedFrom) + ")");
            return {};
        }
        var validator = {};
        if (!(schema.derivedFrom.type === 'type' &&
            schema.derivedFrom.name === 'Any')) {
            extendValidator(validator, this.ensureValidator(schema.derivedFrom));
        }
        var requiredProperties = [];
        var wildProperties = 0;
        Object.keys(schema.properties).forEach(function (propName) {
            if (propName[0] === '$') {
                wildProperties += 1;
                if (INVALID_KEY_REGEX.test(propName.slice(1))) {
                    _this.fatal(errors.invalidPropertyName + propName);
                }
            }
            else {
                if (INVALID_KEY_REGEX.test(propName)) {
                    _this.fatal(errors.invalidPropertyName + propName);
                }
            }
            if (!validator[propName]) {
                validator[propName] = {};
            }
            var propType = schema.properties[propName];
            if (propName[0] !== '$' && !_this.isNullableType(propType)) {
                requiredProperties.push(propName);
            }
            extendValidator(validator[propName], _this.ensureValidator(propType));
        });
        if (wildProperties > 1 || wildProperties === 1 && requiredProperties.length > 0) {
            this.fatal(errors.invalidWildChildren);
        }
        if (requiredProperties.length > 0) {
            // this.hasChildren(requiredProperties)
            extendValidator(validator, { '.validate': [hasChildrenExp(requiredProperties)] });
        }
        // Disallow $other properties by default
        if (hasProps) {
            validator['$other'] = {};
            extendValidator(validator['$other'], { '.validate': ast.boolean(false) });
        }
        this.extendValidationMethods(validator, schema.methods);
        return validator;
    };
    Generator.prototype.isNullableType = function (type) {
        var result = this.symbols.isDerivedFrom(type, 'Null') ||
            this.symbols.isDerivedFrom(type, 'Map');
        return result;
    };
    // Update rules based on the given path expression.
    Generator.prototype.updateRules = function (path) {
        var i;
        var location = util.ensureObjectPath(this.rules, path.template.getLabels());
        var exp;
        extendValidator(location, this.ensureValidator(path.isType));
        location['.scope'] = path.template.getScope();
        this.extendValidationMethods(location, path.methods);
        // Write indices
        if (path.methods['index']) {
            switch (path.methods['index'].body.type) {
                case 'String':
                    exp = ast.array([path.methods['index'].body]);
                    break;
                case 'Array':
                    exp = path.methods['index'].body;
                    break;
                default:
                    this.fatal(errors.badIndex);
                    return;
            }
            var indices = [];
            for (i = 0; i < exp.value.length; i++) {
                if (exp.value[i].type !== 'String') {
                    this.fatal(errors.badIndex + " (not " + exp.value[i].type + ")");
                }
                else {
                    indices.push(exp.value[i].value);
                }
            }
            // TODO: Error check not over-writing index rules.
            location['.indexOn'] = indices;
        }
    };
    Generator.prototype.extendValidationMethods = function (validator, methods) {
        var writeMethods = [];
        ['create', 'update', 'delete'].forEach(function (method) {
            if (method in methods) {
                writeMethods.push(ast.andArray([writeAliases[method], methods[method].body]));
            }
        });
        if (writeMethods.length !== 0) {
            extendValidator(validator, { '.write': ast.orArray(writeMethods) });
        }
        ['validate', 'read', 'write'].forEach(function (method) {
            if (method in methods) {
                var methodValidator = {};
                methodValidator['.' + method] = methods[method].body;
                extendValidator(validator, methodValidator);
            }
        });
    };
    // Return union validator (||) over each schema
    Generator.prototype.unionValidators = function (schema) {
        var union = {};
        schema.forEach(function (typeName) {
            // First and the validator terms for a single type
            // Todo extend to unions and generics
            var singleType = extendValidator({}, this.ensureValidator(typeName));
            mapValidator(singleType, ast.andArray);
            extendValidator(union, singleType);
        }.bind(this));
        mapValidator(union, ast.orArray);
        return union;
    };
    // Convert expressions to text, and at the same time, apply pruning operations
    // to remove no-op rules.
    Generator.prototype.convertExpressions = function (validator) {
        var _this = this;
        var methodThisIs = { '.validate': 'newData',
            '.read': 'data',
            '.write': 'newData' };
        function hasWildcardSibling(path) {
            var parts = path.getLabels();
            var childPart = parts.pop();
            var parent = util.deepLookup(validator, parts);
            if (parent === undefined) {
                return false;
            }
            for (var _i = 0, _a = Object.keys(parent); _i < _a.length; _i++) {
                var prop = _a[_i];
                if (prop === childPart) {
                    continue;
                }
                if (prop[0] === '$') {
                    return true;
                }
            }
            return false;
        }
        mapValidator(validator, function (value, prop, scope, path) {
            if (prop in methodThisIs) {
                var result = _this.getExpressionText(ast.andArray(collapseHasChildren(value)), methodThisIs[prop], scope, path);
                // Remove no-op .read or .write rule if no sibling wildcard props.
                if ((prop === '.read' || prop === '.write') && result === 'false') {
                    if (!hasWildcardSibling(path)) {
                        return undefined;
                    }
                }
                // Remove no-op .validate rule if no sibling wildcard props.
                if (prop === '.validate' && result === 'true') {
                    if (!hasWildcardSibling(path)) {
                        return undefined;
                    }
                }
                return result;
            }
            return value;
        });
    };
    Generator.prototype.getExpressionText = function (exp, thisIs, scope, path) {
        if (!('type' in exp)) {
            throw new Error(errors.application + "Not an expression: " + util.prettyJSON(exp));
        }
        // First evaluate w/o binding of this to specific location.
        this.allowUndefinedFunctions = true;
        scope = util.extend({}, scope, { 'this': ast.cast(ast.call(ast.variable('@getThis')), 'Snapshot') });
        exp = this.partialEval(exp, scope);
        // Now re-evaluate the flattened expression.
        this.allowUndefinedFunctions = false;
        this.thisIs = thisIs;
        this.symbols.registerFunction('@getThis', [], ast.builtin(this.getThis.bind(this)));
        this.symbols.registerFunction('@root', [], ast.builtin(this.getRootReference.bind(this, path)));
        this.symbols.registerFunction('prior', ['exp'], ast.builtin(this.prior.bind(this)));
        this.symbols.registerFunction('key', [], ast.builtin(this.getKey.bind(this, path.length() === 0 ? '' : path.getPart(-1).label)));
        exp = this.partialEval(exp);
        delete this.symbols.functions['@getThis'];
        delete this.symbols.functions['@root'];
        delete this.symbols.functions['prior'];
        delete this.symbols.functions['key'];
        // Top level expressions should never be to a snapshot reference - should
        // always evaluate to a boolean.
        exp = ast.ensureBoolean(exp);
        return ast.decodeExpression(exp);
    };
    /*
     *  Wrapper for partialEval debugging.
     */
    Generator.prototype.partialEval = function (exp, params, functionCalls) {
        if (params === void 0) { params = {}; }
        if (functionCalls === void 0) { functionCalls = {}; }
        // Wrap real call for debugging.
        var result = this.partialEvalReal(exp, params, functionCalls);
        // console.log(ast.decodeExpression(exp) + " => " + ast.decodeExpression(result));
        return result;
    };
    // Partial evaluation of expressions - copy of expression tree (immutable).
    //
    // - Expand inline function calls.
    // - Replace local and global variables with their values.
    // - Expand snapshot references using child('ref').
    // - Coerce snapshot references to values as needed.
    Generator.prototype.partialEvalReal = function (exp, params, functionCalls) {
        if (params === void 0) { params = {}; }
        if (functionCalls === void 0) { functionCalls = {}; }
        var self = this;
        function subExpression(exp2) {
            return self.partialEval(exp2, params, functionCalls);
        }
        function valueExpression(exp2) {
            return ast.ensureValue(subExpression(exp2));
        }
        function booleanExpression(exp2) {
            return ast.ensureBoolean(subExpression(exp2));
        }
        function lookupVar(exp2) {
            // TODO: Unbound variable access should be an error.
            return params[exp2.name] || self.globals[exp2.name] || exp2;
        }
        // Convert ref[prop] => ref.child(prop)
        function snapshotChild(ref) {
            return ast.cast(ast.call(ast.reference(ref.base, ast.string('child')), [ref.accessor]), 'Snapshot');
        }
        switch (exp.type) {
            case 'op':
                var expOp = ast.copyExp(exp);
                // Ensure arguments are boolean (or values) where needed.
                if (expOp.op === 'value') {
                    expOp.args[0] = valueExpression(expOp.args[0]);
                }
                else if (expOp.op === '||' || expOp.op === '&&' || expOp.op === '!') {
                    for (var i = 0; i < expOp.args.length; i++) {
                        expOp.args[i] = booleanExpression(expOp.args[i]);
                    }
                }
                else if (expOp.op === '?:') {
                    expOp.args[0] = booleanExpression(expOp.args[0]);
                    expOp.args[1] = valueExpression(expOp.args[1]);
                    expOp.args[2] = valueExpression(expOp.args[2]);
                }
                else {
                    for (var i = 0; i < expOp.args.length; i++) {
                        expOp.args[i] = valueExpression(expOp.args[i]);
                    }
                }
                return expOp;
            case 'var':
                return lookupVar(exp);
            case 'ref':
                var expRef = ast.copyExp(exp);
                expRef.base = subExpression(expRef.base);
                // var[ref] => var[ref]
                if (expRef.base.valueType !== 'Snapshot') {
                    expRef.accessor = subExpression(expRef.accessor);
                    return expRef;
                }
                var propName = ast.getPropName(expRef);
                // snapshot.prop (static string property)
                if (propName !== '') {
                    // snapshot.valueMethod => snapshot.val().valueMethod
                    if (util.arrayIncludes(valueMethods, propName)) {
                        expRef.base = valueExpression(expRef.base);
                        return expRef;
                    }
                    // snapshot.ssMethod => snapshot.ssMethod
                    if (util.arrayIncludes(snapshotMethods, propName)) {
                        return expRef;
                    }
                }
                // snapshot[exp] => snapshot.child(exp) or
                // snapshot[ref] => snapshot.child(ref.val())
                expRef.accessor = valueExpression(expRef.accessor);
                return snapshotChild(expRef);
            case 'call':
                var expCall = ast.copyExp(exp);
                expCall.ref = subExpression(expCall.ref);
                var callee = this.lookupFunction(expCall.ref);
                // Expand the function call inline
                if (callee) {
                    var fn = callee.fn;
                    if (callee.self) {
                        expCall.args.unshift(ast.ensureValue(callee.self));
                    }
                    if (fn.params.length !== expCall.args.length) {
                        this.fatal(errors.mismatchParams + " ( " +
                            callee.methodName + " expects " + fn.params.length +
                            " but actually passed " + expCall.args.length + ")");
                        return exp;
                    }
                    if (fn.body.type === 'builtin') {
                        return fn.body.fn(expCall.args, params);
                    }
                    var innerParams = {};
                    for (var i = 0; i < fn.params.length; i++) {
                        innerParams[fn.params[i]] = subExpression(expCall.args[i]);
                    }
                    if (functionCalls[callee.methodName]) {
                        throw new Error(errors.recursive + " (" + callee.methodName + ")");
                    }
                    functionCalls[callee.methodName] = true;
                    var result = this.partialEval(fn.body, innerParams, functionCalls);
                    functionCalls[callee.methodName] = false;
                    return result;
                }
                // Can't expand function - but just expand the arguments.
                if (!this.allowUndefinedFunctions) {
                    var funcName = ast.getMethodName(expCall);
                    if (funcName !== '' && !(funcName in this.symbols.schema['String'].methods ||
                        util.arrayIncludes(snapshotMethods, funcName))) {
                        this.fatal(errors.undefinedFunction + ast.decodeExpression(expCall.ref));
                    }
                }
                for (var i = 0; i < expCall.args.length; i++) {
                    expCall.args[i] = subExpression(expCall.args[i]);
                }
                // Hack for snapshot.parent().val()
                // Todo - build table-based method signatures.
                if (ast.getMethodName(expCall) === 'parent') {
                    expCall = ast.cast(expCall, 'Snapshot');
                }
                return expCall;
            // Expression types (like literals) than need no expansion.
            default:
                return exp;
        }
    };
    // Builtin function - convert all 'this' to 'data' (from 'newData').
    // Args are function arguments, and params are the local (function) scope variables.
    Generator.prototype.prior = function (args, params) {
        var lastThisIs = this.thisIs;
        this.thisIs = 'data';
        var exp = this.partialEval(args[0], params);
        this.thisIs = lastThisIs;
        return exp;
    };
    // Builtin function - current value of 'this'
    Generator.prototype.getThis = function (args, params) {
        return ast.snapshotVariable(this.thisIs);
    };
    // Builtin function - ensure type of argument
    Generator.prototype.ensureType = function (type, args, params) {
        if (args.length !== 1) {
            throw new Error(errors.application + "ensureType arguments.");
        }
        var exp = this.partialEval(args[0], params);
        if (exp.type !== type) {
            throw new Error(errors.coercion + ast.decodeExpression(exp) + " => " + type);
        }
        return exp;
    };
    // Builtin function - return the parent key of 'this'.
    Generator.prototype.getKey = function (key, args, params) {
        if (args.length !== 0) {
            throw new Error(errors.mismatchParams + "(found " + args.length + " but expected 1)");
        }
        return key[0] === '$' ? ast.literal(key) : ast.string(key);
    };
    // Builtin function - return the reference to the root
    // When in read mode - use 'root'
    // When in write/validate - use path to root via newData.parent()...
    Generator.prototype.getRootReference = function (path, args, params) {
        if (args.length !== 0) {
            throw new Error(errors.application + "@root arguments.");
        }
        // 'data' case
        if (this.thisIs === 'data') {
            return ast.snapshotVariable('root');
        }
        // TODO(koss): Remove this special case if JSON supports newRoot instead.
        // 'newData' case - traverse to root via parent()'s.
        var result = ast.snapshotVariable('newData');
        for (var i = 0; i < path.length(); i++) {
            result = ast.snapshotParent(result);
        }
        return result;
    };
    // Lookup globally defined function.
    Generator.prototype.lookupFunction = function (ref) {
        // Function call.
        if (ref.type === 'var') {
            var refVar = ref;
            var fn = this.symbols.functions[refVar.name];
            if (!fn) {
                return undefined;
            }
            return { self: undefined, fn: fn, methodName: refVar.name };
        }
        // Method call.
        if (ref.type === 'ref') {
            var refRef = ref;
            // TODO: Require static type validation before calling String methods.
            if (refRef.base.op !== 'value' &&
                refRef.accessor.value in this.symbols.schema['String'].methods) {
                var methodName = refRef.accessor.value;
                return { self: refRef.base,
                    fn: this.symbols.schema['String'].methods[methodName],
                    methodName: 'String.' + methodName
                };
            }
        }
        return undefined;
    };
    Generator.prototype.fatal = function (s) {
        logger_1.error(s);
        this.errorCount += 1;
    };
    return Generator;
}());
exports.Generator = Generator;
;
// Merge all .X terms into target.
function extendValidator(target, src) {
    if (src === undefined) {
        throw new Error(errors.application + "Illegal validation source.");
    }
    for (var prop in src) {
        if (!src.hasOwnProperty(prop)) {
            continue;
        }
        if (prop[0] === '.') {
            if (target[prop] === undefined) {
                target[prop] = [];
            }
            if (util.isType(src[prop], 'array')) {
                util.extendArray(target[prop], src[prop]);
            }
            else {
                target[prop].push(src[prop]);
            }
        }
        else {
            if (!target[prop]) {
                target[prop] = {};
            }
            extendValidator(target[prop], src[prop]);
        }
    }
    return target;
}
exports.extendValidator = extendValidator;
// Call fn(value, prop, path) on all '.props' and assiging the value back into the
// validator.
function mapValidator(v, fn, scope, path) {
    if (!scope) {
        scope = {};
    }
    if (!path) {
        path = new ast.PathTemplate();
    }
    if ('.scope' in v) {
        scope = v['.scope'];
    }
    for (var prop in v) {
        if (!v.hasOwnProperty(prop)) {
            continue;
        }
        if (prop[0] === '.') {
            var value = fn(v[prop], prop, scope, path);
            if (value !== undefined) {
                v[prop] = value;
            }
            else {
                delete v[prop];
            }
        }
        else if (!util.isType(v[prop], 'object')) {
            continue;
        }
        else {
            var child = new ast.PathTemplate([prop]);
            path.push(child);
            mapValidator(v[prop], fn, scope, path);
            path.pop(child);
        }
    }
}
exports.mapValidator = mapValidator;
// Collapse all hasChildren calls into one (combining their arguments).
// E.g. [newData.hasChildren(), newData.hasChildren(['x']), newData.hasChildren(['y'])] =>
//      newData.hasChildren(['x', 'y'])
function collapseHasChildren(exps) {
    var hasHasChildren = false;
    var combined = [];
    var result = [];
    exps.forEach(function (exp) {
        if (exp.type !== 'call') {
            result.push(exp);
            return;
        }
        var expCall = exp;
        if (ast.getMethodName(expCall) !== 'hasChildren') {
            result.push(exp);
            return;
        }
        if (expCall.args.length === 0) {
            hasHasChildren = true;
            return;
        }
        // Expect one argument of Array type.
        if (expCall.args.length !== 1 || expCall.args[0].type !== 'Array') {
            throw new Error(errors.application + "Invalid argument to hasChildren(): " +
                expCall.args[0].type);
        }
        var args = expCall.args[0].value;
        args.forEach(function (arg) {
            hasHasChildren = true;
            if (arg.type !== 'String') {
                throw new Error(errors.application + "Expect string argument to hasChildren(), not: " +
                    arg.type);
            }
            combined.push(arg.value);
        });
    });
    if (hasHasChildren) {
        result.unshift(hasChildrenExp(combined));
    }
    return result;
}
// Generate this.hasChildren([props, ...]) or this.hasChildren()
function hasChildrenExp(props) {
    var args = props.length === 0 ? [] : [ast.array(props.map(ast.string))];
    return ast.call(ast.reference(ast.cast(ast.variable('this'), 'Any'), ast.string('hasChildren')), args);
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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Q0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDMUIsTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxHQUFHLGdEQUFnRDtvQkFDckUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzVCLENBQUM7WUFDRCxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUNuQixNQUFNLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFDRCxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxnRUFBZ0U7QUFDaEUsd0JBQXdCLEtBQWU7SUFDckMsSUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsS0FBSyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxFQUMvRSxJQUFJLENBQUMsQ0FBQztBQUN4QixDQUFDIiwiZmlsZSI6InJ1bGVzLWdlbmVyYXRvci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qXHJcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXHJcbiAqXHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XHJcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cclxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XHJcbiAqXHJcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuICpcclxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxyXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXHJcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxyXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4gKi9cclxuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xyXG5pbXBvcnQgKiBhcyBhc3QgZnJvbSAnLi9hc3QnO1xyXG5pbXBvcnQge3dhcm4sIGVycm9yfSBmcm9tICcuL2xvZ2dlcic7XHJcbmxldCBwYXJzZXIgPSByZXF1aXJlKCcuL3J1bGVzLXBhcnNlcicpO1xyXG5pbXBvcnQge3BhcnNlRXhwcmVzc2lvbn0gZnJvbSAnLi9wYXJzZS11dGlsJztcclxuXHJcbnZhciBlcnJvcnMgPSB7XHJcbiAgYmFkSW5kZXg6IFwiVGhlIGluZGV4IGZ1bmN0aW9uIG11c3QgcmV0dXJuIGEgU3RyaW5nIG9yIGFuIGFycmF5IG9mIFN0cmluZ3MuXCIsXHJcbiAgbm9QYXRoczogXCJNdXN0IGhhdmUgYXQgbGVhc3Qgb25lIHBhdGggZXhwcmVzc2lvbi5cIixcclxuICBub25PYmplY3Q6IFwiVHlwZSBjb250YWlucyBwcm9wZXJ0aWVzIGFuZCBtdXN0IGV4dGVuZCAnT2JqZWN0Jy5cIixcclxuICBtaXNzaW5nU2NoZW1hOiBcIk1pc3NpbmcgZGVmaW5pdGlvbiBmb3IgdHlwZS5cIixcclxuICByZWN1cnNpdmU6IFwiUmVjdXJzaXZlIGZ1bmN0aW9uIGNhbGwuXCIsXHJcbiAgbWlzbWF0Y2hQYXJhbXM6IFwiSW5jb3JyZWN0IG51bWJlciBvZiBmdW5jdGlvbiBhcmd1bWVudHMuXCIsXHJcbiAgZ2VuZXJhdGVGYWlsZWQ6IFwiQ291bGQgbm90IGdlbmVyYXRlIEpTT046IFwiLFxyXG4gIG5vU3VjaFR5cGU6IFwiTm8gdHlwZSBkZWZpbml0aW9uIGZvcjogXCIsXHJcbiAgYmFkU2NoZW1hTWV0aG9kOiBcIlVuc3VwcG9ydGVkIG1ldGhvZCBuYW1lIGluIHR5cGUgc3RhdGVtZW50OiBcIixcclxuICBiYWRQYXRoTWV0aG9kOiBcIlVuc3VwcG9ydGVkIG1ldGhvZCBuYW1lIGluIHBhdGggc3RhdGVtZW50OiBcIixcclxuICBiYWRXcml0ZUFsaWFzOiBcIkNhbm5vdCBoYXZlIGJvdGggYSB3cml0ZSgpIG1ldGhvZCBhbmQgYSB3cml0ZS1hbGlhc2luZyBtZXRob2Q6IFwiLFxyXG4gIGNvZXJjaW9uOiBcIkNhbm5vdCBjb252ZXJ0IHZhbHVlOiBcIixcclxuICB1bmRlZmluZWRGdW5jdGlvbjogXCJVbmRlZmluZWQgZnVuY3Rpb246IFwiLFxyXG4gIGFwcGxpY2F0aW9uOiBcIkJvbHQgYXBwbGljYXRpb24gZXJyb3I6IFwiLFxyXG4gIGludmFsaWRHZW5lcmljOiBcIkludmFsaWQgZ2VuZXJpYyBzY2hlbWEgdXNhZ2U6IFwiLFxyXG4gIGludmFsaWRNYXBLZXk6IFwiTWFwPEtleSwgVD4gLSBLZXkgbXVzdCBkZXJpdmUgZnJvbSBTdHJpbmcgdHlwZS5cIixcclxuICBpbnZhbGlkV2lsZENoaWxkcmVuOiBcIlR5cGVzIGNhbiBoYXZlIGF0IG1vc3Qgb25lICR3aWxkIHByb3BlcnR5IGFuZCBjYW5ub3QgbWl4IHdpdGggb3RoZXIgcHJvcGVydGllcy5cIixcclxuICBpbnZhbGlkUHJvcGVydHlOYW1lOiBcIlByb3BlcnR5IG5hbWVzIGNhbm5vdCBjb250YWluIGFueSBvZjogLiAkICMgWyBdIC8gb3IgY29udHJvbCBjaGFyYWN0ZXJzOiBcIixcclxufTtcclxuXHJcbmxldCBJTlZBTElEX0tFWV9SRUdFWCA9IC9bXFxbXFxdLiMkXFwvXFx1MDAwMC1cXHUwMDFGXFx1MDA3Rl0vO1xyXG5cclxuLypcclxuICAgQSBWYWxpZGF0b3IgaXMgYSBKU09OIGhlcmlhcmNoaWNhbCBzdHJ1Y3R1cmUuIFRoZSBcImxlYXZlc1wiIGFyZSBcImRvdC1wcm9wZXJ0aWVzXCJcclxuICAgKHNlZSBiZWxvdykuIFRoZSBpbnRlcm1lZGlhdGUgbm9kZXMgaW4gdGhlIHRyZWUgYXJlIFwicHJvcFwiIG9yIFwiJHByb3BcIlxyXG4gICBwcm9wZXJ0aWVzLlxyXG5cclxuICAgQSBWYWxpZGF0b3IgaXMgbXV0YXRlZCB0byBoYXZlIGRpZmZlcmVudCBmb3JtcyBiYXNlZCBvbiB0aGUgdGhlIHBoYXNlIG9mXHJcbiAgIGdlbmVyYXRpb24uXHJcblxyXG4gICBJbiB0aGUgZmlyc3QgcGhhc2UsIHRoZXkgYXJlIEV4cFtdLiBMYXRlciB0aGUgRXhwW10gYXJlIEFORGVkIHRvZ2V0aGVyIGFuZFxyXG4gICBjb21iaW5lZCBpbnRvIGV4cHJlc3Npb24gdGV4dCAoYW5kIHJldHVybmVkIGFzIHRoZSBmaW5hbCBKU09OLXJ1bGVzIHRoYXRcclxuICAgRmlyZWJhc2UgdXNlcy5cclxuXHJcbiAgIE5vdGU6IFRTIGRvZXMgbm90IGFsbG93IGZvciBzcGVjaWFsIHByb3BlcnRpZXMgdG8gaGF2ZSBkaXN0aW5jdFxyXG4gICB0eXBlcyBmcm9tIHRoZSAnaW5kZXgnIHByb3BlcnR5IGdpdmVuIGZvciB0aGUgaW50ZXJmYWNlLiAgOi0oXHJcblxyXG4gICAnLnJlYWQnOiBhc3QuRXhwW10gfCBzdHJpbmc7XHJcbiAgICcud3JpdGUnOiBhc3QuRXhwW10gfCBzdHJpbmc7XHJcbiAgICcudmFsaWRhdGUnOiBhc3QuRXhwW10gfCBzdHJpbmc7XHJcbiAgICcuaW5kZXhPbic6IHN0cmluZ1tdO1xyXG4gICAnLnNjb3BlJzogeyBbdmFyaWFibGU6IHN0cmluZ106IHN0cmluZyB9XHJcbiovXHJcbmV4cG9ydCB0eXBlIFZhbGlkYXRvclZhbHVlID0gYXN0LkV4cCB8IGFzdC5FeHBbXSB8IHN0cmluZyB8IHN0cmluZ1tdIHwgVmFsaWRhdG9yO1xyXG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRvciB7XHJcbiAgW25hbWU6IHN0cmluZ106IFZhbGlkYXRvclZhbHVlO1xyXG59O1xyXG5cclxudmFyIGJ1aWx0aW5TY2hlbWFOYW1lcyA9IFsnQW55JywgJ051bGwnLCAnU3RyaW5nJywgJ051bWJlcicsICdCb29sZWFuJywgJ09iamVjdCddO1xyXG4vLyBNZXRob2QgbmFtZXMgYWxsb3dlZCBpbiBCb2x0IGZpbGVzLlxyXG52YXIgdmFsdWVNZXRob2RzID0gWydsZW5ndGgnLCAnaW5jbHVkZXMnLCAnc3RhcnRzV2l0aCcsICdiZWdpbnNXaXRoJywgJ2VuZHNXaXRoJyxcclxuICAgICAgICAgICAgICAgICAgICAncmVwbGFjZScsICd0b0xvd2VyQ2FzZScsICd0b1VwcGVyQ2FzZScsICd0ZXN0JywgJ2NvbnRhaW5zJyxcclxuICAgICAgICAgICAgICAgICAgICAnbWF0Y2hlcyddO1xyXG4vLyBUT0RPOiBNYWtlIHN1cmUgdXNlcnMgZG9uJ3QgY2FsbCBpbnRlcm5hbCBtZXRob2RzLi4ubWFrZSBwcml2YXRlIHRvIGltcGwuXHJcbnZhciBzbmFwc2hvdE1ldGhvZHMgPSBbJ3BhcmVudCcsICdjaGlsZCcsICdoYXNDaGlsZHJlbicsICd2YWwnLCAnaXNTdHJpbmcnLCAnaXNOdW1iZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICdpc0Jvb2xlYW4nXS5jb25jYXQodmFsdWVNZXRob2RzKTtcclxuXHJcbnZhciB3cml0ZUFsaWFzZXMgPSA8eyBbbWV0aG9kOiBzdHJpbmddOiBhc3QuRXhwIH0+IHtcclxuICAnY3JlYXRlJzogcGFyc2VFeHByZXNzaW9uKCdwcmlvcih0aGlzKSA9PSBudWxsJyksXHJcbiAgJ3VwZGF0ZSc6IHBhcnNlRXhwcmVzc2lvbigncHJpb3IodGhpcykgIT0gbnVsbCAmJiB0aGlzICE9IG51bGwnKSxcclxuICAnZGVsZXRlJzogcGFyc2VFeHByZXNzaW9uKCdwcmlvcih0aGlzKSAhPSBudWxsICYmIHRoaXMgPT0gbnVsbCcpXHJcbn07XHJcblxyXG4vLyBVc2FnZTpcclxuLy8gICBqc29uID0gYm9sdC5nZW5lcmF0ZShib2x0LXRleHQpXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZShzeW1ib2xzOiBzdHJpbmcgfCBhc3QuU3ltYm9scyk6IFZhbGlkYXRvciB7XHJcbiAgaWYgKHR5cGVvZiBzeW1ib2xzID09PSAnc3RyaW5nJykge1xyXG4gICAgc3ltYm9scyA9IHBhcnNlci5wYXJzZShzeW1ib2xzKTtcclxuICB9XHJcbiAgdmFyIGdlbiA9IG5ldyBHZW5lcmF0b3IoPGFzdC5TeW1ib2xzPiBzeW1ib2xzKTtcclxuICByZXR1cm4gZ2VuLmdlbmVyYXRlUnVsZXMoKTtcclxufVxyXG5cclxuLy8gU3ltYm9scyBjb250YWluczpcclxuLy8gICBmdW5jdGlvbnM6IHt9XHJcbi8vICAgc2NoZW1hOiB7fVxyXG4vLyAgIHBhdGhzOiB7fVxyXG5leHBvcnQgY2xhc3MgR2VuZXJhdG9yIHtcclxuICBzeW1ib2xzOiBhc3QuU3ltYm9scztcclxuICB2YWxpZGF0b3JzOiB7IFtzY2hlbWFOYW1lOiBzdHJpbmddOiBWYWxpZGF0b3I7IH07XHJcbiAgcnVsZXM6IFZhbGlkYXRvcjtcclxuICBlcnJvckNvdW50OiBudW1iZXI7XHJcbiAgcnVuU2lsZW50bHk6IGJvb2xlYW47XHJcbiAgYWxsb3dVbmRlZmluZWRGdW5jdGlvbnM6IGJvb2xlYW47XHJcbiAgZ2xvYmFsczogYXN0LlBhcmFtcztcclxuICB0aGlzSXM6IHN0cmluZztcclxuICBrZXlJbmRleDogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzeW1ib2xzOiBhc3QuU3ltYm9scykge1xyXG4gICAgdGhpcy5zeW1ib2xzID0gc3ltYm9scztcclxuICAgIHRoaXMudmFsaWRhdG9ycyA9IHt9O1xyXG4gICAgdGhpcy5ydWxlcyA9IHt9O1xyXG4gICAgdGhpcy5lcnJvckNvdW50ID0gMDtcclxuICAgIHRoaXMucnVuU2lsZW50bHkgPSBmYWxzZTtcclxuICAgIHRoaXMuYWxsb3dVbmRlZmluZWRGdW5jdGlvbnMgPSBmYWxzZTtcclxuICAgIHRoaXMua2V5SW5kZXggPSAwO1xyXG5cclxuICAgIC8vIFRPRE86IGdsb2JhbHMgc2hvdWxkIGJlIHBhcnQgb2YgdGhpcy5zeW1ib2xzIChuZXN0ZWQgc2NvcGVzKVxyXG4gICAgdGhpcy5nbG9iYWxzID0ge1xyXG4gICAgICBcInJvb3RcIjogYXN0LmNhbGwoYXN0LnZhcmlhYmxlKCdAcm9vdCcpKSxcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlckJ1aWx0aW5TY2hlbWEoKTtcclxuICB9XHJcblxyXG4gIC8vIFJldHVybiBGaXJlYmFzZSBjb21wYXRpYmxlIFJ1bGVzIEpTT04gZm9yIGEgdGhlIGdpdmVuIHN5bWJvbHMgZGVmaW5pdGlvbnMuXHJcbiAgZ2VuZXJhdGVSdWxlcygpOiBWYWxpZGF0b3Ige1xyXG4gICAgdGhpcy5lcnJvckNvdW50ID0gMDtcclxuICAgIHZhciBwYXRocyA9IHRoaXMuc3ltYm9scy5wYXRocztcclxuICAgIHZhciBzY2hlbWEgPSB0aGlzLnN5bWJvbHMuc2NoZW1hO1xyXG4gICAgdmFyIG5hbWU6IHN0cmluZztcclxuXHJcbiAgICBwYXRocy5mb3JFYWNoKChwYXRoKSA9PiB7XHJcbiAgICAgIHRoaXMudmFsaWRhdGVNZXRob2RzKGVycm9ycy5iYWRQYXRoTWV0aG9kLCBwYXRoLm1ldGhvZHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIFsndmFsaWRhdGUnLCAncmVhZCcsICd3cml0ZScsICdpbmRleCddKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGZvciAobmFtZSBpbiBzY2hlbWEpIHtcclxuICAgICAgaWYgKCF1dGlsLmFycmF5SW5jbHVkZXMoYnVpbHRpblNjaGVtYU5hbWVzLCBuYW1lKSkge1xyXG4gICAgICAgIHRoaXMudmFsaWRhdGVNZXRob2RzKGVycm9ycy5iYWRTY2hlbWFNZXRob2QsIHNjaGVtYVtuYW1lXS5tZXRob2RzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsndmFsaWRhdGUnLCAncmVhZCcsICd3cml0ZSddKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChwYXRocy5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5mYXRhbChlcnJvcnMubm9QYXRocyk7XHJcbiAgICB9XHJcblxyXG4gICAgcGF0aHMuZm9yRWFjaCgocGF0aCkgPT4gdGhpcy51cGRhdGVSdWxlcyhwYXRoKSk7XHJcbiAgICB0aGlzLmNvbnZlcnRFeHByZXNzaW9ucyh0aGlzLnJ1bGVzKTtcclxuXHJcbiAgICBpZiAodGhpcy5lcnJvckNvdW50ICE9PSAwKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuZ2VuZXJhdGVGYWlsZWQgKyB0aGlzLmVycm9yQ291bnQgKyBcIiBlcnJvcnMuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHV0aWwuZGVsZXRlUHJvcE5hbWUodGhpcy5ydWxlcywgJy5zY29wZScpO1xyXG4gICAgdXRpbC5wcnVuZUVtcHR5Q2hpbGRyZW4odGhpcy5ydWxlcyk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgcnVsZXM6IHRoaXMucnVsZXNcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICB2YWxpZGF0ZU1ldGhvZHMobTogc3RyaW5nLCBtZXRob2RzOiB7IFtuYW1lOiBzdHJpbmddOiBhc3QuTWV0aG9kIH0sIGFsbG93ZWQ6IHN0cmluZ1tdKSB7XHJcbiAgICBpZiAodXRpbC5hcnJheUluY2x1ZGVzKGFsbG93ZWQsICd3cml0ZScpKSB7XHJcbiAgICAgIGFsbG93ZWQgPSBhbGxvd2VkLmNvbmNhdChPYmplY3Qua2V5cyh3cml0ZUFsaWFzZXMpKTtcclxuICAgIH1cclxuICAgIGZvciAodmFyIG1ldGhvZCBpbiBtZXRob2RzKSB7XHJcbiAgICAgIGlmICghdXRpbC5hcnJheUluY2x1ZGVzKGFsbG93ZWQsIG1ldGhvZCkpIHtcclxuICAgICAgICB3YXJuKG0gKyB1dGlsLnF1b3RlU3RyaW5nKG1ldGhvZCkgK1xyXG4gICAgICAgICAgICAgXCIgKGFsbG93ZWQ6IFwiICsgYWxsb3dlZC5tYXAodXRpbC5xdW90ZVN0cmluZykuam9pbignLCAnKSArIFwiKVwiKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKCd3cml0ZScgaW4gbWV0aG9kcykge1xyXG4gICAgICBPYmplY3Qua2V5cyh3cml0ZUFsaWFzZXMpLmZvckVhY2goKGFsaWFzKSA9PiB7XHJcbiAgICAgICAgaWYgKGFsaWFzIGluIG1ldGhvZHMpIHtcclxuICAgICAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLmJhZFdyaXRlQWxpYXMgKyBhbGlhcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJlZ2lzdGVyQnVpbHRpblNjaGVtYSgpIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgIHZhciB0aGlzVmFyID0gYXN0LnZhcmlhYmxlKCd0aGlzJyk7XHJcblxyXG4gICAgZnVuY3Rpb24gcmVnaXN0ZXJBc0NhbGwobmFtZTogc3RyaW5nLCBtZXRob2ROYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgc2VsZi5zeW1ib2xzLnJlZ2lzdGVyU2NoZW1hKG5hbWUsIGFzdC50eXBlVHlwZSgnQW55JyksIHVuZGVmaW5lZCwge1xyXG4gICAgICAgIHZhbGlkYXRlOiBhc3QubWV0aG9kKFsndGhpcyddLCBhc3QuY2FsbChhc3QucmVmZXJlbmNlKGFzdC5jYXN0KHRoaXNWYXIsICdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3Quc3RyaW5nKG1ldGhvZE5hbWUpKSkpXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlclNjaGVtYSgnQW55JywgYXN0LnR5cGVUeXBlKCdBbnknKSwgdW5kZWZpbmVkLCB7XHJcbiAgICAgIHZhbGlkYXRlOiBhc3QubWV0aG9kKFsndGhpcyddLCBhc3QuYm9vbGVhbih0cnVlKSlcclxuICAgIH0pO1xyXG5cclxuICAgIHJlZ2lzdGVyQXNDYWxsKCdPYmplY3QnLCAnaGFzQ2hpbGRyZW4nKTtcclxuXHJcbiAgICAvLyBCZWNhdXNlIG9mIHRoZSB3YXkgZmlyZWJhc2UgdHJlYXRzIE51bGwgdmFsdWVzLCB0aGVyZSBpcyBubyB3YXkgdG9cclxuICAgIC8vIHdyaXRlIGEgdmFsaWRhdGlvbiBydWxlLCB0aGF0IHdpbGwgRVZFUiBiZSBjYWxsZWQgd2l0aCB0aGlzID09IG51bGxcclxuICAgIC8vIChmaXJlYmFzZSBhbGxvd3MgdmFsdWVzIHRvIGJlIGRlbGV0ZWQgbm8gbWF0dGVyIHRoZWlyIHZhbGlkYXRpb24gcnVsZXMpLlxyXG4gICAgLy8gU28sIGNvbXBhcmluZyB0aGlzID09IG51bGwgd2lsbCBhbHdheXMgcmV0dXJuIGZhbHNlIC0+IHRoYXQgaXMgd2hhdFxyXG4gICAgLy8gd2UgZG8gaGVyZSwgd2hpY2ggd2lsbCBiZSBvcHRpbWl6ZWQgYXdheSBpZiBPUmVkIHdpdGggb3RoZXIgdmFsaWRhdGlvbnMuXHJcbiAgICB0aGlzLnN5bWJvbHMucmVnaXN0ZXJTY2hlbWEoJ051bGwnLCBhc3QudHlwZVR5cGUoJ0FueScpLCB1bmRlZmluZWQsIHtcclxuICAgICAgdmFsaWRhdGU6IGFzdC5tZXRob2QoWyd0aGlzJ10sIGFzdC5ib29sZWFuKGZhbHNlKSlcclxuICAgIH0pO1xyXG5cclxuICAgIHNlbGYuc3ltYm9scy5yZWdpc3RlclNjaGVtYSgnU3RyaW5nJywgYXN0LnR5cGVUeXBlKCdBbnknKSwgdW5kZWZpbmVkLCB7XHJcbiAgICAgIHZhbGlkYXRlOiBhc3QubWV0aG9kKFsndGhpcyddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuY2FsbChhc3QucmVmZXJlbmNlKGFzdC5jYXN0KHRoaXNWYXIsICdBbnknKSwgYXN0LnN0cmluZygnaXNTdHJpbmcnKSkpKSxcclxuICAgICAgaW5jbHVkZXM6IGFzdC5tZXRob2QoWyd0aGlzJywgJ3MnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ2NvbnRhaW5zJykpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbIGFzdC52YWx1ZShhc3QudmFyaWFibGUoJ3MnKSkgXSkpLFxyXG4gICAgICBzdGFydHNXaXRoOiBhc3QubWV0aG9kKFsndGhpcycsICdzJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ2JlZ2luc1dpdGgnKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyBhc3QudmFsdWUoYXN0LnZhcmlhYmxlKCdzJykpIF0pKSxcclxuICAgICAgZW5kc1dpdGg6IGFzdC5tZXRob2QoWyd0aGlzJywgJ3MnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ2VuZHNXaXRoJykpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbIGFzdC52YWx1ZShhc3QudmFyaWFibGUoJ3MnKSkgXSkpLFxyXG4gICAgICByZXBsYWNlOiBhc3QubWV0aG9kKFsndGhpcycsICdzJywgJ3InXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuY2FsbChhc3QucmVmZXJlbmNlKGFzdC52YWx1ZSh0aGlzVmFyKSwgYXN0LnN0cmluZygncmVwbGFjZScpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbIGFzdC52YWx1ZShhc3QudmFyaWFibGUoJ3MnKSksIGFzdC52YWx1ZShhc3QudmFyaWFibGUoJ3InKSkgXSkpLFxyXG4gICAgICB0ZXN0OiBhc3QubWV0aG9kKFsndGhpcycsICdyJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ21hdGNoZXMnKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyBhc3QuY2FsbChhc3QudmFyaWFibGUoJ0BSZWdFeHAnKSwgW2FzdC52YXJpYWJsZSgncicpXSkgXSkpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmVnaXN0ZXJBc0NhbGwoJ051bWJlcicsICdpc051bWJlcicpO1xyXG4gICAgcmVnaXN0ZXJBc0NhbGwoJ0Jvb2xlYW4nLCAnaXNCb29sZWFuJyk7XHJcblxyXG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyRnVuY3Rpb24oJ0BSZWdFeHAnLCBbJ3InXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5idWlsdGluKHRoaXMuZW5zdXJlVHlwZS5iaW5kKHRoaXMsICdSZWdFeHAnKSkpO1xyXG5cclxuICAgIGxldCBtYXAgPSB0aGlzLnN5bWJvbHMucmVnaXN0ZXJTY2hlbWEoJ01hcCcsIGFzdC50eXBlVHlwZSgnQW55JyksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJ0tleScsICdWYWx1ZSddKTtcclxuICAgIG1hcC5nZXRWYWxpZGF0b3IgPSB0aGlzLmdldE1hcFZhbGlkYXRvci5iaW5kKHRoaXMpO1xyXG4gIH1cclxuXHJcbiAgLy8gdHlwZSBNYXA8S2V5LCBWYWx1ZT4gPT4ge1xyXG4gIC8vICAgJGtleToge1xyXG4gIC8vICAgICAnLnZhbGlkYXRlJzogJGtleSBpbnN0YW5jZW9mIEtleSBhbmQgdGhpcyBpbnN0YW5jZW9mIFZhbHVlO1xyXG4gIC8vICAgJy52YWxpZGF0ZSc6ICduZXdEYXRhLmhhc0NoaWxkcmVuKCknXHJcbiAgLy8gfVxyXG4gIC8vIEtleSBtdXN0IGRlcml2ZSBmcm9tIFN0cmluZ1xyXG4gIGdldE1hcFZhbGlkYXRvcihwYXJhbXM6IGFzdC5FeHBbXSk6IFZhbGlkYXRvciB7XHJcbiAgICBsZXQga2V5VHlwZSA9IDxhc3QuRXhwU2ltcGxlVHlwZT4gcGFyYW1zWzBdO1xyXG4gICAgbGV0IHZhbHVlVHlwZSA9IDxhc3QuRXhwVHlwZT4gcGFyYW1zWzFdO1xyXG4gICAgaWYgKGtleVR5cGUudHlwZSAhPT0gJ3R5cGUnIHx8ICF0aGlzLnN5bWJvbHMuaXNEZXJpdmVkRnJvbShrZXlUeXBlLCAnU3RyaW5nJykpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5pbnZhbGlkTWFwS2V5ICsgXCIgIChcIiArIGFzdC5kZWNvZGVFeHByZXNzaW9uKGtleVR5cGUpICsgXCIgZG9lcyBub3QpXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCB2YWxpZGF0b3IgPSA8VmFsaWRhdG9yPiB7fTtcclxuICAgIGxldCBpbmRleCA9IHRoaXMudW5pcXVlS2V5KCk7XHJcbiAgICB2YWxpZGF0b3JbaW5kZXhdID0gPFZhbGlkYXRvcj4ge307XHJcbiAgICBleHRlbmRWYWxpZGF0b3IodmFsaWRhdG9yLCB0aGlzLmVuc3VyZVZhbGlkYXRvcihhc3QudHlwZVR5cGUoJ09iamVjdCcpKSk7XHJcblxyXG4gICAgLy8gRmlyc3QgdmFsaWRhdGUgdGhlIGtleSAob21pdCB0ZXJtaW5hbCBTdHJpbmcgdHlwZSB2YWxpZGF0aW9uKS5cclxuICAgIHdoaWxlIChrZXlUeXBlLm5hbWUgIT09ICdTdHJpbmcnKSB7XHJcbiAgICAgIGxldCBzY2hlbWEgPSB0aGlzLnN5bWJvbHMuc2NoZW1hW2tleVR5cGUubmFtZV07XHJcbiAgICAgIGlmIChzY2hlbWEubWV0aG9kc1sndmFsaWRhdGUnXSkge1xyXG4gICAgICAgIGxldCBleHAgPSB0aGlzLnBhcnRpYWxFdmFsKHNjaGVtYS5tZXRob2RzWyd2YWxpZGF0ZSddLmJvZHksIHsndGhpcyc6IGFzdC5saXRlcmFsKGluZGV4KX0pO1xyXG4gICAgICAgIGV4dGVuZFZhbGlkYXRvcig8VmFsaWRhdG9yPiB2YWxpZGF0b3JbaW5kZXhdLCA8VmFsaWRhdG9yPiB7Jy52YWxpZGF0ZSc6IFtleHBdfSk7XHJcbiAgICAgIH1cclxuICAgICAga2V5VHlwZSA9IDxhc3QuRXhwU2ltcGxlVHlwZT4gc2NoZW1hLmRlcml2ZWRGcm9tO1xyXG4gICAgfVxyXG5cclxuICAgIGV4dGVuZFZhbGlkYXRvcig8VmFsaWRhdG9yPiB2YWxpZGF0b3JbaW5kZXhdLCB0aGlzLmVuc3VyZVZhbGlkYXRvcih2YWx1ZVR5cGUpKTtcclxuICAgIHJldHVybiB2YWxpZGF0b3I7XHJcbiAgfVxyXG5cclxuICB1bmlxdWVLZXkoKTogc3RyaW5nIHtcclxuICAgIHRoaXMua2V5SW5kZXggKz0gMTtcclxuICAgIHJldHVybiAnJGtleScgKyB0aGlzLmtleUluZGV4O1xyXG4gIH1cclxuXHJcbiAgLy8gQ29sbGVjdGlvbiBzY2hlbWEgaGFzIGV4YWN0bHkgb25lICR3aWxkY2hpbGQgcHJvcGVydHlcclxuICBpc0NvbGxlY3Rpb25TY2hlbWEoc2NoZW1hOiBhc3QuU2NoZW1hKTogYm9vbGVhbiB7XHJcbiAgICBsZXQgcHJvcHMgPSBPYmplY3Qua2V5cyhzY2hlbWEucHJvcGVydGllcyk7XHJcbiAgICBsZXQgcmVzdWx0ID0gcHJvcHMubGVuZ3RoID09PSAxICYmIHByb3BzWzBdWzBdID09PSAnJCc7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgLy8gRW5zdXJlIHdlIGhhdmUgYSBkZWZpbml0aW9uIGZvciBhIHZhbGlkYXRvciBmb3IgdGhlIGdpdmVuIHNjaGVtYS5cclxuICBlbnN1cmVWYWxpZGF0b3IodHlwZTogYXN0LkV4cFR5cGUpOiBWYWxpZGF0b3Ige1xyXG4gICAgdmFyIGtleSA9IGFzdC5kZWNvZGVFeHByZXNzaW9uKHR5cGUpO1xyXG4gICAgaWYgKCF0aGlzLnZhbGlkYXRvcnNba2V5XSkge1xyXG4gICAgICB0aGlzLnZhbGlkYXRvcnNba2V5XSA9IHsnLnZhbGlkYXRlJzogYXN0LmxpdGVyYWwoJyoqKlRZUEUgUkVDVVJTSU9OKioqJykgfTtcclxuXHJcbiAgICAgIGxldCBhbGxvd1NhdmUgPSB0aGlzLmFsbG93VW5kZWZpbmVkRnVuY3Rpb25zO1xyXG4gICAgICB0aGlzLmFsbG93VW5kZWZpbmVkRnVuY3Rpb25zID0gdHJ1ZTtcclxuICAgICAgdGhpcy52YWxpZGF0b3JzW2tleV0gPSB0aGlzLmNyZWF0ZVZhbGlkYXRvcih0eXBlKTtcclxuICAgICAgdGhpcy5hbGxvd1VuZGVmaW5lZEZ1bmN0aW9ucyA9IGFsbG93U2F2ZTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnZhbGlkYXRvcnNba2V5XTtcclxuICB9XHJcblxyXG4gIGNyZWF0ZVZhbGlkYXRvcih0eXBlOiBhc3QuRXhwVHlwZSk6IFZhbGlkYXRvciB7XHJcbiAgICBzd2l0Y2ggKHR5cGUudHlwZSkge1xyXG4gICAgY2FzZSAndHlwZSc6XHJcbiAgICAgIHJldHVybiB0aGlzLmNyZWF0ZVZhbGlkYXRvckZyb21TY2hlbWFOYW1lKCg8YXN0LkV4cFNpbXBsZVR5cGU+IHR5cGUpLm5hbWUpO1xyXG5cclxuICAgIGNhc2UgJ3VuaW9uJzpcclxuICAgICAgbGV0IHVuaW9uID0gPFZhbGlkYXRvcj4ge307XHJcbiAgICAgICg8YXN0LkV4cFVuaW9uVHlwZT4gdHlwZSkudHlwZXMuZm9yRWFjaCgodHlwZVBhcnQ6IGFzdC5FeHBUeXBlKSA9PiB7XHJcbiAgICAgICAgLy8gTWFrZSBhIGNvcHlcclxuICAgICAgICB2YXIgc2luZ2xlVHlwZSA9IGV4dGVuZFZhbGlkYXRvcih7fSwgdGhpcy5lbnN1cmVWYWxpZGF0b3IodHlwZVBhcnQpKTtcclxuICAgICAgICBtYXBWYWxpZGF0b3Ioc2luZ2xlVHlwZSwgYXN0LmFuZEFycmF5KTtcclxuICAgICAgICBleHRlbmRWYWxpZGF0b3IodW5pb24sIHNpbmdsZVR5cGUpO1xyXG4gICAgICB9KTtcclxuICAgICAgbWFwVmFsaWRhdG9yKHVuaW9uLCBhc3Qub3JBcnJheSk7XHJcbiAgICAgIHJldHVybiB1bmlvbjtcclxuXHJcbiAgICBjYXNlICdnZW5lcmljJzpcclxuICAgICAgbGV0IGdlbmVyaWNUeXBlID0gPGFzdC5FeHBHZW5lcmljVHlwZT4gdHlwZTtcclxuICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlVmFsaWRhdG9yRnJvbUdlbmVyaWMoZ2VuZXJpY1R5cGUubmFtZSwgZ2VuZXJpY1R5cGUucGFyYW1zKTtcclxuXHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJpbnZhbGlkIGludGVybmFsIHR5cGU6IFwiICsgdHlwZS50eXBlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNyZWF0ZVZhbGlkYXRvckZyb21HZW5lcmljKHNjaGVtYU5hbWU6IHN0cmluZywgcGFyYW1zOiBhc3QuRXhwVHlwZVtdKTogVmFsaWRhdG9yIHtcclxuICAgIHZhciBzY2hlbWEgPSB0aGlzLnN5bWJvbHMuc2NoZW1hW3NjaGVtYU5hbWVdO1xyXG5cclxuICAgIGlmIChzY2hlbWEgPT09IHVuZGVmaW5lZCB8fCAhYXN0LlNjaGVtYS5pc0dlbmVyaWMoc2NoZW1hKSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm5vU3VjaFR5cGUgKyBzY2hlbWFOYW1lICsgXCIgKGdlbmVyaWMpXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCBzY2hlbWFQYXJhbXMgPSA8c3RyaW5nW10+IHNjaGVtYS5wYXJhbXM7XHJcblxyXG4gICAgaWYgKHBhcmFtcy5sZW5ndGggIT09IHNjaGVtYVBhcmFtcy5sZW5ndGgpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5pbnZhbGlkR2VuZXJpYyArIFwiIGV4cGVjdGVkIDxcIiArIHNjaGVtYVBhcmFtcy5qb2luKCcsICcpICsgXCI+XCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENhbGwgY3VzdG9tIHZhbGlkYXRvciwgaWYgZ2l2ZW4uXHJcbiAgICBpZiAoc2NoZW1hLmdldFZhbGlkYXRvcikge1xyXG4gICAgICByZXR1cm4gc2NoZW1hLmdldFZhbGlkYXRvcihwYXJhbXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCBiaW5kaW5ncyA9IDxhc3QuVHlwZVBhcmFtcz4ge307XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcmFtcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBiaW5kaW5nc1tzY2hlbWFQYXJhbXNbaV1dID0gcGFyYW1zW2ldO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEV4cGFuZCBnZW5lcmljcyBhbmQgZ2VuZXJhdGUgdmFsaWRhdG9yIGZyb20gc2NoZW1hLlxyXG4gICAgc2NoZW1hID0gdGhpcy5yZXBsYWNlR2VuZXJpY3NJblNjaGVtYShzY2hlbWEsIGJpbmRpbmdzKTtcclxuICAgIHJldHVybiB0aGlzLmNyZWF0ZVZhbGlkYXRvckZyb21TY2hlbWEoc2NoZW1hKTtcclxuICB9XHJcblxyXG4gIHJlcGxhY2VHZW5lcmljc0luU2NoZW1hKHNjaGVtYTogYXN0LlNjaGVtYSwgYmluZGluZ3M6IGFzdC5UeXBlUGFyYW1zKTogYXN0LlNjaGVtYSB7XHJcbiAgICB2YXIgZXhwYW5kZWRTY2hlbWEgPSA8YXN0LlNjaGVtYT4ge1xyXG4gICAgICBkZXJpdmVkRnJvbTogPGFzdC5FeHBUeXBlPiB0aGlzLnJlcGxhY2VHZW5lcmljc0luRXhwKHNjaGVtYS5kZXJpdmVkRnJvbSwgYmluZGluZ3MpLFxyXG4gICAgICBwcm9wZXJ0aWVzOiB7IH0sXHJcbiAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgfTtcclxuICAgIGxldCBwcm9wcyA9IE9iamVjdC5rZXlzKHNjaGVtYS5wcm9wZXJ0aWVzKTtcclxuICAgIHByb3BzLmZvckVhY2goKHByb3ApID0+IHtcclxuICAgICAgZXhwYW5kZWRTY2hlbWEucHJvcGVydGllc1twcm9wXSA9XHJcbiAgICAgICAgPGFzdC5FeHBUeXBlPiB0aGlzLnJlcGxhY2VHZW5lcmljc0luRXhwKHNjaGVtYS5wcm9wZXJ0aWVzW3Byb3BdLCBiaW5kaW5ncyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBsZXQgbWV0aG9kcyA9IE9iamVjdC5rZXlzKHNjaGVtYS5tZXRob2RzKTtcclxuICAgIG1ldGhvZHMuZm9yRWFjaCgobWV0aG9kTmFtZSkgPT4ge1xyXG4gICAgICBleHBhbmRlZFNjaGVtYS5tZXRob2RzW21ldGhvZE5hbWVdID0gdGhpcy5yZXBsYWNlR2VuZXJpY3NJbk1ldGhvZChzY2hlbWEubWV0aG9kc1ttZXRob2ROYW1lXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5kaW5ncyk7XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBleHBhbmRlZFNjaGVtYTtcclxuICB9XHJcblxyXG4gIHJlcGxhY2VHZW5lcmljc0luRXhwKGV4cDogYXN0LkV4cCwgYmluZGluZ3M6IGFzdC5UeXBlUGFyYW1zKTogYXN0LkV4cCB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgZnVuY3Rpb24gcmVwbGFjZUdlbmVyaWNzSW5BcnJheShleHBzOiBhc3QuRXhwW10pOiBhc3QuRXhwW10ge1xyXG4gICAgICByZXR1cm4gZXhwcy5tYXAoZnVuY3Rpb24oZXhwUGFydCkge1xyXG4gICAgICAgIHJldHVybiBzZWxmLnJlcGxhY2VHZW5lcmljc0luRXhwKGV4cFBhcnQsIGJpbmRpbmdzKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoIChleHAudHlwZSkge1xyXG4gICAgY2FzZSAnb3AnOlxyXG4gICAgY2FzZSAnY2FsbCc6XHJcbiAgICAgIGxldCBvcFR5cGUgPSA8YXN0LkV4cE9wPiBhc3QuY29weUV4cChleHApO1xyXG4gICAgICBvcFR5cGUuYXJncyA9IHJlcGxhY2VHZW5lcmljc0luQXJyYXkob3BUeXBlLmFyZ3MpO1xyXG4gICAgICByZXR1cm4gb3BUeXBlO1xyXG5cclxuICAgIGNhc2UgJ3R5cGUnOlxyXG4gICAgICBsZXQgc2ltcGxlVHlwZSA9IDxhc3QuRXhwU2ltcGxlVHlwZT4gZXhwO1xyXG4gICAgICByZXR1cm4gYmluZGluZ3Nbc2ltcGxlVHlwZS5uYW1lXSB8fCBzaW1wbGVUeXBlO1xyXG5cclxuICAgIGNhc2UgJ3VuaW9uJzpcclxuICAgICAgbGV0IHVuaW9uVHlwZSA9IDxhc3QuRXhwVW5pb25UeXBlPiBleHA7XHJcbiAgICAgIHJldHVybiBhc3QudW5pb25UeXBlKDxhc3QuRXhwVHlwZVtdPiByZXBsYWNlR2VuZXJpY3NJbkFycmF5KHVuaW9uVHlwZS50eXBlcykpO1xyXG5cclxuICAgIGNhc2UgJ2dlbmVyaWMnOlxyXG4gICAgICBsZXQgZ2VuZXJpY1R5cGUgPSA8YXN0LkV4cEdlbmVyaWNUeXBlPiBleHA7XHJcbiAgICAgIHJldHVybiBhc3QuZ2VuZXJpY1R5cGUoZ2VuZXJpY1R5cGUubmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YXN0LkV4cFR5cGVbXT4gcmVwbGFjZUdlbmVyaWNzSW5BcnJheShnZW5lcmljVHlwZS5wYXJhbXMpKTtcclxuXHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICByZXR1cm4gZXhwO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmVwbGFjZUdlbmVyaWNzSW5NZXRob2QobWV0aG9kOiBhc3QuTWV0aG9kLCBiaW5kaW5nczogYXN0LlR5cGVQYXJhbXMpOiBhc3QuTWV0aG9kIHtcclxuICAgIHZhciBleHBhbmRlZE1ldGhvZCA9IDxhc3QuTWV0aG9kPiB7XHJcbiAgICAgIHBhcmFtczogbWV0aG9kLnBhcmFtcyxcclxuICAgICAgYm9keTogbWV0aG9kLmJvZHlcclxuICAgIH07XHJcblxyXG4gICAgZXhwYW5kZWRNZXRob2QuYm9keSA9IHRoaXMucmVwbGFjZUdlbmVyaWNzSW5FeHAobWV0aG9kLmJvZHksIGJpbmRpbmdzKTtcclxuICAgIHJldHVybiBleHBhbmRlZE1ldGhvZDtcclxuICB9XHJcblxyXG4gIGNyZWF0ZVZhbGlkYXRvckZyb21TY2hlbWFOYW1lKHNjaGVtYU5hbWU6IHN0cmluZyk6IFZhbGlkYXRvciB7XHJcbiAgICB2YXIgc2NoZW1hID0gdGhpcy5zeW1ib2xzLnNjaGVtYVtzY2hlbWFOYW1lXTtcclxuXHJcbiAgICBpZiAoIXNjaGVtYSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm5vU3VjaFR5cGUgKyBzY2hlbWFOYW1lKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYXN0LlNjaGVtYS5pc0dlbmVyaWMoc2NoZW1hKSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm5vU3VjaFR5cGUgKyBzY2hlbWFOYW1lICsgXCIgdXNlZCBhcyBub24tZ2VuZXJpYyB0eXBlLlwiKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVWYWxpZGF0b3JGcm9tU2NoZW1hKHNjaGVtYSk7XHJcbiAgfVxyXG5cclxuICBjcmVhdGVWYWxpZGF0b3JGcm9tU2NoZW1hKHNjaGVtYTogYXN0LlNjaGVtYSk6IFZhbGlkYXRvciB7XHJcbiAgICB2YXIgaGFzUHJvcHMgPSBPYmplY3Qua2V5cyhzY2hlbWEucHJvcGVydGllcykubGVuZ3RoID4gMCAmJlxyXG4gICAgICAhdGhpcy5pc0NvbGxlY3Rpb25TY2hlbWEoc2NoZW1hKTtcclxuXHJcbiAgICBpZiAoaGFzUHJvcHMgJiYgIXRoaXMuc3ltYm9scy5pc0Rlcml2ZWRGcm9tKHNjaGVtYS5kZXJpdmVkRnJvbSwgJ09iamVjdCcpKSB7XHJcbiAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLm5vbk9iamVjdCArIFwiIChpcyBcIiArIGFzdC5kZWNvZGVFeHByZXNzaW9uKHNjaGVtYS5kZXJpdmVkRnJvbSkgKyBcIilcIik7XHJcbiAgICAgIHJldHVybiB7fTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgdmFsaWRhdG9yID0gPFZhbGlkYXRvcj4ge307XHJcblxyXG4gICAgaWYgKCEoc2NoZW1hLmRlcml2ZWRGcm9tLnR5cGUgPT09ICd0eXBlJyAmJlxyXG4gICAgICAgICAgKDxhc3QuRXhwU2ltcGxlVHlwZT4gc2NoZW1hLmRlcml2ZWRGcm9tKS5uYW1lID09PSAnQW55JykpIHtcclxuICAgICAgZXh0ZW5kVmFsaWRhdG9yKHZhbGlkYXRvciwgdGhpcy5lbnN1cmVWYWxpZGF0b3Ioc2NoZW1hLmRlcml2ZWRGcm9tKSk7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IHJlcXVpcmVkUHJvcGVydGllcyA9IDxzdHJpbmdbXT4gW107XHJcbiAgICBsZXQgd2lsZFByb3BlcnRpZXMgPSAwO1xyXG4gICAgT2JqZWN0LmtleXMoc2NoZW1hLnByb3BlcnRpZXMpLmZvckVhY2goKHByb3BOYW1lKSA9PiB7XHJcbiAgICAgIGlmIChwcm9wTmFtZVswXSA9PT0gJyQnKSB7XHJcbiAgICAgICAgd2lsZFByb3BlcnRpZXMgKz0gMTtcclxuICAgICAgICBpZiAoSU5WQUxJRF9LRVlfUkVHRVgudGVzdChwcm9wTmFtZS5zbGljZSgxKSkpIHtcclxuICAgICAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLmludmFsaWRQcm9wZXJ0eU5hbWUgKyBwcm9wTmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmIChJTlZBTElEX0tFWV9SRUdFWC50ZXN0KHByb3BOYW1lKSkge1xyXG4gICAgICAgICAgdGhpcy5mYXRhbChlcnJvcnMuaW52YWxpZFByb3BlcnR5TmFtZSArIHByb3BOYW1lKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgaWYgKCF2YWxpZGF0b3JbcHJvcE5hbWVdKSB7XHJcbiAgICAgICAgdmFsaWRhdG9yW3Byb3BOYW1lXSA9IHt9O1xyXG4gICAgICB9XHJcbiAgICAgIHZhciBwcm9wVHlwZSA9IHNjaGVtYS5wcm9wZXJ0aWVzW3Byb3BOYW1lXTtcclxuICAgICAgaWYgKHByb3BOYW1lWzBdICE9PSAnJCcgJiYgIXRoaXMuaXNOdWxsYWJsZVR5cGUocHJvcFR5cGUpKSB7XHJcbiAgICAgICAgcmVxdWlyZWRQcm9wZXJ0aWVzLnB1c2gocHJvcE5hbWUpO1xyXG4gICAgICB9XHJcbiAgICAgIGV4dGVuZFZhbGlkYXRvcig8VmFsaWRhdG9yPiB2YWxpZGF0b3JbcHJvcE5hbWVdLCB0aGlzLmVuc3VyZVZhbGlkYXRvcihwcm9wVHlwZSkpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHdpbGRQcm9wZXJ0aWVzID4gMSB8fCB3aWxkUHJvcGVydGllcyA9PT0gMSAmJiByZXF1aXJlZFByb3BlcnRpZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICB0aGlzLmZhdGFsKGVycm9ycy5pbnZhbGlkV2lsZENoaWxkcmVuKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAocmVxdWlyZWRQcm9wZXJ0aWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgLy8gdGhpcy5oYXNDaGlsZHJlbihyZXF1aXJlZFByb3BlcnRpZXMpXHJcbiAgICAgIGV4dGVuZFZhbGlkYXRvcih2YWxpZGF0b3IsXHJcbiAgICAgICAgICAgICAgICAgICAgICB7Jy52YWxpZGF0ZSc6IFtoYXNDaGlsZHJlbkV4cChyZXF1aXJlZFByb3BlcnRpZXMpXX0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIERpc2FsbG93ICRvdGhlciBwcm9wZXJ0aWVzIGJ5IGRlZmF1bHRcclxuICAgIGlmIChoYXNQcm9wcykge1xyXG4gICAgICB2YWxpZGF0b3JbJyRvdGhlciddID0ge307XHJcbiAgICAgIGV4dGVuZFZhbGlkYXRvcig8VmFsaWRhdG9yPiB2YWxpZGF0b3JbJyRvdGhlciddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgPFZhbGlkYXRvcj4geycudmFsaWRhdGUnOiBhc3QuYm9vbGVhbihmYWxzZSl9KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmV4dGVuZFZhbGlkYXRpb25NZXRob2RzKHZhbGlkYXRvciwgc2NoZW1hLm1ldGhvZHMpO1xyXG5cclxuICAgIHJldHVybiB2YWxpZGF0b3I7XHJcbiAgfVxyXG5cclxuICBpc051bGxhYmxlVHlwZSh0eXBlOiBhc3QuRXhwVHlwZSk6IGJvb2xlYW4ge1xyXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMuc3ltYm9scy5pc0Rlcml2ZWRGcm9tKHR5cGUsICdOdWxsJykgfHxcclxuICAgICAgdGhpcy5zeW1ib2xzLmlzRGVyaXZlZEZyb20odHlwZSwgJ01hcCcpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8vIFVwZGF0ZSBydWxlcyBiYXNlZCBvbiB0aGUgZ2l2ZW4gcGF0aCBleHByZXNzaW9uLlxyXG4gIHVwZGF0ZVJ1bGVzKHBhdGg6IGFzdC5QYXRoKSB7XHJcbiAgICB2YXIgaTogbnVtYmVyO1xyXG4gICAgdmFyIGxvY2F0aW9uID0gPFZhbGlkYXRvcj4gdXRpbC5lbnN1cmVPYmplY3RQYXRoKHRoaXMucnVsZXMsIHBhdGgudGVtcGxhdGUuZ2V0TGFiZWxzKCkpO1xyXG4gICAgdmFyIGV4cDogYXN0LkV4cFZhbHVlO1xyXG5cclxuICAgIGV4dGVuZFZhbGlkYXRvcihsb2NhdGlvbiwgdGhpcy5lbnN1cmVWYWxpZGF0b3IocGF0aC5pc1R5cGUpKTtcclxuICAgIGxvY2F0aW9uWycuc2NvcGUnXSA9IHBhdGgudGVtcGxhdGUuZ2V0U2NvcGUoKTtcclxuXHJcbiAgICB0aGlzLmV4dGVuZFZhbGlkYXRpb25NZXRob2RzKGxvY2F0aW9uLCBwYXRoLm1ldGhvZHMpO1xyXG5cclxuICAgIC8vIFdyaXRlIGluZGljZXNcclxuICAgIGlmIChwYXRoLm1ldGhvZHNbJ2luZGV4J10pIHtcclxuICAgICAgc3dpdGNoIChwYXRoLm1ldGhvZHNbJ2luZGV4J10uYm9keS50eXBlKSB7XHJcbiAgICAgIGNhc2UgJ1N0cmluZyc6XHJcbiAgICAgICAgZXhwID0gYXN0LmFycmF5KFtwYXRoLm1ldGhvZHNbJ2luZGV4J10uYm9keV0pO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlICdBcnJheSc6XHJcbiAgICAgICAgZXhwID0gPGFzdC5FeHBWYWx1ZT4gcGF0aC5tZXRob2RzWydpbmRleCddLmJvZHk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgdGhpcy5mYXRhbChlcnJvcnMuYmFkSW5kZXgpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICB2YXIgaW5kaWNlcyA9IDxzdHJpbmdbXT4gW107XHJcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBleHAudmFsdWUubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBpZiAoZXhwLnZhbHVlW2ldLnR5cGUgIT09ICdTdHJpbmcnKSB7XHJcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy5iYWRJbmRleCArIFwiIChub3QgXCIgKyBleHAudmFsdWVbaV0udHlwZSArIFwiKVwiKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgaW5kaWNlcy5wdXNoKGV4cC52YWx1ZVtpXS52YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8vIFRPRE86IEVycm9yIGNoZWNrIG5vdCBvdmVyLXdyaXRpbmcgaW5kZXggcnVsZXMuXHJcbiAgICAgIGxvY2F0aW9uWycuaW5kZXhPbiddID0gaW5kaWNlcztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGV4dGVuZFZhbGlkYXRpb25NZXRob2RzKHZhbGlkYXRvcjogVmFsaWRhdG9yLCBtZXRob2RzOiB7IFttZXRob2Q6IHN0cmluZ106IGFzdC5NZXRob2QgfSkge1xyXG4gICAgbGV0IHdyaXRlTWV0aG9kcyA9IDxhc3QuRXhwW10+IFtdO1xyXG4gICAgWydjcmVhdGUnLCAndXBkYXRlJywgJ2RlbGV0ZSddLmZvckVhY2goKG1ldGhvZCkgPT4ge1xyXG4gICAgICBpZiAobWV0aG9kIGluIG1ldGhvZHMpIHtcclxuICAgICAgICB3cml0ZU1ldGhvZHMucHVzaChhc3QuYW5kQXJyYXkoW3dyaXRlQWxpYXNlc1ttZXRob2RdLCBtZXRob2RzW21ldGhvZF0uYm9keV0pKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBpZiAod3JpdGVNZXRob2RzLmxlbmd0aCAhPT0gMCkge1xyXG4gICAgICBleHRlbmRWYWxpZGF0b3IodmFsaWRhdG9yLCA8VmFsaWRhdG9yPiB7ICcud3JpdGUnOiBhc3Qub3JBcnJheSh3cml0ZU1ldGhvZHMpIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIFsndmFsaWRhdGUnLCAncmVhZCcsICd3cml0ZSddLmZvckVhY2goKG1ldGhvZCkgPT4ge1xyXG4gICAgICBpZiAobWV0aG9kIGluIG1ldGhvZHMpIHtcclxuICAgICAgICB2YXIgbWV0aG9kVmFsaWRhdG9yID0gPFZhbGlkYXRvcj4ge307XHJcbiAgICAgICAgbWV0aG9kVmFsaWRhdG9yWycuJyArIG1ldGhvZF0gPSBtZXRob2RzW21ldGhvZF0uYm9keTtcclxuICAgICAgICBleHRlbmRWYWxpZGF0b3IodmFsaWRhdG9yLCBtZXRob2RWYWxpZGF0b3IpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vIFJldHVybiB1bmlvbiB2YWxpZGF0b3IgKHx8KSBvdmVyIGVhY2ggc2NoZW1hXHJcbiAgdW5pb25WYWxpZGF0b3JzKHNjaGVtYTogc3RyaW5nW10pOiBWYWxpZGF0b3Ige1xyXG4gICAgdmFyIHVuaW9uID0gPFZhbGlkYXRvcj4ge307XHJcbiAgICBzY2hlbWEuZm9yRWFjaChmdW5jdGlvbih0eXBlTmFtZTogc3RyaW5nKSB7XHJcbiAgICAgIC8vIEZpcnN0IGFuZCB0aGUgdmFsaWRhdG9yIHRlcm1zIGZvciBhIHNpbmdsZSB0eXBlXHJcbiAgICAgIC8vIFRvZG8gZXh0ZW5kIHRvIHVuaW9ucyBhbmQgZ2VuZXJpY3NcclxuICAgICAgdmFyIHNpbmdsZVR5cGUgPSBleHRlbmRWYWxpZGF0b3Ioe30sIHRoaXMuZW5zdXJlVmFsaWRhdG9yKHR5cGVOYW1lKSk7XHJcbiAgICAgIG1hcFZhbGlkYXRvcihzaW5nbGVUeXBlLCBhc3QuYW5kQXJyYXkpO1xyXG4gICAgICBleHRlbmRWYWxpZGF0b3IodW5pb24sIHNpbmdsZVR5cGUpO1xyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuICAgIG1hcFZhbGlkYXRvcih1bmlvbiwgYXN0Lm9yQXJyYXkpO1xyXG4gICAgcmV0dXJuIHVuaW9uO1xyXG4gIH1cclxuXHJcbiAgLy8gQ29udmVydCBleHByZXNzaW9ucyB0byB0ZXh0LCBhbmQgYXQgdGhlIHNhbWUgdGltZSwgYXBwbHkgcHJ1bmluZyBvcGVyYXRpb25zXHJcbiAgLy8gdG8gcmVtb3ZlIG5vLW9wIHJ1bGVzLlxyXG4gIGNvbnZlcnRFeHByZXNzaW9ucyh2YWxpZGF0b3I6IFZhbGlkYXRvcikge1xyXG4gICAgdmFyIG1ldGhvZFRoaXNJcyA9IDx7W3Byb3A6IHN0cmluZ106IHN0cmluZ30+IHsgJy52YWxpZGF0ZSc6ICduZXdEYXRhJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcucmVhZCc6ICdkYXRhJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcud3JpdGUnOiAnbmV3RGF0YScgfTtcclxuXHJcbiAgICBmdW5jdGlvbiBoYXNXaWxkY2FyZFNpYmxpbmcocGF0aDogYXN0LlBhdGhUZW1wbGF0ZSk6IGJvb2xlYW4ge1xyXG4gICAgICBsZXQgcGFydHMgPSBwYXRoLmdldExhYmVscygpO1xyXG4gICAgICBsZXQgY2hpbGRQYXJ0ID0gcGFydHMucG9wKCk7XHJcbiAgICAgIGxldCBwYXJlbnQgPSB1dGlsLmRlZXBMb29rdXAodmFsaWRhdG9yLCBwYXJ0cyk7XHJcbiAgICAgIGlmIChwYXJlbnQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICBmb3IgKGxldCBwcm9wIG9mIE9iamVjdC5rZXlzKHBhcmVudCkpIHtcclxuICAgICAgICBpZiAocHJvcCA9PT0gY2hpbGRQYXJ0KSB7XHJcbiAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHByb3BbMF0gPT09ICckJykge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBtYXBWYWxpZGF0b3IodmFsaWRhdG9yLCAodmFsdWU6IGFzdC5FeHBbXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGU6IGFzdC5QYXJhbXMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogYXN0LlBhdGhUZW1wbGF0ZSkgPT4ge1xyXG4gICAgICBpZiAocHJvcCBpbiBtZXRob2RUaGlzSXMpIHtcclxuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcy5nZXRFeHByZXNzaW9uVGV4dChhc3QuYW5kQXJyYXkoY29sbGFwc2VIYXNDaGlsZHJlbih2YWx1ZSkpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZFRoaXNJc1twcm9wXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoKTtcclxuICAgICAgICAvLyBSZW1vdmUgbm8tb3AgLnJlYWQgb3IgLndyaXRlIHJ1bGUgaWYgbm8gc2libGluZyB3aWxkY2FyZCBwcm9wcy5cclxuICAgICAgICBpZiAoKHByb3AgPT09ICcucmVhZCcgfHwgcHJvcCA9PT0gJy53cml0ZScpICYmIHJlc3VsdCA9PT0gJ2ZhbHNlJykge1xyXG4gICAgICAgICAgaWYgKCFoYXNXaWxkY2FyZFNpYmxpbmcocGF0aCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFJlbW92ZSBuby1vcCAudmFsaWRhdGUgcnVsZSBpZiBubyBzaWJsaW5nIHdpbGRjYXJkIHByb3BzLlxyXG4gICAgICAgIGlmIChwcm9wID09PSAnLnZhbGlkYXRlJyAmJiByZXN1bHQgPT09ICd0cnVlJykge1xyXG4gICAgICAgICAgaWYgKCFoYXNXaWxkY2FyZFNpYmxpbmcocGF0aCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBnZXRFeHByZXNzaW9uVGV4dChleHA6IGFzdC5FeHAsIHRoaXNJczogc3RyaW5nLCBzY29wZTogYXN0LlBhcmFtcywgcGF0aDogYXN0LlBhdGhUZW1wbGF0ZSk6IHN0cmluZyB7XHJcbiAgICBpZiAoISgndHlwZScgaW4gZXhwKSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJOb3QgYW4gZXhwcmVzc2lvbjogXCIgKyB1dGlsLnByZXR0eUpTT04oZXhwKSk7XHJcbiAgICB9XHJcbiAgICAvLyBGaXJzdCBldmFsdWF0ZSB3L28gYmluZGluZyBvZiB0aGlzIHRvIHNwZWNpZmljIGxvY2F0aW9uLlxyXG4gICAgdGhpcy5hbGxvd1VuZGVmaW5lZEZ1bmN0aW9ucyA9IHRydWU7XHJcbiAgICBzY29wZSA9IDxhc3QuUGFyYW1zPiB1dGlsLmV4dGVuZCh7fSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAndGhpcyc6IGFzdC5jYXN0KGFzdC5jYWxsKGFzdC52YXJpYWJsZSgnQGdldFRoaXMnKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1NuYXBzaG90JykgfSk7XHJcbiAgICBleHAgPSB0aGlzLnBhcnRpYWxFdmFsKGV4cCwgc2NvcGUpO1xyXG4gICAgLy8gTm93IHJlLWV2YWx1YXRlIHRoZSBmbGF0dGVuZWQgZXhwcmVzc2lvbi5cclxuICAgIHRoaXMuYWxsb3dVbmRlZmluZWRGdW5jdGlvbnMgPSBmYWxzZTtcclxuICAgIHRoaXMudGhpc0lzID0gdGhpc0lzO1xyXG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyRnVuY3Rpb24oJ0BnZXRUaGlzJywgW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuYnVpbHRpbih0aGlzLmdldFRoaXMuYmluZCh0aGlzKSkpO1xyXG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyRnVuY3Rpb24oJ0Byb290JywgW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuYnVpbHRpbih0aGlzLmdldFJvb3RSZWZlcmVuY2UuYmluZCh0aGlzLCBwYXRoKSkpO1xyXG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyRnVuY3Rpb24oJ3ByaW9yJywgWydleHAnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5idWlsdGluKHRoaXMucHJpb3IuYmluZCh0aGlzKSkpO1xyXG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyRnVuY3Rpb24oJ2tleScsIFtdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmJ1aWx0aW4odGhpcy5nZXRLZXkuYmluZChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aC5sZW5ndGgoKSA9PT0gMCA/ICcnIDogcGF0aC5nZXRQYXJ0KC0xKS5sYWJlbCkpKTtcclxuXHJcbiAgICBleHAgPSB0aGlzLnBhcnRpYWxFdmFsKGV4cCk7XHJcblxyXG4gICAgZGVsZXRlIHRoaXMuc3ltYm9scy5mdW5jdGlvbnNbJ0BnZXRUaGlzJ107XHJcbiAgICBkZWxldGUgdGhpcy5zeW1ib2xzLmZ1bmN0aW9uc1snQHJvb3QnXTtcclxuICAgIGRlbGV0ZSB0aGlzLnN5bWJvbHMuZnVuY3Rpb25zWydwcmlvciddO1xyXG4gICAgZGVsZXRlIHRoaXMuc3ltYm9scy5mdW5jdGlvbnNbJ2tleSddO1xyXG5cclxuICAgIC8vIFRvcCBsZXZlbCBleHByZXNzaW9ucyBzaG91bGQgbmV2ZXIgYmUgdG8gYSBzbmFwc2hvdCByZWZlcmVuY2UgLSBzaG91bGRcclxuICAgIC8vIGFsd2F5cyBldmFsdWF0ZSB0byBhIGJvb2xlYW4uXHJcbiAgICBleHAgPSBhc3QuZW5zdXJlQm9vbGVhbihleHApO1xyXG4gICAgcmV0dXJuIGFzdC5kZWNvZGVFeHByZXNzaW9uKGV4cCk7XHJcbiAgfVxyXG5cclxuICAvKlxyXG4gICAqICBXcmFwcGVyIGZvciBwYXJ0aWFsRXZhbCBkZWJ1Z2dpbmcuXHJcbiAgICovXHJcblxyXG4gIHBhcnRpYWxFdmFsKGV4cDogYXN0LkV4cCxcclxuICAgICAgICAgICAgICBwYXJhbXMgPSA8YXN0LlBhcmFtcz4ge30sXHJcbiAgICAgICAgICAgICAgZnVuY3Rpb25DYWxsczogeyBbbmFtZTogc3RyaW5nXTogYm9vbGVhbiB9ID0ge30pXHJcbiAgOiBhc3QuRXhwIHtcclxuICAgIC8vIFdyYXAgcmVhbCBjYWxsIGZvciBkZWJ1Z2dpbmcuXHJcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJ0aWFsRXZhbFJlYWwoZXhwLCBwYXJhbXMsIGZ1bmN0aW9uQ2FsbHMpO1xyXG4gICAgLy8gY29uc29sZS5sb2coYXN0LmRlY29kZUV4cHJlc3Npb24oZXhwKSArIFwiID0+IFwiICsgYXN0LmRlY29kZUV4cHJlc3Npb24ocmVzdWx0KSk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgLy8gUGFydGlhbCBldmFsdWF0aW9uIG9mIGV4cHJlc3Npb25zIC0gY29weSBvZiBleHByZXNzaW9uIHRyZWUgKGltbXV0YWJsZSkuXHJcbiAgLy9cclxuICAvLyAtIEV4cGFuZCBpbmxpbmUgZnVuY3Rpb24gY2FsbHMuXHJcbiAgLy8gLSBSZXBsYWNlIGxvY2FsIGFuZCBnbG9iYWwgdmFyaWFibGVzIHdpdGggdGhlaXIgdmFsdWVzLlxyXG4gIC8vIC0gRXhwYW5kIHNuYXBzaG90IHJlZmVyZW5jZXMgdXNpbmcgY2hpbGQoJ3JlZicpLlxyXG4gIC8vIC0gQ29lcmNlIHNuYXBzaG90IHJlZmVyZW5jZXMgdG8gdmFsdWVzIGFzIG5lZWRlZC5cclxuICBwYXJ0aWFsRXZhbFJlYWwoZXhwOiBhc3QuRXhwLFxyXG4gICAgICAgICAgICAgIHBhcmFtcyA9IDxhc3QuUGFyYW1zPiB7fSxcclxuICAgICAgICAgICAgICBmdW5jdGlvbkNhbGxzID0gPHsgW25hbWU6IHN0cmluZ106IGJvb2xlYW4gfT4ge30pXHJcbiAgOiBhc3QuRXhwIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBmdW5jdGlvbiBzdWJFeHByZXNzaW9uKGV4cDI6IGFzdC5FeHApOiBhc3QuRXhwIHtcclxuICAgICAgcmV0dXJuIHNlbGYucGFydGlhbEV2YWwoZXhwMiwgcGFyYW1zLCBmdW5jdGlvbkNhbGxzKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB2YWx1ZUV4cHJlc3Npb24oZXhwMjogYXN0LkV4cCk6IGFzdC5FeHAge1xyXG4gICAgICByZXR1cm4gYXN0LmVuc3VyZVZhbHVlKHN1YkV4cHJlc3Npb24oZXhwMikpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGJvb2xlYW5FeHByZXNzaW9uKGV4cDI6IGFzdC5FeHApOiBhc3QuRXhwIHtcclxuICAgICAgcmV0dXJuIGFzdC5lbnN1cmVCb29sZWFuKHN1YkV4cHJlc3Npb24oZXhwMikpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxvb2t1cFZhcihleHAyOiBhc3QuRXhwVmFyaWFibGUpIHtcclxuICAgICAgLy8gVE9ETzogVW5ib3VuZCB2YXJpYWJsZSBhY2Nlc3Mgc2hvdWxkIGJlIGFuIGVycm9yLlxyXG4gICAgICByZXR1cm4gcGFyYW1zW2V4cDIubmFtZV0gfHwgc2VsZi5nbG9iYWxzW2V4cDIubmFtZV0gfHwgZXhwMjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDb252ZXJ0IHJlZltwcm9wXSA9PiByZWYuY2hpbGQocHJvcClcclxuICAgIGZ1bmN0aW9uIHNuYXBzaG90Q2hpbGQocmVmOiBhc3QuRXhwUmVmZXJlbmNlKTogYXN0LkV4cCB7XHJcbiAgICAgIHJldHVybiBhc3QuY2FzdChhc3QuY2FsbChhc3QucmVmZXJlbmNlKHJlZi5iYXNlLCBhc3Quc3RyaW5nKCdjaGlsZCcpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtyZWYuYWNjZXNzb3JdKSxcclxuICAgICAgICAgICAgICAgICAgICAgICdTbmFwc2hvdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAoZXhwLnR5cGUpIHtcclxuICAgIGNhc2UgJ29wJzpcclxuICAgICAgbGV0IGV4cE9wID0gPGFzdC5FeHBPcD4gYXN0LmNvcHlFeHAoZXhwKTtcclxuICAgICAgLy8gRW5zdXJlIGFyZ3VtZW50cyBhcmUgYm9vbGVhbiAob3IgdmFsdWVzKSB3aGVyZSBuZWVkZWQuXHJcbiAgICAgIGlmIChleHBPcC5vcCA9PT0gJ3ZhbHVlJykge1xyXG4gICAgICAgIGV4cE9wLmFyZ3NbMF0gPSB2YWx1ZUV4cHJlc3Npb24oZXhwT3AuYXJnc1swXSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoZXhwT3Aub3AgPT09ICd8fCcgfHwgZXhwT3Aub3AgPT09ICcmJicgfHwgZXhwT3Aub3AgPT09ICchJykge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwT3AuYXJncy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgZXhwT3AuYXJnc1tpXSA9IGJvb2xlYW5FeHByZXNzaW9uKGV4cE9wLmFyZ3NbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmIChleHBPcC5vcCA9PT0gJz86Jykge1xyXG4gICAgICAgIGV4cE9wLmFyZ3NbMF0gPSBib29sZWFuRXhwcmVzc2lvbihleHBPcC5hcmdzWzBdKTtcclxuICAgICAgICBleHBPcC5hcmdzWzFdID0gdmFsdWVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMV0pO1xyXG4gICAgICAgIGV4cE9wLmFyZ3NbMl0gPSB2YWx1ZUV4cHJlc3Npb24oZXhwT3AuYXJnc1syXSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHBPcC5hcmdzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICBleHBPcC5hcmdzW2ldID0gdmFsdWVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gZXhwT3A7XHJcblxyXG4gICAgY2FzZSAndmFyJzpcclxuICAgICAgcmV0dXJuIGxvb2t1cFZhcig8YXN0LkV4cFZhcmlhYmxlPiBleHApO1xyXG5cclxuICAgIGNhc2UgJ3JlZic6XHJcbiAgICAgIGxldCBleHBSZWYgPSA8YXN0LkV4cFJlZmVyZW5jZT4gYXN0LmNvcHlFeHAoZXhwKTtcclxuICAgICAgZXhwUmVmLmJhc2UgPSBzdWJFeHByZXNzaW9uKGV4cFJlZi5iYXNlKTtcclxuXHJcbiAgICAgIC8vIHZhcltyZWZdID0+IHZhcltyZWZdXHJcbiAgICAgIGlmIChleHBSZWYuYmFzZS52YWx1ZVR5cGUgIT09ICdTbmFwc2hvdCcpIHtcclxuICAgICAgICBleHBSZWYuYWNjZXNzb3IgPSBzdWJFeHByZXNzaW9uKGV4cFJlZi5hY2Nlc3Nvcik7XHJcbiAgICAgICAgcmV0dXJuIGV4cFJlZjtcclxuICAgICAgfVxyXG5cclxuICAgICAgbGV0IHByb3BOYW1lID0gYXN0LmdldFByb3BOYW1lKGV4cFJlZik7XHJcblxyXG4gICAgICAvLyBzbmFwc2hvdC5wcm9wIChzdGF0aWMgc3RyaW5nIHByb3BlcnR5KVxyXG4gICAgICBpZiAocHJvcE5hbWUgIT09ICcnKSB7XHJcbiAgICAgICAgLy8gc25hcHNob3QudmFsdWVNZXRob2QgPT4gc25hcHNob3QudmFsKCkudmFsdWVNZXRob2RcclxuICAgICAgICBpZiAodXRpbC5hcnJheUluY2x1ZGVzKHZhbHVlTWV0aG9kcywgcHJvcE5hbWUpKSB7XHJcbiAgICAgICAgICBleHBSZWYuYmFzZSA9IHZhbHVlRXhwcmVzc2lvbihleHBSZWYuYmFzZSk7XHJcbiAgICAgICAgICByZXR1cm4gZXhwUmVmO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gc25hcHNob3Quc3NNZXRob2QgPT4gc25hcHNob3Quc3NNZXRob2RcclxuICAgICAgICBpZiAodXRpbC5hcnJheUluY2x1ZGVzKHNuYXBzaG90TWV0aG9kcywgcHJvcE5hbWUpKSB7XHJcbiAgICAgICAgICByZXR1cm4gZXhwUmVmO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gc25hcHNob3RbZXhwXSA9PiBzbmFwc2hvdC5jaGlsZChleHApIG9yXHJcbiAgICAgIC8vIHNuYXBzaG90W3JlZl0gPT4gc25hcHNob3QuY2hpbGQocmVmLnZhbCgpKVxyXG4gICAgICBleHBSZWYuYWNjZXNzb3IgPSB2YWx1ZUV4cHJlc3Npb24oZXhwUmVmLmFjY2Vzc29yKTtcclxuICAgICAgcmV0dXJuIHNuYXBzaG90Q2hpbGQoZXhwUmVmKTtcclxuXHJcbiAgICBjYXNlICdjYWxsJzpcclxuICAgICAgbGV0IGV4cENhbGwgPSA8YXN0LkV4cENhbGw+IGFzdC5jb3B5RXhwKGV4cCk7XHJcbiAgICAgIGV4cENhbGwucmVmID0gPGFzdC5FeHBWYXJpYWJsZSB8IGFzdC5FeHBSZWZlcmVuY2U+IHN1YkV4cHJlc3Npb24oZXhwQ2FsbC5yZWYpO1xyXG4gICAgICB2YXIgY2FsbGVlID0gdGhpcy5sb29rdXBGdW5jdGlvbihleHBDYWxsLnJlZik7XHJcblxyXG4gICAgICAvLyBFeHBhbmQgdGhlIGZ1bmN0aW9uIGNhbGwgaW5saW5lXHJcbiAgICAgIGlmIChjYWxsZWUpIHtcclxuICAgICAgICB2YXIgZm4gPSBjYWxsZWUuZm47XHJcblxyXG4gICAgICAgIGlmIChjYWxsZWUuc2VsZikge1xyXG4gICAgICAgICAgZXhwQ2FsbC5hcmdzLnVuc2hpZnQoYXN0LmVuc3VyZVZhbHVlKGNhbGxlZS5zZWxmKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZm4ucGFyYW1zLmxlbmd0aCAhPT0gZXhwQ2FsbC5hcmdzLmxlbmd0aCkge1xyXG4gICAgICAgICAgdGhpcy5mYXRhbChlcnJvcnMubWlzbWF0Y2hQYXJhbXMgKyBcIiAoIFwiICtcclxuICAgICAgICAgICAgICAgICAgICAgY2FsbGVlLm1ldGhvZE5hbWUgKyBcIiBleHBlY3RzIFwiICsgZm4ucGFyYW1zLmxlbmd0aCArXHJcbiAgICAgICAgICAgICAgICAgICAgIFwiIGJ1dCBhY3R1YWxseSBwYXNzZWQgXCIgKyBleHBDYWxsLmFyZ3MubGVuZ3RoICsgXCIpXCIpO1xyXG4gICAgICAgICAgcmV0dXJuIGV4cDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChmbi5ib2R5LnR5cGUgPT09ICdidWlsdGluJykge1xyXG4gICAgICAgICAgcmV0dXJuICg8YXN0LkV4cEJ1aWx0aW4+IGZuLmJvZHkpLmZuKGV4cENhbGwuYXJncywgcGFyYW1zKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBpbm5lclBhcmFtcyA9IDxhc3QuUGFyYW1zPiB7fTtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmbi5wYXJhbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgIGlubmVyUGFyYW1zW2ZuLnBhcmFtc1tpXV0gPSBzdWJFeHByZXNzaW9uKGV4cENhbGwuYXJnc1tpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmdW5jdGlvbkNhbGxzW2NhbGxlZS5tZXRob2ROYW1lXSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5yZWN1cnNpdmUgKyBcIiAoXCIgKyBjYWxsZWUubWV0aG9kTmFtZSArIFwiKVwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZnVuY3Rpb25DYWxsc1tjYWxsZWUubWV0aG9kTmFtZV0gPSB0cnVlO1xyXG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnRpYWxFdmFsKGZuLmJvZHksIGlubmVyUGFyYW1zLCBmdW5jdGlvbkNhbGxzKTtcclxuICAgICAgICBmdW5jdGlvbkNhbGxzW2NhbGxlZS5tZXRob2ROYW1lXSA9IGZhbHNlO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIENhbid0IGV4cGFuZCBmdW5jdGlvbiAtIGJ1dCBqdXN0IGV4cGFuZCB0aGUgYXJndW1lbnRzLlxyXG4gICAgICBpZiAoIXRoaXMuYWxsb3dVbmRlZmluZWRGdW5jdGlvbnMpIHtcclxuICAgICAgICB2YXIgZnVuY05hbWUgPSBhc3QuZ2V0TWV0aG9kTmFtZShleHBDYWxsKTtcclxuICAgICAgICBpZiAoZnVuY05hbWUgIT09ICcnICYmICEoZnVuY05hbWUgaW4gdGhpcy5zeW1ib2xzLnNjaGVtYVsnU3RyaW5nJ10ubWV0aG9kcyB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dGlsLmFycmF5SW5jbHVkZXMoc25hcHNob3RNZXRob2RzLCBmdW5jTmFtZSkpKSB7XHJcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy51bmRlZmluZWRGdW5jdGlvbiArIGFzdC5kZWNvZGVFeHByZXNzaW9uKGV4cENhbGwucmVmKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cENhbGwuYXJncy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGV4cENhbGwuYXJnc1tpXSA9IHN1YkV4cHJlc3Npb24oZXhwQ2FsbC5hcmdzW2ldKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gSGFjayBmb3Igc25hcHNob3QucGFyZW50KCkudmFsKClcclxuICAgICAgLy8gVG9kbyAtIGJ1aWxkIHRhYmxlLWJhc2VkIG1ldGhvZCBzaWduYXR1cmVzLlxyXG4gICAgICBpZiAoYXN0LmdldE1ldGhvZE5hbWUoZXhwQ2FsbCkgPT09ICdwYXJlbnQnKSB7XHJcbiAgICAgICAgZXhwQ2FsbCA9IDxhc3QuRXhwQ2FsbD4gYXN0LmNhc3QoZXhwQ2FsbCwgJ1NuYXBzaG90Jyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiBleHBDYWxsO1xyXG5cclxuICAgIC8vIEV4cHJlc3Npb24gdHlwZXMgKGxpa2UgbGl0ZXJhbHMpIHRoYW4gbmVlZCBubyBleHBhbnNpb24uXHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICByZXR1cm4gZXhwO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gQnVpbHRpbiBmdW5jdGlvbiAtIGNvbnZlcnQgYWxsICd0aGlzJyB0byAnZGF0YScgKGZyb20gJ25ld0RhdGEnKS5cclxuICAvLyBBcmdzIGFyZSBmdW5jdGlvbiBhcmd1bWVudHMsIGFuZCBwYXJhbXMgYXJlIHRoZSBsb2NhbCAoZnVuY3Rpb24pIHNjb3BlIHZhcmlhYmxlcy5cclxuICBwcmlvcihhcmdzOiBhc3QuRXhwW10sIHBhcmFtczogYXN0LlBhcmFtcyk6IGFzdC5FeHAge1xyXG4gICAgdmFyIGxhc3RUaGlzSXMgPSB0aGlzLnRoaXNJcztcclxuICAgIHRoaXMudGhpc0lzID0gJ2RhdGEnO1xyXG4gICAgdmFyIGV4cCA9IHRoaXMucGFydGlhbEV2YWwoYXJnc1swXSwgcGFyYW1zKTtcclxuICAgIHRoaXMudGhpc0lzID0gbGFzdFRoaXNJcztcclxuICAgIHJldHVybiBleHA7XHJcbiAgfVxyXG5cclxuICAvLyBCdWlsdGluIGZ1bmN0aW9uIC0gY3VycmVudCB2YWx1ZSBvZiAndGhpcydcclxuICBnZXRUaGlzKGFyZ3M6IGFzdC5FeHBbXSwgcGFyYW1zOiBhc3QuUGFyYW1zKTogYXN0LkV4cCB7XHJcbiAgICByZXR1cm4gYXN0LnNuYXBzaG90VmFyaWFibGUodGhpcy50aGlzSXMpO1xyXG4gIH1cclxuXHJcbiAgLy8gQnVpbHRpbiBmdW5jdGlvbiAtIGVuc3VyZSB0eXBlIG9mIGFyZ3VtZW50XHJcbiAgZW5zdXJlVHlwZSh0eXBlOiBzdHJpbmcsIGFyZ3M6IGFzdC5FeHBbXSwgcGFyYW1zOiBhc3QuUGFyYW1zKSB7XHJcbiAgICBpZiAoYXJncy5sZW5ndGggIT09IDEpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5hcHBsaWNhdGlvbiArIFwiZW5zdXJlVHlwZSBhcmd1bWVudHMuXCIpO1xyXG4gICAgfVxyXG4gICAgdmFyIGV4cCA9IDxhc3QuRXhwVmFsdWU+IHRoaXMucGFydGlhbEV2YWwoYXJnc1swXSwgcGFyYW1zKTtcclxuICAgIGlmIChleHAudHlwZSAhPT0gdHlwZSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmNvZXJjaW9uICsgYXN0LmRlY29kZUV4cHJlc3Npb24oZXhwKSArIFwiID0+IFwiICsgdHlwZSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZXhwO1xyXG4gIH1cclxuXHJcbiAgLy8gQnVpbHRpbiBmdW5jdGlvbiAtIHJldHVybiB0aGUgcGFyZW50IGtleSBvZiAndGhpcycuXHJcbiAgZ2V0S2V5KGtleTogc3RyaW5nLCBhcmdzOiBhc3QuRXhwW10sIHBhcmFtczogYXN0LlBhcmFtcykge1xyXG4gICAgaWYgKGFyZ3MubGVuZ3RoICE9PSAwKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMubWlzbWF0Y2hQYXJhbXMgKyBcIihmb3VuZCBcIiArIGFyZ3MubGVuZ3RoICsgXCIgYnV0IGV4cGVjdGVkIDEpXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBrZXlbMF0gPT09ICckJyA/IGFzdC5saXRlcmFsKGtleSkgOiBhc3Quc3RyaW5nKGtleSk7XHJcbiAgfVxyXG5cclxuICAvLyBCdWlsdGluIGZ1bmN0aW9uIC0gcmV0dXJuIHRoZSByZWZlcmVuY2UgdG8gdGhlIHJvb3RcclxuICAvLyBXaGVuIGluIHJlYWQgbW9kZSAtIHVzZSAncm9vdCdcclxuICAvLyBXaGVuIGluIHdyaXRlL3ZhbGlkYXRlIC0gdXNlIHBhdGggdG8gcm9vdCB2aWEgbmV3RGF0YS5wYXJlbnQoKS4uLlxyXG4gIGdldFJvb3RSZWZlcmVuY2UocGF0aDogYXN0LlBhdGhUZW1wbGF0ZSwgYXJnczogYXN0LkV4cFtdLCBwYXJhbXM6IGFzdC5QYXJhbXMpIHtcclxuICAgIGlmIChhcmdzLmxlbmd0aCAhPT0gMCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJAcm9vdCBhcmd1bWVudHMuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vICdkYXRhJyBjYXNlXHJcbiAgICBpZiAodGhpcy50aGlzSXMgPT09ICdkYXRhJykge1xyXG4gICAgICByZXR1cm4gYXN0LnNuYXBzaG90VmFyaWFibGUoJ3Jvb3QnKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBUT0RPKGtvc3MpOiBSZW1vdmUgdGhpcyBzcGVjaWFsIGNhc2UgaWYgSlNPTiBzdXBwb3J0cyBuZXdSb290IGluc3RlYWQuXHJcbiAgICAvLyAnbmV3RGF0YScgY2FzZSAtIHRyYXZlcnNlIHRvIHJvb3QgdmlhIHBhcmVudCgpJ3MuXHJcbiAgICBsZXQgcmVzdWx0OiBhc3QuRXhwID0gYXN0LnNuYXBzaG90VmFyaWFibGUoJ25ld0RhdGEnKTtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aC5sZW5ndGgoKTsgaSsrKSB7XHJcbiAgICAgIHJlc3VsdCA9IGFzdC5zbmFwc2hvdFBhcmVudChyZXN1bHQpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8vIExvb2t1cCBnbG9iYWxseSBkZWZpbmVkIGZ1bmN0aW9uLlxyXG4gIGxvb2t1cEZ1bmN0aW9uKHJlZjogYXN0LkV4cFZhcmlhYmxlIHwgYXN0LkV4cFJlZmVyZW5jZSk6IHtcclxuICAgIHNlbGY/OiBhc3QuRXhwLFxyXG4gICAgZm46IGFzdC5NZXRob2QsXHJcbiAgICBtZXRob2ROYW1lOiBzdHJpbmdcclxuICB9IHwgdW5kZWZpbmVkIHtcclxuICAgIC8vIEZ1bmN0aW9uIGNhbGwuXHJcbiAgICBpZiAocmVmLnR5cGUgPT09ICd2YXInKSB7XHJcbiAgICAgIGxldCByZWZWYXIgPSA8YXN0LkV4cFZhcmlhYmxlPiByZWY7XHJcbiAgICAgIHZhciBmbiA9IHRoaXMuc3ltYm9scy5mdW5jdGlvbnNbcmVmVmFyLm5hbWVdO1xyXG4gICAgICBpZiAoIWZuKSB7XHJcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4geyBzZWxmOiB1bmRlZmluZWQsIGZuOiBmbiwgbWV0aG9kTmFtZTogcmVmVmFyLm5hbWV9O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIE1ldGhvZCBjYWxsLlxyXG4gICAgaWYgKHJlZi50eXBlID09PSAncmVmJykge1xyXG4gICAgICBsZXQgcmVmUmVmID0gPGFzdC5FeHBSZWZlcmVuY2U+IHJlZjtcclxuICAgICAgLy8gVE9ETzogUmVxdWlyZSBzdGF0aWMgdHlwZSB2YWxpZGF0aW9uIGJlZm9yZSBjYWxsaW5nIFN0cmluZyBtZXRob2RzLlxyXG4gICAgICBpZiAoKDxhc3QuRXhwT3A+IHJlZlJlZi5iYXNlKS5vcCAhPT0gJ3ZhbHVlJyAmJlxyXG4gICAgICAgICAgPHN0cmluZz4gKDxhc3QuRXhwVmFsdWU+IHJlZlJlZi5hY2Nlc3NvcikudmFsdWUgaW4gdGhpcy5zeW1ib2xzLnNjaGVtYVsnU3RyaW5nJ10ubWV0aG9kcykge1xyXG4gICAgICAgIGxldCBtZXRob2ROYW1lID0gPHN0cmluZz4gKDxhc3QuRXhwVmFsdWU+IHJlZlJlZi5hY2Nlc3NvcikudmFsdWU7XHJcbiAgICAgICAgcmV0dXJuIHsgc2VsZjogcmVmUmVmLmJhc2UsXHJcbiAgICAgICAgICAgICAgICAgZm46IHRoaXMuc3ltYm9scy5zY2hlbWFbJ1N0cmluZyddLm1ldGhvZHNbbWV0aG9kTmFtZV0sXHJcbiAgICAgICAgICAgICAgICAgbWV0aG9kTmFtZTogJ1N0cmluZy4nICsgbWV0aG9kTmFtZVxyXG4gICAgICAgICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxuXHJcbiAgZmF0YWwoczogc3RyaW5nKSB7XHJcbiAgICBlcnJvcihzKTtcclxuICAgIHRoaXMuZXJyb3JDb3VudCArPSAxO1xyXG4gIH1cclxufTtcclxuXHJcbi8vIE1lcmdlIGFsbCAuWCB0ZXJtcyBpbnRvIHRhcmdldC5cclxuZXhwb3J0IGZ1bmN0aW9uIGV4dGVuZFZhbGlkYXRvcih0YXJnZXQ6IFZhbGlkYXRvciwgc3JjOiBWYWxpZGF0b3IpOiBWYWxpZGF0b3Ige1xyXG4gIGlmIChzcmMgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5hcHBsaWNhdGlvbiArIFwiSWxsZWdhbCB2YWxpZGF0aW9uIHNvdXJjZS5cIik7XHJcbiAgfVxyXG4gIGZvciAodmFyIHByb3AgaW4gc3JjKSB7XHJcbiAgICBpZiAoIXNyYy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuICAgIGlmIChwcm9wWzBdID09PSAnLicpIHtcclxuICAgICAgaWYgKHRhcmdldFtwcm9wXSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdGFyZ2V0W3Byb3BdID0gW107XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHV0aWwuaXNUeXBlKHNyY1twcm9wXSwgJ2FycmF5JykpIHtcclxuICAgICAgICB1dGlsLmV4dGVuZEFycmF5KDxhbnlbXT4gdGFyZ2V0W3Byb3BdLCA8YW55W10+IHNyY1twcm9wXSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgKDxhc3QuRXhwW10+IHRhcmdldFtwcm9wXSkucHVzaCg8YXN0LkV4cD4gc3JjW3Byb3BdKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKCF0YXJnZXRbcHJvcF0pIHtcclxuICAgICAgICB0YXJnZXRbcHJvcF0gPSB7fTtcclxuICAgICAgfVxyXG4gICAgICBleHRlbmRWYWxpZGF0b3IoPFZhbGlkYXRvcj4gdGFyZ2V0W3Byb3BdLCA8VmFsaWRhdG9yPiBzcmNbcHJvcF0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHRhcmdldDtcclxufVxyXG5cclxuLy8gQ2FsbCBmbih2YWx1ZSwgcHJvcCwgcGF0aCkgb24gYWxsICcucHJvcHMnIGFuZCBhc3NpZ2luZyB0aGUgdmFsdWUgYmFjayBpbnRvIHRoZVxyXG4vLyB2YWxpZGF0b3IuXHJcbmV4cG9ydCBmdW5jdGlvbiBtYXBWYWxpZGF0b3IodjogVmFsaWRhdG9yLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZuOiAodmFsOiBWYWxpZGF0b3JWYWx1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3A6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlOiBhc3QuUGFyYW1zLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogYXN0LlBhdGhUZW1wbGF0ZSkgPT4gVmFsaWRhdG9yVmFsdWUgfCB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGU/OiBhc3QuUGFyYW1zLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg/OiBhc3QuUGF0aFRlbXBsYXRlKSB7XHJcbiAgaWYgKCFzY29wZSkge1xyXG4gICAgc2NvcGUgPSA8YXN0LlBhcmFtcz4ge307XHJcbiAgfVxyXG4gIGlmICghcGF0aCkge1xyXG4gICAgcGF0aCA9IG5ldyBhc3QuUGF0aFRlbXBsYXRlKCk7XHJcbiAgfVxyXG4gIGlmICgnLnNjb3BlJyBpbiB2KSB7XHJcbiAgICBzY29wZSA9IDxhc3QuUGFyYW1zPiB2Wycuc2NvcGUnXTtcclxuICB9XHJcbiAgZm9yICh2YXIgcHJvcCBpbiB2KSB7XHJcbiAgICBpZiAoIXYuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcbiAgICBpZiAocHJvcFswXSA9PT0gJy4nKSB7XHJcbiAgICAgIGxldCB2YWx1ZSA9IGZuKHZbcHJvcF0sIHByb3AsIHNjb3BlLCBwYXRoKTtcclxuICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICB2W3Byb3BdID0gdmFsdWU7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZGVsZXRlIHZbcHJvcF07XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAoIXV0aWwuaXNUeXBlKHZbcHJvcF0sICdvYmplY3QnKSkge1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGxldCBjaGlsZCA9IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFtwcm9wXSk7XHJcbiAgICAgIHBhdGgucHVzaChjaGlsZCk7XHJcbiAgICAgIG1hcFZhbGlkYXRvcig8VmFsaWRhdG9yPiB2W3Byb3BdLCBmbiwgc2NvcGUsIHBhdGgpO1xyXG4gICAgICBwYXRoLnBvcChjaGlsZCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vLyBDb2xsYXBzZSBhbGwgaGFzQ2hpbGRyZW4gY2FsbHMgaW50byBvbmUgKGNvbWJpbmluZyB0aGVpciBhcmd1bWVudHMpLlxyXG4vLyBFLmcuIFtuZXdEYXRhLmhhc0NoaWxkcmVuKCksIG5ld0RhdGEuaGFzQ2hpbGRyZW4oWyd4J10pLCBuZXdEYXRhLmhhc0NoaWxkcmVuKFsneSddKV0gPT5cclxuLy8gICAgICBuZXdEYXRhLmhhc0NoaWxkcmVuKFsneCcsICd5J10pXHJcbmZ1bmN0aW9uIGNvbGxhcHNlSGFzQ2hpbGRyZW4oZXhwczogYXN0LkV4cFtdKTogYXN0LkV4cFtdIHtcclxuICB2YXIgaGFzSGFzQ2hpbGRyZW46IGJvb2xlYW4gPSBmYWxzZTtcclxuICB2YXIgY29tYmluZWQgPSA8c3RyaW5nW10+IFtdO1xyXG4gIHZhciByZXN1bHQgPSA8YXN0LkV4cFtdPiBbXTtcclxuICBleHBzLmZvckVhY2goZnVuY3Rpb24oZXhwKSB7XHJcbiAgICBpZiAoZXhwLnR5cGUgIT09ICdjYWxsJykge1xyXG4gICAgICByZXN1bHQucHVzaChleHApO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGV4cENhbGwgPSA8YXN0LkV4cENhbGw+IGV4cDtcclxuICAgIGlmIChhc3QuZ2V0TWV0aG9kTmFtZShleHBDYWxsKSAhPT0gJ2hhc0NoaWxkcmVuJykge1xyXG4gICAgICByZXN1bHQucHVzaChleHApO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGV4cENhbGwuYXJncy5sZW5ndGggPT09IDApIHtcclxuICAgICAgaGFzSGFzQ2hpbGRyZW4gPSB0cnVlO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRXhwZWN0IG9uZSBhcmd1bWVudCBvZiBBcnJheSB0eXBlLlxyXG4gICAgaWYgKGV4cENhbGwuYXJncy5sZW5ndGggIT09IDEgfHwgZXhwQ2FsbC5hcmdzWzBdLnR5cGUgIT09ICdBcnJheScpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5hcHBsaWNhdGlvbiArIFwiSW52YWxpZCBhcmd1bWVudCB0byBoYXNDaGlsZHJlbigpOiBcIiArXHJcbiAgICAgICAgICAgICAgICAgICAgICBleHBDYWxsLmFyZ3NbMF0udHlwZSk7XHJcbiAgICB9XHJcbiAgICBsZXQgYXJncyA9ICg8YXN0LkV4cFZhbHVlPiBleHBDYWxsLmFyZ3NbMF0pLnZhbHVlO1xyXG5cclxuICAgIGFyZ3MuZm9yRWFjaChmdW5jdGlvbihhcmc6IGFzdC5FeHBWYWx1ZSkge1xyXG4gICAgICBoYXNIYXNDaGlsZHJlbiA9IHRydWU7XHJcbiAgICAgIGlmIChhcmcudHlwZSAhPT0gJ1N0cmluZycpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJFeHBlY3Qgc3RyaW5nIGFyZ3VtZW50IHRvIGhhc0NoaWxkcmVuKCksIG5vdDogXCIgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmcudHlwZSk7XHJcbiAgICAgIH1cclxuICAgICAgY29tYmluZWQucHVzaChhcmcudmFsdWUpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIGlmIChoYXNIYXNDaGlsZHJlbikge1xyXG4gICAgcmVzdWx0LnVuc2hpZnQoaGFzQ2hpbGRyZW5FeHAoY29tYmluZWQpKTtcclxuICB9XHJcbiAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuLy8gR2VuZXJhdGUgdGhpcy5oYXNDaGlsZHJlbihbcHJvcHMsIC4uLl0pIG9yIHRoaXMuaGFzQ2hpbGRyZW4oKVxyXG5mdW5jdGlvbiBoYXNDaGlsZHJlbkV4cChwcm9wczogc3RyaW5nW10pOiBhc3QuRXhwIHtcclxuICB2YXIgYXJncyA9IHByb3BzLmxlbmd0aCA9PT0gMCA/IFtdIDogW2FzdC5hcnJheShwcm9wcy5tYXAoYXN0LnN0cmluZykpXTtcclxuICByZXR1cm4gYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QuY2FzdChhc3QudmFyaWFibGUoJ3RoaXMnKSwgJ0FueScpLCBhc3Quc3RyaW5nKCdoYXNDaGlsZHJlbicpKSxcclxuICAgICAgICAgICAgICAgICAgYXJncyk7XHJcbn1cclxuIl19
