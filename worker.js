if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var express = require('express')
var zoom    = require('node-zoom')
var op      = require('object-path')
var yaml    = require('js-yaml')



// global variables (and list of all used environment variables)
APP_VERSION = require('./package').version
APP_STARTED = new Date().toISOString()
APP_PORT    = process.env.PORT || 3000



function simpleJson(marc) {
    var tags = {
        leader: op.get(marc, 'leader')
    }
    for(k1 in op.get(marc, 'fields', [])) {
        for(k2 in op.get(marc, ['fields', k1], [])) { //tags
            if(op.get(marc, ['fields', k1, k2, 'ind1'], '').trim()) op.set(tags, [parseInt(k2), 'ind1'], op.get(marc, ['fields', k1, k2, 'ind1']))
            if(op.get(marc, ['fields', k1, k2, 'ind2'], '').trim()) op.set(tags, [parseInt(k2), 'ind2'], op.get(marc, ['fields', k1, k2, 'ind2']))

            var values = {}
            for(k3 in op.get(marc, ['fields', k1, k2, 'subfields'], [])) { //subfields
                for(k4 in op.get(marc, ['fields', k1, k2, 'subfields', k3], [])) { //values
                    op.push(values, k4, op.get(marc, ['fields', k1, k2, 'subfields', k3, k4]))
                }
            }

            op.push(tags, [parseInt(k2), 'fields'], values)
        }
    }
    return tags
}



function concatedJson(marc) {
    var tags = {
        leader: op.get(marc, 'leader')
    }
    for(k1 in op.get(marc, 'fields', [])) {
        for(k2 in op.get(marc, ['fields', k1], [])) { //tags
            if(op.get(marc, ['fields', k1, k2, 'ind1'], '').trim()) op.set(tags, [parseInt(k2), 'ind1'], op.get(marc, ['fields', k1, k2, 'ind1']))
            if(op.get(marc, ['fields', k1, k2, 'ind2'], '').trim()) op.set(tags, [parseInt(k2), 'ind2'], op.get(marc, ['fields', k1, k2, 'ind2']))

            var value = ''
            for(k3 in op.get(marc, ['fields', k1, k2, 'subfields'], [])) { //subfields
                for(k4 in op.get(marc, ['fields', k1, k2, 'subfields', k3], [])) { //values
                    if(['v', 'x', 'y', 'z'].indexOf(k4) > 0) {
                        value += ' -- ' + op.get(marc, ['fields', k1, k2, 'subfields', k3, k4])
                    } else {
                        value += ' ' + op.get(marc, ['fields', k1, k2, 'subfields', k3, k4])
                    }
                }
            }

            op.push(tags, [parseInt(k2), 'values'], value)
        }
    }
    return tags
}



function humanJson(marc) {
    var mapping = { // http://www.loc.gov/marc/bibliographic
         20: {a: 'isbn'},
         22: {a: 'issn'},
         41: {a: 'language',
              h: 'original-language'},
         72: {a: 'udc'},
         80: {a: 'udc'},
        100: {a: 'author'},
        245: {a: 'title',
              b: 'subtitle',
              p: 'subtitle',
              n: 'number'},
        250: {a: 'edition'},
        260: {a: 'publishing-place',
              b: 'publisher',
              c: 'publishing-date'},
        300: {a: 'pages',
              c: 'dimensions'},
        440: {a: 'series',
              p: 'series',
              n: 'series-number',
              v: 'series-number'},
        500: {a: 'notes'},
        501: {a: 'notes'},
        502: {a: 'notes'},
        504: {a: 'notes'},
        505: {a: 'notes'},
        520: {a: 'notes'},
        525: {a: 'notes'},
        530: {a: 'notes'},
        650: {a: 'tag'},
        655: {a: 'tag'},
        710: {a: 'publisher'},
        907: {a: 'ester-id'},
    }
    var authormapping = {
        'fotograaf':       'photographer',
        'helilooja':       'composer',
        'illustreerija':   'illustrator',
        'järelsõna autor': 'epilogue-author',
        'koostaja':        'compiler',
        'kujundaja':       'designer',
        'osatäitja':       'actor',
        'produtsent':      'producer',
        'režissöör':       'director',
        'stsenarist':      'screenwriter',
        'toimetaja':       'editor',
        'tolkija':         'translator',
        'tõlkija':         'translator',
    }

    marc = simpleJson(marc)

    var tags = {}
    for(k1 in mapping) { //tags
        if(!op.has(marc, k1)) continue
        for(k2 in op.get(marc, [k1, 'fields'], [])) { //subfields
            for(k3 in op.get(mapping, k1, {})) {
                if(op.has(marc, [k1, 'fields', k2, k3])) {
                    for(k4 in op.get(marc, [k1, 'fields', k2, k3], [])) {
                        op.push(tags, op.get(mapping, [k1, k3]), op.get(marc, [k1, 'fields', k2, k3, k4]))
                    }
                }
            }
        }
    }
    for(a1 in op.get(marc, [700, 'fields'], [])) { //authors
        for(a2 in op.get(marc, [700, 'fields', a1, 'a'], [])) {
            op.push(tags, op.get(authormapping, op.get(marc, [700, 'fields', a1, 'e'])), op.get(marc, [700, 'fields', a1, 'a', a2]))
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

                        if(req.params.type === 'human') {
                            results.push(humanJson(r.json))
                        } else if(req.params.type === 'simple') {
                            results.push(simpleJson(r.json))
                        } else if(req.params.type === 'concated') {
                            results.push(concatedJson(r.json))
                        } else if(req.params.type === 'json') {
                            results.push(r.json)
                        } else if(req.params.type === 'raw') {
                            results.push(r.raw)
                        } else {
                            return res.redirect('/simple?q=' + req.query.q)
                        }
                    }
                    var result = {
                        result: results,
                        count: results.length,
                        version: APP_VERSION,
                        started: APP_STARTED
                    }

                    if(req.query.format === 'yaml') {
                        res.set('Content-Type', 'text/x-yaml; charset=utf-8')
                        res.send(yaml.safeDump(result, {sortKeys: true, indent: 4}))
                    } else {
                        res.send(result)
                    }
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
