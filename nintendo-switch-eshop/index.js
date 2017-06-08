const request = require("request");
const xml2js = require("xml2js");
const unique = require("array-unique-x");
const countries = require("country-data").countries;
const regions = require("country-data").regions;
const Q = require("q");

const GET_GAMES_US_URL = "http://www.nintendo.com/json/content/get/filter/game?system=switch&sort=title&direction=asc&shop=ncom";
const GET_GAMES_EU_URL = "http://search.nintendo-europe.com/en/select";
const GET_GAMES_JP_URL = "http://search1.nintendo.co.jp/search/softwareXml.php?hard%5B15%5D=switch_all&hard%5B16%5D=switch&hard%5B17%5D=switch_dl&release_mode=&SearchWindow=1&mode=mf&";
const GET_PRICE_URL = "https://api.ec.nintendo.com/v1/price?lang=en";

const GAME_LIST_LIMIT = 200;
const PRICE_LIST_LIMIT = 50;

const GAME_CODE_REGEX_JP = /\/HAC(\w{4})/;
const GAME_CODE_REGEX_US = /HAC\w(\w{4})/;
const GAME_CODE_REGEX_EU = /HAC\w(\w{4})/;

const NSUID_REGEX_JP = /\d{14}/;

const GAME_CHECK_CODE_US = "70010000000185";
const GAME_CHECK_CODE_EU = "70010000000184";
const GAME_CHECK_CODE_JP = "70010000000039";

/**
 * Region code constant.
 * @readonly
 * @enum {number}
 */
const Region = {
    AMERICAS: 1,
    EUROPE: 2,
    ASIA: 3
};

/**
 * Fetches all games on american eshops. Paginates every 200 games.
 * @returns {Promise<Object[]>} Promise containing all the games.
 */
function getGamesAmerica(offset, games) {
    offset = offset || 0;
    games = games || [];

    return new Promise((resolve, reject) => {
        request.get({
            url: GET_GAMES_US_URL,
            qs: {
                limit: GAME_LIST_LIMIT,
                offset: offset,
            }
        }, (err, res, body) => {
            if (err) return reject(err);
            
            let filteredResponse = JSON.parse(body);

            // Sometimes the last page of the request returns all items (thus giving duplicates)
            let accumulatedGames = unique(games.concat(filteredResponse.games.game), "slug");

            if (filteredResponse.games.game.length + offset < filteredResponse.filter.total) {
                getGamesAmerica(offset + GAME_LIST_LIMIT, accumulatedGames).then(resolve).catch(reject);
            } else {
                return resolve(accumulatedGames);
            }
        });
    });
}

/**
 * Fetches all games on japanese eshop. Paginates every 16 games.
 * @returns {Promise<Object[]>} Promise containing all the games.
 */
function getGamesJapan(page, games) {
    page = page || 1;
    games = games || [];

    return new Promise((resolve, reject) => {
        request.get({
            url: GET_GAMES_JP_URL,
            qs: {
                page: page,
                "_": new Date().getTime(),
            }
        }, (err, res, body) => {
            if (err) return reject(err);

            xml2js.parseString(body, function (err, result) {
                let response = result;
                let totalGameCount = response.Software.TotalCount[0];
                let accumulatedGames = games.concat(response.Software.TotalInfolist[0].TitleInfo);

                if(accumulatedGames.length < totalGameCount) {
                    getGamesJapan(page + 1, accumulatedGames).then(resolve).catch(reject);
                } else {
                    return resolve(accumulatedGames);
                }
            });
        });
    });
}

/**
 * Fetches all games on european eshop. Paginates every 9999 games.
 * @returns {Promise<Object[]>} Promise containing all the games.
 */
function getGamesEurope() {
    return new Promise((resolve, reject) => {
        request.get({
            url: GET_GAMES_EU_URL,
            qs: {
                fl: "product_code_txt,title,date_from,nsuid_txt,image_url_sq_s",
                fq: "type:GAME AND (system_type:\"nintendoswitch_gamecard\" OR system_type:\"nintendoswitch_downloadsoftware\" OR system_type:\"nintendoswitch_digitaldistribution\") AND product_code_txt:*",
                q: "*",
                rows: "9999",
                sort: "sorting_title asc",
                start: "0",
                wt: "json"
            }
        }, (err, res, body) => {
            if(err) return reject(err);
            let responseWrapper = JSON.parse(body);
            resolve(responseWrapper.response.docs);
        });
    });
}

/**
 * Gets all active eshops given a list of countries.
 * @param {string[]} countryCodes A list of 2 digit country codes for every country eshop to lookup. (ISO 3166-1 alpha-2 country codes)
 * @param {string} gamecode A 14 digits game code from the desired region.
 * @param {any} region A region id that will be appendend in the final shop object for filtering purposes.
 * @returns {Promise<Object[]>} A list of shop objects with country code, name and default currency.
 */
function getShopsByCountryCodes(countryCodes, gamecode, region) {
    let countryList = countryCodes.map(code => countries[code]);

    return new Promise((resolve, reject) => {
        let promises = [];

        countryList.forEach(country => {
            promises.push(getPrices(country.alpha2, gamecode).then(response => {
                response.country = country;
                return response;
            }));
        });

        Q.allSettled(promises).then(values => {
            let validShops = values.map(promise => promise.value).filter(value => value && !value.error);
            let activeShops = validShops.filter(shop => shop.prices && shop.prices.length && shop.prices[0].regular_price);
            let formatted = activeShops.map(shop => {
                return {
                    code: shop.country.alpha2,
                    country: shop.country.name,
                    currency: shop.prices[0].regular_price.currency,
                    region: region
                };
            });
            resolve(formatted);
        }).catch(reject);
    });
}

/**
 * Gets all active eshops on american countries.
 * This method will launch several requests at nintendo web services, so don't abuse it. 
 * @returns {Promise<Object[]>} A list of shop objects with country code, name and default currency.
 */
function getShopsAmerica() {
    return getShopsByCountryCodes(regions.southAmerica.countries
        .concat(regions.centralAmerica.countries)
        .concat(regions.northernAmerica.countries),
        GAME_CHECK_CODE_US, Region.AMERICAS);
}

/**
 * Gets all active eshops on european countries.
 * Please note that South Africa and Oceania countries are included.
 * This method will launch several requests at nintendo web services, so don't abuse it.
 * @returns {Promise<Object[]>} A list of shop objects with country code, name and default currency.
 */
function getShopsEurope() {
    return getShopsByCountryCodes(regions.northernEurope.countries 
        .concat(regions.southernEurope.countries)
        .concat(regions.easternEurope.countries)
        .concat(regions.westernEurope.countries)
        .concat(regions.australia.countries) // ¯\_(ツ)_/¯ They use EU nsuids
        .concat(regions.southernAfrica.countries), // ¯\_(ツ)_/¯ Nintendo lists them at EU 
        GAME_CHECK_CODE_EU, Region.EUROPE); 
}

/**
 * Gets all active eshops on asian countries.
 * This method will launch several requests at nintendo web services, so don't abuse it.
 * @returns {Promise<Object[]>} A list of shop objects with country code, name and default currency.
 */
function getShopsAsia() {
    return getShopsByCountryCodes(regions.centralAsia.countries 
        .concat(regions.southernAsia.countries)
        .concat(regions.southeastAsia.countries)
        .concat(regions.eastAsia.countries)
        .concat(regions.westernAsia.countries),
        GAME_CHECK_CODE_JP, Region.ASIA);
}

/**
 * Gets all active eshops.
 * This method will launch several requests at nintendo web services, so don't abuse it.
 * @returns {Promise<Object[]>} A list of shop objects with country code, name and default currency.
 */
function getActiveShops() {
    return Q.all([getShopsAmerica(), getShopsAsia(), getShopsEurope()]).spread((america, asia, eu) => america.concat(asia).concat(eu));
}

/**
 * Get pricing information for the requested games. Paginates every 50 games.
 * @param {string} country A two digit country code. (ISO 3166-1 alpha-2 country code)
 * @param {string[] | string} gameIds One or more NSUID of the corresponding games.
 * @return {Promise<any>} A promise containing the pricing information.
 */
function getPrices(country, gameIds, offset, prices) {
    offset = offset || 0;
    prices = prices || [];
    let filteredIds = gameIds.slice(offset, offset + PRICE_LIST_LIMIT);
    return new Promise((resolve, reject) => {
        request.get({
            url: GET_PRICE_URL,
            qs: {
                country: country,
                limit: PRICE_LIST_LIMIT,
                ids: filteredIds
            }
        }, (err, res, body) => {
            if (err) return reject(err);
            try {
                let response = JSON.parse(body);

                if(response.prices && response.prices.length + offset < gameIds.length) {
                    let accumulatedPrices = prices.concat(response.prices);
                    getPrices(country, gameIds, offset + PRICE_LIST_LIMIT, accumulatedPrices).then(resolve).catch(reject);
                } else if(response.prices){
                    response.prices = response.prices.concat(prices);
                    resolve(response);
                } else {
                    resolve(response);
                }
                
            } catch(e) {
                // Sometimes we get an unexpected response
                reject(e);
            }
        });
    });
}

/**
 * Parses the game code to extract the cross-region protion.
 * @param {Object} game The game object returned from one of the other methods.
 * @param {number} region Region code. (use the Region constant)
 * @returns {string} The 4-digit resulting game code.
 */
function parseGameCode(game, region) {
    let codeParse;

    switch (region) {
        case Region.EUROPE:
            codeParse = GAME_CODE_REGEX_EU.exec(game.product_code_txt[0]);
            break;
        case Region.ASIA:
            codeParse = GAME_CODE_REGEX_JP.exec(game.Imgpath[0]);
            break;
        default:
        case Region.AMERICAS:
            codeParse = GAME_CODE_REGEX_US.exec(game.game_code);
            break;
    }

    return (codeParse && codeParse.length > 1) ? codeParse[1] : null;
}

/**
 * Extracts NSUID information from the game object.
 * @param {Object} game The game object returned from one of the other methods.
 * @param {number} region Region code. (use the Region constant)
 * @returns {string} The 14-digit NSUID.
 */
function parseNSUID(game, region) {
    let nsuidParse;
    switch (region) {
        case Region.EUROPE:
            return game.nsuid_txt ? game.nsuid_txt[0] : null;
        case Region.ASIA:
            nsuidParse = NSUID_REGEX_JP.exec(game.LinkUrl[0]);
            return (nsuidParse && nsuidParse.length > 0) ? nsuidParse[0] : null;
        default:
        case Region.AMERICAS:
            return game.nsuid;
    }
}

module.exports = {
    Region: Region,
    parseGameCode: parseGameCode,
    parseNSUID: parseNSUID,
    getGamesAmerica: getGamesAmerica,
    getGamesEurope: getGamesEurope,
    getGamesJapan: getGamesJapan,
    getPrices: getPrices,
    getShopsByCountryCodes: getShopsByCountryCodes,
    getShopsAmerica: getShopsAmerica,
    getShopsEurope: getShopsEurope,
    getShopsAsia: getShopsAsia,
    getActiveShops: getActiveShops
};