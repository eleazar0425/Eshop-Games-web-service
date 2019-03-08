const FIREBASE_KEY = "AAAA3kb7hiY:APA91bFqPgoaCJ_fJlPt9GovnOHmokr9FzTpJubCrB1Lg4582eUM7ICtAU-mZWNk29MdiKxeFMZGv_JHa-0A1FLo6Zgb0DgljUElH1UZfYD5X1Xi8oZIcOTZzS2nQwKkMPq3JKenDZft"
var request = require('request')

function sendDiscountNotification(game,callBack) {
    var jsonBody = {
        to: "/topics/"+game.id,
        content_available: true,
        priority: "high",
        notification: {
            title: "Beep Boop!",
            body: game.title + " has a price discount to $"+game.sale_price
        }
    };
    request({
        url: "https://fcm.googleapis.com/fcm/send",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "key="+FIREBASE_KEY
        },
        json: true,   
        body: jsonBody
    }, function (error, response, body){
        callBack(error, response, body)
    });
}

module.exports.sendDiscountNotification  = sendDiscountNotification