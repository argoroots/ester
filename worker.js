if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var express = require('express')
var cors    = require('cors')
var path    = require('path')
var fs      = require('fs')
var raven   = require('raven')



// global variables (and list of all used environment variables)
APP_VERSION = require('./package').version
APP_STARTED = new Date().toISOString()
APP_PORT    = process.env.PORT || 3000
APP_TMPDIR  = process.env.TMPDIR || path.join(__dirname, 'tmp')
APP_SENTRY  = process.env.SENTRY_DSN



fs.existsSync(APP_TMPDIR) || fs.mkdirSync(APP_TMPDIR)



express()
    // set CORS
    .use(cors())

    // logs to getsentry.com
    .use(raven.middleware.express(APP_SENTRY))

    // routes mapping
    .use('/search', require('./routes/search'))
    .use('/item', require('./routes/item'))

    // show error
    .use(function(err, req, res, next) {
        var status = parseInt(err.status) || 500

        res.status(status)
        res.send({
            error: err.message,
            version: APP_VERSION,
            started: APP_STARTED
        })

        if(err.status !== 404) console.log(err)
    })

    // start server
    .listen(APP_PORT)



console.log(new Date().toString() + ' started listening port ' + APP_PORT)
