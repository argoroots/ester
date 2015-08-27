if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var express = require('express')
var zoom    = require('node-zoom')



// global variables (and list of all used environment variables)
APP_VERSION = require('./package').version
APP_STARTED = new Date().toISOString()
APP_PORT    = process.env.PORT || 3000


function setValue(a, v) {
    if(!a) a = []
    if(a.indexOf(v) < 0) {
        a.push(v)
    }
    return a
}


express()
    // routes mapping
    .use('/:type', function(req, res, next) {
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
                        if(!r) continue
                        if(!r._record) continue
                        if(req.params.type === 'simple') {
                            fields = {}
                            for(k1 in r.json.fields) {
                                for(k2 in r.json.fields[k1]) {
                                    for(k3 in r.json.fields[k1][k2].subfields) {
                                        for(k4 in r.json.fields[k1][k2].subfields[k3])
                                            fields[k2][k4] = setValue(fields[k2], r.json.fields[k1][k2].subfields[k3][k4])
                                        }
                                    }
                                }
                            }
                            results.push(fields)
                        } else {
                            results.push(r.json)
                        }
                    }
                    res.send({
                        result: results,
                        count: results.length,
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
