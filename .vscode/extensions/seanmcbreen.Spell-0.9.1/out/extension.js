'use strict';
var spellProvider_1 = require('./features/spellProvider');
function activate(context) {
    var linter = new spellProvider_1.default();
    linter.activate(context);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map