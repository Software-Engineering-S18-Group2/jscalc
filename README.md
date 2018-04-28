# JSCalc

<p>This repository is forked from https://github.com/askinakhan/jscalc.

JSCalc.io is a free and open-source web service that reduces the task of creating an embeddable, mobile-frindly calculator to writing a single Javascript function.</p>

<h2> Youtube Demo </h2>
To know how to use, please watch the <a href="https://www.youtube.com/watch?v=rZ4JfD-YdZY&list=RDrZ4JfD-YdZY">demo</a>.

## Installing

To run this on local machine you need following :

1) node.JS

2) MongoDB


### Install node.js

1) Download Node.js from <a href = "https://nodejs.org/en/download/">here</a>
2) Run the installler (.msi) file
3) Follow the prompts in the installer 
4) Restart your computer.

<b>Testing Node installation</b>

Test Node : 
1) Open the Windows Command Prompt or command line tool or terminal
2) type <i> node -v </i>
3) This should print a version number. So you will see version number.

Test npm : 
To check if npm is installed 
1) Open Command prompt or command line tool or terminal
2) type <i> npm -v </i>
3) This should print version number of npm installed on your computer.

### Install MongoDB

1) Download Mongo DB from <a href="https://www.mongodb.com/download-center?_ga=2.33066110.1905691052.1524679894-1233068672.1520485505#production">download center</a>.
2) For setup MongoDB environment please follow the <a href="https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/">instructions</a> as specified based on your operating system.

Verify MongoDB:
3) Once you start MongoDB from command prompt, you should see message like "[initandlisten] waiting for connections on port 27017"

<h2> Running your jscalc</h2> 

## Clone the repository 

1) clone this project $ git clone https://github.com/Software-Engineering-S18-Group2/jscalc.git
2) cd jscalc

### Run

    npm install

which will also install Bower dependencies with `postinstall` hook.

### Building

Currently no build is involved, `connect-assets` is used instead.

### Running locally

Run

    MONGOLAB_URI=<Your Mongo DB URI> node server/app.js

Open your favourite browser and open : http://localhost:3000/ 
    

### Environment Variables

Of the environment variables listed below, the only one required for most of the functionality is `MONGOLAB_URI` (this can be the URI of either a local Mongo DB, or one hosted remotely on a service like Mongolab/MongoDB). `PHANTOMJSCLOUD_KEY` and `PRERENDER_HOST` are needed for serving static versions of pages to crawlers visiting `_escaped_fragment_` URIs (currently disabled, so these two variables aren't used). `SENDGRID_USER` and `SENDGRID_PASSWORD` are needed to send password reset emails. `SESSION_SECRET` will default to `test`.

    MONGOLAB_URI=<Mongo DB URI>
    PHANTOMJSCLOUD_KEY=<currently not used, phantomjscloud.com key>
    PRERENDER_HOST=<currently not used, host that does not redirect http to
        https, to be used by phantomjscloud.com>
    NODE_ENV=<"development" or "production">
    SESSION_SECRET=<session secret>
    SENDGRID_USER=<sendgrid.com user>
    SENDGRID_PASSWORD=<sendgrid.com password>
 
<h2>Contributing</h2>
If anyone wants to improve on this, please submit a pull request w/ your changes.

<h2> Forking </h2>
Forking for unique communities is quite welcome and encouraged, but please alter the colors or appearance at least a little bit so all forks don't look exactly the same. Feel free to submit a pull request on this file to add your fork to the list below once it is live.
    

## License

MIT
