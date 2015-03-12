# Dyndns: a simple DynDNS server

This script takes the same parameters as the original dyndns.org server does. It can update a BIND DNS server via `nsupdate`.

As it uses the same syntax as the original DynDNS.org servers do, a dynamic DNS server equipped with this script can be used with DynDNS compatible clients without having to modify anything on the client side.


### Features

This script handles DNS updates on the url

    http://yourdomain.tld/?hostname=<domain>&myip=<ipaddr>

For security HTTP basic auth is used. You can create multiple users and assign host names for each user.


### Installation

To be able to dynamically update the BIND DNS server, a DNS key must be generated with the command:

    ddns-confgen

This command outputs instructions for your BIND installation. The generated key has to be added to the named.conf.local:

    key "ddns-key" {
        algorithm hmac-sha256;
        secret "bvZ....K5A==";
    };

and saved to a file which is referenced in index.php as "bind.keyfile". In the "zone" entry, you have to add an "update-policy":

    zone "dyndns.example.com" {
        type master;
        file "db.dyndns.example.com";
        ...
        update-policy {
            grant ddns-key zonesub ANY;
        }
    }

In this case, the zone is also called "dyndns.example.com". The (initial) db.dyndns.example.com file (located in BIND's cache directory) looks like this:

    $TTL 1h
    @ IN SOA dyndns.example.com. root.example.com. (
            2007111501      ; serial
            1h              ; refresh
            15m             ; retry
            7d              ; expiration
            1h              ; minimum
            )  
            NS <your dns server>

Remember to change access rights so BIND is able to write to this file. On Ubuntu the zone need to be in /var/lib/bind due to AppArmor.


### Script configuration

This Node.js service is called by the DynDNS client, it validates the input and calls "nsupdate" to 
finally update the DNS with the new data. Its configuration is rather simple, the user database is
stored in `config.js`.

    <user>:<password>

Passwords are bcrypt'ed. Additionally, each user has a list of hosts, which they can modify (so users can update multiple hosts, and a host can be updated by multiple users). Passwords can be encrypted like this:

    require('bcrypt').hash('myspecialsecret', 10, console.log);


### Usage

Authentication in URL:

    http://username:password@yourdomain.tld/?hostname=yourhostname&myip=ipaddress


Raw HTTP GET Request:

    GET /?hostname=yourhostname&myip=ipaddress HTTP/1.0 
    Host: yourdomain.tld 
    Authorization: Basic base-64-authorization 
    User-Agent: Company - Device - Version Number

Fragment base-64-authorization should be represented by Base 64 encoded username:password string.


### Implemented fields

- `hostname` Comma separated list of hostnames that you wish to update (up to 20 hostnames per request). This is a required field. Example: `hostname=dynhost1.yourdomain.tld,dynhost2.yourdomain.tld`
- `myip` IP address to set for the update. Defaults to the best IP address the server can determine.


### Return Codes

- `good` The update was successful, and the hostname is now updated.
- `badauth` The username and password pair do not match a real user.
- `notfqdn` The hostname specified is not a fully-qualified domain name (not in the form hostname.dyndns.org or domain.com).
- `nohost` The hostname specified does not exist in this user account (or is not in the service specified in the system parameter)
- `dnserr` DNS error encountered


### Todo

- Properly test this
- Maybe support other protocols
- Add IPv6 support
- Build a Docker container to demo this


### License

MIT
