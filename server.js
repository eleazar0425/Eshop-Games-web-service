
var express = require('express')
var app = express()
var cron = require('cron')
var firebaseNotification = require('./FirebaseNotification')
var repository = require('./EshopGamesRepository')

var port = process.env.PORT  || 1337

app.get('/gamesAmerica', async function(req, res){
    repository.getGamesAmerica().then(function(results){
        res.send(results)
    }).catch(function(error){
        res.send(error)
    })
})

app.get('/gamesEurope', function(req, res){
    SwitchEshop.getGamesEurope({locale: 'en', limit: 100}).then(function(result, error){
        res.send(result)
    })
})

app.get('/gamesJapan', function(req, res){
    SwitchEshop.getGamesJapan().then(function(result,error){
        res.send(result)
    })
})

app.listen(port)

console.log('Server running at port:'+port);
var cron = require('cron');
var cronJob = cron.job('* */12 * * * *', function(){
    repository.getGamesAmerica().then(function(results){
        results.forEach(game => {
            if(game.hasOwnProperty('sale_price')){
                firebaseNotification.sendDiscountNotification(game, function(error, response, body){
                    console.log(response)
                })
            }
        })
    }).catch(function(error){
        console.log(error)
    })
    console.info('cron job completed');
}); 
cronJob.start();