// Dimensions of sunburst.
const WIDTH = 750;
const HEIGHT = 600;
const RADIUS = Math.min(WIDTH, HEIGHT) / 2;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
const B = {
  w: 75,
  h: 30,
  s: 3,
  t: 10,
};

// Mapping of step names to colors.
const COLORS = {
  home: "#5687d1",
  product: "#7b615c",
  search: "#de783b",
  account: "#6ab975",
  other: "#a173d1",
  end: "#bbbbbb",
};

// Total size of all segments; we set this later, after loading the data.
let totalSize = 0;

let vis = d3
  .select("#chart")
  .append("svg:svg")
  .attr("width", WIDTH)
  .attr("height", HEIGHT)
  .append("svg:g")
  .attr("id", "container")
  .attr("transform", "translate(" + WIDTH / 2 + "," + HEIGHT / 2 + ")");

let partition = d3.partition().size([2 * Math.PI, RADIUS * RADIUS]);

let arc = d3
  .arc()
  .startAngle((d) => d.x0)
  .endAngle((d) => d.x1)
  .innerRadius((d) => Math.sqrt(d.y0))
  .outerRadius((d) => Math.sqrt(d.y1));

d3.csv("./visit-sequences.csv").then(function (text) {
  const json = buildHierarchy(text);
  createVisualization(json);
});

// Main function to draw and set up the visualization, once we have the data.
function createVisualization(json) {
  // Basic setup of page elements.
  initializeBreadcrumbTrail();
  drawLegend();
  d3.select("#togglelegend").on("click", toggleLegend);

  // Bounding circle underneath the sunburst, to make it easier to detect
  // when the mouse leaves the parent g.
  vis.append("svg:circle").attr("r", RADIUS).style("opacity", 0);

  // Turn the data into a d3 hierarchy and calculate the sums.
  let root = d3
    .hierarchy(json)
    .sum((d) => d.size)
    .sort((a, b) => b.value - a.value);

  // For efficiency, filter nodes to keep only those large enough to see.
  let nodes = partition(root)
    .descendants()
    .filter((d) => d.x1 - d.x0 > 0.005);

  let path = vis
    .data([json])
    .selectAll("path")
    .data(nodes)
    .enter()
    .append("svg:path")
    .attr("display", (d) => (d.depth ? null : "none"))
    .attr("d", arc)
    .attr("fill-rule", "evenodd")
    .style("fill", (d) => COLORS[d.data.name])
    .style("opacity", 1)
    .on("mouseover", mouseover);

  // Add the mouseleave handler to the bounding circle.
  d3.select("#container").on("mouseleave", mouseleave);

  // Get total size of the tree = value of root node from partition.
  totalSize = path.datum().value;
}

// Fade all but the current sequence, and show it in the breadcrumb trail.
function mouseover(d) {
  let percentage = ((100 * d.value) / totalSize).toPrecision(3);
  let percentageString = percentage + "%";
  if (percentage < 0.1) {
    percentageString = "< 0.1%";
  }

  d3.select("#percentage").text(percentageString);

  d3.select("#explanation").style("visibility", "");

  let sequenceArray = d.ancestors().reverse();
  sequenceArray.shift(); // remove root node from the array
  updateBreadcrumbs(sequenceArray, percentageString);

  // Fade all the segments.
  d3.selectAll("path").style("opacity", 0.3);

  // Then highlight only those that are an ancestor of the current segment.
  vis
    .selectAll("path")
    .filter((node) => sequenceArray.indexOf(node) >= 0)
    .style("opacity", 1);
}

// Restore everything to full opacity when moving off the visualization.
function mouseleave(d) {
  // Hide the breadcrumb trail
  d3.select("#trail").style("visibility", "hidden");

  // Deactivate all segments during transition.
  d3.selectAll("path").on("mouseover", null);

  // Transition each segment to full opacity and then reactivate it.
  d3.selectAll("path")
    .transition()
    .duration(1000)
    .style("opacity", 1)
    .on("end", function () {
      d3.select(this).on("mouseover", mouseover);
    });

  d3.select("#explanation").style("visibility", "hidden");
}

function initializeBreadcrumbTrail() {
  // Add the svg area.
  let trail = d3
    .select("#sequence")
    .append("svg:svg")
    .attr("width", WIDTH)
    .attr("height", 50)
    .attr("id", "trail");
  // Add the label at the end, for the percentage.
  trail.append("svg:text").attr("id", "endlabel").style("fill", "#000");
}

// Generate a string that describes the points of a breadcrumb polygon.
function breadcrumbPoints(d, i) {
  let points = [];
  points.push("0,0");
  points.push(B.w + ",0");
  points.push(B.w + B.t + "," + B.h / 2);
  points.push(B.w + "," + B.h);
  points.push("0," + B.h);
  if (i > 0) {
    // Leftmost breadcrumb; don't include 6th vertex.
    points.push(B.t + "," + B.h / 2);
  }
  return points.join(" ");
}

// Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(nodeArray, percentageString) {
  // Data join; key function combines name and depth (= position in sequence).
  let trail = d3
    .select("#trail")
    .selectAll("g")
    .data(nodeArray, (d) => d.data.name + d.depth);

  // Remove exiting nodes.
  trail.exit().remove();

  // Add breadcrumb and label for entering nodes.
  let entering = trail.enter().append("svg:g");

  entering
    .append("svg:polygon")
    .attr("points", breadcrumbPoints)
    .style("fill", (d) => COLORS[d.data.name]);

  entering
    .append("svg:text")
    .attr("x", (B.w + B.t) / 2)
    .attr("y", B.h / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text((d) => d.data.name);

  // Merge enter and update selections; set position for all nodes.
  entering
    .merge(trail)
    .attr("transform", (d, i) => "translate(" + i * (B.w + B.s) + ", 0)");

  // Now move and update the percentage at the end.
  d3.select("#trail")
    .select("#endlabel")
    .attr("x", (nodeArray.length + 0.5) * (B.w + B.s))
    .attr("y", B.h / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text(percentageString);

  // Make the breadcrumb trail visible, if it's hidden.
  d3.select("#trail").style("visibility", "");
}

function drawLegend() {
  // Dimensions of legend item: width, height, spacing, radius of rounded rect.
  const li = {
    w: 75,
    h: 30,
    s: 3,
    r: 3,
  };

  var legend = d3
    .select("#legend")
    .append("svg:svg")
    .attr("width", li.w)
    .attr("height", Object.keys(COLORS).length * (li.h + li.s));
  //   .attr("height", li.h)

  var g = legend
    .selectAll("g")
    .data(Object.entries(COLORS))
    .enter()
    .append("svg:g")
    .attr("transform", (d, i) => "translate(0," + i * (li.h + li.s) + ")");

  g.append("svg:rect")
    .attr("rx", li.r)
    .attr("ry", li.r)
    .attr("width", li.w)
    .attr("height", li.h)
    .style("fill", (d) => d.value);

  g.append("svg:text")
    .attr("x", li.w / 2)
    .attr("y", li.h / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text((d) => d.key);
}

function toggleLegend() {
  var legend = d3.select("#legend");
  if (legend.style("visibility") == "hidden") {
    legend.style("visibility", "");
  } else {
    legend.style("visibility", "hidden");
  }
}

// Take a 2-column CSV and transform it into a hierarchical structure suitable
// for a partition layout. The first column is a sequence of step names, from
// root to leaf, separated by hyphens. The second column is a count of how
// often that sequence occurred.
function buildHierarchy(csv) {
  let root = { name: "root", children: [] };
  for (var i = 0; i < csv.length; i++) {
    let sequence = csv[i].account;
    let size = +csv[i].num;
    if (isNaN(size)) {
      // e.g. if this is a header row
      continue;
    }
    let parts = sequence.split("-");
    let currentNode = root;
    for (var j = 0; j < parts.length; j++) {
      let children = currentNode["children"];
      let nodeName = parts[j];
      let childNode;
      if (j + 1 < parts.length) {
        // Not yet at the end of the sequence; move down the tree.
        let foundChild = false;
        for (var k = 0; k < children.length; k++) {
          if (children[k]["name"] == nodeName) {
            childNode = children[k];
            foundChild = true;
            break;
          }
        }
        // If we don't already have a child node for this branch, create it.
        if (!foundChild) {
          childNode = { name: nodeName, children: [] };
          children.push(childNode);
        }
        currentNode = childNode;
      } else {
        // Reached the end of the sequence; create a leaf node.
        childNode = { name: nodeName, size: size };
        children.push(childNode);
      }
    }
  }
  return root;
}
