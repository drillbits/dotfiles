'use strict';
var YAMLException = (function () {
    function YAMLException(reason, mark) {
        if (mark === void 0) { mark = null; }
        this.name = 'YAMLException';
        this.reason = reason;
        this.mark = mark;
        this.message = this.toString(false);
    }
    YAMLException.prototype.toString = function (compact) {
        if (compact === void 0) { compact = false; }
        var result;
        result = 'yaml: ' + (this.reason || '(unknown reason)');
        if (!compact && this.mark) {
            result += ' ' + this.mark.toString();
        }
        return result;
    };
    return YAMLException;
}());
module.exports = YAMLException;
//# sourceMappingURL=exception.js.map