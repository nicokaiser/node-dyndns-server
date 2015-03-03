'use strict';

var childProcess = require('child_process');

var path = 'nsupdate';

module.exports = function (keyfile, commands, callback) {
    var child = childProcess.spawn(path, ['-k', keyfile]);
    var errors = '';

    child.stderr.on('data', function (data) {
        errors += data;
    });

    child.on('error', callback);

    child.on('exit', function (status) {
        if (status !== 0) {
            return callback(new Error('Status code ' + status + ': ' + errors.trim()));
        }
        if (errors.length > 0) {
            return callback(new Error(errors.trim()));
        }
        callback(null);
    });

    child.stdin.write(commands + '\n');
    child.stdin.end();
};
