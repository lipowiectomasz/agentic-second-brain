# Production deployment of a containerised web application

This procedure covers the first release of a containerised web application to a single
virtual server and every release after it. It assumes a reverse proxy that terminates TLS,
release images built by CI from the main branch, and a PostgreSQL database in the same
compose project.

## Release artefacts

- CI runs the test suite on every change to the main branch, builds the application images
  and publishes them to a container registry.
- The release tag is the full commit SHA of the accepted commit. Short SHAs and moving tags
  such as `latest` are not used, because a rollback has to name an exact, immutable image.
- A release is promoted by merging the staging branch into the main branch; nobody builds
  images by hand on the server.

## First deployment

1. Create the application directory under `/opt/<application>`, owned by the deploying user,
   and clone the repository at the main branch.
2. Log the container engine in to the registry with a token that can only read packages.
3. Create the external Docker network that the reverse proxy and the application share, and
   attach the reverse proxy container to it once. Declare that network as external in the
   proxy's own compose file so the attachment survives a restart.
4. Copy the example production configuration, set its mode to `0600`, and generate a separate
   random value (`openssl rand -hex 32`) for every secret: database password, application
   secret, HMAC keys. A hex value needs no URL encoding inside a database connection string.
5. Use production keys for third-party services such as bot protection; test keys accept
   every request.
6. Run the deployment script with the release SHA. It pulls the images, starts the database,
   stops application traffic, runs migrations, starts the services, waits for their
   healthchecks and runs smoke tests against the public origin.
7. Add one proxy host for the domain pointing at the application's internal web server
   container and port, with WebSocket support, exploit blocking, a Let's Encrypt certificate
   and forced HTTPS. Path routing (for example `/admin` to the CMS) belongs to the internal
   web server, not to extra proxy hosts.

## Acceptance after the first deployment

Open the public health endpoints, create the first administrator, enter the initial content,
send a test message through every public form and confirm it is stored and delivered, check
protected downloads, test on a phone, and confirm that the admin panel requires
authentication. Then take the first database dump.

## Every later release

Pull the main branch with `--ff-only`, take a database dump, and run the deployment script
with the new full SHA. A release is never deployed without a fresh dump.

## Rollback and diagnostics

The rollback script switches the application images to an earlier SHA. It does not reverse
database migrations, so an earlier release may only be started when its schema is compatible
with the current database. For diagnostics use `docker compose ps` and
`docker compose logs --tail=200 <service>` with the production env file, and rerun the smoke
test script against the public origin.
