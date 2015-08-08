var Rx = require('rx');
var json = require('./out.json');
var shane = true;
var running = false;

var obs = Rx.Observable.create(function (obs) {
    setTimeout(function () {
        obs.onCompleted();
    }, 2000);
});

var source = Rx.Observable
    .interval(500)
    .takeUntil(obs)
    .subscribe(
        function (x) {
            console.log('Value:', x);
        },
        function (err) {
            console.log('Error: ' + err);
        },
        function () {
            console.log('Completed');
        }
);

