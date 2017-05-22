'use strict';
(function (Kind) {
    Kind[Kind["SCALAR"] = 'SCALAR'] = "SCALAR";
    Kind[Kind["MAPPING"] = 'MAPPING'] = "MAPPING";
    Kind[Kind["MAP"] = 'MAP'] = "MAP";
    Kind[Kind["SEQ"] = 'SEQ'] = "SEQ";
    Kind[Kind["ANCHOR_REF"] = 'ANCHOR_REF'] = "ANCHOR_REF";
    Kind[Kind["INCLUDE_REF"] = 'INCLUDE_REF'] = "INCLUDE_REF";
})(exports.Kind || (exports.Kind = {}));
var Kind = exports.Kind;
exports.NodeType = {
    object: "object",
    array: "array",
    property: "property",
    string: "string",
    number: "number",
    boolean: "boolean",
    null: "null",
};
function newMapping(key, value) {
    var end = (value ? value.end : key.end + 1); //FIXME.workaround, end should be defied by position of ':'
    //console.log('key: ' + key.value + ' ' + key.startPosition + '..' + key.endPosition + ' ' + value + ' end: ' + end);
    // value.name = key.name = key.buffer;
    var node = {
        type: 'property',
        name: null,
        start: key.start,
        end: end,
        parent: null,
        kind: Kind.MAPPING,
        key: key,
        value: value,
        errors: []
    };
    return node;
}
exports.newMapping = newMapping;
function newAnchorRef(key, start, end, value) {
    return {
        type: 'string',
        name: key,
        start: start,
        end: end,
        parent: null,
        value: value,
        referencesAnchor: key,
        kind: Kind.ANCHOR_REF,
        errors: []
    };
}
exports.newAnchorRef = newAnchorRef;
function newScalar(v) {
    if (v === void 0) { v = ""; }
    return {
        type: undefined,
        name: v,
        start: -1,
        end: -1,
        parent: null,
        isKey: undefined,
        kind: Kind.SCALAR,
        doubleQuoted: false,
        buffer: v,
        errors: []
    };
}
exports.newScalar = newScalar;
function newItems() {
    return {
        type: 'array',
        name: null,
        start: -1,
        end: -1,
        parent: null,
        kind: Kind.SEQ,
        items: [],
        errors: []
    };
}
exports.newItems = newItems;
function newSeq() {
    return newItems();
}
exports.newSeq = newSeq;
function newMap(properties) {
    return {
        type: 'object',
        name: null,
        start: -1,
        end: -1,
        parent: null,
        kind: Kind.MAP,
        properties: properties ? properties : [],
        errors: []
    };
}
exports.newMap = newMap;
//# sourceMappingURL=interface.js.map