if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var express = require('express')
var zoom    = require('node-zoom')



// global variables (and list of all used environment variables)
APP_VERSION = require('./package').version
APP_STARTED = new Date().toISOString()
APP_PORT    = process.env.PORT || 3000



function setValue(array, value) {
    if(!array) array = []
    if(array.indexOf(value) < 0) {
        array.push(value)
    }
    return array
}



function simpleJson(marc_json) {
    var tags = {leader: marc_json.leader}
    for(k1 in marc_json.fields) {
        for(k2 in marc_json.fields[k1]) { //tags
            if(!tags[k2]) tags[k2] = {fields: []}
            if(marc_json.fields[k1][k2].ind1 !== ' ') tags[k2].ind1 = marc_json.fields[k1][k2].ind1
            if(marc_json.fields[k1][k2].ind2 !== ' ') tags[k2].ind2 = marc_json.fields[k1][k2].ind2

            var values = {}
            for(k3 in marc_json.fields[k1][k2].subfields) { //subfields
                for(k4 in marc_json.fields[k1][k2].subfields[k3]) { //values
                    values[k4] = setValue(values[k4], marc_json.fields[k1][k2].subfields[k3][k4])
                }
            }

            tags[k2].fields.push(values)
        }
    }
    return tags
}



express()
    // routes mapping
    .use('/:type', function(req, res, next) {
        var query = req.query.q
        var results = []

        if(!query) return next(new Error('No query parameter (q)!'))

        zoom.connection('193.40.4.242:212/INNOPAC')
            .set('preferredRecordSyntax', 'usmarc')
            .query('@or @attr 1=4 "' + query + '" @or @attr 1=7 "' + query + '" @attr 1=12 "' + query + '"')
            .search(function(err, resultset) {
                if(err) return next(err)
                resultset.getRecords(0, resultset.size, function(err, records) {
                    if(err) return next(err)

                    while (records.hasNext()) {
                        var r = records.next()

                        if(!r) continue
                        if(!r._record) continue

                        if(req.params.type === 'simple') {
                            results.push(simpleJson(r.json))
                        } else if(req.params.type === 'json') {
                            results.push(r.json)
                        } else if(req.params.type === 'raw') {
                            results.push(r.raw)
                        } else {
                            return res.redirect('/simple?q=' + req.query.q)
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
