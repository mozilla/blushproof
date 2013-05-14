What?
-----
This is documentation for the server that listens for metrics events uploaded by blushproof. It currently lives in 'server/server.js'.

How to set up the server
------------------------
1. Set up an AWS instance (or whatever - that just happens to be what we are using)
2. Install Nginx (again, or whatever - it just has to be able to reverse proxy)
  * Here's the important part of nginx.conf:

            server {
               listen       8443;
               server_name  blushproof.org;

               ssl                  on;
               ssl_certificate      cert.pem;
               ssl_certificate_key  cert.key;

               ssl_session_timeout  5m;

               ssl_protocols  TLSv1;
               ssl_ciphers  HIGH:!aNULL:!MD5;
               ssl_prefer_server_ciphers   on;

               add_header Strict-Transport-Security max-age=10886400;

               location / {
                   proxy_pass http://127.0.0.1:8158;
               }
               # redirect server error pages to the static page /40x.html
               #
               error_page  404              /404.html;
               location = /40x.html {
                   root   /usr/share/nginx/html;
               }

               # redirect server error pages to the static page /50x.html
               #
               error_page   500 502 503 504  /50x.html;
               location = /50x.html {
                   root   /usr/share/nginx/html;
               }
            }
  * cert.{pem,key} is the certificate and key for the server
  * Listening on 8443 turns into listening on 443 through AWS magic, AIUI
  * Forwarding to port 8158 means we can run an unprivileged node server and not have to enter our key's passphrase every time we restart that server
  * "`ssl_ciphers  HIGH:!aNULL:!MD5;`" means no null-ciphers and no md5 (this is per the default Nginx sample configuration)
3. Install things as the 'app' user on the AWS instance
  * Node packages 'promise', 'http', 'sqlite3'
  * server/server.js
4. Start the servers:
  * As ec2-user: 'sudo /etc/init.d/nginx start' (requires key passphrase, logs in /var/log/nginx)
  * As app: 'node server.js' (this creates the file 'events.sqlite')
5. Are events coming in as expected?
  * Try 'sqlite3 events.sqlite', then 'select * from events;'
