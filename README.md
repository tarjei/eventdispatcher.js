# eventtarget

Add familiar, standard JavaScript event handling methods for custom objects based on
[EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget).

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
constructor with options. See `__setOptions`.

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

Note that if an error throws within one of the listeners, an `ErrorEvent` will
be dispatched to `window` as expected, or, if on Node, you can listen instead
for `uncaughtException`. Alternatively, you may implement your own
`__userErrorEventHandler` method (see below).

## Custom methods

The following are non-standard methods:

-   `__setOptions(optsObject)` - Set custom options. Currently limited to
    `defaultSync` which can be set to `true` to execute the default behaviors
    even before late listeners and before `dispatchEvent` returns. Default
    listeners will otherwise be triggered after `setTimeout(..., 0)`.

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

-   `__getParent` - This method can be implemented by consumers to support
    hierarchical events (those with bubbling and/or capturing). Should
    itself return an `EventTarget` object.

-   `__userErrorEventHandler(errorObj, triggerGlobalErrorEventCb)` - This
    method can be implemented by consumers to override the default behavior
    relating to triggering of a global `ErrorEvent` upon encountering exceptions
    within handlers. Will be passed an object representing the thrown error
    and a callback which can be invoked to trigger the usual global `ErrorEvent`
    behavior. An example usage is for an IndexedDB transaction object which must
    abort a transaction upon encountering an error in a user event handler. This
    method could be used to implement the aborting or it could merely rethrow
    the error object passed to it and allow the internal consuming code to
    catch it and abort the transaction. If using this handler, you should ideally
    use a flag in your calling code and utilize that in this handler in order to
    distinguish between your own specific internal error events and those dispatched
    by users in their own `dispatchEvent` calls (which shouldn't ever throw
    as that would be non-standard for the real `EventTarget`).

## Possible to-dos

-   See `todo`'s' within code.

-   Option to set global `event` (Does this redefine or alter the object for capturing, bubbling, etc.?)

-   Support `worker.onerror`

-   Allow `__getParent` to return a promise to allow async bubbling

-   Consider refactoring so that all methods (as with properties) are private and
    all early/late/default listeners, parent retrieval, and option setting are
    done dynamically at class creation time or, alternatively, at any time via
    ES6 Symbols (Babel) which are somewhat more "safely" namespaced. Remove
    `hasEventListener` as it is necessarily run-time and non-standard.

-   Add `getEventHandler` and `setEventHandler` methods (ala Mozilla)?

-   Provide option for early, late, and default listeners to capture and
    bubble (will need to propagate independently of normal listeners)?

-   Add another type of late listener or config which executes even
    after async default?

-   Demo `click()` (for capturing/bubbling/propagation) and
    `submit()` (for default and default prevention) on implementations on JSON.
