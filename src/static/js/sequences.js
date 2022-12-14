// Dimensions of sunburst.
const WIDTH = 1000;
const HEIGHT = 2000;
const RADIUS = Math.min(WIDTH, HEIGHT) / 2;

const statusInfomation = {
  R: { full: "runnable", color: "#1A85F1" },
  D: { full: "uninterruptible sleep", color: "#F26523" },
  T: { full: "stopped", color: "#ED1C24" },
  S: { full: "interruptible sleep", color: "#FBF267" },
  Z: { full: "zombie", color: "#7053CC" },
  I: { full: "process generating", color: "#38B349" },
  O: { full: "running", color: "#0218FF" },
  U: { full: "unknown", color: "#777" },
};

function setElement() {
  const svg = d3
    .select("#chart")
    .append("svg:svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .call(
      d3
        .zoom()
        .scaleExtent([1 / 2, 8])
        .on("zoom", zoomed)
    )
    .append("g");

  function zoomed(event) {
    svg.attr("transform", event.transform);
  }

  const hierarchy = d3.select("#hierarchy").append("svg");

  const legend = d3.select("#legend").append("svg:svg");

  return [svg, hierarchy, legend];
}

async function readData(svg, hierarchy, legend) {
  const text = await d3.tsv("./data/process_data.tsv");
  createVisualization(text, svg, hierarchy, legend);
}

const [svg, hierarchy, legend] = setElement();
setInterval(readData, 10000, svg, hierarchy, legend);

function createVisualization(tsv, svg, hierarchy, legend) {
  const json = buildHierarchy(tsv);

  drawLegend(tsv, legend);

  drawChart(json, svg);
  drawHierarchy(json, hierarchy);

  d3.select("#togglelegend").on("click", () => {
    const legend = d3.select("#legend");
    if (legend.style("visibility") == "hidden") {
      legend.style("visibility", "");
    } else {
      legend.style("visibility", "hidden");
    }
  });
}

function drawChart(json, svg) {
  const root = d3
    .hierarchy(json)
    .sum((d) => d.cpu)
    .sort((a, b) => b.value - a.value);
  const transform = d3.zoomIdentity;

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

  let node;
  let link;
  let index = 0;

  const simulation = d3
    .forceSimulation()
    .force(
      "link",
      d3.forceLink().id((d) => d.id)
    )
    .force(
      "collide",
      d3.forceCollide().radius((d) => d.r)
    )
    .force(
      "charge",
      d3
        .forceManyBody()
        .strength((d) => Math.min(-5 * d.value, -30))
        .distanceMax(200)
    )
    .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 6))
    .on("tick", ticked);

  update(svg);

  function update(svg) {
    const nodes = flatten(root);
    const links = root.links();

    link = svg.selectAll(".link").data(links, (d) => d.target.id);
    link.exit().remove();

    const linkEnter = link
      .enter()
      .append("line")
      .attr("class", "link")
      .style("stroke", "#ccc")
      .style("opacity", "0.2")
      .style("stroke-width", 3);

    link = linkEnter.merge(link);

    node = svg.selectAll(".node").data(nodes, (d) => d.id);
    node.exit().remove();

    const nodeEnter = node
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("stroke", "#666")
      .attr("stroke-width", 0)
      .style("fill", color)
      .style("opacity", (d) => (d.data.command === "root" ? 0.9 : 0.5))
      .on("click", clicked)
      .call(
        d3
          .drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      )
      .sort((a, b) => {
        return b.depth - a.depth;
      });

    nodeEnter
      .append("circle")
      .attr("r", (d) => {
        return d.data.command === "root" ? 50 : Math.sqrt(d.data.cpu) * 15 || 5;
      })
      .style("text-anchor", (d) => (d.children ? "end" : "start"))
      .text((d) => d.data.command);

    node = nodeEnter.merge(node);
    simulation.nodes(nodes);
    simulation.force("link").links(links);
  }

  function color(d) {
    if (d.data.command === "root") {
      return "rga(5, 5, 5)";
    }
    if (d._children) {
      return "#ccc";
    }
    if (d.children) {
      return "#ccc";
    }
    if ("stat" in d.data) {
      return statusInfomation[d.data.stat[0]].color;
    } else {
      return statusInfomation.U.color;
    }
  }

  function ticked() {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
  }

  function clicked(event, d) {
    if (!event.defaultPrevented) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      update();
    }
  }

  function dragstarted(event, d) {
    if (!event.active) {
      simulation.alphaTarget(0.3).restart();
    }
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) {
      simulation.alphaTarget(0);
    }
    d.fx = null;
    d.fy = null;
  }

  function flatten(root) {
    const nodes = [];
    function recurse(node) {
      if (node.children) {
        node.children.forEach(recurse);
      }
      if (!node.id) {
        node.id = ++index;
      } else {
        ++index;
      }
      nodes.push(node);
    }
    recurse(root);
    return nodes;
  }
}

function drawLegend(tsv, legend) {
  const DIM_LEGEND = {
    width: 250,
    height: 30,
    spacing: 3,
    radius: 3,
  };

  let statusIndex = 0;
  let statusDict = [];
  tsv.forEach((d) => {
    const statLegend = d.STAT[0];
    if (statusDict.map((status) => status.stat).indexOf(statLegend) === -1) {
      statusDict.push({
        stat: statLegend,
        id: statusIndex,
        buttonClicked: false,
      });
      statusIndex++;
    }
  });

  const sortedStatus = statusDict
    .slice()
    .sort((a, b) => d3.ascending(a.stat, b.stat));

  legend
    .attr("width", DIM_LEGEND.width)
    .attr(
      "height",
      statusDict.length * (DIM_LEGEND.height + DIM_LEGEND.spacing)
    );

  legend.selectAll("g").remove();
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
    .style(
      "fill",
      (d) => statusInfomation[d.stat in statusInfomation ? d.stat : "U"].color
    )
    .style("opacity", 0.5)
    .attr("class", (d) => "rect_" + d.id);

  g.append("svg:text")
    .attr("x", DIM_LEGEND.width / 2)
    .attr("y", DIM_LEGEND.height / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text(
      (d) => statusInfomation[d.stat in statusInfomation ? d.stat : "U"].full
    );

  g.on("click", clickLegend);

  // ボタンの情報を返す
  return statusDict;

  function clickLegend(event, d) {
    if (d.buttonClicked) {
      // ボタンが既に押されている時，ボタンをoffにし色を薄くする
      d.buttonClicked = false;
      d3.selectAll(".rect_" + d.id).style("opacity", 0.5);
      d3.selectAll("path").style("opacity", 1);
    } else {
      // ボタンがまだ押されていない時，他のボタンをoffにし、一旦すべてのボタンの色を薄くする
      statusDict.forEach((data) => {
        data.buttonClicked = false;
      });
      d3.selectAll("rect").style("opacity", 0.5);

      // ボタンをonにし色を濃くする
      d.buttonClicked = true;
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
}

function drawHierarchy(json, hierarchy) {
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
  hierarchy
    .attr("width", DIM_HIERARCHY.width)
    .attr("height", DIM_HIERARCHY.height);

  hierarchy.selectAll("g").remove();
  const g = hierarchy.append("g");

  let link;
  let node;
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

    link = g.selectAll(".link").data(root.links(), (d) => d.target.id);
    link.exit().remove();

    const linkEnter = link
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#ccc")
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

    node = g
      .selectAll(".node")
      .data(root.descendants(), (d) => d.id || (d.id = ++index));
    node.exit().remove();

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
      .attr("stroke", "#ccc");
    nodeEnter
      .append("text")
      .text((d) => d.data.command)
      .attr("transform", `translate(5, 15)`)
      .attr("fill", "#ccc")
      .attr("stroke", "none");

    const nodeUpdate = nodeEnter.merge(node);
    nodeUpdate
      .transition()
      .duration(DURATION)
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    nodeUpdate
      .select("rect")
      .style("fill", (d) => (d._children ? "#444" : "#222"));
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
