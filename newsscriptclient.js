let dom = {};
let data;

async function setup() {
    data = await fetch("processed.json");
    data = await data.json();
    console.log(data);
    dom.direction = document.querySelector("#direction");
    dom.slider = document.querySelector("#slider");

    //data = JSON.parse(data);
    dom.method = "score";
    dom.dir = "desc";
    dom.lowest = false;
    dom.highest = false;
    data = sortJson(dom.method, data);
    dom.data = data;
    for (let d of data) {
        if (!dom.lowest || d.dateX < dom.lowest) {
            dom.lowest = d.dateX;
        }
        if (!dom.highest || d.dateX > dom.highest) {
            dom.highest = d.dateX;
        }
    }
    dom.results = document.querySelector("results");
    dom.results = data.length;
    dom.networks = [];
    dom.area = document.querySelector("#findings");
    dom.creators = document.querySelector("#creators");
    processCreators(data);
    let range = {
        min: dom.lowest / 1000,
        max: dom.highest / 1000
    };
    console.log(range);

    noUiSlider.create(dom.slider, {
        start: [dom.lowest / 1000, dom.highest / 1000],
        connect: true,
        range: range
    });
    dom.drawHtml(data);

    dom.slider.noUiSlider.on("update", function() {
        let low = dom.slider.noUiSlider.get()[0];
        let high = dom.slider.noUiSlider.get()[1];
        dom.updateDateSliders(low * 1000, high * 1000);

    });

    dom.slider.noUiSlider.on("change", function() {
        processDates(dom.data);
    });
    dom.updateDateSliders(dom.lowest, dom.highest);

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

dom.clear = function() {
    this.area.textContent = " ";
}

dom.fill = async function(data) {
    let results = data;
}


let processCreators = function(data) {
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

            for (let d of document.querySelectorAll(".transcript")) {
                if (dom.networks.includes(d.dataset.creator) || clear) {
                    // d.style.display = "block";
                } else {
                    d.style.display = "none";
                }
            }
            dom.updateResults();

        });


    }

    dom.creators.appendChild(document.createElement("hr"));
}

let processDates = function() {
    let slidepoints = dom.slider.noUiSlider.get();
    let low = slidepoints[0] * 1000;
    let high = slidepoints[1] * 1000;
    for (let clip of document.querySelectorAll(".transcript")) {
        let date = clip.dataset.date;
        date = moment(date, "YYYY-MM-DD");
        date = date.format("X");
        console.log(date, low, high);
        if (date > low && date < high) {
            clip.style.display = "block";
        } else {
            clip.style.display = "none";
        }
    }

    dom.updateResults();
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

dom.drawHtml = function(data) {


    for (let clip of data) {
        let div = document.createElement("div");
        div.classList.add("transcript");
        div.dataset.creator = clip.creator;
        div.dataset.date = clip.date;
        div.dataset.distanceScore = clip.distanceScore;
        let date = moment(clip.date, "X");
        let h5 = document.createElement("h5");
        h5.textContent = clip.title.split(":")[0];
        div.appendChild(h5);
        clip.transcript = clip.transcript.replace("covid", "<strong>covid</strong>").replace("prison", "<strong>prison</strong>");
        let h4 = document.createElement("h4");
        h4.innerHTML = `${clip.date} // ${clip.creator} // ${clip.distanceScore} <button class="vid" data-vid="${clip.video}" data-distance="${clip.distanceScore}" href="#">&#9654;</button>`;
        div.appendChild(h4);
        let p = document.createElement("p");
        p.innerHTML = `<p> ${clip.transcript} </p>
        <button id="save">save &#9989;</button> <button id="discard">discard &#10060;</button>
        <hr>`;
        div.appendChild(p);
        dom.area.appendChild(div);
    }


    for (let a of document.querySelectorAll(".vid")) {
        a.addEventListener("click", function() {
            video.src = a.dataset.vid;
            video.controls = true;
            video.currentTime = 0;
            video.play();
        });

    };
    processDates();

}

dom.updateDateSliders = function(lowest, highest) {
    var slider = document.getElementById('slider');
    var low = document.getElementById('lowest');
    var high = document.getElementById('highest');

    low.textContent = moment(lowest, "X").format("MM/DD/YYYY");
    high.textContent = moment(highest, "X").format("MM/DD/YYYY");

}



//drawHtml(0);