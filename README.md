# operate

[![NPM](https://img.shields.io/npm/v/operate.svg?maxAge=2592000&style=flat-square)](https://www.npmjs.com/package/operate)
[![License](https://img.shields.io/npm/l/operate.svg?style=flat-square)](https://github.com/daluege/operate/blob/master/LICENSE)
[![Build status](https://img.shields.io/travis/daluege/operate/master.svg?style=flat-square)](https://travis-ci.org/daluege/operate)
[![GitHub issues](https://img.shields.io/github/issues/daluege/operate.svg?style=flat-square)](https://github.com/daluege/operate/issues)

## Installation

Install this package using NPM:

    npm install operate

## Examples

For a primer on zones, review the [Dart](https://www.dartlang.org/articles/libraries/zones) introduction.

### General concept

```javascript
const operate = require('operate');
const fs = require('fs');

var fileContent = null;

// An application that does multiple unknown asynchronous operations
function application() {
  function readFile () {
    // Read file asynchronously
    fs.readFile('data.txt', function callback (data) {
      fileContent = data;
    });
  }
  // Wait for 1 second and then start a request
  setTimeout(readFile, 1000);
}

operate(application).then(
  function () {
    console.log('This file content has been read: ' + fileContent);
  }
).catch(
  function (error) {
    console.log('Either setTimeout or fs.readFile threw an uncatched error');
  }
);
```

### Run untrusted code asynchronously

```javascript
const vm = require('vm');

var sandbox = {
  setTimeout,
  setInterval,
  setImmediate,
  print: console.log
};

// Use operate and vm to run a program in an isolated environment
operate(
  function () {
    vm.runInNewContext(applicationCode, sandbox);
  }
).then(
  function () { console.log('Terminated successfully'); }
).catch(
  function (error) { console.log('An error occurred'); }
);
```

### Terminate a zone from outside

```javascript
var zone = operate(application);

// Cancel all pending events after 1 minute

setTimeout(function () {
  zone.cancel();
}, 60000);

// If node is stalling due to pending tasks in the operating zone,
// zone.cancel() will unstall it.
```

### Executing zones parallely

```javascript
Promise.all(
  operate(app1),
  operate(app2),
  operate(app3)
).then(
  function() { console.log('All tasks have concluded successfully'); }
).catch(
  function() { console.log('An error occurred'); }
);
```

### Run untrusted applications in non-blocking mode

```javascript
// Run a huge number of untrusted applications in non-blocking mode
for (var i = 0; i < applications.length; i++) {
  operate(applications[i], { blocking: false });
}

function application () {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "data.txt", false);
  } catch (error) {
    console.log(error); // Error: No permission to execute the synchronous system operation XMLHttpRequest.open
  }

  try {
    var xhr = fs.readfileSync('data.txt');
  } catch (error) {
    console.log(error); // Error: No permission to execute the synchronous system operation fs.readFileSync
  }
}

operate(application);
```

## License

MIT © 2016 ([see full text](./LICENSE))
