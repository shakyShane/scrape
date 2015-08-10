var Rx = require('rx');

function getTimer (time) {
    return Rx.Observable.create(function (obs) {
        setTimeout(function () {
            obs.onNext();
            obs.onCompleted();
        }, time);
    });
}

function createTimeout() {
    console.log('>>> timeout started');
    return Rx.Observable.timer(2000);
}

var count = 0;
var checked = getTimer(2000);
var timeout = checked.concat(Rx.Observable.defer(createTimeout)).skip(1);
var source = Rx.Observable.interval(250)
    .do(function () {
        count += 1;
        console.log('-----....value = ' + count + '....-----');
    })
    .map(function (v) {
        return 'Value';
    });

console.log('>>> started');
source
    .skipUntil(checked)
    .takeUntil(timeout)
    .map(function (v) {
        console.log('Subscription received value');
    }).subscribe();