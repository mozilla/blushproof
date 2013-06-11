This is a simple dashboard for the metrics collected by blushproof.
It requires [d3](http://d3js.org) and [xCharts](http://tenxer.github.io/xcharts/).
More specifically, it requires `d3.v3.min.js`, `xcharts.min.js`, and `xcharts.min.css` (or the equivalent non-minimized versions, but that would require changes to `index.html`). Additionally, it requires data from the metrics database, obtained by running `./db2js.sh events.sqlite > events.js`.
Try zooming in and out using a scroll wheel!
