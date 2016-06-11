var DOMException;
(function () {
  'use strict'

  if (typeof window === 'undefined') {
    DOMException = function (msg, name) {
      return new Error(name + ': ' + msg)
    }
  }

  function addListener (listeners, listener, type) {
    var listenersByType = listeners[type]
    if (listenersByType === undefined) listeners[type] = listenersByType = []

    if (listenersByType.some(function (l) {
      return l === listener
    })) return

    listenersByType.push(listener)
  }

  function removeListener (listeners, listener, type) {
    var listenersByType = listeners[type]
    if (listenersByType === undefined) return

    listenersByType.some(function (l, i) {
      if (l === listener) {
        listenersByType.splice(i, 1)
        return true
      }
    })

    if (!listenersByType.length) delete listeners[type]
  }

  function hasListener (listeners, listener, type) {
    return listeners[type] !== undefined && listeners[type].indexOf(listener) !== -1
  }

  function EventTarget () {}

  Object.assign(EventTarget.prototype, {

    // This should only be used within an implementation
    addEarlyEventListener: function (type, listener) {
      if (!this._earlyListeners) Object.defineProperty(this, '_earlyListeners', {value: {}})
      addListener(this._earlyListeners, listener, type)
    },
    // This should only be used within an implementation
    removeEarlyEventListener: function (type, listener) {
      if (!this._earlyListeners) Object.defineProperty(this, '_earlyListeners', {value: {}})
      removeListener(this._earlyListeners, listener, type)
    },
    hasEarlyEventListener: function (type, listener) {
      if (!this._earlyListeners) Object.defineProperty(this, '_earlyListeners', {value: {}})
      return hasListener(this._earlyListeners, listener, type)
    },

    // This should only be used within an implementation
    addLateEventListener: function (type, listener) {
      if (!this._lateListeners) Object.defineProperty(this, '_lateListeners', {value: {}})
      addListener(this._lateListeners, listener, type)
    },
    // This should only be used within an implementation
    removeLateEventListener: function (type, listener) {
      if (!this._lateListeners) Object.defineProperty(this, '_lateListeners', {value: {}})
      removeListener(this._lateListeners, listener, type)
    },
    hasLateEventListener: function (type, listener) {
      if (!this._lateListeners) Object.defineProperty(this, '_lateListeners', {value: {}})
      return hasListener(this._lateListeners, listener, type)
    },

    addEventListener: function (type, listener) {
      if (!this._listeners) Object.defineProperty(this, '_listeners', {value: {}})
      addListener(this._listeners, listener, type)
    },
    removeEventListener: function (type, listener) {
      if (!this._listeners) Object.defineProperty(this, '_listeners', {value: {}})
      removeListener(this._listeners, listener, type)
    },
    hasEventListener: function (type, listener) {
      if (!this._listeners) Object.defineProperty(this, '_listeners', {value: {}})
      return hasListener(this._listeners, listener, type)
    },

    dispatchEvent: function (ev) {
      if (!this._listeners) Object.defineProperty(this, '_listeners', {value: {}})
      if (!this._earlyListeners) Object.defineProperty(this, '_earlyListeners', {value: {}})
      if (!this._lateListeners) Object.defineProperty(this, '_lateListeners', {value: {}})

      if (ev._dispatched) throw new DOMException('The object is in an invalid state.', 'InvalidStateError')
      ev._dispatched = true

      var type = ev.type
      if (type == undefined || type == '') throw new DOMException('UNSPECIFIED_EVENT_TYPE_ERR', 'UNSPECIFIED_EVENT_TYPE_ERR') // eslint-disable-line eqeqeq

      var listenersByType = this._listeners[type].concat() || []

      var onListener = this['on' + type]
      var dummyIPos = listenersByType.length ? 1 : 0

      var stopImmediatePropagation = false

      // [ToDo] Use read-only properties instead of attributes when available
      ev.cancelable = true
      ev.defaultPrevented = false
      ev.isTrusted = false
      ev.preventDefault = function () {
        if (this.cancelable) this.defaultPrevented = true
      }
      ev.stopImmediatePropagation = function () {
        stopImmediatePropagation = true
      }
      ev.target = this
      ev.timeStamp = new Date().getTime()

      listenersByType.some(function (listener, i) {
        if (stopImmediatePropagation) return true
        if (i === dummyIPos && typeof onListener === 'function') {
          // We don't splice this in as could be overwritten; executes here per
          //  https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-attributes:event-handlers-14
          onListener.call(this, ev)
        }
        listener.call(this, ev)
      }, this)
      if (typeof onListener === 'function' && listenersByType.length < 2) onListener.call(this, ev) // Won't have executed if too short

      return !ev.defaultPrevented
    }
  })

  if (typeof module !== 'undefined' && module.exports) module.exports = EventTarget
  else window.EventTarget = EventTarget
}())
