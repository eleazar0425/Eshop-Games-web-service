const SwitchEshop = require("./nintendo-switch-eshop")
var express = require('express')
var app = express()

var port = process.env.PORT  || 1337



app.get('/gamesAmerica', function(req, res){
    SwitchEshop.getGamesAmerica(req.query.offset || 0, null).then(function(result, error){
        res.json(result)
    })
})

app.listen(port)

console.log('Server running at port:'+port);