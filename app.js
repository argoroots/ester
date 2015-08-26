if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var express = require('express')
var path    = require('path')
var fs      = require('fs')
var logger  = require('morgan')
var rotator = require('file-stream-rotator')
var zoom    = require('node-zoom')
var debug   = require('debug')('app:' + path.basename(__filename).replace('.js', ''))



// global variables (and list of all used environment variables)
APP_VERSION   = require('./package').version
APP_STARTED   = new Date().toISOString()
APP_DEBUG     = process.env.DEBUG
APP_PORT      = process.env.PORT || 3000
APP_LOG_DIR   = process.env.LOGDIR || __dirname + '/log'



// ensure log directory exists
fs.existsSync(APP_LOG_DIR) || fs.mkdirSync(APP_LOG_DIR)



// create a rotating write stream
var access_log_stream = rotator.getStream({
  filename: APP_LOG_DIR + '/access-%DATE%.log',
  frequency: 'daily',
  verbose: false,
  date_format: 'YYYY-MM-DD'
})



express()
    // logging
    .use(logger(':date[iso] | HTTP/:http-version | :method | :status | :url | :res[content-length] b | :response-time ms | :remote-addr | :referrer | :user-agent', {stream: access_log_stream}))

    // routes mapping
    .use('/', function(req, res, next) {
        var query = req.query.q
        var results = []
        var count = 0

        zoom.connection('193.40.4.242:212/INNOPAC')
            .set('preferredRecordSyntax', 'usmarc')
            .query('@or @attr 1=4 "' + query + '" @or @attr 1=7 "' + query + '" @attr 1=12 "' + query + '"')
            .search(function(err, resultset) {
                if err {
                    next(err)
                    return
                }
                count = resultset.size
                resultset.getRecords(0, resultset.size, function(err, records) {
                    if err {
                        next(err)
                        return
                    }
                    while (records.hasNext()) {
                        results.push(records.next().json)
                    }
                    res.send({
                        result: results,
                        count: count
                    })
                })
            })
    })

    // error
    .use(function(err, req, res, next) {
        var status = parseInt(err.status) || 500

        res.status(status)
        res.send({
            error: status,
            message: err.message
        })

        if(err.status !== 404) debug(err)
    })

    // start server
    .listen(APP_PORT)



debug('Started at port %s', APP_PORT)
