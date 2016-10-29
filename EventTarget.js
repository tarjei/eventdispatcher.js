var DOMException;
(function () {
  'use strict';

  var phases = {
    NONE: 0,
    CAPTURING_PHASE: 1,
    AT_TARGET: 2,
    BUBBLING_PHASE: 3
  };

  if (typeof DOMException === 'undefined') {
    // Todo: Better polyfill (if even needed here)
    DOMException = function (msg, name) { // No need for `toString` as same as for `Error`
      var err = new Error(msg);
      err.name = name;
      return err;
    };
  }

  var ev = new WeakMap();
  var evCfg = new WeakMap();

  // Todo: Set _ev argument outside of this function
  /**
  * We use an adapter class rather than a proxy not only for compatibility but also since we have to clone
  * native event properties anyways in order to properly set `target`, etc.
  * @note The regular DOM method `dispatchEvent` won't work with this polyfill as it expects a native event
  */
  var EventPolyfill = function EventPolyfill (type, evInit, _ev) { // eslint-disable-line no-native-reassign
    if (!arguments.length) {
      throw new TypeError("Failed to construct 'Event': 1 argument required, but only 0 present.");
    }
    evInit = evInit || {};
    _ev = _ev || {};

    var _evCfg = {};
    _evCfg.type = type;
    if ('bubbles' in evInit) {
      _evCfg.bubbles = evInit.bubbles;
    }
    if ('cancelable' in evInit) {
      _evCfg.cancelable = evInit.cancelable;
    }
    if ('composed' in evInit) {
      _evCfg.composed = evInit.composed;
    }

    // _evCfg.isTrusted = true; // We are not always using this for user-created events
    // _evCfg.timeStamp = new Date().valueOf(); // This is no longer a timestamp, but monotonic (elapsed?)

    ev.set(this, _ev);
    evCfg.set(this, _evCfg);
    Object.defineProperties(this,
      ['target', 'currentTarget', 'eventPhase', 'defaultPrevented'].reduce(function (obj, prop) {
        obj[prop] = {
          get: function () {
            return (/* prop in _evCfg && */ _evCfg[prop] !== undefined) ? _evCfg[prop] : (
              prop in _ev ? _ev[prop] : (
                // Defaults
                prop === 'eventPhase' ? 0 : (prop === 'defaultPrevented' ? false : null)
              )
            );
          }
        };
        return obj;
      }, {})
    );
    var props = [
      // Event
      'type',
      'bubbles', 'cancelable', // Defaults to false
      'isTrusted', 'timeStamp',
      // Other event properties (not used by our code)
      'composedPath', 'composed', 'initEvent', 'initCustomEvent'
    ];
    if (this.toString() === '[object CustomEvent]') {
      props.push('detail');
    }

    Object.defineProperties(this, props.reduce(function (obj, prop) {
      obj[prop] = {
        get: function () {
          return prop in _evCfg ? _evCfg[prop] : (prop in _ev ? _ev[prop] : (
            ['bubbles', 'cancelable', 'composed'].indexOf(prop) > -1 ? false : undefined
          ));
        }
      };
      return obj;
    }, {}));
  };
  Object.defineProperties(EventPolyfill.prototype, {
    NONE: {writable: false, value: 0},
    CAPTURING_PHASE: {writable: false, value: 1},
    AT_TARGET: {writable: false, value: 2},
    BUBBLING_PHASE: {writable: false, value: 3}
  });
  EventPolyfill.prototype.preventDefault = function () {
    var _ev = ev.get(this);
    var _evCfg = evCfg.get(this);
    if (this.cancelable && !_evCfg._passive) {
      _evCfg.defaultPrevented = true;
      if (typeof _ev.preventDefault === 'function') { // Prevent any predefined defaults
        _ev.preventDefault();
      }
    };
  };
  EventPolyfill.prototype.stopImmediatePropagation = function () {
    var _evCfg = evCfg.get(this);
    _evCfg._stopImmediatePropagation = true;
  };
  EventPolyfill.prototype.stopPropagation = function () {
    var _evCfg = evCfg.get(this);
    _evCfg._stopPropagation = true;
  };
  EventPolyfill.prototype.toString = function () {
    return '[object Event]';
  };

  var CustomEventPolyfill = function (type, eventInitDict, _ev) {
    EventPolyfill.call(this, type, eventInitDict, _ev);
    var _evCfg = evCfg.get(this);
    _evCfg.detail = eventInitDict && typeof eventInitDict === 'object' ? eventInitDict.detail : null;
  };
  CustomEventPolyfill.prototype.toString = function () {
    return '[object CustomEvent]';
  };

  function copyEvent (ev) {
    if ('detail' in ev) {
      return new CustomEventPolyfill(ev.type, {bubbles: ev.bubbles, cancelable: ev.cancelable, detail: ev.detail}, ev);
    }
    return new EventPolyfill(ev.type, {bubbles: ev.bubbles, cancelable: ev.cancelable}, ev);
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
      // Todo: Make into event properties?
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

      var _evCfg = evCfg.get(ev);
      if (_evCfg && setTarget && _evCfg._dispatched) throw new DOMException('The object is in an invalid state.', 'InvalidStateError');

      var eventCopy;
      if (_evCfg) {
        eventCopy = ev;
      } else {
        eventCopy = copyEvent(ev);
        _evCfg = evCfg.get(eventCopy);
        _evCfg._dispatched = true;
        (this._extraProperties || []).forEach(function (prop) {
          if (prop in ev) {
            eventCopy[prop] = ev[prop]; // Todo: Put internal to `EventPolyfill`?
          }
        });
      }
      var type = eventCopy.type;

      function finishEventDispatch () {
        _evCfg.eventPhase = phases.NONE;
        _evCfg.currentTarget = null;
        delete _evCfg._children;
      }
      function invokeDefaults () {
        // Ignore stopPropagation from defaults
        _evCfg._stopImmediatePropagation = undefined;
        _evCfg._stopPropagation = undefined;
        // We check here for whether we should invoke since may have changed since timeout (if late listener prevented default)
        if (!eventCopy.defaultPrevented || !_evCfg.cancelable) { // 2nd check should be redundant
          _evCfg.eventPhase = phases.AT_TARGET; // Temporarily set before we invoke default listeners
          eventCopy.target.invokeCurrentListeners(eventCopy.target._defaultListeners, eventCopy, type);
        }
        finishEventDispatch();
      }
      function continueEventDispatch () {
        // Ignore stop propagation of user now
        _evCfg._stopImmediatePropagation = undefined;
        _evCfg._stopPropagation = undefined;
        if (!me._defaultSync) {
          setTimeout(invokeDefaults, 0);
        } else invokeDefaults();

        _evCfg.eventPhase = phases.AT_TARGET; // Temporarily set before we invoke late listeners
        // Sync default might have stopped
        if (!_evCfg._stopPropagation) {
          _evCfg._stopImmediatePropagation = undefined;
          _evCfg._stopPropagation = undefined;
          // We could allow stopPropagation by only executing upon (_evCfg._stopPropagation)
          eventCopy.target.invokeCurrentListeners(eventCopy.target._lateListeners, eventCopy, type);
        }
        finishEventDispatch();

        return !eventCopy.defaultPrevented;
      }

      if (setTarget) _evCfg.target = this;

      switch (eventCopy.eventPhase) {
        default: case phases.NONE:

          _evCfg.eventPhase = phases.AT_TARGET; // Temporarily set before we invoke early listeners
          this.invokeCurrentListeners(this._earlyListeners, eventCopy, type);
          if (!this.__getParent) {
            _evCfg.eventPhase = phases.AT_TARGET;
            return this._dispatchEvent(eventCopy, false);
          }

          var par = this;
          var root = this;
          while (par.__getParent && (par = par.__getParent()) !== null) {
            if (!_evCfg._children) {
              _evCfg._children = [];
            }
            _evCfg._children.push(root);
            root = par;
          }
          root._defaultSync = me._defaultSync;
          _evCfg.eventPhase = phases.CAPTURING_PHASE;
          return root._dispatchEvent(eventCopy, false);
        case phases.CAPTURING_PHASE:
          if (_evCfg._stopPropagation) {
            return continueEventDispatch();
          }
          this.invokeCurrentListeners(this._listeners, eventCopy, type);
          var child = _evCfg._children && _evCfg._children.length && _evCfg._children.pop();
          if (!child || child === eventCopy.target) {
            _evCfg.eventPhase = phases.AT_TARGET;
          }
          if (child) child._defaultSync = me._defaultSync;
          return (child || this)._dispatchEvent(eventCopy, false);
        case phases.AT_TARGET:
          if (_evCfg._stopPropagation) {
            return continueEventDispatch();
          }
          this.invokeCurrentListeners(this._listeners, eventCopy, type, true);
          if (!_evCfg.bubbles) {
            return continueEventDispatch();
          }
          _evCfg.eventPhase = phases.BUBBLING_PHASE;
          return this._dispatchEvent(eventCopy, false);
        case phases.BUBBLING_PHASE:
          if (_evCfg._stopPropagation) {
            return continueEventDispatch();
          }
          var parent = this.__getParent && this.__getParent();
          if (!parent) {
            return continueEventDispatch();
          }
          parent.invokeCurrentListeners(parent._listeners, eventCopy, type, true);
          parent._defaultSync = me._defaultSync;
          return parent._dispatchEvent(eventCopy, false);
      }
    },
    invokeCurrentListeners: function (listeners, eventCopy, type, checkOnListeners) {
      var _evCfg = evCfg.get(eventCopy);
      var me = this;
      _evCfg.currentTarget = this;

      var listOpts = getListenersOptions(listeners, type, {});
      var listenersByType = listOpts.listenersByType.concat();
      var dummyIPos = listenersByType.length ? 1 : 0;

      listenersByType.some(function (listenerObj, i) {
        var onListener = checkOnListeners ? me['on' + type] : null;
        if (_evCfg._stopImmediatePropagation) return true;
        if (i === dummyIPos && typeof onListener === 'function') {
          // We don't splice this in as could be overwritten; executes here per
          //  https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-attributes:event-handlers-14
          this.tryCatch(function () {
            var ret = onListener.call(eventCopy.currentTarget, eventCopy);
            if (ret === false) {
              eventCopy.preventDefault();
            }
          });
        }
        var options = listenerObj.options;
        var once = options.once; // Remove listener after invoking once
        var passive = options.passive; // Don't allow `preventDefault`
        var capture = options.capture; // Use `_children` and set `eventPhase`
        _evCfg._passive = passive;

        if ((capture && eventCopy.target !== eventCopy.currentTarget && eventCopy.eventPhase === phases.CAPTURING_PHASE) ||
          (eventCopy.eventPhase === phases.AT_TARGET ||
          (!capture && eventCopy.target !== eventCopy.currentTarget && eventCopy.eventPhase === phases.BUBBLING_PHASE))
        ) {
          var listener = listenerObj.listener;
          this.tryCatch(function () {
            listener.call(eventCopy.currentTarget, eventCopy);
          });
          if (once) {
            this.removeEventListener(type, listener, options);
          }
        }
      }, this);
      this.tryCatch(function () {
        var onListener = checkOnListeners ? me['on' + type] : null;
        if (typeof onListener === 'function' && listenersByType.length < 2) {
          var ret = onListener.call(eventCopy.currentTarget, eventCopy); // Won't have executed if too short
          if (ret === false) {
            eventCopy.preventDefault();
          }
        }
      });

      return !eventCopy.defaultPrevented;
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
      if (typeof window === 'undefined' || typeof ErrorEvent === 'undefined' || (
          window && typeof window === 'object' && !window.dispatchEvent)
      ) {
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

  // Todo: Move to own library (but allowing WeakMaps to be passed in for sharing here)
  EventTarget.EventPolyfill = EventPolyfill;
  EventTarget.CustomEventPolyfill = CustomEventPolyfill;
  EventTarget.DOMException = DOMException;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventTarget;
  } else {
    window.EventTarget = EventTarget;
  }
}());
