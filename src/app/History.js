import {EXPRESSION_TO_MATHJAX_INLINE} from './util.js';
import $ from 'jquery';
const d3 = require('d3');

const KEY = {
  LEFT_ARROW:  37,
  RIGHT_ARROW: 39,
  UP_ARROW:    38,
  DOWN_ARROW:  40,
};

class History {
  constructor(selector, initialHistory, initialFuture) {
    this.$element = $(selector);
    this.$frames = this.$element.find('#frames');
    this.history = initialHistory || [];
    this.future = initialFuture || [];
    this.dispatcher = d3.dispatch('select', 'back', 'forward');
    this.$backButton = this.$element.find('#back');
    this.$forwardButton = this.$element.find('#forward');

    this.$backButton.click(() => {
      this.dispatcher.call('back', this);
    })

    this.$forwardButton.click(() => {
      this.dispatcher.call('forward', this);
    });

    $(document).keydown((e) => {

      if (e.target == $('#eq-input').get(0)) {
        return;
      }

      if (e.which == KEY.LEFT_ARROW){
        if (!this.$backButton.prop('disabled')) {
          this.$backButton.click();
        }
      }
      if (e.which == KEY.RIGHT_ARROW){
        if (!this.$forwardButton.prop('disabled')) {
          this.$forwardButton.click();
        }
      }
    });

  }

  push(expression) {
    this.history.push(expression);
    this.future = [];
    this.update();
  }

  forward() {
    if (this.future.length > 0) {
      this.history.push(this.future.shift());
      this.update();
    }
  }

  pop(until) {
    let result = null;
    if (until) {
      while (this.peek() != until && history.length > 0) {
        this.future.unshift(this.history.pop());
      }
      result = until;
    }
    else {
      result = this.history.pop();
      this.future.unshift(result);
    }

    this.update();
    return result;
  }

  peek() {
    return this.history[this.history.length - 1];
  }

  update() {
    const $frames = this.$frames;

    this.$backButton.prop('disabled', this.history.length <= 1);
    this.$forwardButton.prop('disabled', this.future.length == 0);

    const update = d3.select($frames.get(0)).selectAll('.frame')
      .data(this.history.concat(this.future));

    const enter = update.enter()
      .append('div')
      .classed('frame', true)
      .classed('expression-box', true)
      .style('visibility', 'hidden')
      .text(EXPRESSION_TO_MATHJAX_INLINE)
      .each(function() {
        MathJax.Hub.Typeset(this, () => {
          d3.select(this).style('visibility', 'visible');
          $frames.animate({
            scrollTop: $frames.prop("scrollHeight")
          }, 1000);
        });
      })
      .on('click', d => this.dispatcher.call('select', this, d));

    enter
      .append('span')
      .classed('index', true)
      .text((d, i) => i + 1);

    enter
      .merge(update)
      .classed('current', d => d == this.history[this.history.length - 1])
      .classed('faded', d => this.future.indexOf(d) > -1);

    update.exit()
      .remove();
  }

  on(event, handler) {
    this.dispatcher.on(event, handler);
    return this;
  }

  clear(initialHistory, initialFuture) {
    this.history = initialHistory || [];
    this.future = initialFuture || [];
    this.update();
  }
}

export default History;
