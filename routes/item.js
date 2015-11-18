var fs     = require('fs')
var path   = require('path')
var router = require('express').Router()



// get item by id router
router.get('/:id', function(req, res, next) {
    var format = req.query.f
    if(['human', 'simple', 'concat', 'json', 'marc'].indexOf(format) === -1) format = 'human'

    var id = req.params.id
    if(!id) return next(new Error('No ID'))

    var filename = path.join(APP_TMPDIR, id + '.json')
    if(!id.match('[a-fA-F0-9]{32}') || !fs.existsSync(filename)) return next(new Error('Invalid ID'))

    var fullResult = require(filename)

    if(format === 'marc') {
        res.set('Content-Type', 'text/plain; charset=utf-8')
        res.send(fullResult.marc)
    } else {
        res.send({
            result: fullResult[format],
            version: APP_VERSION,
            started: APP_STARTED
        })
    }
})



module.exports = router
