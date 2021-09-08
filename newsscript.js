let video = document.querySelector("video");
let results = document.querySelector("#results").textContent;



for (let mode of document.querySelectorAll(".mode")) {
    if (dom.method == mode.id) {
        //console.log("no nothing");
    } else {

        mode.addEventListener("click", function(e) {
            for (let mod of document.querySelectorAll(".mode")) {
                mod.classList.remove("active");
            }
            e.target.classList.toggle("active");
            dom.method = e.target.id;
            dom.clear();
            sortJson(dom.method, data);
            dom.drawHtml(data);
        });
    }
}

document.querySelector("#direction").addEventListener("click", function() {
    console.log("click");
    let d = document.querySelector("#direction");
    console.log(d.dataset.dir);
    if (d.dataset.dir === "asc") {
        d.textContent = "⬇";
        dom.direction.dataset.dir = "desc";
        dom.dir = "desc";
        console.log("now desc");
        dom.clear();
        sortJson(dom.method, data);
        dom.drawHtml(data);
        return false;
    } else if (d.dataset.dir === "desc") {
        document.querySelector("#direction").innerHTML = "⬆";
        console.log(document.querySelector("#direction  ").textContent)
        console.log("now asc");
        dom.direction.dataset.dir = "asc";
        dom.dir = "asc";
        dom.clear();
        sortJson(dom.method, data);

        dom.drawHtml(data);
        return false;

    } else {
        alert("wtf");
    }

});