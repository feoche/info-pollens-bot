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
            city.pollens = response;
        }).catch(() => {
            cities.push(
                Object.assign({}, city, {
                    pollens: city.pollens || [],
                }),
            );
        }).finally(() => {
            if (cities.length >= data.CITIES.length) {
                // eslint-disable-next-line
                console.info('cities:', cities);

                const groupBy = (list, props) => {
                    return list.reduce((a, b) => {
                        (a[b[props]] = a[b[props]] || []).push(b);
                        return a;
                    }, {});
                };

                createTweetText(
                    Object.values(
                        groupBy(
                            cities
                            .map((city) => ({label: city.label.replace("Saint", "St"), pollens: city.pollens.filter((pollen) => pollen !== 'Graminée')}))
                            , 'pollens')
                    )
                    .map((cities) => ({cities: cities.map((city) => city.label), pollens: cities[0].pollens}))
                    .sort((a, b) => {
                        if (a.pollens.length !== b.pollens.length) { return b.pollens.length - a.pollens.length; } else { return b.cities.lenght > a.cities.length; }
                    })
                );
            }
        });
    });
}

init();

function createTweetText(entries) {
    let res = `${format(new Date(), 'dd/MM/yy')} :\n\n`;
    entries.map((entry) => {res += `${entry.cities.join(', ')} : ${entry.pollens.map((pollen) => `${data.POLLENS[pollen] || '🌳'}${pollen}`).join(', ')}\n`;});

    // eslint-disable-next-line
    console.info('res:', res);

    const tweets = res.match(/(.*?\n){1,8}/gmi);
    // eslint-disable-next-line
    console.info('tweets:', tweets);
    tweet({ status:tweets[0]}).then((t) => {
        if(tweets[1]) {
            tweet({status: tweets[1], in_reply_to_status_id: t.id});
        }
    })
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

function queryWidget(url) {
    return new Promise((resolve, reject) => {
        urllib.request(url, {timeout: 20000}, (error, data, response) => {
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



















