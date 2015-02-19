var Hapi = require('hapi');
var Good = require('good');
var Basic = require('hapi-auth-basic');
var goodConsole = require('good-console');
var bcrypt = require('bcrypt');
var requestIp = require('request-ip');
var validateIp = require('validate-ip');

var nsupdate = require('./lib/nsupdate');

var config = require('./config');

var server = new Hapi.Server();
server.connection({
    port: config.port,
    host: config.host
});

var validateAuth = function (username, password, callback) {
    var user = config.users[username];
    if (! user) {
        return callback(null, false);
    }

    bcrypt.compare(password, user.password, function (err, isValid) {
        callback(null, isValid, {
            username: username,
            hosts: user.hosts
        });
    });
};

var validateHostnames = function (hostnames, userHosts) {
    var valid = true;
    hostnames.forEach(function (hostname) {
        if (userHosts.indexOf(hostname) < 0) {
            valid = false;
        }
    });
    return valid;
};

var doUpdate = function (hostnames, myip, callback) {
    var commands = 'server ' + config.bind.server + '\n';
    commands += 'zone ' + config.bind.zone + '\n';
    hostnames.forEach(function (hostname) {
        var recType = 'A'; // FIXME: detect "AAAA"
        commands += 'update delete ' + hostname + ' ' + recType + '\n';
        commands += 'update add ' + hostname + ' ' + config.bind.ttl + ' ' + recType + ' ' + myip + '\n';
    });
    commands += 'send\n';

    nsupdate(config.bind.keyfile, commands, callback);
};

server.register([
    {
        register: Good,
        options: {
            reporters: [{
                reporter: goodConsole,
                args:[{ log: '*', response: '*' }]
            }]
        }
    },{
        register: Basic,
        options: {}
    }
], function (err) {
    if (err) {
        throw err;
    }

    server.auth.strategy('simple', 'basic', { validateFunc: validateAuth });

    server.ext('onPreResponse', function (request, reply) {
        if (! request.response.isBoom) {
            return reply(request.response);
        }

        request.response.output.headers['content-type'] = 'text/plain';
        if (request.response.output.statusCode === 401) {
            request.response.output.payload = 'noauth';
        } else {
            request.response.output.payload = 'err';
        }

        return reply(request.response);
    });

    server.route({
        method: 'GET',
        path: '/favicon.ico',
        handler: function (request, reply) {
            reply('err').type('text/plain').code(404);
        }
    });

    server.route({
        method: ['GET', 'POST'],
        path: '/{param*}',
        config: {
            auth: 'simple',
            handler: function (request, reply) {
                var myip = request.query.myip ? request.query.myip : requestIp.getClientIp(request.raw.req);
                if (! validateIp(myip)) {
                    // FIXME: detect IPv6
                    myip = requestIp.getClientIp(request.raw.req);
                    server.log('debug', 'Invalid "myip" parameter "' + request.query.myip + '" using "' + myip + '" instead');
                }

                if (! request.query.hostname) {
                    return reply('notfqdn').type('text/plain').code(400);
                }
                var hostnames = request.query.hostname.split(',');
                if (hostnames.length < 1) {
                    return reply('notfqdn').type('text/plain').code(400);
                }
                if (! validateHostnames(hostnames, request.auth.credentials.hosts)) {
                    return reply('nohost').type('text/plain').code(400);
                }

                server.log('debug', 'User: ' + request.auth.credentials.username);
                server.log('info', 'Updating ' + hostnames + ' to ' + myip);
                doUpdate(hostnames, myip, function (err) {
                    if (err) {
                        server.log('warn', err.message);
                        return reply('dnserr').type('text/plain');
                    }
                    reply('good').type('text/plain');
                })
            }
        }
    });

    server.start(function () {
        server.log('info', 'Server running at ' + server.info.uri);
    });
});
