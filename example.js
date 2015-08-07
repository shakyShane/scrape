var Rx = require('rx');
var json = require('./out.json');

var slow = Rx.Observable.fromNodeCallback(function (item, cb) {
    setTimeout(function () {
        cb(null, 1000);
    }, 1000);
});

var slow2 = Rx.Observable.fromNodeCallback(function (item, cb) {
    setTimeout(function () {
        cb(null, 2000);
    }, 1000);
});

var source = Rx.Observable
    .fromArray(json.text)
    .map(function (item) {
        return slow(item);
    })
    .subscribe(function (val) {
        console.log('value', val);
    }, function (err) {
        console.log(err);
    }, function (values, va) {
        console.log('END');
    });