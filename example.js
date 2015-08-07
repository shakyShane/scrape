var Rx = require('rx');
var json = require('./out.json');

var slow = Rx.Observable.fromNodeCallback(function (item, cb) {
    setTimeout(function () {
        console.log('WRITING 1');
        item.waited = 'forever - 1';
        cb(null, item);
    }, 1000);
});
var slow2 = Rx.Observable.fromNodeCallback(function (item, cb) {
    setTimeout(function () {
        console.log('WRITING 2');
        item.waited2 = 'forever - 2';
        cb(new Error('as'));
    }, 1000);
});

Rx.Observable
    .fromArray(json.text)
    .concatMap(function (item) {
        return slow(item);
    })
    .concatMap(function (item) {
        return slow2(item);
    })
    .subscribe(function (val) {
        //console.log(val);
    }, function (err) {
        console.log(err);
    }, function (values, va) {
        console.log(values, va);
    });