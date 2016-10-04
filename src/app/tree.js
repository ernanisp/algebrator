import $ from 'jquery';
const d3 = require('d3');
const d3Kit = require('d3kit');
import {EXPRESSION_TO_MATHJAX_INLINE, ComputeInlineExpressionSize} from './util.js';

export const DEFAULT_OPTIONS = {
  margin: { top: 50, right: 30, bottom: 80, left: 30 },
  offset: [0, 0],
  initialWidth: 600,
  initialHeight: 370,
  circleRadius: 6,
  nodePadding: {x: 14, y: 8},
  nodeId: (d, i) => i,
  transitionDuration: 1000,
  fontSize: 20,
};

const EVENTS = [
  'nodeMouseenter', 'nodeMousemove', 'nodeMouseout', 'nodeClick',
  'actionMouseenter', 'actionMousemove', 'actionMouseout', 'actionClick'
];

export default d3Kit.factory.createChart(DEFAULT_OPTIONS, EVENTS, (skeleton) => {
  const options = skeleton.options();
  const layerOrganizer = skeleton.getLayerOrganizer();
  const dispatch = skeleton.getDispatcher();
  const tree = d3.tree();

  const visualize = _.debounce(visualizeDebounced, 100);

  skeleton
    .autoResize('both')
    .on('options', visualize)
    .on('data', visualize)
    .on('resize', resize);

  skeleton.resizeToFitContainer('both');

  const rootG = d3.select('#tree > svg > g');
  layerOrganizer.create(['links', 'nodes']);
  const linkLayer = rootG.select('.links-layer');
  const nodeLayer = rootG.select('.nodes-layer');

  function resize() {
    tree.size([skeleton.getInnerWidth(), skeleton.getInnerHeight()]);
    visualize();
  }

  function visualizeDebounced() {
    if (!(skeleton.hasData() && skeleton.hasNonZeroArea())) return;

    const root = d3.hierarchy(skeleton.data(), establishNodeChildren);

    tree(root);

    updateLinks(root);
    updateNodes(root);
  }

  function updateLinks(root) {
    const update = linkLayer.selectAll('.link')
      .data(root.descendants().slice(1), options.nodeId);

    const enter = update
      .enter()
      .append('path')
      .attr('class', 'link');

    update
      .merge(enter)
      .transition()
      .duration(options.transitionDuration)
      .attr('d', function(d) {
        return 'M' + d.x + ',' + d.y
          + 'C' + d.x + ',' +  (d.y + d.parent.y) / 2
          + ' ' + d.parent.x + ',' + (d.y + d.parent.y) / 2
          + ' ' + d.parent.x + ',' + d.parent.y;
      });

    update.exit()
      .remove();
  }

  function updateNodes(root) {

    const update = nodeLayer
      .selectAll('g.node')
      .data(root.descendants(), options.nodeId);

    const enter = update
      .enter()
      .append('g')
      .classed('node', true)
      .attr('opacity', 1)
      .attr('transform', d => 'translate(' + [d.x, d.y] + ')')
      .on('mouseenter', d => dispatch.call('nodeMouseenter', this, d))
      .on('mousemove', d => dispatch.call('nodeMousemove', this, d))
      .on('mouseout', d => dispatch.call('nodeMouseout', this, d))
      .on('click', d => dispatch.call('nodeClick', this, d));

    updateActions(enter, update);

    enter
      .append('foreignObject')
      .append('xhtml:body')
      .append('div')
      .classed('node-expression', true)
      .style('position', 'fixed')
      .style('font-size', options.fontSize + 'px')
      .merge(update.select('.node-expression'))
      .each(updateExpression);

    update
      .merge(enter)
      .transition()
      .duration(options.transitionDuration)
      .attr('transform', d => 'translate(' + [d.x, d.y] + ')');

    update
      .exit()
      .remove();
  }

  function updateActions(enter, update) {
    const actionGroup = enter.append('g')
      .classed('action-group', true);

    const actionUpdate = update.select('.action-group').merge(actionGroup)
      .selectAll('.action')
      .data(d => d.data.actions);

    const actionEnter = actionUpdate
      .enter()
      .append('circle')
      .classed('action', true)
      .attr('r', options.circleRadius)
      .style('fill', 'red')
      .on('mouseenter', d => dispatch.call('actionMouseenter', this, d))
      .on('mousemove', d => dispatch.call('actionMousemove', this, d))
      .on('mouseout', d => dispatch.call('actionMouseout', this, d))
      .on('click', d => dispatch.call('actionClick', this, d));

    actionUpdate
      .exit()
      .remove();

    actionUpdate.merge(actionEnter)
      .transition()
      .duration(options.transitionDuration)
      .attr('cx', (d, i, actions) => {
        return i * options.circleRadius * 3
          - ((actions.length - 1) * options.circleRadius * 3) / 2;
      });
  }

  function updateExpression(node) {
    const $node = $(this);
    const $body = $node.parent();
    $node.css('visibility', 'hidden');

    $node.text(EXPRESSION_TO_MATHJAX_INLINE(establishDatum(node.data)));
    MathJax.Hub.Typeset(this, (d) => {
      const mjxSize = ComputeInlineExpressionSize($node);
      $body
        .width(mjxSize.width)
        .height(mjxSize.height);

      const dx = -$node.outerWidth() / 2;
      const dy = -$node.outerHeight() / 2;

      $body
        .parent()
        .attr('transform', 'translate(' + [dx, dy] + ')');

      // adjust action position

      $node.parent().parent().parent()
        .find('.action-group')
        .attr('transform', 'translate('
          + [0, -dy + options.circleRadius * 2.5]
          + ')');

      $node.css('visibility', 'visible');
    });
  }

  function establishNodeName(node) {
    const datum = establishDatum(node.data);
    return datum.op || datum.value || datum.name;
  }

  function establishNodeChildren(node) {
    const children = establishDatum(node).args;
    return children ? children.filter(d => d.shouldRender()) : null;
  }

  function establishDatum(node) {
    let result = node;
    while (result.content) {result = result.content;}
    return result;
  }

  return skeleton.mixin({ visualize });
});
