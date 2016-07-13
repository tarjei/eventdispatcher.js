# eventtarget

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

## Constructor

If you inherit from `EventTarget`, you can invoke the (non-standard)
constructor with options. See `setOptions`.

## Standard methods

The following behave as with the standard `EventTarget` methods
(as possible). Options supported include the standard options, `capture`
(including expressed as a boolean), as well as `once` (which auto-removes
the listener after execution) and `passive` (which prevents the listener
from using `preventDefault` even if the event passed to the target was
`cancelable`).

-   `addEventListener(type, listener, options)` - These standard methods cannot
    prevent execution of the non-standard
    `addDefaultEventListener`/`addLateEventListener`-added methods.

-   `removeEventListener(type, listener, options)`

-   `dispatchEvent(ev)` - Will check as appropriate the event's `type`,
    `bubbles` or `cancelable` (which can all be set with invocation of the
    constructor, `Event`) or the readonly `eventPhase` and `defaultPrevented`.
    The properties `target`, `currentTarget`, `eventPhase`, and
    `defaultPrevented` will be set as appropriate.

-   `on* = function (ev) {};` (e.g., `onclick`) - Can use `return false` to
    prevent the default (but this will not stop propagation or stop immediate
    propagation as per regular JavaScript behavior (unlike jQuery which stops
    propagation)).

## Custom methods

The following are non-standard methods:

-   `setOptions` - Set custom options. Currently limited to `defaultSync` which
    can be set to `true` to execute the default behaviors even before late
    listeners and before `dispatchEvent` returns. Default listeners will
    otherwise be triggered after `setTimeout(..., 0)`.

-   `hasEventListener(type, listener, options)` - Detects whether a given event
    listener exists

-   `<add/remove/has>EarlyEventListener` - Allows maintenance of functions
    which execute prior to all other event listeners. These should generally
    not stop propagation or prevent the default behavior since that should
    normally be left up to the consumer. Note that capturing and bubbling do
    not occur for early listeners.

-   `<add/remove/has>DefaultEventListener` - Allows maintenance of functions
    which execute subsequent to all normal event listeners and which can be
    prevented via `preventDefault` (or checked via `defaultPrevented`) unless
    the event dispatched to the target is not cancelable. These events will
    not be stopped by `stopPropagation` or `stopImmediatePropagation` alone.
    (You can check the `defaultPrevented` property in these methods to
    determine whether the user has called `e.preventDefault()` and thus to
    decide whether to continue on with some default behavior.) These cannot
    use `stopPropagation` to stop execution of late event listeners (though
    they can use `stopImmediatePropagation` to prevent further execution of
    other default listeners). Note that capturing and bubbling do not occur
    for default listeners.

-   `<add/remove/has>LateEventListener` - Allows maintenance of functions
    which execute subsequent to all event listeners (unless default behaviors
    are set to run asynchronously) and which cannot be stopped. Should be
    used within implementations only to avoid unexpected behavior by
    consumers. If default event listeners fire after late listeners (when
    `defaultSync` is true), late listeners can prevent default event execution.
    Note that capturing and bubbling do not occur for late listeners.
    `stopPropagation` has no relevance (even if occurring before default
    listeners) (though `stopImmediatePropagation` may be used to prevent
    further execution of other late listeners).

## Todos

-   Provide option for early, late, and default listeners to capture and
    bubble (will need to propagate independently of normal listeners).

-   Add another type of late listener or config which executes even
    after async default?

-   Use babel and ES6 Symbols, e.g., for bubbling state, parents (or
    getParent), children (for capturing), parent names/paths, etc.
    to provide safer namespacing of properties?

-   Demo `click()` (for capturing/bubbling/propagation) and
    `submit()` (for default and default prevention) on implementations on JSON.
