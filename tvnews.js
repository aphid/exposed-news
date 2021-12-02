var rp = require('request-promise-native');
var fs = require('fs-promise');
var ffmpeg = require('fluent-ffmpeg');
var moment = require('moment');
const lcs = require('longest-common-subsequence');
var striptags = require('striptags');
var cp = require('child_process');
var data = "newses.json";
var mediaDir = "media/";
var stringSimilarity = require("string-similarity");
var norm = require("ffmpeg-normalize");

const smtihWaltermanScore = require('smith-walterman-score');
const options = {
    gap: -1,
    mismatch: -2,
    match: 2
};

let query = [
    ["covid", "prison"],
    ["covid", "inmate"],
    ["covid", "incarcerated"]
]

var newses = [];
var dict = [""];
/* ffmpeg.getAvailableFormats(function (err, codecs) {
    console.log('Available codecs:');
    console.dir(codecs);
});*/

var nots = [];

var News = function(object) {
    console.log("instantiating gone");
    for (let thing in object) {
        this[thing] = object[thing];
    }
    this.start = parseInt(this.start, 10);
    this.finds = [];
};

News.prototype.fetchVideo = async function() {
    if (fs.existsSync(this.identifier + ".mp4")) {
        return Promise.resolve();
    }
    var start = this.start - 20;
    if (this.truncated) {
        start = this.start - 35;
    }

    if (start < 0) {
        start = 0;
    }
    console.log(start);
    var end = start + 60;
    var url = "http://archive.org/download/" + this.identifier + "/" + this.identifier + ".mp4?t=" + start + "/" + end + "&ignore=x.mp4";
    console.log("fetching: ", url);

    var asdf = await getFile(url, mediaDir + this.identifier + ".mp4");
    this.localFile = asdf;

};

News.prototype.tcodeMp3 = async function() {
    var gon = this;
    console.log("transcoding audio");
    var path = this.localFile.replace(".mp4", ".mp3");




    console.log(path);

    return new Promise(async function(resolve) {
        if (await fs.exists(path)) {
            console.log("file exists");
            gon.localMp3 = path;

            resolve();
        }
        try {
            ffmpeg(gon.localFile).audioCodec('libmp3lame').audioBitrate("64k").on('start', function(cmd) {
                console.log("invoked with", cmd);
            }).on('end', function() {
                gon.localMp3 = path;
                resolve();
            }).output(path).run();
        } catch (e) {
            throw (e);
        }
    });
}



News.prototype.tcodeNorm = async function() {
    var gon = this;
    console.log("transcoding normalized video");
    var path = this.localFile.replace(".mp4", "_normalized.mp4");

    return new Promise(async function(resolve) {
        if (await fs.exists(path)) {
            console.log("file exists");
            gon.localNormalized = path;
            resolve();
        }
        //ffmpeg -i this.localPCM -filter:a loudnorm output.wav
        var encode = cp.exec('ffmpeg -y -analyzeduration 999999999 -probesize 999999999 -i ' + gon.localFile + ' -filter:a loudnorm -max_muxing_queue_size 9999 -vcodec copy ' + path, {
            timeout: 50000
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
            gon.localPCM = path;
            resolve();
        });
    });

}


News.prototype.tcodeWav = async function() {
    var gon = this;
    console.log("transcoding wav");
    var path = this.localFile.replace(".mp4", ".wav");

    return new Promise(async function(resolve) {
        if (await fs.exists(path)) {
            console.log("file exists");
            gon.localPCM = path;
            resolve();
        }
        var encode = cp.exec('ffmpeg -i ' + gon.localFile + ' -acodec pcm_s16le -ac 1 -ar 16000 ' + path, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
            gon.localPCM = path;
            resolve();
        });
    });

}

News.prototype.speech2text = async function() {
    var gon = this;
    var path = this.localFile.replace(".mp4", ".txt");
    if (fs.existsSync(path) && fs.statSync(path).size) {
        console.log("already sphinx'd");
        var sp = fs.readFileSync(path, "utf8");
        console.log(sp);
        gon.processSpeech(sp);
        return Promise.resolve();
    }
    return new Promise(async function(resolve) {
        var command = 'pocketsphinx_continuous -infile ' + gon.localPCM + ' -kws_threshold /1e-40/ -time yes -logfn /dev/null -keyphrase "' + gon.phrase + '"';
        console.log(command);
        var listen = cp.exec(command, async (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                throw (error);
            }
            var results = gon.processSpeech(stdout);
            console.log(`stderr: ${stderr}`);
            await fs.writeFile(path, stdout);
            resolve();
        });
    });

}

News.prototype.processSpeech = async function(inc) {
    console.log("processing speech");
    //console.log(inc);
    var finds = [];
    inc = inc.split(/\n/);
    var repl = new RegExp(this.phrase, "gi");

    console.log(inc.length, "incs");
    for (let i of inc) {
        console.log(i);
        i = i.replace(repl, "").trim();
        console.log(i);
        if (i.length > 5 && !i.includes("!!!")) {
            console.log("processing a find");
            console.log(i);
            i = i.split(" ");
            let find = {
                start: i[0],
                end: i[1],
                confidence: i[2]
            };
            console.log(find);
            finds.push(find);
        }
    }
    this.finds = finds;
    console.log(this);


};

var findNews = async function(phrase) {
    for (let i = 0; i < newses.length; i++) {
        if (newses[i].transcript === phrase) {
            return i;
        }
    }
}

var getNewss = async function(search) {

    let newses = [];
    let queryphrase = search.replace(/\s/g, "%20");
    let url = "http://archive.org/details/tv?q=" + queryphrase + "&output=json";

    /* old var queries = ["http://archive.org/details/tv?q=%22gone%20are%20the%20days%22&output=json", "http://archive.org/details/tv?q=%22gone%20were%20the%20days%22&output=json"]; */

    console.log("cmon");
    console.log("trying ", queryphrase);
    let json = await jsonz(url);
    for (let clip of json) {
        clip.phrase = queryphrase;
        newses.push(clip);

    }
    console.log(json.length);
    return newses;
}

var getJSON = function(url) {
    console.log('requesting ', url);
    return new Promise(function(resolve) {
        rp(url, {
            method: 'get'
        }).then(function(response) {
            console.log("got response", response.length);
            resolve(JSON.parse(response));

        }).catch(function(err) {
            console.log(err);
        });

    });

}
var jsonz = async function(url) {
    console.log("getting jsons");
    var done = false;
    var counter = 1;
    var results = [];
    console.log("page ", counter);
    while (!done) {
        let res = await getJSON((url + "&page=" + counter));
        if (!res.length) {
            done = true;
            console.log("done");
            return results;
        }
        results = results.concat(res);
        counter++;
        console.log(results.length)
    }
}



var getFile = function(url, dest) {
    console.log('trying ', url);

    return new Promise(async function(resolve) {
        if (await fs.exists(dest)) {
            console.log("file exists");
            resolve(dest);
        } else {
            rp(url, {
                method: 'get',
                encoding: null
            }).then(async function(response) {
                await fs.writeFile(dest, response);
                console.log("file written: ", dest);
                resolve(dest);
            }).catch(function(err) {
                console.log(err);
            });
        }
    });

}
let full = [];

var processNewss = async function(newses, qry) {
    dict = [""];

    let qwords = [qry[0], qry[1]];



    var nNewss = [];
    let thisNews = 0;
    for (let news of newses) {
        let isMatched = false; //await matched(news);
        news.transcript = striptags(news.snip);
        news.unique = news.identifier + "__" + news.start;
        news.topic = null;
        news.shortTitle = news.title.split(":")[0];
        news.dateX = string2date(news.title, "X");
        news.date = string2date(news.title, "YYYY-MM-DD");
        news.time = string2date(news.title, "HH:mm");
        news.distanceScore = calculateDistance(news.transcript, qwords);
        if (new RegExp(qwords.join("|")).test(news.transcript)) {
            news.found = true;
        } else {
            news.found = false;
        }
        if (full.includes(news.unique)) {
            console.log("^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ B L O C K E D ^ A ^ D U P E ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^")
            console.log(news.unique)
            isMatched = true;
        }
        if (!isMatched || news.distanceScore < 900) {
            console.log("adding gone");
            nNewss.push(new News(news));
            full.push(news.unique);
            dict.push(news.transcript);
        } else {
            console.log("naw");
        }
        console.log(thisNews, "/", newses.length, "(", nNewss.length, ")")
        thisNews++;
    }
    console.log(nNewss.lenth);
    sameDaySameChannel(nNewss);
    //thoseSeparators(nNewss, query[0], query[1]);
    console.log(nNewss.lenth);

    return nNewss.sort(compareDates); //.reverse();
};

function sameDaySameChannel(input) {
    let removes = [];
    for (let i = input.length - 1; i >= 0; i--) {
        if (input[i].distanceScore > 900) {
            removes.push(i);
        }
        console.log("testing", input[i].shortTitle);
        for (let j = 0; j < input.length; j++) {

            let a = input[i].shortTitle;
            let b = input[j].shortTitle;
            if (a === b && input[i].date === j.date && j !== i) {
                console.log("removing", i, input[i].identifier, input[j].identifier);
                removes.push(i);
            }
            /*
            if ((input[i] && j) && input[i].creator && input[i].date && j.creator && j.date) {

                if (input[i].creator === j.creator && input[i].date === j.date && input[i].dateX !== j.dateX) {
                    console.log("removing", i, input[i].identifier, j.identifier);
                    removes.push(i);
                }
            } else {
                console.log("missing creator or date in: ");
                console.log(input[i].creator, input[i].date);
                console.log(j.creator, j.date);
            } */
        }
    }

    removes.sort().reverse();
    for (let r of removes) {
        input.splice(r, 1);
    }
    return input;
}

function calculateDistance(input, qwords) {
    let dists = [];
    for (let q of qwords) {
        if (input.indexOf(q) !== -1) {
            let idx = input.indexOf(q);
            console.log(q, "at", idx);
            dists.push(idx)
        }
    }
    if (dists.length < 2) {
        return 999;
    }
    console.log("calculating dists", dists);
    let dist = minimumAbsoluteDifference(dists);
    console.log(dist);
    return dist;
}


function minimumAbsoluteDifference(arr) {

    let min_difference = Number.MAX_VALUE;
    // sorts the given array in an ascending order
    arr.sort((a, b) => a - b);

    for (let i = 0; i < arr.length - 1; i++) {
        min_difference = Math.min(Math.abs(arr[i] - arr[i + 1]), min_difference);

        // Return early as 0 is the minimum absolute difference
        if (min_difference == 0)
            return 0;
    }
    return min_difference;
}

function thoseSeparators(input, start, end) {

    for (let i = input.length - 1; i >= 0; i--) {
        let transcript = input[i].transcript;
        console.log(transcript);
        let re = new RegExp("(?<=" + start + ")([^>>]*)(?=" + end + ")");
        let er = new RegExp("(?<=" + end + ")([^>>]*)(?=" + start + ")");
        console.log(re.test(transcript), er.test(transcript));
        if (!re.test(transcript) && !er.test(transcript)) {

            input.splice(i, 1);
            console.log("removing", i);
        }


    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

var matched = async function(news) {

    let newswords = news.transcript;
    let dic = [...dict];
    var index = dic.indexOf(newswords);
    if (index !== -1) {
        dic.splice(index, 1);
    }
    let ss = stringSimilarity.findBestMatch(newswords, dic);
    let best = ss.ratings[ss.bestMatchIndex];
    console.log('\x1b[36m%s\x1b[0m', best.rating);
    await sleep(1000);
    console.log("testing: ", news.transcript), "\n";

    console.log("vs :", ss.ratings[ss.bestMatchIndex], "\n");
    if (best.rating > 0.85) {
        console.log("match")
        console.log(newswords);
        console.log(ss.ratings[ss.bestMatchIndex]);
        return true;
    } else if (best.rating > 0.6) {
        for (let d of dic) {
            let a = news.transcript.substr(0, 100);
            let b = d.substr(0, 100);
            let elcs = lcs(a, b);
            console.log(elcs.length);
            let long = Math.max(a.length, b.length);
            if (elcs.length > long * 0.65) {
                console.log("match", elcs.length);
                console.log(news.transcript, "\n");
                console.log(d);
                console.log(">>>>>>>>>elcs: \n", elcs);
                await sleep(2500);
                return true;
            } else {
                console.log("no match yet...");
            }
        }
        console.log("...no match");
        return false;
    } else {
        return false;
    }
    return best.rating;
    /*
    } else {
        if (best.rating > 0.6) {
            console.log("no match")
            console.log(newswords);
            console.log(ss.ratings[ss.bestMatchIndex]);
        }
        return false;
    }
    /*
    for (let gon of newses) {
        if (gon.identifier === news.identifier) {
       
        } else {
            let newswords = striptags(news.snip);
            let gonwords = striptags(gon.snip);
            
            let dist = stringSimilarity.compareTwoStrings(newswords,gonwords);
            //console.log(news.snip);
            console.log(dist);
            if (dist.length > 0.5) {
                console.log("matched existing");
                console.log(newswords.substr(0, 200), gonwords.substr(0, 200));
                process.exit();
                return true;
            } else {
                return false;
                //console.log("new phrase:", gonwords);
            }
    }
    }
    */

}

var compareDates = function(a, b) {
    let aDate = string2date(a.title);
    let bDate = string2date(b.title);
    //console.log(aDate, bDate);
    if (aDate > bDate) {
        //console.log("a");
        return -1;
    } else {
        //console.log("b");
        return 1;
    }


};



var string2date = function(str, format = "X") {

    var datestring = str.split(" : ");
    datestring = datestring[datestring.length - 1];
    datestring = datestring.split("-");
    datestring = datestring[0] + datestring[1].split(" ")[1];

    var test = moment(datestring, "MMMM Do, YYYY hh:mmA z").format(format);
    return test;

};



var go = async function() {


    for (let q of query) {
        console.log(`@@@${q}@@@)`);
        let phrase = `${q[0]} AND ${q[1]}`;
        var newses = await getNewss(phrase);
        newses = await processNewss(newses, q);
        fs.writeFileSync(`${q.join("_")}.json`, JSON.stringify(newses, undefined, 2));

    }

    //let newses = JSON.parse(fs.readFileSync("data.json"));
    console.log("processing...")
    console.log("writing files")
    //fs.writeFileSync(`processed.json`, JSON.stringify(newses, undefined, 2));

    /*
    console.log("checking local file");
    newses = JSON.parse(fs.readFileSync("processed.json"));
    console.log(newses.length);
    newses = processNewss(newses);
    
    for (let news of newses) {
        //console.log(gone);
        await news.fetchVideo();
        await news.tcodeMp3();
       //await news.tcodeWav();
        //await news.tcodeNorm();
        //await news.speech2text();
        await fs.writeFile("data.json", JSON.stringify(newses, undefined, 2));

    }
    
    var found = [];
    for (let news of newses) {
        if (news.found) {
            found.push(news);
        }
    }
    await fs.writeFile("found.json", JSON.stringify(newses, undefined, 2)); */

};

go();

/*
ffmpeg -i INPUT -acodec pcm_s16le -ac 1 -ar 16000 OUTPUT

pocketsphinx_continuous -infile WAV -keyphrase "gone are the days" -kws_threshold /1e-40/ -time yes
*/