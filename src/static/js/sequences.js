// Dimensions of sunburst.
const WIDTH = 750;
const HEIGHT = 600;
const RADIUS = Math.min(WIDTH, HEIGHT) / 2;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
const DIM_BREADCRUMB = {
  width: 200,
  height: 30,
  spacing: 3,
  tip: 10,
};

// Mapping of step commands to colors.
const COLORS = d3.scaleOrdinal(d3.schemeCategory10);

// Total size of all segments; we set this later, after loading the data.
let totalSize = 0;

const vis = d3
  .select("#chart")
  .append("svg:svg")
  .attr("width", WIDTH)
  .attr("height", HEIGHT)
  .append("svg:g")
  .attr("id", "container")
  .attr("transform", "translate(" + WIDTH / 2 + "," + HEIGHT / 2 + ")");

const partition = d3.partition().size([2 * Math.PI, RADIUS * RADIUS]);

const arc = d3
  .arc()
  .startAngle((d) => d.x0)
  .endAngle((d) => d.x1)
  .innerRadius((d) => Math.sqrt(d.y0))
  .outerRadius((d) => Math.sqrt(d.y1));

d3.tsv("./data/process_data.tsv").then(function (text) {
  createVisualization(text);
});

// Main function to draw and set up the visualization, once we have the data.
function createVisualization(tsv) {
  const json = buildHierarchy(tsv);

  // Basic setup of page elements.
  initializeBreadcrumbTrail();
  let status = drawLegend(tsv);
  d3.select("#togglelegend").on("click", toggleLegend);
  drawHierarchy(json);

  // Bounding circle underneath the sunburst, to make it easier to detect
  // when the mouse leaves the parent g.
  vis.append("svg:circle").attr("r", RADIUS).style("opacity", 0);

  // Turn the data into a d3 hierarchy and calculate the sums.
  const root = d3
    .hierarchy(json)
    .sum((d) => d.cpu)
    .sort((a, b) => b.value - a.value);

  // For efficiency, filter nodes to keep only those large enough to see.
  const nodes = partition(root)
    .descendants()
    .filter((d) => d.x1 - d.x0 > 0.005);

  const path = vis
    .data([json])
    .selectAll("path")
    .data(nodes)
    .enter()
    .append("svg:path")
    .attr("display", (d) => (d.depth ? null : "none"))
    .attr("d", arc)
    .attr("fill-rule", "evenodd")
    .style("fill", (d) => COLORS(d.data.command))
    .style("opacity", 1)
    .on("mouseover", mouseoverSunburst);

  // Add the mouseleave handler to the bounding circle.
  d3.select("#container").on("mouseleave", mouseleaveSunburst);

  // Get total size of the tree = value of root node from partition.
  totalSize = path.datum().value;

  function toggleLegend() {
    const legend = d3.select("#legend");
    if (legend.style("visibility") == "hidden") {
      legend.style("visibility", "");
    } else {
      legend.style("visibility", "hidden");
    }
  }

  // Fade all but the current sequence, and show it in the breadcrumb trail.
  function mouseoverSunburst(event, d) {
    const percentage = ((100 * d.value) / totalSize).toPrecision(3);
    const percentageString = percentage + "%";
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
  function mouseleaveSunburst() {
    // Hide the breadcrumb trail
    d3.select("#trail").style("visibility", "hidden");

    // onになっているボタンがないか探す
    let onStat = "none";
    status.forEach((d) => {
      if (d.button == "on") {
        onStat = d.stat;
      }
    })

    // ボタンがすべてoffなら通常表示に戻る
    if (onStat == "none") {
      d3.selectAll("path").style("opacity", 1);
    }
    // onになっているボタンがあれば、ハイライト表示に戻る
    else {
      d3.selectAll("path").style("opacity", (data) => {
        if (!data.data || data.data.command === "root") {
          return 1;
        }
        return data.data.stat[0] === onStat ? 1 : 0.3;
      });
    }

    d3.select("#explanation").style("visibility", "hidden");
  }
}

function initializeBreadcrumbTrail() {
  // Add the svg area.
  const trail = d3
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
  points.push(DIM_BREADCRUMB.width + ",0");
  points.push(
    DIM_BREADCRUMB.width + DIM_BREADCRUMB.tip + "," + DIM_BREADCRUMB.height / 2
  );
  points.push(DIM_BREADCRUMB.width + "," + DIM_BREADCRUMB.height);
  points.push("0," + DIM_BREADCRUMB.height);
  if (i > 0) {
    // Leftmost breadcrumb; don't include 6th vertex.
    points.push(DIM_BREADCRUMB.tip + "," + DIM_BREADCRUMB.height / 2);
  }
  return points.join(" ");
}

// Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(nodeArray, percentageString) {
  // Data join; key function combines name and depth (= position in sequence).
  let trail = d3
    .select("#trail")
    .selectAll("g")
    .data(nodeArray, (d) => d.data.command + d.depth);

  // Remove exiting nodes.
  trail.exit().remove();

  // Add breadcrumb and label for entering nodes.
  let entering = trail.enter().append("svg:g");

  entering
    .append("svg:polygon")
    .attr("points", breadcrumbPoints)
    .style("fill", (d) => COLORS(d.data.command));

  entering
    .append("svg:text")
    .attr("x", (DIM_BREADCRUMB.width + DIM_BREADCRUMB.tip) / 2)
    .attr("y", DIM_BREADCRUMB.height / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text((d) => d.data.command);

  // Merge enter and update selections; set position for all nodes.
  entering
    .merge(trail)
    .attr(
      "transform",
      (d, i) =>
        "translate(" +
        i * (DIM_BREADCRUMB.width + DIM_BREADCRUMB.spacing) +
        ", 0)"
    );

  // Now move and update the percentage at the end.
  d3.select("#trail")
    .select("#endlabel")
    .attr(
      "x",
      (nodeArray.length + 0.5) * (DIM_BREADCRUMB.width + DIM_BREADCRUMB.spacing)
    )
    .attr("y", DIM_BREADCRUMB.height / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text(percentageString);

  // Make the breadcrumb trail visible, if it's hidden.
  d3.select("#trail").style("visibility", "");
}

function drawLegend(tsv) {
  // Dimensions of legend item: width, height, spacing, radius of rounded rect.
  const DIM_LEGEND = {
    width: 130,
    height: 30,
    spacing: 3,
    radius: 3,
  };

  let statusId = 0;
  let statusDict = [];
  tsv.forEach((d) => {
    let statLegend = d.STAT[0];
    if (statusDict.map((status) => status.stat).indexOf(statLegend) === -1) {
      statusDict.push({ stat: statLegend, id: statusId , button: "off"});
      statusId++;
    }
  });

  const sortedStatus = statusDict
    .slice()
    .sort((a, b) => d3.ascending(a.stat, b.stat));

  const legend = d3
    .select("#legend")
    .append("svg:svg")
    .attr("width", DIM_LEGEND.width)
    .attr(
      "height",
      statusDict.length * (DIM_LEGEND.height + DIM_LEGEND.spacing)
    );

  const g = legend
    .selectAll("g")
    .data(sortedStatus)
    .enter()
    .append("svg:g")
    .attr(
      "transform",
      (d, i) =>
        "translate(0," + i * (DIM_LEGEND.height + DIM_LEGEND.spacing) + ")"
    );

  g.append("svg:rect")
    .attr("rx", DIM_LEGEND.radius)
    .attr("ry", DIM_LEGEND.radius)
    .attr("width", DIM_LEGEND.width)
    .attr("height", DIM_LEGEND.height)
    .style("fill", "black")
    .style("opacity", 0.5)
    .attr("class", (d) => "rect_" + d.id);

  g.append("svg:text")
    .attr("x", DIM_LEGEND.width / 2)
    .attr("y", DIM_LEGEND.height / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text((d) => {
      const statusAbbreviations = {
        R: "runnable",
        D: "ninterruptible sleep",
        T: "stopped",
        S: "interruptible sleep",
        Z: "zombie",
        I: "process generating",
        O: "running",
      };
      return d.stat in statusAbbreviations
        ? statusAbbreviations[d.stat]
        : "unknown";
    });

  g.on("click", clickLegend);

  function clickLegend(event, d) {
    // ボタンが既に押されている時
    if (d.button == "on") {
      // ボタンをoffにし色を薄くする
      d.button = "off"
      d3.selectAll(".rect_" + d.id).style("opacity", 0.5);

      d3.selectAll("path").style("opacity", 1);
    }
    //ボタンがまだ押されていない時
    else if (d.button == "off") {
      // 他のボタンをoffにし、一旦すべてのボタンの色を薄くする
      statusDict.forEach((data) => {
        if (data.button == "on") {
          data.button = "off";
        }
      })
      d3.selectAll("rect").style("opacity", 0.5);

      // ボタンをonにし色を濃くする
      d.button = "on"
      d3.selectAll(".rect_" + d.id).style("opacity", 1);
      
      // 選択されたstatusのデータをハイライト表示する
      d3.selectAll("path").style("opacity", (data) => {
        if (!data.data || data.data.command === "root") {
          return 1;
        }
        return data.data.stat[0] === d.stat ? 1 : 0.3;
      });
    }
  }
  // ボタンの情報を返す
  return statusDict;
}

function drawHierarchy(json) {
  // 参考：https://qiita.com/e_a_s_y/items/dd1f0f9366ce5d1d1e7c
  const DIM_RECT = {
    height: 20,
    width: 80,
  };

  const DIM_SPACE = {
    padding: 30,
    height: 50,
    width: 120,
  };

  const DIM_LINK = {
    left: 20,
  };

  const DURATION = 500;

  const root = d3.hierarchy(json);
  const tree = d3.tree();
  tree(root);

  const countChildren = (hierarchy) =>
    hierarchy.eachAfter((node) => {
      let sum = 1;
      if (node.children) {
        const children = node.children;
        for (const child of children) {
          sum += child.value;
        }
      }
      node.value = sum;
    });

  countChildren(root);

  const calcHierarchySize = (source) => {
    return {
      height:
        source.value * DIM_RECT.height +
        (source.value - 1) * (DIM_SPACE.height - DIM_RECT.height) +
        DIM_SPACE.padding * 2,
      width:
        (source.height + 1) * DIM_RECT.width +
        source.height * (DIM_SPACE.width - DIM_RECT.width) +
        DIM_SPACE.padding * 2,
    };
  };

  const DIM_HIERARCHY = calcHierarchySize(root);

  const hierarchy = d3
    .select("#hierarchy")
    .append("svg")
    .attr("width", DIM_HIERARCHY.width)
    .attr("height", DIM_HIERARCHY.height);

  const g = hierarchy.append("g");

  let index = 0;
  updateTree(root);

  function toggle(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
  }

  function updateTree(source) {
    countChildren(root);
    DIM_HIERARCHY.height,
      (DIM_HIERARCHY.width = calcHierarchySize(root).height),
      calcHierarchySize(root).width;

    const seekParent = (currentData, command) => {
      const currentHierarchy = currentData.parent.children;
      const targetFound = currentHierarchy.find(
        (contents) => contents.data.command == command
      );
      return targetFound
        ? { command: command, hierarchy: currentHierarchy }
        : seekParent(currentData.parent, command);
    };

    const calcLeaves = (commands, currentData) => {
      const eachHierarchies = commands.map((command) =>
        seekParent(currentData, command)
      );
      const eachIdxes = eachHierarchies.map((item) =>
        item.hierarchy.findIndex(
          (contents) => contents.data.command == item.command
        )
      );
      const filteredHierarchies = eachHierarchies.map((item, idx) =>
        item.hierarchy.slice(0, eachIdxes[idx])
      );
      const values = filteredHierarchies.map((hierarchy) =>
        hierarchy.map((item) => item.value)
      );
      return values.flat();
    };

    const defineY = (data) => {
      if (data.data.command === "root") {
        return DIM_SPACE.padding;
      }
      const ancestorValues = data.ancestors().map((item) => item.data.command);
      const leaves = calcLeaves(
        ancestorValues.slice(0, ancestorValues.length - 1),
        data
      );
      const sumLeaves = leaves.reduce(
        (previous, current) => previous + current,
        0
      );

      return (data.depth + sumLeaves) * DIM_SPACE.height + DIM_SPACE.padding;
    };

    const definePos = (treeData) => {
      treeData.each((d) => {
        d.x = d.depth * 2 * DIM_LINK.left + DIM_SPACE.padding;
        d.y = defineY(d);
      });
    };

    definePos(root, DIM_SPACE);

    tree(root);
    definePos(root, DIM_SPACE);

    const link = g.selectAll(".link").data(root.links(), (d) => d.target.id);
    const linkEnter = link
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("d", (d) =>
        ` M ${source.xPrev}, ${source.yPrev + DIM_RECT.height / 2}
            L ${d.source.x + DIM_LINK.left},
              ${source.yPrev + DIM_RECT.height / 2}
            L ${d.source.x + DIM_LINK.left},
              ${d.source.y + DIM_RECT.height}`
          .replace(/\r?\n/g, "")
          .replace(/\s+/g, " ")
      );

    const linkUpdate = linkEnter.merge(link);
    linkUpdate
      .transition()
      .duration(DURATION)
      .attr("d", (d) =>
        ` M ${d.target.x}, ${d.target.y + DIM_RECT.height / 2}
            L ${d.source.x + DIM_LINK.left}, 
              ${d.target.y + DIM_RECT.height / 2}
            L ${d.source.x + DIM_LINK.left},
              ${d.source.y + DIM_RECT.height}`
          .replace(/\r?\n/g, "")
          .replace(/\s+/g, " ")
      );

    link
      .exit()
      .transition()
      .duration(DURATION)
      .attr("d", (d) =>
        ` M ${source.x}, ${source.y + DIM_RECT.height / 2}
        L ${d.source.x + DIM_LINK.left}, 
          ${source.y + DIM_RECT.height / 2}
        L ${d.source.x + DIM_LINK.left},
          ${d.source.y + DIM_RECT.height}`
          .replace(/\r?\n/g, "")
          .replace(/\s+/g, " ")
      )
      .remove();

    const node = g
      .selectAll(".node")
      .data(root.descendants(), (d) => d.id || (d.id = ++index));
    const nodeEnter = node
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .on("click", (event, d) => {
        toggle(d);
        updateTree(d);
      });
    nodeEnter
      .append("rect")
      .attr("width", DIM_RECT.width)
      .attr("height", DIM_RECT.height)
      .attr("fill", "#fff")
      .attr("stroke", "black");
    nodeEnter
      .append("text")
      .text((d) => d.data.command)
      .attr("transform", `translate(5, 15)`);

    const nodeUpdate = nodeEnter.merge(node);
    nodeUpdate
      .transition()
      .duration(DURATION)
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    nodeUpdate
      .select("rect")
      .style("fill", (d) => (d._children ? "lightsteelblue" : "#fff"));
    nodeEnter.select("text").style("fill-opacity", 1);

    const nodeExit = node
      .exit()
      .transition()
      .duration(DURATION)
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .remove();
    nodeExit.select("rect").attr("height", 0).attr("width", 0);
    nodeExit.select("text").style("fill-opacity", 1e-6);

    node.each((d) => {
      d.xPrev = d.x;
      d.yPrev = d.y;
    });
  }
}

// Take a 2-column tsv and transform it into a hierarchical structure suitable
// for a partition layout. The first column is a sequence of step names, from
// root to leaf, separated by hyphens. The second column is a count of how
// often that sequence occurred.
function buildHierarchy(tsv) {
  let root = { command: "root", children: [] };
  let parentNode = root;
  let childNode;
  for (let i = 0; i < tsv.length - 1; i++) {
    const currentRow = tsv[i];
    const nextRow = tsv[i + 1];
    const user = currentRow["USER"];
    const pid = parseInt(currentRow["PID"]);
    const cpu = parseFloat(currentRow["%CPU"]);
    const rss = parseFloat(currentRow["RSS"]);
    const stat = currentRow["STAT"];
    const command = currentRow["COMMAND"];
    const currentGene = parseInt(currentRow["GENE"]);
    const nextGene = parseInt(nextRow["GENE"]);

    if (nextGene > currentGene) {
      childNode = {
        command: command,
        user: user,
        pid: pid,
        cpu: cpu,
        rss: rss,
        stat: stat,
        parent: parentNode,
        children: [],
      };
      parentNode["children"].push(childNode);
      parentNode = childNode;
    } else if (nextGene == currentGene) {
      childNode = {
        command: command,
        user: user,
        pid: pid,
        cpu: cpu,
        rss: rss,
        stat: stat,
        parent: parentNode,
        children: [],
      };
      parentNode["children"].push(childNode);
    } else {
      childNode = {
        command: command,
        user: user,
        pid: pid,
        cpu: cpu,
        rss: rss,
        stat: stat,
        parent: parentNode,
        children: [],
      };
      parentNode["children"].push(childNode);
      const geneGap = currentGene - nextGene;
      for (let j = 0; j < geneGap; j++) {
        parentNode = parentNode["parent"];
      }
    }
  }
  return root;
}
