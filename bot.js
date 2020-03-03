import Twitter from 'twitter';
import minimist from 'minimist';
import urllib from 'urllib';
import $ from 'cheerio';
import {format, compareAsc} from 'date-fns';
import {data} from './data.js';

// Retrieve args
const args = minimist(process.argv.slice(2));
let dataItems = [];

// create an object using the keys we just determined
const twitterAPI = new Twitter({
    consumer_key: process.env.CONSUMER_TOKEN || args.consumer_key,
    consumer_secret: process.env.CONSUMER_SECRET || args.consumer_secret,
    access_token_key: process.env.ACCESS_TOKEN_KEY || args.access_token_key,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET || args.access_token_secret,
});

function init() {
    console.log(
        `\x1b[96m`, (`[` + new Date().toLocaleString() + `]`).padStart(10),
        `Started`);

    const cities = [];

    data.CITIES.map((city) => {
        queryWidget(data.URL.replace(/%ID%/g, city.id)).then(response => {
            cities.push(
                Object.assign({}, city, {
                    pollens: response,
                }),
            );
            if (cities.length >= data.CITIES.length) {
                createTweetText(
                    cities.sort((a, b) => {
                        if (a.pollens.length !== b.pollens.length) { return b.pollens.length - a.pollens.length; } else { return b.label < a.label; }
                    }).map((city) => [city.label, city.pollens.filter((pollen) => pollen !== "Graminée").map((pollen) => `${data.POLLENS[pollen]}${pollen}`).join(', ')]));
            }
        });
    });
}

init();

function createTweetText(entries) {
    let res = `Info pollens du ${format(new Date(), 'dd/MM/yy')} :\n`;
    entries.map((entry) => {res += `${entry[0]} : ${entry[1]}\n`;});
    // eslint-disable-next-line
    console.info('res:', res);
    return res;
}

function tweet(options) {
    options.status = options.status.substring(0, 280);
    console.info(
        `\x1b[96m`, (`[` + new Date().toLocaleTimeString() + `]`).padStart(10),
        options.status);
    if (!args.test) { // TWEET
        return new Promise((resolve, reject) => {
            twitterAPI.post('statuses/update', options,
                (error, tweet) => {
                    if (error) {
                        console.error(
                            `\x1b[96m`, (`[` + new Date().toLocaleTimeString() + `]`).padStart(10),
                            'Error: ', error);
                        reject(error);
                    }
                    resolve(tweet);
                },
            );
        });
    }
}

function mergeArrays(arr1, arr2) {
    let res = [];
    for (let i = 0; i < arr1.length; i++) {
        let found = false;
        const a = arr1[i];
        for (let j = 0; j < arr2.length; j++) {
            const b = arr2[j];
            if (a.slug === b.slug) {
                found = true;
                res.push({
                    slug: a.slug,
                    pictoTemps: a.pictoTemps,
                    temperature: Math.max(a.temperature, b.temperature),
                    temperatureMer: Math.max(a.temperatureMer, b.temperatureMer),
                    pictoVent: a.pictoVent,
                    forceVent: Math.max(a.forceVent, b.forceVent),
                });
            }
        }
        if (!found) {
            res.push(a);
        }
    }
    for (let i = 0; i < arr2.length; i++) {
        let found = false;
        let a = arr2[i];
        for (let j = 0; j < arr1.length; j++) {
            let b = arr1[j];
            if (b.slug === a.slug) {
                found = true;
            }
        }
        if (!found) {
            res.push(arr2[i]);
        }
    }
    return res;
}

function queryWidget(url) {
    return new Promise((resolve, reject) => {
        urllib.request(url, {timeout: 10000}, (error, data, response) => {
            if (error) {
                console.error(
                    `\x1b[96m`, (`[` + new Date().toLocaleTimeString() + `]`).padStart(10),
                    'Error: ', error);
                reject(error);
            } else if (response.statusCode === 200) {
                resolve(
                    $(data.toString()).find('.level2:has(img[src*="state-1"]), .level3:has(img[src*="state-1"])').text().split(/\s/gmi).filter(Boolean),
                );
            }
        });
    });
}

function textToWeather(type) {
    let index = 0, previousSpace = false;

    const weather = index => dataItems.filter(a => a.slug === data.DATACITIES[index])[0];

    return data.MAP.split('').map(char => {
        switch (char) {
            case '#':
            case 'w':
                let point = '',
                    wcity = weather(index)[type];
                switch (type) {
                    case 'temperature' :
                        if (previousSpace) {
                            previousSpace = !previousSpace;
                        } else {
                            point += '\u2003';
                        }
                        point += ('' + wcity).replace(/\w/g, a => data.SMALL_LETTERS[a]);
                        break;

                    case 'temperatureMer' :
                        if (previousSpace) {
                            previousSpace = !previousSpace;
                        }
                        if (wcity > -1) {
                            point += ('' + wcity).replace(/\w/g, a => data.SMALL_LETTERS[a]) +
                                data.WEATHER.filter(a => (weather(index)['pictoTemps']).match(a.codes))[0].emojis[0];
                        } else {
                            point = char === 'w' ? '🌊' : '🏖';
                        }
                        break;
                    case 'pictoVent' :
                        const wforce = ('' + weather(index)['forceVent']).replace(/[\s<]/g, '').padStart(2, '0');
                        const emoji = data.WINDS.filter(a => a.codes.includes(wcity))[0].emojis;
                        point = emoji[Math.min(emoji.length - 1, Math.max(0, Math.floor(wforce[0]) - 1))];
                        break;
                    case 'pictoTemps' :
                    default:
                        const res = data.WEATHER.filter(a => wcity.match(a.codes))[0];
                        if (!res) {
                            console.info(
                                `\x1b[96m`, (`[` + new Date().toLocaleTimeString() + `]`).padStart(10),
                                'wcity : ', wcity);
                        }
                        point = res && res.emojis[0];
                        break;
                }
                index++;
                return point;
            case '_':
                previousSpace = true;
                return '\u2003';
            case '-':
                previousSpace = true;
                return '\u2002';
            default:
                previousSpace = true;
                return char;
        }
    }).join('');
}



















