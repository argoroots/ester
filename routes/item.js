var express = require('express')
var router  = express.Router()
var path    = require('path')
var fs      = require('fs')



// get item by id router
router.get('/:id', function(req, res, next) {
    var format = req.query.f
    if(['human', 'simple', 'concat', 'json', 'marc'].indexOf(format) === -1) format = 'human'

    var id = req.params.id
    if(!id) return next(new Error('No ID'))

    var filename = path.join(APP_TMPDIR, id + '.json')
    if(!id.match('[a-fA-F0-9]{32}') || !fs.existsSync(filename)) return next(new Error('Invalid ID'))

    var full_result = require(filename)

    if(format === 'marc') {
        res.set('Content-Type', 'text/plain; charset=utf-8')
        res.send(full_result.marc)
    } else {
        res.send({
            result: full_result[format],
            version: APP_VERSION,
            started: APP_STARTED
        })
    }
})
