if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var express = require('express')
var cors    = require('cors')
var path    = require('path')
var fs      = require('fs')
var raven   = require('raven')



// global variables (and list of all used environment variables)
APP_VERSION = (process.env.VERSION || process.env.SOURCE_VERSION) || require('./package').version
APP_STARTED = new Date().toISOString()
APP_PORT    = process.env.PORT || 3000
APP_TMPDIR  = process.env.TMPDIR || path.join(__dirname, 'tmp')
APP_SENTRY  = process.env.SENTRY_DSN



fs.existsSync(APP_TMPDIR) || fs.mkdirSync(APP_TMPDIR)



// initialize getsentry.com client
raven.config(APP_SENTRY, {
    release: APP_VERSION,
    dataCallback: function(data) {
        delete data.request.env
        return data
    }
}).install()



// start express app
var app = express()

// get correct client IP behind nginx
app.set('trust proxy', true)

// set CORS
app.use(cors())

// logs to getsentry.com - start
app.use(raven.requestHandler())

// routes mapping
app.use('/', require('./routes/index'))
app.use('/search', require('./routes/search'))
app.use('/item', require('./routes/item'))

// logs to getsentry.com - error
app.use(raven.errorHandler())

// show error
app.use(function(err, req, res) {
    res.send({
        error: err.message,
        version: APP_VERSION,
        started: APP_STARTED
    })

    if(err.status !== 404) console.log(err)
})



// start server
app.listen(APP_PORT, function() {
    console.log(new Date().toString() + ' started listening port ' + APP_PORT)
})
