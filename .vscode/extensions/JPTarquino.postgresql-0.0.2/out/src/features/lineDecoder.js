'use strict';
var string_decoder_1 = require('string_decoder');
var LineDecoder = (function () {
    function LineDecoder(encoding) {
        if (encoding === void 0) { encoding = 'utf8'; }
        this.stringDecoder = new string_decoder_1.StringDecoder(encoding);
        this.remaining = null;
    }
    LineDecoder.prototype.write = function (buffer) {
        var result = [];
        var value = this.remaining
            ? this.remaining + this.stringDecoder.write(buffer)
            : this.stringDecoder.write(buffer);
        if (value.length < 1) {
            return result;
        }
        var start = 0;
        var ch;
        while (start < value.length && ((ch = value.charCodeAt(start)) === 13 || ch === 10)) {
            start++;
        }
        var idx = start;
        while (idx < value.length) {
            ch = value.charCodeAt(idx);
            if (ch === 13 || ch === 10) {
                result.push(value.substring(start, idx));
                idx++;
                while (idx < value.length && ((ch = value.charCodeAt(idx)) === 13 || ch === 10)) {
                    idx++;
                }
                start = idx;
            }
            else {
                idx++;
            }
        }
        this.remaining = start < value.length ? value.substr(start) : null;
        return result;
    };
    LineDecoder.prototype.end = function () {
        return this.remaining;
    };
    return LineDecoder;
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LineDecoder;
//# sourceMappingURL=lineDecoder.js.map