'use strict';
var net = require('net');
function WaitForPortToOpen(port, timeout) {
    return new Promise(function (resolve, reject) {
        var timedOut = false;
        var handle = setTimeout(function () {
            timedOut = true;
            reject("Timeout after " + timeout + " milli-seconds");
        }, timeout);
        tryToConnect();
        function tryToConnect() {
            if (timedOut) {
                return;
            }
            var socket = net.connect({ port: port }, function () {
                if (timedOut) {
                    return;
                }
                socket.end();
                clearTimeout(handle);
                resolve();
            });
            socket.on("error", function (error) {
                if (timedOut) {
                    return;
                }
                if (error.code === "ECONNREFUSED" && !timedOut) {
                    setTimeout(function () { tryToConnect(); }, 10);
                    return;
                }
                clearTimeout(handle);
                if (error && error.message) {
                    error.message = "connection failed (" + error.message + ")";
                }
                reject(error);
            });
        }
    });
}
exports.WaitForPortToOpen = WaitForPortToOpen;
//# sourceMappingURL=waitForPortToOpen.js.map