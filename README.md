# Installing

Run

    npm install

which will also install Bower dependencies with `postinstall` hook.

# Building

Currently no build is involved, `connect-assets` is used instead.

# Running locally

Run

    MONGOLAB_URI=<Your Mongo DB URI> node server/app.js

# Environment Variables

Of the environment variables listed below, the only one required for most of the functionality is `MONGOLAB_URI` (this can be the URI of either a local Mongo DB, or one hosted remotely on a service like Mongolab/MongoDB). `PHANTOMJSCLOUD_KEY` and `PRERENDER_HOST` are needed for serving static versions of pages to crawlers visiting `_escaped_fragment_` URIs. `SENDGRID_USER` and `SENDGRID_PASSWORD` are needed to send password reset emails. `SESSION_SECRET` will default to `test`.

    MONGOLAB_URI=<Mongo DB URI>
    PHANTOMJSCLOUD_KEY=<phantomjscloud.com key>
    PRERENDER_HOST=<host that does not redirect http to https, to be used by
        phantomjscloud.com>
    NODE_ENV=<"development" or "production">
    SESSION_SECRET=<session secret>
    SENDGRID_USER=<sendgrid.com user>
    SENDGRID_PASSWORD=<sendgrid.com password>

# License

MIT
