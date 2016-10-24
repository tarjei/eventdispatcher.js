var DOMException, Proxy, Event;
(function () {
  'use strict';

  var EventPolyfill;
  var ProxyPolyfill;
  var phases = {
    NONE: 0,
    CAPTURING_PHASE: 1,
    AT_TARGET: 2,
    BUBBLING_PHASE: 3
  };

  if (typeof DOMException === 'undefined') {
    DOMException = function (msg, name) { // No need for `toString` as same as for `Error`
      var err = new Error(msg);
      err.name = name;
      return err;
    };
  }

  EventPolyfill = function EventPolyfill (type, evInit, ev) { // eslint-disable-line no-native-reassign
    evInit = evInit || {};
    Object.defineProperties(this, {
      type: {writable: false, value: type},
      target: {writable: false, value: null, configurable: true}, // Changeable by proxy
      currentTarget: {writable: false, value: null, configurable: true}, // Changeable by proxy
      eventPhase: {writable: false, value: 0, configurable: true}, // Changeable by proxy
      bubbles: {writable: false, value: 'bubbles' in evInit ? evInit.bubbles : false},
      cancelable: {writable: false, value: 'cancelable' in evInit ? evInit.cancelable : false},
      defaultPrevented: {writable: false, value: false, configurable: true} // Changeable by proxy
      // isTrusted: {writable: false, value: true}, // We are not always using this for user-created events
      // timeStamp: {writable: false, value: new Date().valueOf()} // This is no longer a timestamp, but monotonic (elapsed?)
    });
  };
  Object.defineProperties(EventPolyfill.prototype, {
    NONE: {writable: false, value: 0},
    CAPTURING_PHASE: {writable: false, value: 1},
    AT_TARGET: {writable: false, value: 2},
    BUBBLING_PHASE: {writable: false, value: 3}
  });
  EventPolyfill.prototype.toString = function () {
    return '[object Event]';
  };

  function copyEvent (ev) {
    return new EventPolyfill(ev.type, {bubbles: ev.bubbles, cancelable: ev.cancelable});
  }

  if (typeof Proxy === 'undefined') { // Remove when Proxies well supported: http://caniuse.com/#feat=proxy
    Proxy = ProxyPolyfill = function ProxyPolyfill (ev /* , handler*/) {
      this._ev = ev;
      Object.defineProperties(this,
        ['target', 'currentTarget', 'eventPhase', 'defaultPrevented'].reduce(function (obj, prop) {
          obj[prop] = {get: function () {
            return (('_' + prop) in this && this['_' + prop] !== undefined) ? this['_' + prop] : this._ev[prop];
          }, set: function (val) {
            this['_' + prop] = val;
          }};
          obj['_' + prop] = {enumerable: false, writable: true};
          return obj;
        }, {})
      );
      Object.defineProperties(this,
        [
          // Event
          'type', 'NONE', 'CAPTURING_PHASE', 'AT_TARGET', 'BUBBLING_PHASE',
          'bubbles', 'cancelable', 'isTrusted', 'timeStamp',
          // Other event properties (not used by our code)
          'composedPath', 'composed', 'initEvent',
          // CustomEvent
          'detail'
        ].reduce(function (obj, prop) {
          obj[prop] = {get: function () {
            return this._ev[prop];
          }, set: function (val) {
            this._ev[prop] = val;
          }};
          return obj;
        }, {})
      );
    };
    Proxy.prototype.preventDefault = function () { // eslint-disable-line no-extend-native
      if (typeof this._ev.preventDefault === 'function') {
        this._ev.preventDefault();
        return;
      }
      if (this.cancelable && !this._passive) this.defaultPrevented = true;
    };
    Proxy.prototype.stopImmediatePropagation = function () { // eslint-disable-line no-extend-native
      this._stopImmediatePropagation = true;
    };
    Proxy.prototype.stopPropagation = function () { // eslint-disable-line no-extend-native
      this._stopPropagation = true;
    };
  }

  function getListenersOptions (listeners, type, options) {
    var listenersByType = listeners[type];
    if (listenersByType === undefined) listeners[type] = listenersByType = [];
    options = typeof options === 'boolean' ? {capture: options} : (options || {});
    var stringifiedOptions = JSON.stringify(options);
    var listenersByTypeOptions = listenersByType.filter(function (obj) {
      return stringifiedOptions === JSON.stringify(obj.options);
    });
    return {listenersByTypeOptions: listenersByTypeOptions, options: options, listenersByType: listenersByType};
  }

  var methods = {
    addListener: function addListener (listeners, listener, type, options) {
      var listenerOptions = getListenersOptions(listeners, type, options);
      var listenersByTypeOptions = listenerOptions.listenersByTypeOptions;
      options = listenerOptions.options;
      var listenersByType = listenerOptions.listenersByType;

      if (listenersByTypeOptions.some(function (l) {
        return l.listener === listener;
      })) return;
      listenersByType.push({listener: listener, options: options});
    },

    removeListener: function removeListener (listeners, listener, type, options) {
      var listenerOptions = getListenersOptions(listeners, type, options);
      var listenersByType = listenerOptions.listenersByType;
      var stringifiedOptions = JSON.stringify(listenerOptions.options);

      listenersByType.some(function (l, i) {
        if (l.listener === listener && stringifiedOptions === JSON.stringify(l.options)) {
          listenersByType.splice(i, 1);
          if (!listenersByType.length) delete listeners[type];
          return true;
        }
      });
    },

    hasListener: function hasListener (listeners, listener, type, options) {
      var listenerOptions = getListenersOptions(listeners, type, options);
      var listenersByTypeOptions = listenerOptions.listenersByTypeOptions;
      return listenersByTypeOptions.some(function (l) {
        return l.listener === listener;
      });
    }
  };

  function EventTarget (customOptions) {
    this.__setOptions(customOptions);
  }

  Object.assign(EventTarget.prototype, ['Early', '', 'Late', 'Default'].reduce(function (obj, listenerType) {
    ['add', 'remove', 'has'].forEach(function (method) {
      obj[method + listenerType + 'EventListener'] = function (type, listener, options) {
        if (arguments.length < 2) throw new TypeError('2 or more arguments required');
        if (typeof type !== 'string') throw new DOMException('UNSPECIFIED_EVENT_TYPE_ERR', 'UNSPECIFIED_EVENT_TYPE_ERR'); // eslint-disable-line eqeqeq
        if (listener.handleEvent) { listener = listener.handleEvent.bind(listener); }
        var arrStr = '_' + listenerType.toLowerCase() + (listenerType === '' ? 'l' : 'L') + 'isteners';
        if (!this[arrStr]) Object.defineProperty(this, arrStr, {value: {}});
        return methods[method + 'Listener'](this[arrStr], listener, type, options);
      };
    });
    return obj;
  }, {}));

  Object.assign(EventTarget.prototype, {
    __setOptions: function (customOptions) {
      customOptions = customOptions || {};
      this._defaultSync = customOptions.defaultSync;
      this._extraProperties = customOptions.extraProperties;
    },
    dispatchEvent: function (ev) {
      return this._dispatchEvent(ev, true);
    },
    _dispatchEvent: function (ev, setTarget) {
      var me = this;
      ['early', '', 'late', 'default'].forEach(function (listenerType) {
        var arrStr = '_' + listenerType + (listenerType === '' ? 'l' : 'L') + 'isteners';
        if (!this[arrStr]) Object.defineProperty(this, arrStr, {value: {}});
      }, this);

      if (setTarget && ev._dispatched) throw new DOMException('The object is in an invalid state.', 'InvalidStateError');
      ev._dispatched = true;

      var type = ev.type;
      if (!type || typeof type !== 'string') throw new TypeError('Invalid type');

      var handler = {
        // Avoid readonly
        get: function (ev, prop) {
          if (['preventDefault', 'stopImmediatePropagation', 'stopPropagation'].includes(prop)) {
            switch (prop) {
              case 'preventDefault': // Doesn't affect propagation
                return typeof ev[prop] === 'function' ? ev[prop] : function () {
                  if (eventProxy.cancelable && !eventProxy._passive) {
                    eventProxy.defaultPrevented = true;
                  }
                };
              case 'stopImmediatePropagation': // Doesn't affect default
                return function () {
                  eventProxy._stopImmediatePropagation = true;
                };
              case 'stopPropagation':
                return function () { // Doesn't affect default
                  eventProxy._stopPropagation = true;
                };
            }
          }
          if (['target', 'currentTarget', 'eventPhase', 'defaultPrevented'].includes(prop) && ('_' + prop) in ev) {
            return ev['_' + prop];
          }
          return ev[prop];
        },
        set: function (ev, prop, value) {
          if (['target', 'currentTarget', 'eventPhase', 'defaultPrevented'].includes(prop)) {
            ev['_' + prop] = value;
          } else {
            ev[prop] = value;
          }
          return true;
        }
      };
      var eventProxy;
      if (ev.isProxified) {
        eventProxy = ev;
      } else {
        eventProxy = new Proxy(copyEvent(ev), handler);
        eventProxy.isProxified = true;
        [
          'target', 'currentTarget', 'defaultPrevented',
          'isTrusted', 'timeStamp',
          // Other event properties (not used by our code)
          'composedPath', 'composed', 'initEvent',
          // CustomEvent
          'detail',
          // Our own properties
          '_dispatched', '_stopImmediatePropagation', '_stopPropagation'
        ].concat(this._extraProperties || []).forEach(function (prop) {
          if (prop in ev) {
            eventProxy[prop] = ev[prop];
          }
        });
      }

      function finishEventDispatch () {
        eventProxy.eventPhase = phases.NONE;
        eventProxy.currentTarget = null;
      }
      function invokeDefaults () {
        // Ignore stopPropagation from defaults
        eventProxy._stopImmediatePropagation = undefined;
        eventProxy._stopPropagation = undefined;
        // We check here for whether we should invoke since may have changed since timeout (if late listener prevented default)
        if (!eventProxy.defaultPrevented || !eventProxy.cancelable) { // 2nd check should be redundant
          eventProxy.eventPhase = phases.AT_TARGET; // Temporarily set before we invoke default listeners
          eventProxy.target.invokeCurrentListeners(eventProxy.target._defaultListeners, eventProxy, type);
        }
        finishEventDispatch();
      }
      function continueEventDispatch () {
        // Ignore stop propagation of user now
        eventProxy._stopImmediatePropagation = undefined;
        eventProxy._stopPropagation = undefined;
        if (!me._defaultSync) {
          setTimeout(invokeDefaults, 0);
        } else invokeDefaults();

        eventProxy.eventPhase = phases.AT_TARGET; // Temporarily set before we invoke late listeners
        // Sync default might have stopped
        if (!eventProxy._stopPropagation) {
          eventProxy._stopImmediatePropagation = undefined;
          eventProxy._stopPropagation = undefined;
          // We could allow stopPropagation by only executing upon (eventProxy._stopPropagation)
          eventProxy.target.invokeCurrentListeners(eventProxy.target._lateListeners, eventProxy, type);
        }
        finishEventDispatch();

        return !eventProxy.defaultPrevented;
      }

      if (setTarget) eventProxy.target = this;

      switch (eventProxy.eventPhase) {
        default: case phases.NONE:

          eventProxy.eventPhase = phases.AT_TARGET; // Temporarily set before we invoke early listeners
          this.invokeCurrentListeners(this._earlyListeners, eventProxy, type);
          if (!this.__getParent) {
            eventProxy.eventPhase = phases.AT_TARGET;
            return this._dispatchEvent(eventProxy, false);
          }

          var par = this;
          var root = this;
          while (par.__getParent && (par = par.__getParent()) !== null) {
            par._child = root;
            root = par;
          }
          root._defaultSync = me._defaultSync;
          eventProxy.eventPhase = phases.CAPTURING_PHASE;
          return root._dispatchEvent(eventProxy, false);
        case phases.CAPTURING_PHASE:
          if (eventProxy._stopPropagation) {
            return continueEventDispatch();
          }
          this.invokeCurrentListeners(this._listeners, eventProxy, type);
          var child = this._child;
          if (!child || child === eventProxy.target) {
            eventProxy.eventPhase = phases.AT_TARGET;
          }
          if (child) child._defaultSync = me._defaultSync;
          return (child || this)._dispatchEvent(eventProxy, false);
        case phases.AT_TARGET:
          if (eventProxy._stopPropagation) {
            return continueEventDispatch();
          }
          this.invokeCurrentListeners(this._listeners, eventProxy, type, true);
          if (!eventProxy.bubbles) {
            return continueEventDispatch();
          }
          eventProxy.eventPhase = phases.BUBBLING_PHASE;
          return this._dispatchEvent(eventProxy, false);
        case phases.BUBBLING_PHASE:
          if (eventProxy._stopPropagation) {
            return continueEventDispatch();
          }
          var parent = this.__getParent && this.__getParent();
          if (!parent) {
            return continueEventDispatch();
          }
          parent.invokeCurrentListeners(parent._listeners, eventProxy, type, true);
          parent._defaultSync = me._defaultSync;
          return parent._dispatchEvent(eventProxy, false);
      }
    },
    invokeCurrentListeners: function (listeners, eventProxy, type, checkOnListeners) {
      var me = this;
      eventProxy.currentTarget = this;

      var listOpts = getListenersOptions(listeners, type, {});
      var listenersByType = listOpts.listenersByType.concat();
      var dummyIPos = listenersByType.length ? 1 : 0;

      listenersByType.some(function (listenerObj, i) {
        var onListener = checkOnListeners ? me['on' + type] : null;
        if (eventProxy._stopImmediatePropagation) return true;
        if (i === dummyIPos && typeof onListener === 'function') {
          // We don't splice this in as could be overwritten; executes here per
          //  https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-attributes:event-handlers-14
          this.tryCatch(function () {
            var ret = onListener.call(eventProxy.currentTarget, eventProxy);
            if (ret === false) {
              eventProxy.preventDefault();
            }
          });
        }
        var options = listenerObj.options;
        var once = options.once; // Remove listener after invoking once
        var passive = options.passive; // Don't allow `preventDefault`
        var capture = options.capture; // Use `_child` and set `eventPhase`
        eventProxy._passive = passive;

        if ((capture && eventProxy.target !== eventProxy.currentTarget && eventProxy.eventPhase === phases.CAPTURING_PHASE) ||
          (eventProxy.eventPhase === phases.AT_TARGET ||
          (!capture && eventProxy.target !== eventProxy.currentTarget && eventProxy.eventPhase === phases.BUBBLING_PHASE))
        ) {
          var listener = listenerObj.listener;
          this.tryCatch(function () {
            listener.call(eventProxy.currentTarget, eventProxy);
          });
          if (once) {
            this.removeEventListener(type, listener, options);
          }
        }
      }, this);
      this.tryCatch(function () {
        var onListener = checkOnListeners ? me['on' + type] : null;
        if (typeof onListener === 'function' && listenersByType.length < 2) {
          var ret = onListener.call(eventProxy.currentTarget, eventProxy); // Won't have executed if too short
          if (ret === false) {
            eventProxy.preventDefault();
          }
        }
      });

      return !eventProxy.defaultPrevented;
    },
    tryCatch: function (cb) {
      try {
        // Per MDN: Exceptions thrown by event handlers are reported
        //  as uncaught exceptions; the event handlers run on a nested
        //  callstack: they block the caller until they complete, but
        //  exceptions do not propagate to the caller.
        cb();
      } catch (err) {
        this.triggerErrorEvent(err);
      }
    },
    triggerErrorEvent: function (err) {
      var error = err;
      if (typeof err === 'string') {
        error = new Error('Uncaught exception: ' + err);
      } else {
        error.message = 'Uncaught exception: ' + err.message;
      }

      var triggerGlobalErrorEvent;
      if (typeof window === 'undefined') {
        triggerGlobalErrorEvent = function () {
          setTimeout(function () { // Node won't be able to catch in this way if we throw in the main thread
            // console.log(err); // Should we auto-log for user?
            throw error; // Let user listen to `process.on('uncaughtException', function(err) {});`
          });
        };
      } else {
        triggerGlobalErrorEvent = function () {
          // See https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onerror
          //   and https://github.com/w3c/IndexedDB/issues/49

          // Note that a regular Event will properly trigger
          //   `window.addEventListener('error')` handlers, but it will not trigger
          //   `window.onerror` as per https://html.spec.whatwg.org/multipage/webappapis.html#handler-onerror
          // Note also that the following line won't handle `window.addEventListener` handlers
          //    if (window.onerror) window.onerror(error.message, err.fileName, err.lineNumber, error.columnNumber, error);

          // `ErrorEvent` properly triggers `window.onerror` and `window.addEventListener('error')` handlers
          var ev = new ErrorEvent('error', {
            error: err,
            message: error.message || '',
            // We can't get the actually useful user's values!
            filename: error.fileName || '',
            lineno: error.lineNumber || 0,
            colno: error.columnNumber || 0
          });
          window.dispatchEvent(ev);
          // console.log(err); // Should we auto-log for user?
        };
      }
      if (this.__userErrorEventHandler) {
        this.__userErrorEventHandler(error, triggerGlobalErrorEvent);
      } else {
        triggerGlobalErrorEvent();
      }
    }
  });

  EventTarget.Event = Event;
  EventTarget.EventPolyfill = EventPolyfill;
  EventTarget.ProxyPolyfill = ProxyPolyfill;
  EventTarget.DOMException = DOMException;
  EventTarget.Error = Error;
  EventTarget.TypeError = TypeError;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventTarget;
  } else {
    window.EventTarget = EventTarget;
  }
}());
