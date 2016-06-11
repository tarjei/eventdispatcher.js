# eventdispatcher.js

JavaScript events for custom objects

## Installation

### Browser

```html
<script src="EventTarget.js"></script>
```

### Node

```shell
npm install
```

```js
var EventTarget = require('eventtarget');
```

## Usage

```html
<script>

// Adding events to custom object

var Car = function () {
  this.start = function () {
    this.dispatchEvent({type: 'start', message: 'vroom vroom!'});
  };
};

Object.assign(Car.prototype, EventTarget.prototype);

// Using events

var car = new Car();

car.addEventListener('start', function (event) {
  alert(event.message);
});

car.start();

</script>
```

## Standard methods

The following behave as with the standard `EventTarget` methods
(as possible).

-   `addEventListener(type, listener)`
-   `removeEventListener(type, listener)`
-   `dispatchEvent(ev)`
-   `on* = function (ev) {};` (e.g., `onclick`)

## Custom methods

The following are non-standard methods:

-   `hasEventListener(type, listener)` - Detects whether a given event
    listener exists

-   `<add/remove/has>EarlyEventListener` - Allows maintenance of functions
    which execute prior to all other event listeners. Should be used
    within implementations only to avoid unexpected behavior by consumers.
    These should generally not stop propagation or prevent the default
    behavior since that should normally be left up to the consumer.

-   `<add/remove/has>LateEventListener` - Allows maintenance of functions
    which execute subsequent to all other event listeners. Should be used
    within implementations only to avoid unexpected behavior by consumers.

## Todos

-   Use babel and ES6 Symbols, e.g., for bubbling state, parents (or
    getParent), parent names/paths, etc.

-   `on*` to `preventDefault` with `return false`.

-   Demo `click()` (for capturing/bubbling/propagation) and
    `submit()` (for default and default prevention) on implementations on JSON.

-   Complete `<add/remove/has>earlyEventListener` and
    `<add/remove/has>LateEventListener` behaviors in `dispatchEvent`.

-   Designate and document properties for capturing/bubbling/propagation.

-   Add add/remove/has defaultEventListener
    (You can check the `defaultPrevented` property in these methods to
    determine whether the user has called `e.preventDefault()` and thus to
    decide whether to continue on with some default behavior.)
