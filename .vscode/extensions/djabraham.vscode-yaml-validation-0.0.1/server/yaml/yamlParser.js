'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var jsonLocation_1 = require('../json/jsonLocation');
var nls = require('vscode-nls');
var localize = nls.loadMessageBundle();
var YamlCommon = require('./common');
var YamlLoader = require('./loader');
var YamlInterface = require('./interface');
var DEFAULT_SAFE_SCHEMA = require('./schema/default_safe');
var ASTNode = (function () {
    function ASTNode(parent, type, name, start, end) {
        this.type = type;
        this.name = name;
        this.start = start;
        this.end = end;
        this.parent = parent;
    }
    ASTNode.prototype.getNodeLocation = function () {
        var path = this.parent ? this.parent.getNodeLocation() : new jsonLocation_1.JSONLocation([]);
        if (this.name) {
            path = path.append(this.name);
        }
        return path;
    };
    ASTNode.prototype.getChildNodes = function () {
        return [];
    };
    ASTNode.prototype.getValue = function () {
        // override in children
        return;
    };
    ASTNode.prototype.contains = function (offset, includeRightBound) {
        if (includeRightBound === void 0) { includeRightBound = false; }
        return offset >= this.start && offset < this.end || includeRightBound && offset === this.end;
    };
    ASTNode.prototype.visit = function (visitor) {
        return visitor(this);
    };
    ASTNode.prototype.getNodeFromOffset = function (offset) {
        var findNode = function (node) {
            if (offset >= node.start && offset < node.end) {
                var children = node.getChildNodes();
                for (var i = 0; i < children.length && children[i].start <= offset; i++) {
                    var item = findNode(children[i]);
                    if (item) {
                        return item;
                    }
                }
                return node;
            }
            return null;
        };
        return findNode(this);
    };
    ASTNode.prototype.getNodeFromOffsetEndInclusive = function (offset) {
        var findNode = function (node) {
            if (offset >= node.start && offset <= node.end) {
                var children = node.getChildNodes();
                for (var i = 0; i < children.length && children[i].start <= offset; i++) {
                    var item = findNode(children[i]);
                    if (item) {
                        return item;
                    }
                }
                return node;
            }
            return null;
        };
        return findNode(this);
    };
    ASTNode.prototype.validate = function (schema, validationResult, matchingSchemas, offset) {
        var _this = this;
        if (offset === void 0) { offset = -1; }
        if (offset !== -1 && !this.contains(offset)) {
            return;
        }
        if (Array.isArray(schema.type)) {
            if (schema.type.indexOf(this.type) === -1) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: schema.errorMessage || localize('typeArrayMismatchWarning', 'Incorrect type. Expected one of {0}', schema.type.join(', '))
                });
            }
        }
        else if (schema.type) {
            if (this.type !== schema.type) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: schema.errorMessage || localize('typeMismatchWarning', 'Incorrect type. Expected "{0}"', schema.type)
                });
            }
        }
        if (Array.isArray(schema.allOf)) {
            schema.allOf.forEach(function (subSchema) {
                _this.validate(subSchema, validationResult, matchingSchemas, offset);
            });
        }
        if (schema.not) {
            var subValidationResult = new ValidationResult();
            var subMatchingSchemas = [];
            this.validate(schema.not, subValidationResult, subMatchingSchemas, offset);
            if (!subValidationResult.hasErrors()) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('notSchemaWarning', "Matches a schema that is not allowed.")
                });
            }
            if (matchingSchemas) {
                subMatchingSchemas.forEach(function (ms) {
                    ms.inverted = !ms.inverted;
                    matchingSchemas.push(ms);
                });
            }
        }
        var testAlternatives = function (alternatives, maxOneMatch) {
            var matches = [];
            // remember the best match that is used for error messages
            var bestMatch = null;
            alternatives.forEach(function (subSchema) {
                var subValidationResult = new ValidationResult();
                var subMatchingSchemas = [];
                _this.validate(subSchema, subValidationResult, subMatchingSchemas);
                if (!subValidationResult.hasErrors()) {
                    matches.push(subSchema);
                }
                if (!bestMatch) {
                    bestMatch = { schema: subSchema, validationResult: subValidationResult, matchingSchemas: subMatchingSchemas };
                }
                else {
                    if (!maxOneMatch && !subValidationResult.hasErrors() && !bestMatch.validationResult.hasErrors()) {
                        // no errors, both are equally good matches
                        bestMatch.matchingSchemas.push.apply(bestMatch.matchingSchemas, subMatchingSchemas);
                        bestMatch.validationResult.propertiesMatches += subValidationResult.propertiesMatches;
                        bestMatch.validationResult.propertiesValueMatches += subValidationResult.propertiesValueMatches;
                    }
                    else {
                        var compareResult = subValidationResult.compare(bestMatch.validationResult);
                        if (compareResult > 0) {
                            // our node is the best matching so far
                            bestMatch = { schema: subSchema, validationResult: subValidationResult, matchingSchemas: subMatchingSchemas };
                        }
                        else if (compareResult === 0) {
                            // there's already a best matching but we are as good
                            bestMatch.matchingSchemas.push.apply(bestMatch.matchingSchemas, subMatchingSchemas);
                        }
                    }
                }
            });
            if (matches.length > 1 && maxOneMatch) {
                validationResult.warnings.push({
                    location: { start: _this.start, end: _this.start + 1 },
                    message: localize('oneOfWarning', "Matches multiple schemas when only one must validate.")
                });
            }
            if (bestMatch !== null) {
                validationResult.merge(bestMatch.validationResult);
                validationResult.propertiesMatches += bestMatch.validationResult.propertiesMatches;
                validationResult.propertiesValueMatches += bestMatch.validationResult.propertiesValueMatches;
                if (matchingSchemas) {
                    matchingSchemas.push.apply(matchingSchemas, bestMatch.matchingSchemas);
                }
            }
            return matches.length;
        };
        if (Array.isArray(schema.anyOf)) {
            testAlternatives(schema.anyOf, false);
        }
        if (Array.isArray(schema.oneOf)) {
            testAlternatives(schema.oneOf, true);
        }
        if (Array.isArray(schema.enum)) {
            if (schema.enum.indexOf(this.getValue()) === -1) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('enumWarning', 'Value is not an accepted value. Valid values: {0}', JSON.stringify(schema.enum))
                });
            }
            else {
                validationResult.enumValueMatch = true;
            }
        }
        if (matchingSchemas !== null) {
            matchingSchemas.push({ node: this, schema: schema });
        }
    };
    return ASTNode;
}());
exports.ASTNode = ASTNode;
var ScalarASTNode = (function (_super) {
    __extends(ScalarASTNode, _super);
    function ScalarASTNode(parent, type, name, start, end) {
        _super.call(this, parent, type, name, start, end);
    }
    return ScalarASTNode;
}(ASTNode));
exports.ScalarASTNode = ScalarASTNode;
var NullASTNode = (function (_super) {
    __extends(NullASTNode, _super);
    function NullASTNode(parent, name, start, end) {
        _super.call(this, parent, 'null', name, start, end);
    }
    NullASTNode.prototype.getValue = function () {
        return null;
    };
    return NullASTNode;
}(ScalarASTNode));
exports.NullASTNode = NullASTNode;
var BooleanASTNode = (function (_super) {
    __extends(BooleanASTNode, _super);
    function BooleanASTNode(parent, name, value, start, end) {
        _super.call(this, parent, 'boolean', name, start, end);
        this.value = value;
    }
    BooleanASTNode.prototype.getValue = function () {
        return this.value;
    };
    return BooleanASTNode;
}(ScalarASTNode));
exports.BooleanASTNode = BooleanASTNode;
var NumberASTNode = (function (_super) {
    __extends(NumberASTNode, _super);
    function NumberASTNode(parent, name, start, end) {
        _super.call(this, parent, 'number', name, start, end);
        this.isInteger = true;
        this.value = Number.NaN;
    }
    NumberASTNode.prototype.getValue = function () {
        return this.value;
    };
    NumberASTNode.prototype.validate = function (schema, validationResult, matchingSchemas, offset) {
        if (offset === void 0) { offset = -1; }
        if (offset !== -1 && !this.contains(offset)) {
            return;
        }
        // work around type validation in the base class
        var typeIsInteger = false;
        if (schema.type === 'integer' || (Array.isArray(schema.type) && schema.type.indexOf('integer') !== -1)) {
            typeIsInteger = true;
        }
        if (typeIsInteger && this.isInteger === true) {
            this.type = 'integer';
        }
        _super.prototype.validate.call(this, schema, validationResult, matchingSchemas, offset);
        this.type = 'number';
        var val = this.getValue();
        if (typeof schema.multipleOf === 'number') {
            if (val % schema.multipleOf !== 0) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('multipleOfWarning', 'Value is not divisible by {0}', schema.multipleOf)
                });
            }
        }
        if (typeof schema.minimum === 'number') {
            if (schema.exclusiveMinimum && val <= schema.minimum) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('exclusiveMinimumWarning', 'Value is below the exclusive minimum of {0}', schema.minimum)
                });
            }
            if (!schema.exclusiveMinimum && val < schema.minimum) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('minimumWarning', 'Value is below the minimum of {0}', schema.minimum)
                });
            }
        }
        if (typeof schema.maximum === 'number') {
            if (schema.exclusiveMaximum && val >= schema.maximum) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('exclusiveMaximumWarning', 'Value is above the exclusive maximum of {0}', schema.maximum)
                });
            }
            if (!schema.exclusiveMaximum && val > schema.maximum) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('maximumWarning', 'Value is above the maximum of {0}', schema.maximum)
                });
            }
        }
    };
    return NumberASTNode;
}(ScalarASTNode));
exports.NumberASTNode = NumberASTNode;
var StringASTNode = (function (_super) {
    __extends(StringASTNode, _super);
    function StringASTNode(parent, name, isKey, start, end) {
        _super.call(this, parent, 'string', name, start, end);
        this.isKey = isKey;
        this.value = '';
    }
    StringASTNode.prototype.getValue = function () {
        return this.value;
    };
    StringASTNode.prototype.validate = function (schema, validationResult, matchingSchemas, offset) {
        if (offset === void 0) { offset = -1; }
        if (offset !== -1 && !this.contains(offset)) {
            return;
        }
        _super.prototype.validate.call(this, schema, validationResult, matchingSchemas, offset);
        if (schema.minLength && this.value.length < schema.minLength) {
            validationResult.warnings.push({
                location: { start: this.start, end: this.end },
                message: localize('minLengthWarning', 'String is shorter than the minimum length of ', schema.minLength)
            });
        }
        if (schema.maxLength && this.value.length > schema.maxLength) {
            validationResult.warnings.push({
                location: { start: this.start, end: this.end },
                message: localize('maxLengthWarning', 'String is shorter than the maximum length of ', schema.maxLength)
            });
        }
        if (schema.pattern) {
            var regex = new RegExp(schema.pattern);
            if (!regex.test(this.value)) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: schema.errorMessage || localize('patternWarning', 'String does not match the pattern of "{0}"', schema.pattern)
                });
            }
        }
    };
    return StringASTNode;
}(ScalarASTNode));
exports.StringASTNode = StringASTNode;
var ArrayASTNode = (function (_super) {
    __extends(ArrayASTNode, _super);
    function ArrayASTNode(parent, name, start, end) {
        _super.call(this, parent, 'array', name, start, end);
        this.items = [];
    }
    ArrayASTNode.prototype.getChildNodes = function () {
        return this.items;
    };
    ArrayASTNode.prototype.getValue = function () {
        return this.items.map(function (v) { return v.getValue(); });
    };
    ArrayASTNode.prototype.addItem = function (item) {
        if (item) {
            this.items.push(item);
            return true;
        }
        return false;
    };
    ArrayASTNode.prototype.visit = function (visitor) {
        var ctn = visitor(this);
        for (var i = 0; i < this.items.length && ctn; i++) {
            ctn = this.items[i].visit(visitor);
        }
        return ctn;
    };
    ArrayASTNode.prototype.validate = function (schema, validationResult, matchingSchemas, offset) {
        var _this = this;
        if (offset === void 0) { offset = -1; }
        if (offset !== -1 && !this.contains(offset)) {
            return;
        }
        _super.prototype.validate.call(this, schema, validationResult, matchingSchemas, offset);
        if (Array.isArray(schema.items)) {
            var subSchemas_1 = schema.items;
            subSchemas_1.forEach(function (subSchema, index) {
                var itemValidationResult = new ValidationResult();
                var item = _this.items[index];
                if (item) {
                    item.validate(subSchema, itemValidationResult, matchingSchemas, offset);
                    validationResult.mergePropertyMatch(itemValidationResult);
                }
                else if (_this.items.length >= subSchemas_1.length) {
                    validationResult.propertiesValueMatches++;
                }
            });
            if (schema.additionalItems === false && this.items.length > subSchemas_1.length) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('additionalItemsWarning', 'Array has too many items according to schema. Expected {0} or fewer', subSchemas_1.length)
                });
            }
            else if (this.items.length >= subSchemas_1.length) {
                validationResult.propertiesValueMatches += (this.items.length - subSchemas_1.length);
            }
        }
        else if (schema.items) {
            this.items.forEach(function (item) {
                var itemValidationResult = new ValidationResult();
                item.validate(schema.items, itemValidationResult, matchingSchemas, offset);
                validationResult.mergePropertyMatch(itemValidationResult);
            });
        }
        if (schema.minItems && this.items.length < schema.minItems) {
            validationResult.warnings.push({
                location: { start: this.start, end: this.end },
                message: localize('minItemsWarning', 'Array has too few items. Expected {0} or more', schema.minItems)
            });
        }
        if (schema.maxItems && this.items.length > schema.maxItems) {
            validationResult.warnings.push({
                location: { start: this.start, end: this.end },
                message: localize('maxItemsWarning', 'Array has too many items. Expected {0} or fewer', schema.minItems)
            });
        }
        if (schema.uniqueItems === true) {
            var values_1 = this.items.map(function (node) {
                return node.getValue();
            });
            var duplicates = values_1.some(function (value, index) {
                return index !== values_1.lastIndexOf(value);
            });
            if (duplicates) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('uniqueItemsWarning', 'Array has duplicate items')
                });
            }
        }
    };
    return ArrayASTNode;
}(ASTNode));
exports.ArrayASTNode = ArrayASTNode;
var PropertyASTNode = (function (_super) {
    __extends(PropertyASTNode, _super);
    function PropertyASTNode(parent) {
        _super.call(this, parent, 'property', null, 0, 0);
        this.colonOffset = -1;
    }
    PropertyASTNode.prototype.getChildNodes = function () {
        return this.value ? [this.key, this.value] : [this.key];
    };
    PropertyASTNode.prototype.setKey = function (key) {
        this.key = key;
        if (this.key != null) {
            key.parent = this;
            key.name = key.value;
            this.start = key.start;
            this.end = key.end;
        }
        return key !== null;
    };
    PropertyASTNode.prototype.setValue = function (value) {
        this.value = value;
        if (this.value != null) {
            this.value.name = this.key.name;
        }
        return value !== null;
    };
    PropertyASTNode.prototype.visit = function (visitor) {
        return visitor(this) && this.key.visit(visitor) && this.value && this.value.visit(visitor);
    };
    PropertyASTNode.prototype.validate = function (schema, validationResult, matchingSchemas, offset) {
        if (offset === void 0) { offset = -1; }
        if (offset !== -1 && !this.contains(offset)) {
            return;
        }
        if (this.value) {
            this.value.validate(schema, validationResult, matchingSchemas, offset);
        }
    };
    return PropertyASTNode;
}(ASTNode));
exports.PropertyASTNode = PropertyASTNode;
var ObjectASTNode = (function (_super) {
    __extends(ObjectASTNode, _super);
    function ObjectASTNode(parent, name, start, end) {
        _super.call(this, parent, 'object', name, start, end);
        this.properties = [];
    }
    ObjectASTNode.prototype.getChildNodes = function () {
        return this.properties;
    };
    ObjectASTNode.prototype.addProperty = function (node) {
        if (!node) {
            return false;
        }
        this.properties.push(node);
        return true;
    };
    ObjectASTNode.prototype.getFirstProperty = function (key) {
        for (var i = 0; i < this.properties.length; i++) {
            if (this.properties[i].key.value === key) {
                return this.properties[i];
            }
        }
        return null;
    };
    ObjectASTNode.prototype.getKeyList = function () {
        return this.properties.map(function (p) { return p.key.getValue(); });
    };
    ObjectASTNode.prototype.getValue = function () {
        var value = {};
        this.properties.forEach(function (p) {
            var v = p.value && p.value.getValue();
            if (v) {
                value[p.key.getValue()] = v;
            }
        });
        return value;
    };
    ObjectASTNode.prototype.visit = function (visitor) {
        var ctn = visitor(this);
        for (var i = 0; i < this.properties.length && ctn; i++) {
            ctn = this.properties[i].visit(visitor);
        }
        return ctn;
    };
    ObjectASTNode.prototype.validate = function (schema, validationResult, matchingSchemas, offset) {
        var _this = this;
        if (offset === void 0) { offset = -1; }
        if (offset !== -1 && !this.contains(offset)) {
            return;
        }
        _super.prototype.validate.call(this, schema, validationResult, matchingSchemas, offset);
        var seenKeys = {};
        var unprocessedProperties = [];
        this.properties.forEach(function (node) {
            var key = node.key.value;
            seenKeys[key] = node.value;
            unprocessedProperties.push(key);
        });
        if (Array.isArray(schema.required)) {
            schema.required.forEach(function (propertyName) {
                if (!seenKeys[propertyName]) {
                    var key = _this.parent && _this.parent && _this.parent.key;
                    var location_1 = key ? { start: key.start, end: key.end } : { start: _this.start, end: _this.start + 1 };
                    validationResult.warnings.push({
                        location: location_1,
                        message: localize('MissingRequiredPropWarning', 'Missing property "{0}"', propertyName)
                    });
                }
            });
        }
        var propertyProcessed = function (prop) {
            var index = unprocessedProperties.indexOf(prop);
            while (index >= 0) {
                unprocessedProperties.splice(index, 1);
                index = unprocessedProperties.indexOf(prop);
            }
        };
        if (schema.properties) {
            Object.keys(schema.properties).forEach(function (propertyName) {
                propertyProcessed(propertyName);
                var prop = schema.properties[propertyName];
                var child = seenKeys[propertyName];
                if (child) {
                    var propertyvalidationResult = new ValidationResult();
                    child.validate(prop, propertyvalidationResult, matchingSchemas, offset);
                    validationResult.mergePropertyMatch(propertyvalidationResult);
                }
            });
        }
        if (schema.patternProperties) {
            Object.keys(schema.patternProperties).forEach(function (propertyPattern) {
                var regex = new RegExp(propertyPattern);
                unprocessedProperties.slice(0).forEach(function (propertyName) {
                    if (regex.test(propertyName)) {
                        propertyProcessed(propertyName);
                        var child = seenKeys[propertyName];
                        if (child) {
                            var propertyvalidationResult = new ValidationResult();
                            child.validate(schema.patternProperties[propertyPattern], propertyvalidationResult, matchingSchemas, offset);
                            validationResult.mergePropertyMatch(propertyvalidationResult);
                        }
                    }
                });
            });
        }
        if (schema.additionalProperties) {
            unprocessedProperties.forEach(function (propertyName) {
                var child = seenKeys[propertyName];
                if (child) {
                    var propertyvalidationResult = new ValidationResult();
                    child.validate(schema.additionalProperties, propertyvalidationResult, matchingSchemas, offset);
                    validationResult.mergePropertyMatch(propertyvalidationResult);
                }
            });
        }
        else if (schema.additionalProperties === false) {
            if (unprocessedProperties.length > 0) {
                unprocessedProperties.forEach(function (propertyName) {
                    var child = seenKeys[propertyName];
                    if (child) {
                        var propertyNode = child.parent;
                        validationResult.warnings.push({
                            location: { start: propertyNode.key.start, end: propertyNode.key.end },
                            message: localize('DisallowedExtraPropWarning', 'Property {0} is not allowed', propertyName)
                        });
                    }
                });
            }
        }
        if (schema.maxProperties) {
            if (this.properties.length > schema.maxProperties) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('MaxPropWarning', 'Object has more properties than limit of {0}', schema.maxProperties)
                });
            }
        }
        if (schema.minProperties) {
            if (this.properties.length < schema.minProperties) {
                validationResult.warnings.push({
                    location: { start: this.start, end: this.end },
                    message: localize('MinPropWarning', 'Object has fewer properties than the required number of {0}', schema.minProperties)
                });
            }
        }
        if (schema.dependencies) {
            Object.keys(schema.dependencies).forEach(function (key) {
                var prop = seenKeys[key];
                if (prop) {
                    if (Array.isArray(schema.dependencies[key])) {
                        var valueAsArray = schema.dependencies[key];
                        valueAsArray.forEach(function (requiredProp) {
                            if (!seenKeys[requiredProp]) {
                                validationResult.warnings.push({
                                    location: { start: _this.start, end: _this.end },
                                    message: localize('RequiredDependentPropWarning', 'Object is missing property {0} required by property {1}', requiredProp, key)
                                });
                            }
                            else {
                                validationResult.propertiesValueMatches++;
                            }
                        });
                    }
                    else if (schema.dependencies[key]) {
                        var valueAsSchema = schema.dependencies[key];
                        var propertyvalidationResult = new ValidationResult();
                        _this.validate(valueAsSchema, propertyvalidationResult, matchingSchemas, offset);
                        validationResult.mergePropertyMatch(propertyvalidationResult);
                    }
                }
            });
        }
    };
    return ObjectASTNode;
}(ASTNode));
exports.ObjectASTNode = ObjectASTNode;
var YAMLDocumentConfig = (function () {
    function YAMLDocumentConfig() {
        this.ignoreDanglingComma = false;
    }
    return YAMLDocumentConfig;
}());
exports.YAMLDocumentConfig = YAMLDocumentConfig;
var ValidationResult = (function () {
    function ValidationResult() {
        this.errors = [];
        this.warnings = [];
        this.propertiesMatches = 0;
        this.propertiesValueMatches = 0;
        this.enumValueMatch = false;
    }
    ValidationResult.prototype.hasErrors = function () {
        return !!this.errors.length || !!this.warnings.length;
    };
    ValidationResult.prototype.mergeAll = function (validationResults) {
        var _this = this;
        validationResults.forEach(function (validationResult) {
            _this.merge(validationResult);
        });
    };
    ValidationResult.prototype.merge = function (validationResult) {
        this.errors = this.errors.concat(validationResult.errors);
        this.warnings = this.warnings.concat(validationResult.warnings);
    };
    ValidationResult.prototype.mergePropertyMatch = function (propertyValidationResult) {
        this.merge(propertyValidationResult);
        this.propertiesMatches++;
        if (propertyValidationResult.enumValueMatch || !propertyValidationResult.hasErrors() && propertyValidationResult.propertiesMatches) {
            this.propertiesValueMatches++;
        }
    };
    ValidationResult.prototype.compare = function (other) {
        var hasErrors = this.hasErrors();
        if (hasErrors !== other.hasErrors()) {
            return hasErrors ? -1 : 1;
        }
        if (this.enumValueMatch !== other.enumValueMatch) {
            return other.enumValueMatch ? -1 : 1;
        }
        if (this.propertiesValueMatches !== other.propertiesValueMatches) {
            return this.propertiesValueMatches - other.propertiesValueMatches;
        }
        return this.propertiesMatches - other.propertiesMatches;
    };
    return ValidationResult;
}());
exports.ValidationResult = ValidationResult;
var YAMLDocument = (function () {
    function YAMLDocument(config) {
        this.config = config;
        this.validationResult = new ValidationResult();
    }
    Object.defineProperty(YAMLDocument.prototype, "errors", {
        get: function () {
            return this.validationResult.errors;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(YAMLDocument.prototype, "warnings", {
        get: function () {
            return this.validationResult.warnings;
        },
        enumerable: true,
        configurable: true
    });
    YAMLDocument.prototype.getNodeFromOffset = function (offset) {
        return this.root && this.root.getNodeFromOffset(offset);
    };
    YAMLDocument.prototype.getNodeFromOffsetEndInclusive = function (offset) {
        return this.root && this.root.getNodeFromOffsetEndInclusive(offset);
    };
    YAMLDocument.prototype.visit = function (visitor) {
        if (this.root) {
            this.root.visit(visitor);
        }
    };
    YAMLDocument.prototype.validate = function (schema, matchingSchemas, offset) {
        if (matchingSchemas === void 0) { matchingSchemas = null; }
        if (offset === void 0) { offset = -1; }
        if (this.root) {
            this.root.validate(schema, this.validationResult, matchingSchemas, offset);
        }
    };
    return YAMLDocument;
}());
exports.YAMLDocument = YAMLDocument;
function ConvertNode(s, astParent) {
    var astNode;
    if (!s || !s.kind) {
        return;
    }
    // Convert yamlAST to match jsonAST
    switch (s.kind) {
        case YamlInterface.Kind.SCALAR:
            switch (s.type) {
                case YamlInterface.NodeType.null:
                    var nodeNull = new NullASTNode(astParent, s.name, s.start, s.end);
                    astNode = nodeNull;
                    break;
                case YamlInterface.NodeType.number:
                    var nodeNumber = new NumberASTNode(astParent, s.name, s.start, s.end);
                    nodeNumber.isInteger = s.isInteger;
                    nodeNumber.value = s.value;
                    astNode = nodeNumber;
                    break;
                case YamlInterface.NodeType.boolean:
                    var nodeBoolean = new BooleanASTNode(astParent, s.name, s.value, s.start, s.end);
                    astNode = nodeBoolean;
                    break;
                case YamlInterface.NodeType.string:
                    var nodeString = new StringASTNode(astParent, s.name, s.isKey, s.start, s.end);
                    nodeString.value = s.value;
                    astNode = nodeString;
                    break;
            }
            break;
        case YamlInterface.Kind.SEQ:
            var nodeArray_1 = new ArrayASTNode(astParent, s.name, s.start, s.end);
            astNode = nodeArray_1;
            s.items.forEach(function (item) {
                var itemNode = ConvertNode(item, nodeArray_1);
                nodeArray_1.items.push(itemNode);
            });
            break;
        case YamlInterface.Kind.MAP:
            var nodeObject_1 = new ObjectASTNode(astParent, s.name, s.start, s.end);
            astNode = nodeObject_1;
            s.properties.forEach(function (prop) {
                var propNode = ConvertNode(prop, nodeObject_1);
                nodeObject_1.properties.push(propNode);
            });
            break;
        case YamlInterface.Kind.MAPPING:
            var nodeProperty = new PropertyASTNode(astParent);
            astNode = nodeProperty;
            var keyNode = ConvertNode(s.key, nodeProperty);
            var valNode = ConvertNode(s.value, nodeProperty);
            nodeProperty.setKey(keyNode);
            nodeProperty.setValue(valNode);
            break;
    }
    return astNode;
    // TODO: ANCHOR_REF ?
    // TODO: INCLUDE_REF ?
}
function parse(text, config) {
    if (config === void 0) { config = new YAMLDocumentConfig(); }
    var _doc = new YAMLDocument(config);
    var yamlInterface = YamlLoader.load(text, YamlCommon.extend({ schema: DEFAULT_SAFE_SCHEMA }, config));
    _doc.root = ConvertNode(yamlInterface, null);
    yamlInterface.errors.forEach(function (err) {
        // ignore multiple errors on the same offset
        _doc.errors.push({ message: err.message, location: { start: err.mark.position, end: err.mark.position + err.mark.buffer.length } });
    });
    return _doc;
}
exports.parse = parse;
//# sourceMappingURL=yamlParser.js.map