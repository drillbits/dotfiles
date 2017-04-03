'use strict';
//https://github.com/sindresorhus/opn/blob/master/index.js
//Modified as this uses target as an argument
var path = require('path');
var childProcess = require('child_process');
function open(opts) {
    //opts = objectAssign({wait: true}, opts);
    if (!opts.hasOwnProperty("wait")) {
        opts.wait = true;
    }
    var cmd;
    var appArgs = [];
    var args = [];
    var cpOpts = {};
    if (opts.cwd) {
        cpOpts.cwd = opts.cwd;
    }
    if (opts.env) {
        cpOpts.env = opts.env;
    }
    if (Array.isArray(opts.app)) {
        appArgs = opts.app.slice(1);
        opts.app = opts.app[0];
    }
    if (process.platform === 'darwin') {
        cmd = 'osascript';
        args = ['-e', 'tell application "terminal"',
            '-e', 'do script "cd \\"' + opts.cwd + '\\"; ' + [opts.app].concat(appArgs).join(" ") + '"',
            '-e', 'end tell'];
    }
    else if (process.platform === 'win32') {
        cmd = 'cmd';
        args.push('/c', 'start', '');
        // if (opts.wait) {
        args.push('/wait');
        //  }
        if (opts.app) {
            args.push(opts.app);
        }
        if (appArgs.length > 0) {
            args = args.concat(appArgs);
        }
    }
    else {
        if (opts.app) {
            cmd = opts.app;
        }
        else {
            cmd = path.join(__dirname, 'xdg-open');
        }
        if (appArgs.length > 0) {
            args = args.concat(appArgs);
        }
        if (!opts.wait) {
            // xdg-open will block the process unless
            // stdio is ignored even if it's unref'd
            cpOpts.stdio = 'ignore';
        }
    }
    var cp = childProcess.spawn(cmd, args, cpOpts);
    if (opts.wait) {
        return new Promise(function (resolve, reject) {
            cp.once('error', reject);
            cp.once('close', function (code) {
                if (code > 0) {
                    reject(new Error('Exited with code ' + code));
                    return;
                }
                resolve(cp);
            });
        });
    }
    cp.unref();
    return Promise.resolve(cp);
}
exports.open = open;
;
//# sourceMappingURL=open.js.map