var config = module.exports = {};

config.port = process.env.PORT || 3000;
config.host = 'localhost';

config.users = {
    "user1": {
        "password": "...",
        "hosts": ["mydomain1", "mydomain2"]
    }
};

config.bind = {
    server: 'localhost',
    zone: 'dyn.example.com',
    ttl: 60,
    keyfile: './dyn.exampe.com.key'
};
