let dom = {};
let data;

queryWords = ["covid", "prison"];

if (window.location.href.includes("localhost")) {
    dom.fetchurl = "http://localhost";
    dom.mediaDir = "http://localhost/exposed-news/media/"
} else {
    dom.fetchurl = "https://illegible.us"
    dom.mediaDir = "http://illegible.us/newshandler/media/"
}
dom.fetchurl += ":3535";



async function setup() {




    data = await fetch("processed.json", {
        cache: "reload"
    });
    data = await data.json();
    dom.discards = await fetch("discards.json", {
        cache: "reload"
    });
    dom.discards = await dom.discards.json();
    dom.vidsegs = await fetch("vidsegs.json", {
        cache: "reload"
    });
    dom.vidsegs = await dom.vidsegs.json();
    dom.direction = document.querySelector("#direction");
    dom.dSlider = document.querySelector("#dates .slider");

    //data = JSON.parse(data);
    dom.order = "chron";
    dom.dir = "desc";
    dom.lowest = false;
    dom.highest = false;
    dom.loop = false;
    dom.highestDistance = false;
    dom.distanceThreshold = false;
    data = sortJson(dom.order, data);
    dom.data = data;
    for (let d of data) {
        d.unique = d.identifier + "__" + d.start;
        if (!dom.lowest || d.dateX < dom.lowest) {
            dom.lowest = d.dateX;
        }
        if (!dom.highest || d.dateX > dom.highest) {
            dom.highest = d.dateX;
        }

        if (!dom.highestDistance || d.distanceScore > dom.highestDistance) {
            dom.highestDistance = d.distanceScore;
        }

        if (dom.discards.includes(d.unique)) {
            d.discarded = true;
        } else {
            d.discarded = false;
        }


        for (let v of dom.vidsegs) {
            if (v.id == d.unique) {
                console.log(d.unique);
                d.hasSaved = true;
                d.vidstart = v.start;
                d.vidend = v.end;
                d.url = v.url;
            } else {
                d.vidstart = false;
                d.vidend = false;
            }
        }

    }
    dom.results = document.querySelector("results");
    dom.results = data.length;
    dom.networks = [];
    dom.filters = {};
    dom.filters.datesGood = [];
    dom.filters.distanceGood = [];
    dom.filters.textGood = [];
    dom.filters.netsGood = [];
    dom.lastUpdate = Date.now();
    dom.filts = [dom.filters.datesGood, dom.filters.distanceGood, dom.filters.textGood, dom.filters.netsGood]
    dom.discardBut = document.querySelector("#discarded");
    dom.savedBut = document.querySelector("#hassaved");
    dom.textQuery = document.querySelector("#text");
    dom.query = dom.textQuery.value;

    dom.showDiscards = dom.discardBut.checked;
    dom.showSaved = dom.savedBut.checked;

    dom.area = document.querySelector("#findings");

    dom.creators = document.querySelector("#creators");
    dom.tSlider = document.querySelector("#queryDistance .slider");
    dom.vid = document.querySelector("video");
    dom.viddiv = document.querySelector("videobox");
    dom.vidSlider = document.querySelector("#vidslider");
    dom.vidsegs = 0;
    dom.time = document.createElement("div");
    dom.savebut = document.querySelector("#save");
    processCreators(data);
    let range = {
        min: parseInt(dom.lowest / 1000),
        max: parseInt(dom.highest / 1000)
    };
    console.log(range);

    noUiSlider.create(dom.dSlider, {
        start: [dom.lowest / 1000, dom.highest / 1000],
        connect: true,
        range: range
    });





    noUiSlider.create(dom.tSlider, {
        start: 0,
        step: 1,
        connect: 'lower',
        range: {
            min: 0,
            max: dom.highestDistance
        },
        start: 180
    });
    dom.drawHtml(data);


    dom.dSlider.noUiSlider.on("change", function() {
        processDates();
        dom.updateAllTheThings();

    });

    dom.dSlider.noUiSlider.on("update", function() {
        let low = dom.dSlider.noUiSlider.get()[0];
        let high = dom.dSlider.noUiSlider.get()[1];
        dom.updateDateSliders(low * 1000, high * 1000);
        processDates();


    });

    dom.tSlider.noUiSlider.on("change", function() {
        dom.distanceThreshold = dom.tSlider.noUiSlider.get()
        dom.processDistance();
    });

    dom.tSlider.noUiSlider.on("update", async function() {
        dom.distanceThreshold = dom.tSlider.noUiSlider.get()
        document.querySelector(".threshold").textContent = parseInt(dom.distanceThreshold, 10);
        dom.processDistance();
        dom.updateAllTheThings();
    });

    dom.discardBut.addEventListener("change", async function() {
        dom.savedBut.checked = false;
        dom.showSaved = false;

        dom.showDiscards = dom.discardBut.checked;
        dom.updateAllTheThings();
    });

    dom.savedBut.addEventListener("change", async function() {
        dom.discardBut.checked = false;
        dom.showDiscards = false;

        dom.showSaved = dom.savedBut.checked;
        dom.updateAllTheThings();
    });


    function debounce(func, timeout = 1000) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                func.apply(this, args);
            }, timeout);
        };
    }

    const processChange = debounce(() => dom.textUpdate());

    dom.textQuery.addEventListener("input", processChange);


    dom.textUpdate = async function() {


        dom.query = dom.textQuery.value;
        dom.updateAllTheThings();

    }


    dom.updateDateSliders(dom.lowest, dom.highest);

    dom.lastText = Date.now();


    noUiSlider.create(dom.vidSlider, {
        range: {
            min: 0,
            max: 60
        },
        start: [0, 60],
        connect: true
    });


    dom.vid.addEventListener("timeupdate", function() {
        if ((dom.vidlow || dom.vidlow === 0) && dom.vidhigh) {
            if (dom.vid.currentTime < dom.vidlow) {
                dom.vid.currentTime = dom.vidlow;
            }
            if (dom.vid.currentTime > dom.vidhigh) {
                if (dom.loop) {
                    dom.vid.currentTime = dom.vidlow;
                } else {
                    dom.vid.currentTime = dom.vidhigh;
                    dom.vid.pause();
                }
            }
        }

        dom.time.style.left = (dom.vid.currentTime / dom.vid.duration) * 100 + "%";

    });

    dom.vid.addEventListener("play", function() {
        if ((dom.vidlow || dom.vidlow === 0) && dom.vidhigh) {
            if (dom.vid.currentTime >= dom.vidhigh) {
                dom.vid.currentTime = dom.vidlow;
            }
        }

    });

}




document.querySelector("#save").addEventListener("click", async function() {
    let sendData = {
        unique: dom.activeVid,
        start: dom.vidlow,
        end: dom.vidhigh,
        url: dom.vid.src,
        type: "vidtimes"
    };
    console.log(sendData);
    const resp = await fetch(dom.fetchurl, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(sendData)
    });
    const content = await rawResponse.json();

    console.log(content);
});


document.querySelector("#expand").addEventListener("click", async function() {
    let url = dom.vid.src.split("?t=");
    let time = url[1];
    let start = time.split("/")[0];
    url = dom.vid.src.replace(start, parseInt(start, 10) - 30);
    console.log(url);
    dom.vid.src = url;
    await vidLoaded();

    let end;
    if (dom.vidlow) {
        start = dom.vidlow;
    } else {
        start = 0;
    }
    start = parseInt(start, 10);
    end = parseInt(end, 10);
    if (dom.vidhigh) {
        end = dom.vidhigh;
    } else {
        end = dom.vid.duration;
    }
    console.log(start, end);
    dom.vidSlider.noUiSlider.updateOptions({
        range: {
            min: 0,
            max: parseInt(dom.vid.duration, 10)
        },
        //start: [start, end],
        //connect: true
    }, true);


});



function setupButtons() {

    for (let b of document.querySelectorAll(".discard")) {


        b.addEventListener("click", async function() {
            let sendData = {
                type: "discard",
                unique: b.dataset.id,
            };
            console.log(sendData);
            const resp = await fetch(dom.fetchurl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sendData)
            });
            let id = b.parentElement.dataset.id
            const content = await resp.json();
            console.log(id);
            let d = dom.getById(id);
            d.discarded = true;
            dom.hide(id);

            console.log(content);
        });
    }
}






document.querySelector("#loop").addEventListener("click", function() {
    this.classList.toggle("off");
    dom.loop = !dom.loop;
    if (dom.loop = true && dom.vid.currentTime >= dom.vidhigh && dom.vid.paused) {
        dom.vid.play();
    }
});

dom.getById = function(id) {
    for (let d of data) {
        if (d.unique == id) {
            return d;
        }
    }
}


dom.makeVidSlider = async function() {

    await vidLoaded();
    dom.vid.currentTime = 0;
    let dobj = this.getById(this.activeVid);
    console.dir(dobj);
    let start = 0,
        end = dom.vid.duration;
    if (dobj.vidstart) {
        start = dobj.vidstart;
    }
    if (dobj.vidend) {
        end = dobj.vidend;
    }
    console.log(start, end);
    console.log(dobj.vidstart);
    dom.vidSlider.noUiSlider.updateOptions({
        range: {
            min: 0,
            max: dom.vid.duration
        },
        start: [start, end],
        connect: true
    }, true);

    dom.time.classList.add("playhead");
    document.querySelector(".noUi-base").appendChild(dom.time);

    dom.vidSlider.noUiSlider.on("update", async function() {
        //break these into arrays if you have mults
        dom.vidlow = dom.vidSlider.noUiSlider.get()[0];
        dom.vidhigh = dom.vidSlider.noUiSlider.get()[1];
        document.querySelector(".vidlow").value = new Date(parseInt(parseFloat(dom.vidlow * 1000), 10)).toISOString().substr(14, 5);
        document.querySelector(".vidhigh").value = new Date(parseInt(parseFloat(dom.vidhigh * 1000), 10)).toISOString().substr(14, 5);
    });
}



function vidLoaded() {
    return new Promise(function(resolve, reject) {
        if (dom.vid.readyState) {
            resolve();
        } else {
            dom.vid.addEventListener("loadedmetadata", function() {
                resolve();
            }, {
                once: true
            })
        }

    });
}

dom.processDistance = function() {
    console.log("processing distance", dom.distanceThreshold)
    for (let d of data) {
        let index = dom.filters.distanceGood.indexOf(d.unique);

        if (d.distanceScore <= dom.distanceThreshold && index == -1) {
            dom.filters.distanceGood.push(d.unique);
        } else if (d.distanceScore > dom.distanceThreshold && index > -1) {
            dom.filters.distanceGood.splice(index, 1);
        }
    }
    console.log(dom.filters.distanceGood.length, "under", dom.distanceThreshold);
}

dom.updateAllTheThings = function() {
    let visible = 0;
    if (!this.networks.length) {
        this.filts = [dom.filters.datesGood, dom.filters.distanceGood]
    } else {
        this.filts = [dom.filters.datesGood, dom.filters.distanceGood, dom.filters.netsGood]
    }
    for (let d of data) {
        let result = true;

        if (dom.showDiscards && !d.discarded) {
            result = false;
        }

        if (dom.showSaved && !d.hasSaved) {
            result = false;
        }


        let id = d.unique;
        for (let f of this.filts) {
            if (!f.includes(id)) {
                result = false;
            }
        }

        if (dom.query.length) {
            if (!d.transcript.includes(dom.query)) {
                result = false;
            }
        }


        if (result) {
            visible++;
            dom.show(id)
        } else {
            dom.hide(id);
        }
    }
    let res = document.querySelector("#results");

    res.textContent = `Results: ${visible}`;
}

setup();

sortJson = function(mode, data) {
    console.log("sorting", mode, dom.dir)
    let mult = 1;
    if (dom.dir == "desc") {
        mult = -1;
    }
    if (mode === "chron") {
        val = "date";
    } else {
        val = "distanceScore";
    }

    data.sort(function(a, b) {
        let ad = a[val];
        let bd = b[val];

        if (ad < bd) {
            return -1 * mult;
        } else if (ad === bd) {
            return 0;
        } else {
            return 1 * mult;
        }
    });
    return data;


}

dom.textFilter = function() {
    let txt = dom.txt.value;
    for (let p of document.querySelectorAll(".transcript p")) {
        if (!p.textContent.includes("txt")) {
            p.parentElement.style.display = "none"
        }
    }
    dom.updateResults();
}

dom.clear = function() {
    this.area.textContent = " ";
}

dom.fill = async function(data) {
    let results = data;

}


let processCreators = function() {
    let data = dom.data;
    let creators = [];

    function creator(crea) {
        for (let c of creators) {
            if (c.title === crea) {
                return creators.indexOf(c);
            }
        }
        return false;
    }

    function creator(crea) {
        for (let c of creators) {
            if (c.title === crea) {
                return creators.indexOf(c);
            }
        }
        return false;
    }

    for (let r of data) {
        let thec = creator(r.creator);
        if (thec !== false) {
            let c = creators[thec];
            //console.log("iterating", c.title);
            c.count++;
        } else {
            console.log(r.creator, "not found")
            let c = {
                title: r.creator,
                count: 1
            };
            //console.log(c);
            creators.push(c);
        }
    }
    for (let c of creators) {
        let p = document.createElement("p");
        p.dataset.creator = c.title;
        p.textContent = `${c.title}: ${c.count}`;
        dom.creators.appendChild(p);
    }

    for (let p of document.querySelectorAll("#creators p")) {
        let clear;
        p.addEventListener("click", function() {
            processDates();

            let name = p.textContent.split(":")[0];
            p.classList.toggle("active");
            if (!dom.networks.includes(name)) {
                clear = false;
                dom.networks.push(name);
            } else {
                let index = dom.networks.indexOf(name);
                if (index > -1) {
                    dom.networks.splice(index, 1);
                }
                if (document.querySelectorAll("#creators .active").length == 0) {
                    clear = true;
                }
            }


            dom.updateNets();

        });
        dom.creas = creators;

    }

    dom.creators.appendChild(document.createElement("hr"));
}


dom.updateNets = function() {
    for (let d of data) {
        if (dom.networks.includes(d.creator)) {
            dom.filters.netsGood.push(d.unique);
        } else {
            let index = dom.filters.netsGood.indexOf(d.unique);
            if (index !== -1) {
                dom.filters.netsGood.splice(index, 1);
            }
        }
    }
    this.updateAllTheThings();
}

let processDates = function() {
    let slidepoints = dom.dSlider.noUiSlider.get();
    let low = slidepoints[0] * 1000;
    let high = slidepoints[1] * 1000;
    for (let d of data) {
        let date = d.dateX;
        //console.log(date);
        //date = moment(date, "YYYY-MM-DD");
        //date = date.format("X");
        //console.log(date, low, high);

        let index = dom.filters.datesGood.indexOf(d.unique);

        if ((date > low && date < high) && index == -1) {
            dom.filters.datesGood.push(d.unique)
        } else if ((date < low || date > high) && index > -1) {
            let index = dom.filters.datesGood.indexOf(d.unique);
            if (index !== -1) {
                dom.filters.datesGood.splice(index, 1);
            }
        }
    }


}


function updateCreatorCount() {
    //redo - do it based on final count of filtered 
    for (let p of document.querySelectorAll("#creators p")) {
        let spl = p.textContent.split(":");
        let name = spl[0].trim();
        let num = spl[1].trim();
        let query = '.transcript[data-creator="' + name + '"]';
        let count = document.querySelectorAll(query);
        if (count.length) {
            let also = 0;
            for (let c of count) {
                if (c.style.display === "block") {
                    also++;
                }
            }
            p.textContent = `${name}: ${also}`;
        }
    }

}

dom.updateResults = function() {
    let res = document.querySelector("#results")
    res.textContent = "";

    for (let n of dom.networks) {
        res.textContent += n + " ";
    }
    res.textContent += " " + dom.visibleResults();

}

dom.visibleResults = function() {
    let count = 0;
    for (let z of document.querySelectorAll("#findings .transcript")) {
        if (z.style.display == "block") {
            count++;
        }
    }
    return count;

}

dom.hide = function(id) {
    let div = document.querySelector(`div[data-id="${id}"]`);
    div.classList.add("hidden");


}

dom.show = function(id) {
    console.log("showing");
    let div = document.querySelector(`div[data-id="${id}"]`);
    div.classList.remove("hidden");
    let d = this.getById(id);
    let transcript = div.querySelector(".thetranscript");
    transcript.textContent = d.transcript;
    for (let word of queryWords) {
        transcript.innerHTML = transcript.innerHTML.replace(word, `<strong>${word}</strong>`);
    }
    if (dom.textQuery.value.length) {
        let query = dom.textQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let pattern = new RegExp(query, "g");
        transcript.innerHTML = transcript.innerHTML.replace(pattern, `<span class='selected'>${dom.textQuery.value}</span>`);
    }
}


dom.drawHtml = async function(data) {


    for (let clip of data) {
        let already = document.querySelectorAll(`div[data-id="${clip.unique}"]`);
        if (already.length) {
            console.log("ALREADY", already)
        } else {
            //console.log("inserting", clip.unique)

            let div = document.createElement("div");
            div.classList.add("transcript");
            div.dataset.creator = clip.creator;
            div.dataset.id = clip.unique;
            div.dataset.date = clip.date;
            div.dataset.distanceScore = clip.distanceScore;
            let date = moment(clip.date, "X");
            let h5 = document.createElement("h5");
            h5.textContent = clip.title.split(":")[0];
            div.appendChild(h5);

            let h4 = document.createElement("h4");
            h4.innerHTML = `${clip.date} // ${clip.creator} // term distance: ${clip.distanceScore} <button class="vid" data-vid="${clip.video}" data-id="${clip.unique}" data-distance="${clip.distanceScore}" href="#">&#9654;</button>`;
            div.appendChild(h4);
            let p = document.createElement("p");
            p.classList.add("thetranscript");
            let stronged = "";
            for (let word of queryWords) {
                stronged = clip.transcript.replace(word, `<strong>${word}</strong>`);
            }
            p.innerHTML = ` ${stronged}`;

            div.appendChild(p);

            dom.area.appendChild(div);
            if (clip.hasSaved) {
                let saved = document.createElement("ul");
                saved.classList.add("savedMedia");
                let savedVid = document.createElement("li");
                let savedAud = document.createElement("li");
                savedVid.innerHTML = `<a href="${dom.mediaDir}${clip.unique}.mp4" download>Download Video</a>`;
                savedAud.innerHTML = `<a href="${dom.mediaDir}${clip.unique}.mp3" download>Download Audio</a>`;
                saved.appendChild(savedVid);
                saved.appendChild(savedAud);
                div.appendChild(saved);

            }
            div.innerHTML = div.innerHTML + `
        <button data-id="${clip.unique}" class="discard">discard &#10060;</button>
        <hr>`;
        }
    }
    processDates();
    setupButtons();
    this.processDistance();
    this.updateAllTheThings();

    for (let a of document.querySelectorAll(".vid")) {
        a.addEventListener("click", async function() {
            dom.activeVid = a.dataset.id;
            video.src = a.dataset.vid;
            video.controls = true;
            document.querySelector("#videobox").style.display = "block"
            video.currentTime = 0;
            dom.makeVidSlider();
            video.play();
        });

    };

}

dom.updateDateSliders = function(lowest, highest) {
    var slider = document.querySelector('#dates .slider');
    var low = document.querySelector('#dates .lowest');
    var high = document.querySelector('#dates .highest');

    low.textContent = moment(lowest, "X").format("MM/DD/YYYY");
    high.textContent = moment(highest, "X").format("MM/DD/YYYY");

}


let video = document.querySelector("video");
let results = document.querySelector("#results").textContent;



for (let mode of document.querySelectorAll(".mode")) {
    if (dom.order == mode.id) {
        //console.log("no nothing");
    } else {

        mode.addEventListener("click", function(e) {
            for (let mod of document.querySelectorAll(".mode")) {
                mod.classList.remove("active");
            }
            e.target.classList.toggle("active");
            dom.order = e.target.id;
            dom.clear();
            sortJson(dom.order, data);
            dom.drawHtml(data);
        });
    }
}

document.querySelector("#direction").addEventListener("click", function() {
    console.log("click");
    let d = document.querySelector("#direction");
    console.log(d.dataset.dir);
    if (d.dataset.dir === "asc") {
        d.textContent = "descending";
        dom.direction.dataset.dir = "desc";
        dom.dir = "desc";
        console.log("now desc");
        dom.clear();
        sortJson(dom.order, data);
        dom.drawHtml(data);
        return false;
    } else if (d.dataset.dir === "desc") {
        document.querySelector("#direction").innerHTML = "ascending";
        console.log(document.querySelector("#direction  ").textContent)
        console.log("now asc");
        dom.direction.dataset.dir = "asc";
        dom.dir = "asc";
        dom.clear();
        sortJson(dom.order, data);

        dom.drawHtml(data);
        return false;

    } else {
        alert("wtf");
    }

});


//drawHtml(0);
async function sleep(ms) {
    await new Promise(r => setTimeout(r, ms));
}