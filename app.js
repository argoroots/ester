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
                            var tags = {}
                            for(k1 in r.json.fields) {
                                for(k2 in r.json.fields[k1]) { //tags
                                    var values = {}
                                    if(r.json.fields[k1][k2].ind1 !== ' ') tags[k2].ind1 = r.json.fields[k1][k2].ind1
                                    if(r.json.fields[k1][k2].ind2 !== ' ') tags[k2].ind2 = r.json.fields[k1][k2].ind2
                                    for(k3 in r.json.fields[k1][k2].subfields) { //subfields
                                        for(k4 in r.json.fields[k1][k2].fields[k3]) { //values
                                            values[k4] = setValue(values[k4], r.json.fields[k1][k2].subfields[k3][k4])
                                        }
                                    }
                                    if(!tags[k2]) tags[k2] = {subfields: []}
                                    tags[k2].subfields.push(values)
                                }
                            }
                            results.push(tags)
                        } else if(req.params.type === 'raw') {
                            results.push(r.raw)
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
