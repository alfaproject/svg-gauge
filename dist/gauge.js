/* global window, define, module */
(function(global, factory) {
  var Gauge = factory(global);
  if(typeof define === "function" && define.amd) {
    // AMD support
    define(function() {return Gauge;});
  }else if(typeof module === "object" && module.exports) {
    // CommonJS support
    module.exports = Gauge;
  }else {
    // We are probably running in the browser    
    global.Gauge = Gauge;
  }
})(typeof window === "undefined" ? this : window, function(global, undefined) {

  var document = global.document;

  // EXPERIMENTAL!!
  /**
   * Simplistic animation function for animating the gauge. That's all!
   * Options are:
   * {
   *  duration: 1,    // In seconds
   *  start: 0,       // The start value
   *  end: 100,       // The end value
   *  step: function, // REQUIRED! The step function that will be passed the value and does something
   *  easing: function // The easing function. Default is easeInOutCubic  
   * }
   */
  function Animation(options) {
    var duration = options.duration,
        currentIteration = 1,
        iterations = 60 * duration,
        start = options.start || 0,
        end = options.end || 100,
        change = end - start,
        step = options.step,
        easing = options.easing || function easeInOutCubic(pos) {
          // https://github.com/danro/easing-js/blob/master/easing.js
          if ((pos/=0.5) < 1) return 0.5*Math.pow(pos,3);
          return 0.5 * (Math.pow((pos-2),3) + 2);
        };

    function animate() {
      var progress = (currentIteration++) / iterations;
      var value = change * easing(progress) + start;
      // console.log(progress + ", " + value);
      step(value);
      if(progress < 1) {
        global.requestAnimationFrame(animate);
      }
    }
    // start!
    global.requestAnimationFrame(animate);
  }



  var Gauge = (function() {

    var SVG_NS = "http://www.w3.org/2000/svg";

    var GaugeDefaults = {
      dialStartAngle: 135,
      dialEndAngle: 45,
      centerX: 500,
      centerY: 500,
      radius: 400
    };

    /**
     * A utility function to create SVG dom tree
     * @param {String} name The SVG element name
     * @param {Object} attrs The attributes as they appear in DOM e.g. stroke-width and not strokeWidth
     * @param {Array} children An array of children (can be created by this same function)
     * @return The SVG element
     */
    function svg(name, attrs, children) {
      var elem = document.createElementNS(SVG_NS, name);
      for(var attrName in attrs) {
        elem.setAttribute(attrName, attrs[attrName]);
      }

      if(children) {
        children.forEach(function(c) {
          elem.appendChild(c);
        });
      }
      return elem;
    }

    /**
     * Translates percentage value to angle. e.g. If gauge span angle is 180deg, then 50%
     * will be 90deg
     */
    function getAngle(percentage, gaugeSpanAngle) {
      return percentage * gaugeSpanAngle / 100;
    }

    function normalize(value, limit) {
      var val = Number(value);
      if(val > limit) return limit;
      if(val < 0) return 0;
      return val;
    }

    function getValueInPercentage(value, limit) {
      return 100 * value / limit;
    }

    /**
     * Gets cartesian co-ordinates for a specified radius and angle (in degrees)
     * @param cx {Number} The center x co-oriinate
     * @param cy {Number} The center y co-ordinate 
     * @param radius {Number} The radius of the circle
     * @param angle {Number} The angle in degrees
     * @return An object with x,y co-ordinates
     */
    function getCartesian(cx, cy, radius, angle) {
      var rad = angle * Math.PI / 180;
      return {
        x: Math.round((cx + radius * Math.cos(rad)) * 1000) / 1000,
        y: Math.floor((cy + radius * Math.sin(rad)) * 1000) / 1000
      };
    }

    // Returns start and end points for dial
    // i.e. starts at 135deg ends at 45deg with large arc flag
    // REMEMBER!! angle=0 starts on X axis and then increases clockwise
    function getDialCoords(radius, startAngle, endAngle) {
      var cx = GaugeDefaults.centerX, 
          cy = GaugeDefaults.centerY;
      return {
        end: getCartesian(cx, cy, radius, endAngle),
      	start: getCartesian(cx, cy, radius, startAngle)
      };
    }

    /**
     * Creates a Gauge object. This should be called without the 'new' operator. Various options
     * can be passed for the gauge:
     * {
     *    dialStartAngle: The angle to start the dial. MUST be greater than dialEndAngle. Default 135deg
     *    dialEndAngle: The angle to end the dial. Default 45deg
     *    radius: The gauge's radius. Default 400
     *    max: The maximum value of the gauge. Default 100
     *    value: The starting value of the gauge. Default 0
     * }
     * @param {Element} elem The DOM into which to render the gauge
     * @param {Object} opts The gauge options
     * @return a Gauge object
     */
    return function Gauge(elem, opts) {
      var gaugeContainer = elem,
          limit = opts.max || 100,
          value = normalize(opts.value || 0, limit),
          radius = opts.radius || 400,
          displayValue = opts.displayValue === false ? false : true,
          startAngle = typeof(opts.dialStartAngle) === "undefined" ? 135 : opts.dialStartAngle,
          endAngle = typeof(opts.dialEndAngle) === "undefined" ? 45 : opts.dialEndAngle,
          gaugeTextElem,
          gaugeValuePath,
          instance;

      if(startAngle < endAngle) {
        console.log("WARNING! Start angle should be greater than end angle. Swapping");
        var tmp = startAngle;
        startAngle = endAngle;
        endAngle = tmp;
      }

      function pathString(radius, startAngle, endAngle, largeArc) {
        var coords = getDialCoords(radius, startAngle, endAngle),
            start = coords.start,
            end = coords.end,
            largeArcFlag = typeof(largeArc) === "undefined" ? 1 : largeArc;
            
        return ["M", start.x, start.y, "A", radius, radius, "0", largeArcFlag, "1", end.x, end.y].join(" ");
      }

      function initializeGauge(elem) {
        gaugeTextElem = svg("text", {
          "class": "value-text",
          "x": 500,
          "y": 550,
          "font-size": "300%",
          "stroke": "#666",
          "text-anchor": "middle"
        });
        gaugeValuePath = svg("path", {
          "class": "value",
          "fill": "transparent",
          "stroke": "#666",
          "stroke-width": 20,
          "d": pathString(radius, startAngle, startAngle) // value of 0
        });

        var angle = getAngle(100, 360 - Math.abs(startAngle - endAngle));
        var flag = angle <= 180 ? 0 : 1;
        var gaugeElement = svg("svg", {"viewBox": "0 0 1000 1000", "class": "gauge"}, 
          [
            svg("path", {
              "class": "dial",
              "fill": "transparent",
              "stroke": "#eee",
              "stroke-width": 20,
              "d": pathString(radius, startAngle, endAngle, flag)
            }),
            gaugeTextElem,
            gaugeValuePath
          ]
        );
        elem.appendChild(gaugeElement);
      }

      function updateGauge(theValue) {
        var val = getValueInPercentage(theValue, limit),
            // angle = getAngle(val, 360 - Math.abs(endAngle - startAngle)),
            angle = getAngle(val, 360 - Math.abs(startAngle - endAngle)),
            // this is because we are using arc greater than 180deg
            flag = angle <= 180 ? 0 : 1;
        (displayValue && (gaugeTextElem.textContent = Math.round(theValue)));
        gaugeValuePath.setAttribute("d", pathString(radius, startAngle, angle + startAngle, flag));
      }

      instance = {
        setMaxValue: function(max) {
          limit = max;
        },
        setValue: function(val) {
          value = normalize(val);
          updateGauge(value);
        },
        setValueAnimated: function(val, duration) {
        	var oldVal = value;
          value = normalize(val);
          Animation({
            start: oldVal || 0,
            end: value,
            duration: duration || 1,
            step: function(val) {
              updateGauge(Math.round(val * 100) / 100);
            }
          });
        },
        getValue: function() {
          return value;
        }
      };

      initializeGauge(gaugeContainer);
      updateGauge(value);
      return instance;
    };
  })();

  return Gauge;
});