var os = require('os');
var fs = require('fs');
var child_process = require('child_process');

var path = 'nsupdate';

module.exports = function (keyfile, commands, callback) {
    var child = child_process.spawn(path, [
        '-k', 
        keyfile
    ]);

    var errors = '';

    child.stderr.on('data', function (data) {
        errors += data;
    });

    child.on('error', callback);

    child.on('exit', function (status) {
        if (status !== 0) {
            return callback(new Error('Status code ' + status));
        }
        if (errors.length > 0) {
            return callback(new Error('Unknown error'));
        }
        callback(null);
    });

    child.stdin.write(commands);
    child.stdin.end();
};
