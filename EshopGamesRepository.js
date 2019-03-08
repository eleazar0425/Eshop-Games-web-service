const SwitchEshop = require("nintendo-switch-eshop")

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

function getGamesAmerica(){
    var promise = new Promise(async function(resolve, reject){
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
            resolve(results)
        }catch (e) {
            reject(e)
        }
    })

    return promise
}

module.exports.getGamesAmerica = getGamesAmerica