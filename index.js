const cheerio = require("cheerio");
const moment = require("moment");
const rp = require("request-promise");


exports.get = (event, context, callback) => {
    console.log(`Received event: ${JSON.stringify(event)}`);

    const startDate = event.queryStringParameters && event.queryStringParameters.startDate ? moment(event.queryStringParameters.startDate) : undefined;
    const endDate = event.queryStringParameters && event.queryStringParameters.endDate ? moment(event.queryStringParameters.endDate) : startDate ? startDate : undefined;

    let url = "https://www.dgif.virginia.gov/fishing/trout-stocking-schedule/";
    if (startDate) {
        url += `?start_date=${encodeURIComponent(startDate.format("MM/DD/YYYY"))}`;
    }

    if (endDate) {
        url += `&end_date=${encodeURIComponent(endDate.format("MM/DD/YYYY"))}`;
    }

    console.log(`Using ${url} for the query`);
    return rp({
        method: "GET",
        uri: url,
        headers: {
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36"
        },
        transform: (body) => {
            return cheerio.load(body);
        }
    }).then($ => {
        const entries = [];
        $("#stocking-table").find("tbody").find("tr").each((i, elem) => {
            const tds = $(elem).find("td").map((i, td) => $(td).text());
            entries.push({
                date: scrubDate(tds[0]).format(),
                county: tds[1].trim(),
                water: scrubWater(tds[2]).trim(),
                definition: tds[3].trim()
            });
        });
        console.log(`${entries.length} entries found for url ${url}`);

        callback(null, {
            statusCode: 200,
            body: JSON.stringify(entries),
            headers: {
                "Content-Type": "application/json"
            },
        });
    }).catch(e => {
        callback(null, {
            statusCode: 500,
            body: JSON.stringify({
                error: e
            }),
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        });
    });
};

function scrubDate(value) {
    return moment(Date.parse(value));
}

function scrubWater(value) {
    value = value.replace("&", "and");

    if (value && value.indexOf("(") > 0) {
        return value.substring(0, value.indexOf("("));
    }
    if (value && value.indexOf("[") > 0) {
        return value.substring(0, value.indexOf("["));
    }
    return value;
}