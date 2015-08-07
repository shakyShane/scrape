var Rx = require('rx');
var json = require('./out.json');
var shane = true;
var int = Rx.Observable.interval(100);

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