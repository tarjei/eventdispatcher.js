/*globals expect*/
/* eslint-env node, mocha */
var testTypesArr;
if (typeof Event !== 'undefined') {
  testTypesArr = ['polyfill', 'nativeEvent'];
} else {
  testTypesArr = ['polyfill'];
}

testTypesArr.forEach(function (evClass) {
  function newEvent (type, evInit) {
    return (evClass === 'nativeEvent'
      ? new Event(type, evInit) // This event will either be the native or, for Node, our exported shim
      : new EventTarget.EventPolyfill(type, evInit)); // This event will either be the native or, for Node, our exported shim
  }

  function Car () {}
  Car.prototype.start = function (init) {
    var ev = newEvent('start', init);
    this.dispatchEvent(ev);
  };
  Car.prototype.fire = function (type, init) {
    var ev = newEvent(type, init);
    this.dispatchEvent(ev);
  };
  Object.assign(Car.prototype, EventTarget.prototype);

  var capturedCategories = [];
  var bubbledCategories = [];
  function CategoryTree (name, childCategories) {
    this.name = name;
    this.children = [];
    this.addEventListener('capt', function () {
      capturedCategories.push(name);
    }, true);
    this.addEventListener('bubbl', function () {
      bubbledCategories.push(name);
    });
    (childCategories || []).forEach(function (childCategory) {
      var childTree = new CategoryTree(childCategory[0], childCategory[1]);
      childTree._parent = this;
      this.children.push(childTree);
    }, this);
  }
  CategoryTree.prototype.capture = function () {
    var ev = newEvent('capt', {cancelable: true});
    this.dispatchEvent(ev);
  };
  CategoryTree.prototype.bubble = function () {
    var ev = newEvent('bubbl', {bubbles: true, cancelable: true});
    this.dispatchEvent(ev);
  };
  CategoryTree.prototype.__getParent = function () {
    return this._parent || null;
  };
  Object.assign(CategoryTree.prototype, EventTarget.prototype);

  describe('EventTarget (' + evClass + ')', function () {
    beforeEach(function () {
      capturedCategories = [];
      bubbledCategories = [];
    });
    describe('addEventListener', function () {
      it('should throw properly with invalid arguments', function () {
        expect(function () {
          var car = new Car();
          car.addEventListener('sometype');
        }).to.throw(TypeError, /2 or more arguments required/);
        var car = new Car();
        // DOMException doesn't seem to work with expect().to.throw
        try {
          car.addEventListener(null, function (event) {});
        } catch (err) {
          expect(err instanceof (typeof DOMException !== 'undefined' ? DOMException : Error)).to.be.true;
          expect(err.message).equal('UNSPECIFIED_EVENT_TYPE_ERR');
        }
      });
      it('should allow firing then removal of listener via `once` option', function () {
        var car = new Car();
        var func = function () {};
        expect(car.hasEventListener('start', func, { once: true })).to.be.false;

        car.addEventListener('start', func, {once: true});

        expect(car.hasEventListener('start', func, { once: true })).to.be.true;
        car.start();
        expect(car.hasEventListener('start', func, { once: true })).to.be.false;
      });
      it('should not remove the listener if `once` is not set', function () {
        var car = new Car();
        var func = function () {};
        expect(car.hasEventListener('start', func)).to.be.false;

        car.addEventListener('start', func);

        expect(car.hasEventListener('start', func)).to.be.true;
        car.start();
        expect(car.hasEventListener('start', func)).to.be.true;
      });
      it('should not fire multiple times with a single event dispatch', function () {
        var car = new Car();
        var ct = 0;
        var func = function () {
          ct++;
        };
        car.addEventListener('start', func);
        car.start();
        expect(ct).equal(1);
      });
      it('should fire multiple times with the same or different events', function () {
        var car = new Car();
        var ct = 0;
        var func = function () {
          ct++;
        };
        car.addEventListener('start', func);
        car.start();
        car.start({bubbles: true, cancelable: true});
        car.start();
        expect(ct).equal(3);
      });

      it('should add distinct copies if different in type, listener, or options', function () {
        var car = new Car();

        var type1 = 'something1';
        var type2 = 'something2';

        var ct1 = 0;
        var ct2 = 0;
        var func1 = function () {
          ct1++;
        };
        var func2 = function () {
          ct2++;
        };

        var options1 = {passive: true};
        var options2 = {passive: false};

        expect(car.hasEventListener(type1, func1)).to.be.false;
        expect(car.hasEventListener(type2, func2)).to.be.false;

        car.addEventListener(type1, func1);
        car.addEventListener(type2, func2);

        expect(car.hasEventListener(type1, func1)).to.be.true;
        expect(car.hasEventListener(type2, func2)).to.be.true;

        car.fire(type1);
        expect(ct1).equal(1);
        expect(ct2).equal(0);

        car.fire(type2);
        expect(ct1).equal(1);
        expect(ct2).equal(1);

        car.addEventListener(type1, func1, options1);
        car.addEventListener(type1, func1, options2);
        car.fire(type1);
        expect(ct1).equal(4);
      });
      it('should not add duplicate copies of the same listener', function () {
        var car = new Car();
        var ct = 0;
        var func = function () {
          ct++;
        };
        car.addEventListener('start', func);
        car.addEventListener('start', func);
        car.start();
        expect(ct).equal(1);
      });
    });
    describe('removeEventListener', function () {
      it('should throw properly with invalid arguments', function () {
        expect(function () {
          var car = new Car();
          car.removeEventListener('sometype');
        }).to.throw(TypeError, /2 or more arguments required/);
        // DOMException doesn't seem to work with expect().to.throw
        var car = new Car();
        try {
          car.removeEventListener(null, function (event) {});
        } catch (err) {
          expect(err instanceof (typeof DOMException !== 'undefined' ? DOMException : Error)).to.be.true;
          expect(err.message).equal('UNSPECIFIED_EVENT_TYPE_ERR');
        }
      });
      it('should successfully remove added listener of same type, options, and listener', function () {
        var car = new Car();
        var func = function () {};

        expect(car.hasEventListener('start', func)).to.be.false;
        car.addEventListener('start', func);
        expect(car.hasEventListener('start', func)).to.be.true;
        car.removeEventListener('start', func);
        expect(car.hasEventListener('start', func)).to.be.false;

        expect(car.hasEventListener('start', func, {once: true})).to.be.false;
        car.addEventListener('start', func, {once: true});
        expect(car.hasEventListener('start', func, {once: true})).to.be.true;
        car.removeEventListener('start', func, {once: true});
        expect(car.hasEventListener('start', func, {once: true})).to.be.false;

        expect(car.hasEventListener('start', func, {capture: true, passive: false})).to.be.false;
        car.addEventListener('start', func, {capture: true, passive: false});
        expect(car.hasEventListener('start', func, {capture: true, passive: false})).to.be.true;
        car.removeEventListener('start', func, {capture: true, passive: false});
        expect(car.hasEventListener('start', func, {capture: true, passive: false})).to.be.false;
      });
      it('should not remove added listener of different type', function () {
        var car = new Car();
        var type1 = 'something1';
        var type2 = 'something2';
        var func1 = function () {};

        expect(car.hasEventListener(type1, func1)).to.be.false;
        expect(car.hasEventListener(type2, func1)).to.be.false;
        car.addEventListener(type1, func1);
        car.addEventListener(type2, func1);
        expect(car.hasEventListener(type1, func1)).to.be.true;
        expect(car.hasEventListener(type2, func1)).to.be.true;
        car.removeEventListener(type2, func1);
        expect(car.hasEventListener(type1, func1)).to.be.true;
        expect(car.hasEventListener(type2, func1)).to.be.false;
      });
      it('should not remove added listener of different listener or options', function () {
        var car = new Car();
        var type1 = 'something1';
        var func1 = function () {};
        var func2 = function () {};
        var options1 = {passive: true};
        var options2 = {passive: false};

        expect(car.hasEventListener(type1, func1)).to.be.false;
        expect(car.hasEventListener(type1, func2)).to.be.false;
        car.addEventListener(type1, func1);
        car.addEventListener(type1, func2);
        expect(car.hasEventListener(type1, func1)).to.be.true;
        expect(car.hasEventListener(type1, func2)).to.be.true;
        car.removeEventListener(type1, func1);
        expect(car.hasEventListener(type1, func1)).to.be.false;
        expect(car.hasEventListener(type1, func2)).to.be.true;

        expect(car.hasEventListener(type1, func1, options1)).to.be.false;
        expect(car.hasEventListener(type1, func1, options2)).to.be.false;
        car.addEventListener(type1, func1, options1);
        car.addEventListener(type1, func1, options2);
        expect(car.hasEventListener(type1, func1, options1)).to.be.true;
        expect(car.hasEventListener(type1, func1, options2)).to.be.true;
        car.removeEventListener(type1, func1, options1);
        expect(car.hasEventListener(type1, func1, options1)).to.be.false;
        expect(car.hasEventListener(type1, func1, options2)).to.be.true;
      });
    });
    describe('dispatchEvent', function () {
      it('should throw properly with invalid arguments', function () {
        var car = new Car();
        try {
          car.fire();
        } catch (err) {
          expect(err instanceof TypeError).to.be.true;
          expect(err.message).equal('Invalid type');
        }
        try {
          car.fire(5);
        } catch (err) {
          expect(err instanceof TypeError).to.be.true;
          expect(err.message).equal('Invalid type');
        }
      });
      it('should throw properly with events dispatched multiple times', function () {
        // DOMException doesn't seem to work with expect().to.throw
        var car = new Car();
        var ev = newEvent('something');
        car.dispatchEvent(ev);
        try {
          car.dispatchEvent(ev);
        } catch (err) {
          expect(err instanceof (typeof DOMException !== 'undefined' ? DOMException : Error)).to.be.true;
          expect(err.name).equal('InvalidStateError');
        }
      });
      it('should get proper event properties and `this` value', function (done) {
        var car = new Car();
        car.addEventListener('start', function (ev) {
          expect(ev.type).equal('start');

          expect(ev.target).equal(car);
          expect(ev.currentTarget).equal(car);

          expect(ev.NONE).equal(0);
          expect(ev.CAPTURING_PHASE).equal(1);
          expect(ev.AT_TARGET).equal(2);
          expect(ev.BUBBLING_PHASE).equal(3);
          expect(ev.eventPhase).equal(2);

          expect(ev.bubbles).equal(false);
          expect(ev.cancelable).equal(false);
          expect(ev.defaultPrevented).equal(false);
          expect(this).equal(car);
          done();
        });
        car.start();
      });
      it('should get proper bubbles and cancelable event properties when set', function (done) {
        var car = new Car();
        car.addEventListener('start', function (event) {
          expect(event.bubbles).equal(true);
          expect(event.cancelable).equal(true);
          done();
        });
        car.start({bubbles: true, cancelable: true});
      });
      it('should execute multiple listeners of the same type on the same target, regardless of capturing', function () {
        var car = new Car();
        var actual = [];
        var expected = [1, 2, 3];
        car.addEventListener('start', function (event) {
          actual.push(1);
        });
        car.addEventListener('start', function (event) {
          actual.push(2);
        });
        car.addEventListener('start', function (event) {
          actual.push(3);
        }, {capture: true});
        car.start();
        expect(actual).to.deep.equal(expected);
      });
      describe('Propagation (bubbling, capturing, and stopping propagation)', function () {
        it('should allow bubbling events without hierarchical functions and behavior', function (done) {
          var car = new Car();
          car.addEventListener('start', function (event) {
            expect(event.eventPhase).equal(2);
            done();
          });
          car.start({bubbles: true});
        });
        it('should propagate down a capturing chain', function () {
          var expected = ['root', 'childB', 'grandchildB1'];
          var catTree = new CategoryTree('root', [
            ['childA', [['grandchildA1'], ['grandchildA2']]],
            ['childB', [['grandchildB1'], ['grandchildB2']]]
          ]);
          catTree.children[1].children[0].capture(); // 'grandchildB1'
          expect(capturedCategories).deep.equal(expected);
        });
        it('should capture whether `capture` option stated as boolean or object property', function (done) {
          var parent = {__getParent: function () { return null; }};
          var child = {
            __getParent: function () {
              return parent;
            }
          };
          Object.assign(parent, EventTarget.prototype);
          Object.assign(child, EventTarget.prototype);
          var caught1 = false;
          parent.addEventListener('type1', function () {
            caught1 = true;
          }, true);
          parent.addEventListener('type1', function () {
            expect(caught1).equal(true);
            done();
          }, {capture: true});
          var ev = newEvent('type1');
          child.dispatchEvent(ev);
        });
        it('should allow bubbling in order up a parent chain', function () {
          var expected = ['grandchildB1', 'childB', 'root'];
          var catTree = new CategoryTree('root', [
            ['childA', [['grandchildA1'], ['grandchildA2']]],
            ['childB', [['grandchildB1'], ['grandchildB2']]]
          ]);
          catTree.children[1].children[0].bubble(); // 'grandchildB1'
          expect(bubbledCategories).deep.equal(expected);
        });
        it('should allow stopping immediate propagation', function (done) {
          var car = new Car();
          var actual = [];
          var expected = [1, 2];
          car.addEventListener('start', function (e) {
            actual.push(1);
          });
          car.addEventListener('start', function (e) {
            e.stopImmediatePropagation();
            actual.push(2);
          }, {capture: true});
          car.addEventListener('start', function (e) {
            actual.push(3);
          });
          car.addLateEventListener('start', function (e) {
            expect(actual).to.deep.equal(expected);
            done();
          });
          car.start();
        });
        it('should allow stopping propagation during capture', function (done) {
          var expected = ['root', 'childB'];
          var catTree = new CategoryTree('root', [
            ['childA', [['grandchildA1'], ['grandchildA2']]],
            ['childB', [['grandchildB1'], ['grandchildB2']]]
          ]);
          catTree.children[1].addEventListener('capt', function (e) {
            e.stopPropagation();
          }, true);
          catTree.children[1].children[0].addLateEventListener('capt', function () {
            expect(capturedCategories).deep.equal(expected);
            done();
          }, true);
          catTree.children[1].children[0].capture(); // 'grandchildB1'
        });
        it('should allow stopping propagation during bubbling', function (done) {
          var expected = ['grandchildB1', 'childB'];
          var catTree = new CategoryTree('root', [
            ['childA', [['grandchildA1'], ['grandchildA2']]],
            ['childB', [['grandchildB1'], ['grandchildB2']]]
          ]);
          catTree.children[1].addEventListener('bubbl', function (e) {
            e.stopPropagation();
          });
          catTree.children[1].children[0].addLateEventListener('bubbl', function () {
            expect(bubbledCategories).deep.equal(expected);
            done();
          });
          catTree.children[1].children[0].bubble(); // 'grandchildB1'
        });
        it('should get proper target, currentTarget, and eventPhase event properties when set', function (done) {
          var grandparent = {__getParent: function () { return null; }};
          var parent = {__getParent: function () { return grandparent; }};
          var child = {
            __getParent: function () {
              return parent;
            }
          };
          var caught1 = false;
          var caught2 = false;
          var caught3 = false;
          Object.assign(grandparent, EventTarget.prototype);
          Object.assign(parent, EventTarget.prototype);
          Object.assign(child, EventTarget.prototype);
          grandparent.addEventListener('type1', function (e) {
            caught1 = true;
            expect(e.target).equal(child);
            expect(e.currentTarget).equal(grandparent);
            expect(e.eventPhase).equal(1);
          }, true);
          child.addEventListener('type1', function (e) {
            caught2 = true;
            expect(e.target).equal(child);
            expect(e.currentTarget).equal(child);
            expect(e.eventPhase).equal(2);
          });
          parent.addEventListener('type1', function (e) {
            expect(e.target).equal(child);
            expect(e.currentTarget).equal(parent);
            expect(e.eventPhase).equal(3);
            caught3 = true;
          });
          grandparent.addEventListener('type1', function (e) {
            expect(e.target).equal(child);
            expect(e.currentTarget).equal(grandparent);
            expect(e.eventPhase).equal(3);
            expect(caught1).equal(true);
            expect(caught2).equal(true);
            expect(caught3).equal(true);
            done();
          });
          var ev = newEvent('type1', {bubbles: true});
          expect(ev.eventPhase).equal(0);
          child.dispatchEvent(ev);
        });
        it('user handlers should not be able to stop propagation of default or late listeners', function (done) {
          var car = new Car();
          var caught1 = false;
          car.addLateEventListener('start', function (e) {
            caught1 = true;
          });
          car.addDefaultEventListener('start', function (e) {
            expect(caught1).to.be.true;
          });
          car.addEventListener('start', function (e) {
            e.stopPropagation();
            done();
          });
          car.start({bubbles: true});
        });
      });
    });

    describe('on* events', function () {
      it('`return false` should prevent default but not stop propagation', function (done) {
        var propagated = false;
        var expected = ['grandchildB1', 'childB', 'root'];
        var catTree = new CategoryTree('root', [
          ['childA', [['grandchildA1'], ['grandchildA2']]],
          ['childB', [['grandchildB1'], ['grandchildB2']]]
        ]);
        catTree.children[1].onbubbl = function (e) {
          return false;
        };
        catTree.addEventListener('bubbl', function (e) {
          propagated = true;
          expect(e.defaultPrevented).to.be.true;
        });
        catTree.children[1].children[0].addLateEventListener('bubbl', function (e) {
          expect(propagated).to.be.true;
          expect(bubbledCategories).deep.equal(expected);
          done();
        });
        catTree.children[1].children[0].bubble(); // 'grandchildB1'
      });
    });

    describe('hasEventListener', function () {
      it('should throw properly with invalid arguments', function () {
        expect(function () {
          var car = new Car();
          car.hasEventListener('sometype');
        }).to.throw(TypeError, /2 or more arguments required/);
        try {
          var car = new Car();
          car.hasEventListener(null, function (event) {});
        } catch (err) {
          expect(err instanceof (typeof DOMException !== 'undefined' ? DOMException : Error)).to.be.true;
          expect(err.name).equal('UNSPECIFIED_EVENT_TYPE_ERR');
        }
      });
      it('should successfully detect added listener of same type, options, and listener', function () {
        var car = new Car();

        var type1 = 'something1';

        var ct1 = 0;
        var ct2 = 0;
        var func1 = function () {
          ct1++;
        };
        var func2 = function () {
          ct2++;
        };

        var options1 = {passive: true};
        var options2 = {passive: false};

        expect(car.hasEventListener(type1, func1)).to.be.false;
        car.addEventListener(type1, func1);
        expect(car.hasEventListener(type1, func1)).to.be.true;

        expect(car.hasEventListener(type1, func2)).to.be.false;
        car.addEventListener(type1, func2);
        expect(car.hasEventListener(type1, func2)).to.be.true;

        expect(car.hasEventListener(type1, func1, options1)).to.be.false;
        car.addEventListener(type1, func1, options1);
        expect(car.hasEventListener(type1, func1, options1)).to.be.true;

        expect(car.hasEventListener(type1, func1, options2)).to.be.false;
        car.addEventListener(type1, func1, options2);
        expect(car.hasEventListener(type1, func1, options2)).to.be.true;
      });
      it('should not detect added listener of different type, listener, or options', function () {
        var car = new Car();

        var type1 = 'something1';
        var type2 = 'something2';

        var ct1 = 0;
        var ct2 = 0;
        var func1 = function () {
          ct1++;
        };
        var func2 = function () {
          ct2++;
        };

        var options1 = {passive: true};
        var options2 = {passive: false};

        car.addEventListener(type1, func1);
        expect(car.hasEventListener(type2, func1)).to.be.false;
        expect(car.hasEventListener(type1, func2)).to.be.false;

        car.addEventListener(type1, func1, options1);
        expect(car.hasEventListener(type1, func1, options2)).to.be.false;
      });
    });

    describe('Early event listeners', function () {
      it('should trigger before other event listener types', function (done) {
        var car = new Car();
        var ct = 0;
        car.addDefaultEventListener('start', function () {
          ct++;
          expect(ct).equal(4);
          done();
        });
        car.addLateEventListener('start', function () {
          ct++;
        });
        car.addEventListener('start', function () {
          ct++;
        });
        car.addEarlyEventListener('start', function () {
          ct++;
          expect(ct).equal(1);
        });
        car.start();
      });
      it('should not undergo capture or bubbling', function (done) {
        var parent = {__getParent: function () { return null; }};
        var child = {
          __getParent: function () {
            return parent;
          }
        };
        Object.assign(parent, EventTarget.prototype);
        Object.assign(child, EventTarget.prototype);
        var caught1 = false;
        var caught2 = false;
        child.addLateEventListener('type1', function () {
          expect(caught1).to.be.false;
          expect(caught2).to.be.false;
          done();
        });
        parent.addEarlyEventListener('type1', function () {
          caught1 = true;
        });
        parent.addEarlyEventListener('type1', function () {
          caught2 = true;
        }, true);
        parent.addEventListener('type1', function () {
          expect(caught1).to.be.false;
        }, {capture: true});
        var ev = newEvent('type1', {bubbles: true});
        child.dispatchEvent(ev);
      });
      it('should allow stopping propagation on normal events or prevent default', function (done) {
        var expected = [];
        var catTree = new CategoryTree('root', [
          ['childA', [['grandchildA1'], ['grandchildA2']]],
          ['childB', [['grandchildB1'], ['grandchildB2']]]
        ]);
        var ranDefault = false;
        catTree.children[1].children[0].__setOptions({defaultSync: true});
        catTree.children[1].children[0].addEarlyEventListener('capt', function (e) {
          e.stopPropagation();
          e.preventDefault();
        }, true);
        catTree.children[1].children[0].addDefaultEventListener('capt', function () {
          ranDefault = true;
        });
        catTree.children[1].children[0].addLateEventListener('capt', function (e) {
          // expect(e.defaultPrevented).to.be.true;
          expect(ranDefault).to.be.false;
          expect(capturedCategories).deep.equal(expected);
          done();
        }, true);
        catTree.children[1].children[0].capture(); // 'grandchildB1'
      });
      it('should allow stopping immediate propagation', function (done) {
        var car = new Car();
        var actual = [];
        var expected = [1, 2];
        car.addEarlyEventListener('start', function (e) {
          actual.push(1);
        });
        car.addEarlyEventListener('start', function (e) {
          e.stopImmediatePropagation();
          actual.push(2);
        }, {capture: true});
        car.addEarlyEventListener('start', function (e) {
          actual.push(3);
        });
        car.addLateEventListener('start', function (e) {
          expect(actual).to.deep.equal(expected);
          done();
        });
        car.start();
      });
    });

    describe('Default event listeners', function () {
      it('should trigger after other event listener types', function (done) {
        var car = new Car();
        var ct = 0;
        car.addDefaultEventListener('start', function () {
          ct++;
          expect(ct).equal(4);
          done();
        });
        car.addLateEventListener('start', function () {
          ct++;
        });
        car.addEventListener('start', function () {
          ct++;
        });
        car.addEarlyEventListener('start', function () {
          ct++;
        });
        car.start();
      });
      it('should not undergo capture or bubbling', function (done) {
        var parent = {__getParent: function () { return null; }};
        var child = {
          __getParent: function () {
            return parent;
          }
        };
        Object.assign(parent, EventTarget.prototype);
        Object.assign(child, EventTarget.prototype);
        var caught1 = false;
        var caught2 = false;
        child.__setOptions({defaultSync: true});
        child.addLateEventListener('type1', function () {
          expect(caught1).to.be.false;
          expect(caught2).to.be.false;
          done();
        });
        parent.addDefaultEventListener('type1', function () {
          caught1 = true;
        });
        parent.addDefaultEventListener('type1', function () {
          caught2 = true;
        }, true);
        parent.addEventListener('type1', function () {
          expect(caught1).to.be.false;
        }, {capture: true});
        var ev = newEvent('type1', {bubbles: true});
        child.dispatchEvent(ev);
      });
      it('should allow stopping immediate propagation', function (done) {
        var car = new Car();
        var actual = [];
        var expected = [1, 2];
        car.__setOptions({defaultSync: true});
        car.addDefaultEventListener('start', function (e) {
          actual.push(1);
        });
        car.addDefaultEventListener('start', function (e) {
          e.stopImmediatePropagation();
          actual.push(2);
        }, {capture: true});
        car.addDefaultEventListener('start', function (e) {
          actual.push(3);
        });
        car.addLateEventListener('start', function (e) {
          expect(actual).to.deep.equal(expected);
          done();
        });
        car.start();
      });
      it('should not allow stopping propagation (when async) even to late listeners (as will occur afterward)', function (done) {
        var car = new Car();
        var ranLateEventListener = false;
        var ranNormalEventListener = false;
        var ranEarlyEventListener = false;
        car.addDefaultEventListener('start', function (e) {
          e.stopPropagation();
          e.preventDefault();
          expect(ranEarlyEventListener).to.be.true;
          expect(ranNormalEventListener).to.be.true;
          expect(ranLateEventListener).to.be.true;
          done();
        });
        car.addLateEventListener('start', function (e) {
          ranLateEventListener = true;
        });
        car.addEarlyEventListener('start', function (e) {
          ranEarlyEventListener = true;
        });
        car.addEventListener('start', function (e) {
          ranNormalEventListener = true;
        });
        car.start({bubbles: true});
      });
      it('should allow stopping propagation when sync to late listeners', function (done) {
        var car = new Car();
        car.__setOptions({defaultSync: true});
        var ranLateEventListener = false;
        var ranNormalEventListener = false;
        var ranEarlyEventListener = false;
        car.addDefaultEventListener('start', function (e) {
          e.stopPropagation();
          setTimeout(function () {
            expect(ranEarlyEventListener).to.be.true;
            expect(ranNormalEventListener).to.be.true;
            expect(ranLateEventListener).to.be.false;
            done();
          }, 30);
        });
        car.addLateEventListener('start', function (e) {
          ranLateEventListener = true;
        });
        car.addEarlyEventListener('start', function (e) {
          ranEarlyEventListener = true;
        });
        car.addEventListener('start', function (e) {
          ranNormalEventListener = true;
        });
        car.start({bubbles: true});
      });
      it('should allow successful use of `preventDefault` with cancelable event from non-passive listener', function (done) {
        var car = new Car();
        var ranDefaultEventListener = false;
        car.addEventListener('start', function (e) {
          e.preventDefault();
          setTimeout(function () {
            expect(ranDefaultEventListener).to.be.false;
            done();
          }, 30);
        });
        car.addDefaultEventListener('start', function (e) {
          ranDefaultEventListener = true;
        });
        car.start({bubbles: true, cancelable: true});
      });
      it('should not allow successful use of `preventDefault` (or setting of `defaultPrevented`) with non-`cancelable` event even with non-passive listener', function (done) {
        var car = new Car();
        var ranDefaultEventListener = false;
        car.addEventListener('start', function (e) {
          e.preventDefault();
          expect(e.defaultPrevented).to.be.false;
          setTimeout(function () {
            expect(ranDefaultEventListener).to.be.true;
            done();
          }, 30);
        });
        car.addDefaultEventListener('start', function (e) {
          ranDefaultEventListener = true;
        });
        car.start({bubbles: true});
      });
      it('should not allow successful use of `preventDefault` (or setting of `defaultPrevented`) by `passive` event listener even with cancelable event listener', function (done) {
        var car = new Car();
        var ranDefaultEventListener = false;
        car.addEventListener('start', function (e) {
          e.preventDefault();
          expect(e.defaultPrevented).to.be.false;
          setTimeout(function () {
            expect(ranDefaultEventListener).to.be.true;
            done();
          }, 30);
        }, {passive: true});
        car.addDefaultEventListener('start', function (e) {
          ranDefaultEventListener = true;
        });
        car.start({bubbles: true, cancelable: true});
      });
      it('should get proper defaultPrevented event properties when set', function (done) {
        var car = new Car();
        car.addEventListener('start', function (e) {
          e.preventDefault();
          expect(e.defaultPrevented).to.be.true;
          done();
        });
        car.addDefaultEventListener('start', function (e) {
          //
        });
        car.start({bubbles: true, cancelable: true});
      });
      it('`return false` on addEventListener should not prevent default', function (done) {
        var car = new Car();
        var ranDefaultEventListener = false;
        car.addEventListener('start', function (e) {
          setTimeout(function () {
            expect(ranDefaultEventListener).to.be.true;
            done();
          }, 30);
          return false;
        });
        car.addDefaultEventListener('start', function (e) {
          expect(e.defaultPrevented).to.be.false;
          ranDefaultEventListener = true;
        });
        car.start({bubbles: true, cancelable: true});
      });
      it('should occur before late listeners with custom `defaultSync` option set to true', function (done) {
        var car = new Car();
        var ct = 0;
        car.__setOptions({defaultSync: true});
        car.addDefaultEventListener('start', function () {
          ct++;
          expect(ct).equal(1);
        });
        car.addLateEventListener('start', function () {
          ct++;
          expect(ct).equal(2);
          done();
        });
        car.start();
      });
      it('should occur after late listeners with custom `defaultSync` option unset', function (done) {
        var car = new Car();
        var ct = 0;
        car.addDefaultEventListener('start', function () {
          ct++;
          expect(ct).equal(2);
        });
        car.addLateEventListener('start', function () {
          ct++;
          expect(ct).equal(1);
          done();
        });
        car.start();
      });
    });

    describe('Late event listeners', function () {
      it('should trigger after other event listener types (except asynchronous defaults)', function (done) {
        var car = new Car();
        var ct = 0;
        car.__setOptions({defaultSync: true});
        car.addDefaultEventListener('start', function () {
          ct++;
          expect(ct).equal(3);
        });
        car.addLateEventListener('start', function () {
          ct++;
          expect(ct).equal(4);
          done();
        });
        car.addEventListener('start', function () {
          ct++;
        });
        car.addEarlyEventListener('start', function () {
          ct++;
        });
        car.start();
      });
      it('should not undergo capture or bubbling', function (done) {
        var parent = {__getParent: function () { return null; }};
        var child = {
          __getParent: function () {
            return parent;
          }
        };
        Object.assign(parent, EventTarget.prototype);
        Object.assign(child, EventTarget.prototype);
        var caught1 = false;
        var caught2 = false;
        var ct = 0;
        parent.addDefaultEventListener('type1', function () {
          expect(caught1).to.be.false;
          expect(caught2).to.be.false;
          expect(ct).equal(1);
          done();
        }, true);
        parent.addLateEventListener('type1', function () {
          caught1 = true;
        });
        parent.addLateEventListener('type1', function () {
          caught2 = true;
        }, true);
        parent.addEventListener('type1', function () {
          expect(caught1).equal(false);
          done();
        }, {capture: true});
        var ev = newEvent('type1', {bubbles: true});
        child.dispatchEvent(ev);
      });
      it('should not allow stopping propagation or preventing default with sync defaults (since should execute before)', function (done) {
        var car = new Car();
        var ranDefaultEventListener = false;
        var ranNormalEventListener = false;
        var ranEarlyEventListener = false;
        car.__setOptions({defaultSync: true});
        car.addLateEventListener('start', function (e) {
          e.stopPropagation();
          e.preventDefault();
          expect(ranEarlyEventListener).to.be.true;
          expect(ranNormalEventListener).to.be.true;
          expect(ranDefaultEventListener).to.be.true;
          done();
        });
        car.addDefaultEventListener('start', function (e) {
          ranDefaultEventListener = true;
        });
        car.addEarlyEventListener('start', function (e) {
          ranEarlyEventListener = true;
        });
        car.addEventListener('start', function (e) {
          ranNormalEventListener = true;
        });
        car.start({bubbles: true});
      });
      it('should not allow stopPropagation to prevent default with async defaults', function (done) {
        var car = new Car();
        var ranDefaultEventListener = false;
        car.addLateEventListener('start', function (e) {
          e.stopPropagation();
          expect(ranDefaultEventListener).to.be.false;
        });
        car.addDefaultEventListener('start', function (e) {
          ranDefaultEventListener = true;
          done();
        });
        car.start({bubbles: true, cancelable: true});
      });
      it('should allow preventing default with async defaults', function (done) {
        var car = new Car();
        var ranDefaultEventListener = false;
        car.addLateEventListener('start', function (e) {
          e.preventDefault();
          setTimeout(function () {
            expect(ranDefaultEventListener).to.be.false;
            done();
          }, 30);
        });
        car.addDefaultEventListener('start', function (e) {
          ranDefaultEventListener = true;
        });
        car.start({bubbles: true, cancelable: true});
      });
      it('should allow stopping immediate propagation', function (done) {
        var car = new Car();
        var actual = [];
        var expected = [1, 2];
        car.addLateEventListener('start', function (e) {
          actual.push(1);
        });
        car.addLateEventListener('start', function (e) {
          e.stopImmediatePropagation();
          actual.push(2);
        }, {capture: true});
        car.addLateEventListener('start', function (e) {
          actual.push(3);
        });
        car.addDefaultEventListener('start', function (e) {
          expect(actual).to.deep.equal(expected);
          done();
        });
        car.start();
      });
    });

    describe('Error handling', function () {
      if (typeof window === 'undefined') {
        var listeners;
        beforeEach(function () {
          listeners = process.listeners('uncaughtException');
          process.removeAllListeners('uncaughtException');
        });

        afterEach(function () {
          listeners.forEach(function (listener) {
            process.on('uncaughtException', listener);
          });
        });
      }

      it('should trigger window.onerror', function (done) {
        var ct = 0;
        var ct2 = 0;
        function handler (err) {
          if (ct === 0) {
            expect(err.message).to.equal('Uncaught exception: Oops');
          } else {
            expect(err.message).to.equal('Uncaught exception: Oops again');
            expect(ct).to.equal(1);
            if (typeof window !== 'undefined') {
              expect(ct2).to.equal(2);
              window.removeEventListener('error', handler);
            }
            done();
            return;
          }
          ct++;
        }
        if (typeof window === 'undefined') {
          process.on('uncaughtException', handler);
        } else {
          window.onerror = function (msg) {
            if (ct2 === 0) {
              expect(msg).to.equal('Uncaught exception: Oops');
            } else {
              expect(msg).to.equal('Uncaught exception: Oops again');
              expect(ct2).to.equal(1);
            }
            ct2++;
          };
          window.addEventListener('error', handler);
        }

        var car = new Car();
        var func = function () {
          throw 'Oops'; // eslint-disable-line no-throw-literal
        };
        var func2 = function () {
          throw new Error('Oops again');
        };
        car.addEventListener('start', func);
        car.addEventListener('start', func2);
        car.start();
      });
      it('should trigger `__userErrorEventHandler`', function (done) {
        function handler () {
          expect(true).to.be.false;
          if (typeof window !== 'undefined') {
            window.removeEventListener('error', handler);
          }
          done();
          return;
        }
        if (typeof window === 'undefined') {
          process.on('uncaughtException', handler);
        } else {
          window.onerror = function (msg) {
            expect(true).to.be.false;
          };
          window.addEventListener('error', handler);
        }

        var car = new Car();
        var func = function () {
          throw 'Oops'; // eslint-disable-line no-throw-literal
        };
        var func2 = function () {
          throw new Error('Oops again');
        };
        var errCt = 0;
        car.__userErrorEventHandler = function (errorObj, triggerGlobalErrorEventCb) {
          errCt++;
          if (errCt > 2) {
            return;
          }
          if (errCt === 1) {
            expect(errorObj.message).to.equal('Uncaught exception: Oops');
          } else {
            expect(errorObj.message).to.equal('Uncaught exception: Oops again');
            if (typeof window !== 'undefined') {
              window.removeEventListener('error', handler);
            }
            done();
          }
        };
        car.addEventListener('start1', func);
        car.addEventListener('start1', func2);

        var ev = newEvent('start1');
        car.dispatchEvent(ev);
      });
    });
  });
});
