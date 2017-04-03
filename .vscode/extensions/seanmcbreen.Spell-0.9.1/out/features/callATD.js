'use strict';
var xml2js = require('xml2js');
var request = require('request');
var crypto = require('crypto');
var os = require('os');
function GetURI(language) {
    switch (language) {
        case 'en': return 'https://www.polishmywriting.com/proxy.php?url=/checkDocument';
        case 'fr': return 'https://fr.service.afterthedeadline.com/checkDocument';
        case 'de': return 'https://de.service.afterthedeadline.com/checkDocument';
        case 'pt': return 'https://pt.service.afterthedeadline.com/checkDocument';
        case 'es': return 'https://es.service.afterthedeadline.com/checkDocument';
        default: return 'https://www.polishmywriting.com/proxy.php?url=/checkDocument';
    }
}
function PostToATD(content, language, fn) {
    var key = crypto.createHash('sha1').update(os.hostname()).digest('hex');
    var parser = new xml2js.Parser;
    request({ method: "POST", url: GetURI(language), form: { data: content, key: key } }, function (error, response, body) {
        if (error)
            return fn(error, null);
        parser.parseString(body, function (error, result) {
            if (error)
                return fn(error);
            fn(null, result);
        });
    });
}
function check(language, content, fn) {
    var ignored = [
        'bias language', 'cliches', 'complex expression',
        'diacritical marks', 'double negatives', 'hidden verbs',
        'jargon language', 'passive voice', 'phrases to avoid',
        'redundant expression'
    ];
    PostToATD(content, language, function (error, data) {
        if (error || !data || !data.error)
            return fn(error, null);
        if (!Array.isArray(data.error))
            data.error = [data.error];
        var problems = data.error.filter(function (obj) {
            return !(~ignored.indexOf(obj.type));
        });
        fn(null, problems);
    });
}
exports.check = check;
;
//# sourceMappingURL=callATD.js.map