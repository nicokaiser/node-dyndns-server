'use strict';

const Hapi = require('hapi');
const Good = require('good');
const Basic = require('hapi-auth-basic');
const goodConsole = require('good-console');
const bcrypt = require('bcrypt');
const requestIp = require('request-ip');
const validateIp = require('validate-ip');

const nsupdate = require('./lib/nsupdate');
const config = require('./config');

const server = new Hapi.Server();
server.connection({
    port: config.port,
    host: config.host
});

const validateAuth = (username, password, callback) => {
    const user = config.users[username];
    if (!user) return callback(null, false);
    return bcrypt.compare(password, user.password, (err, isValid) => {
        callback(null, isValid, {
            username,
            hosts: user.hosts
        });
    });
};

const validateHostnames = (hostnames, userHosts) => {
    let valid = true;
    hostnames.forEach((hostname) => {
        if (userHosts.indexOf(hostname) < 0) valid = false;
    });
    return valid;
};

const doUpdate = (hostnames, myip, callback) => {
    let commands = 'server ' + config.bind.server + '\n';
    commands += 'zone ' + config.bind.zone + '\n';
    hostnames.forEach((hostname) => {
        const recType = 'A'; // FIXME: detect "AAAA"
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
                args: [{ log: '*', response: '*' }]
            }]
        }
    }, {
        register: Basic,
        options: {}
    }
], (err) => {
    if (err) throw err;

    server.auth.strategy('simple', 'basic', { validateFunc: validateAuth });

    server.ext('onPreResponse', (request, reply) => {
        if (!request.response.isBoom) return reply(request.response);

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
        handler: (request, reply) => {
            reply('err').type('text/plain').code(404);
        }
    });

    server.route({
        method: ['GET', 'POST'],
        path: '/{param*}',
        config: {
            auth: 'simple',
            handler: (request, reply) => {
                let myip = request.query.myip
                    ? request.query.myip
                    : requestIp.getClientIp(request.raw.req);
                if (!validateIp(myip)) {
                    // FIXME: detect IPv6
                    myip = requestIp.getClientIp(request.raw.req);
                    server.log('debug', 'Invalid "myip" parameter "' + request.query.myip +
                        '" using "' + myip + '" instead');
                }

                if (!request.query.hostname) {
                    return reply('notfqdn').type('text/plain').code(400);
                }
                const hostnames = request.query.hostname.split(',');
                if (hostnames.length < 1) {
                    return reply('notfqdn').type('text/plain').code(400);
                }
                if (!validateHostnames(hostnames, request.auth.credentials.hosts)) {
                    return reply('nohost').type('text/plain').code(400);
                }

                server.log('debug', 'User: ' + request.auth.credentials.username);
                server.log('info', 'Updating ' + hostnames + ' to ' + myip);
                return doUpdate(hostnames, myip, (dnsErr) => {
                    if (dnsErr) {
                        server.log('warn', dnsErr.message);
                        return reply('dnserr').type('text/plain');
                    }
                    return reply('good').type('text/plain');
                });
            }
        }
    });

    server.start(() => server.log('info', 'Server running at ' + server.info.uri));
});
