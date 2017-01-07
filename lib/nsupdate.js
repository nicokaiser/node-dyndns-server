'use strict';

const childProcess = require('child_process');

const path = 'nsupdate';

module.exports = function nsupdate(keyfile, commands, callback) {
    const child = childProcess.spawn(path, ['-k', keyfile]);
    let errors = '';

    child.stderr.on('data', (data) => {
        errors += data;
    });

    child.on('error', callback);

    child.on('exit', (status) => {
        if (status !== 0) return callback(new Error('Status code ' + status + ': ' + errors.trim()));
        if (errors.length > 0) return callback(new Error(errors.trim()));
        return callback(null);
    });

    child.stdin.write(commands + '\n');
    child.stdin.end();
};
