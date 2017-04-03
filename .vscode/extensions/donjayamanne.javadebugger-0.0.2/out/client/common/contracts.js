"use strict";
(function (JavaEvaluationResultFlags) {
    JavaEvaluationResultFlags[JavaEvaluationResultFlags["None"] = 0] = "None";
    JavaEvaluationResultFlags[JavaEvaluationResultFlags["Expandable"] = 1] = "Expandable";
    JavaEvaluationResultFlags[JavaEvaluationResultFlags["MethodCall"] = 2] = "MethodCall";
    JavaEvaluationResultFlags[JavaEvaluationResultFlags["SideEffects"] = 4] = "SideEffects";
    JavaEvaluationResultFlags[JavaEvaluationResultFlags["Raw"] = 8] = "Raw";
    JavaEvaluationResultFlags[JavaEvaluationResultFlags["HasRawRepr"] = 16] = "HasRawRepr";
})(exports.JavaEvaluationResultFlags || (exports.JavaEvaluationResultFlags = {}));
var JavaEvaluationResultFlags = exports.JavaEvaluationResultFlags;
//# sourceMappingURL=contracts.js.map