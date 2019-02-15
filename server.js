const SwitchEshop = require("nintendo-switch-eshop")
var express = require('express')
var app = express()

var port = process.env.PORT  || 1337

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

app.get('/gamesAmerica', async function(req, res){

    try {
        var stillFetchingData = true
        var results = []
        var counter = 0

        while(stillFetchingData) {
            const data = await SwitchEshop.getGamesAmerica({shop: "all", limit: 200}, counter*200)
            console.log("data received: "+data.length)
            counter++
            if (isEmpty(data)) {
                stillFetchingData = false
            }else {
                results = results.concat(data)
            }
        }
        res.send(results)
    }catch (e) {
        throw(e)
    }
})

app.listen(port)

console.log('Server running at port:'+port);