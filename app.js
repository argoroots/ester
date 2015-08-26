if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var express = require('express')
var zoom    = require('node-zoom')



// global variables (and list of all used environment variables)
APP_VERSION = require('./package').version
APP_STARTED = new Date().toISOString()
APP_PORT    = process.env.PORT || 3000



express()
    // routes mapping
    .use('/', function(req, res, next) {
        var query = req.query.q
        var results = []

        zoom.connection('193.40.4.242:212/INNOPAC')
            .set('preferredRecordSyntax', 'usmarc')
            .query('@or @attr 1=4 "' + query + '" @or @attr 1=7 "' + query + '" @attr 1=12 "' + query + '"')
            .search(function(err, resultset) {
                if(err) {
                    next(err)
                    return
                }
                resultset.getRecords(0, resultset.size, function(err, records) {
                    if(err) {
                        next(err)
                        return
                    }
                    while (records.hasNext()) {
                        var r = records.next()
                        if(!r || !r._record) {
                            resultset.size = 0
                            continue
                        }
                        results.push(r.json)
                    }
                    res.send({
                        result: results,
                        count: resultset.size,
                        version: APP_VERSION,
                        started: APP_STARTED
                    })
                })
            })
    })

    // error
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



console.log('Started at port ' + APP_PORT)
