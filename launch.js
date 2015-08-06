var childProc = require('child_process');
childProc.exec('open -a "Google Chrome" --remote-debugging-port=9222', function () {
    console.log('done');
});