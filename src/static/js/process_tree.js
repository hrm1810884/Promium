const WIDTH = parseFloat(
  window
    .getComputedStyle(document.getElementById("chart"))
    .width.replace("px", "")
);
const HEIGHT = 2000;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 5;

let cpuModeOn = true;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("helpButton").addEventListener("change", function () {
    const sidebarContainer = document.getElementById("sidebar");
    const helpContentContainer = document.getElementById("helpContent");
    if (this.checked) {
      sidebarContainer.style.visibility = "hidden";
      helpContentContainer.style.visibility = "visible";
    } else {
      helpContentContainer.style.visibility = "hidden";
      sidebarContainer.style.visibility = "visible";
    }
  });

  document
    .getElementById("legendButton")
    .addEventListener("change", function () {
      const legendContentContainer = document.getElementById("legendContent");
      legendContentContainer.style.visibility = this.checked
        ? "visible"
        : "hidden";
    });

  let inputTabs = document.querySelectorAll("input[name=tab_name]");
  for(let element of inputTabs) {
    element.addEventListener("change",function () {
      if (this.checked) {
        cpuModeOn = (this.id == "cpuTab" ? true : false);
        readData();
      }
    })
  }
});

const initializeSvgElement = () => {
  const chartElement = d3
    .select("#chart")
    .append("svg:svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .call(
      d3
        .zoom()
        .scaleExtent([1 / 2, 8])
        .on("zoom", (event) => {
          chartElement.attr("transform", event.transform);
        })
    )
    .append("g");
  const legendElement = d3.select("#legendContent").append("svg:svg");
  const hierarchyElement = d3.select("#hierarchy").append("svg");
  return [chartElement, legendElement, hierarchyElement];
};

const [chartSvg, legendSvg, hierarchySvg] = initializeSvgElement();
let liveModeOn = true;
let timerIdGeneral = setInterval(readData, 5000);

readData();

document.getElementById("togglelive").addEventListener("change", function () {
  if (this.checked) {
    timerIdGeneral = setInterval(readData, 5000);
  } else {
    clearInterval(timerIdGeneral);
    readData();
  }
});

async function readData() {
  const text = await d3.tsv("./data/process_data.tsv");
  createVisualization(text);
}

function createVisualization(tsv) {
  const json = buildHierarchy(tsv);
  const nodeType = {
    root: {
      displayText: "root",
      colorLight: "#444",
      colorDark: "#222",
    },
    parent: {
      displayText: "parent",
      colorLight: "#888",
      colorDark: "#444",
    },
    leaf: {
      R: {
        displayText: "runnable",
        colorLight: "#1A85F1",
        colorDark: "#082A4C",
      },
      D: {
        displayText: "uninterruptible sleep",
        colorLight: "#F26523",
        colorDark: "#4C200B",
      },
      T: {
        displayText: "stopped",
        colorLight: "#ED1C24",
        colorDark: "#4C090C",
      },
      S: {
        displayText: "interruptible sleep",
        colorLight: "#FBF267",
        colorDark: "#4C4920",
      },
      Z: {
        displayText: "zombie",
        colorLight: "#7053CC",
        colorDark: "#291F4C",
      },
      I: {
        displayText: "process generating",
        colorLight: "#38B349",
        colorDark: "#184C1F",
      },
      O: {
        displayText: "running",
        colorLight: "#0218FF",
        colorDark: "#00084C",
      },
      U: {
        displayText: "unknown",
        colorLight: "#777",
        colorDark: "#777",
      },
    },
  };

  drawChart(json);
  drawLegend(tsv);
  drawHierarchy(json);

  function drawChart(json) {
    const root = d3
      .hierarchy(json)
      .sum( (d) => (cpuModeOn ? d.cpu : d.rss))
      .sort((a, b) => b.value - a.value);

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

    const defs = chartSvg.append("defs");
    Object.keys(nodeType).forEach((keyNode) => {
      const capitalize = (string) => string[0].toUpperCase() + string.slice(1);
      const setGradient = (idString, colorLight, colorDark) => {
        const areaGradient = defs
          .append("radialGradient")
          .attr("id", `areaGradient${idString}`)
          .attr("cx", "0.5")
          .attr("cy", "0.5")
          .attr("fx", "0.3")
          .attr("fy", "0.3")
          .attr("r", "0.5");
        areaGradient
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", colorLight);
        areaGradient
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", colorDark);
      };

      const eachNode = nodeType[keyNode];
      if (keyNode === "leaf") {
        Object.keys(eachNode).forEach((keyStatus) => {
          const eachStatus = eachNode[keyStatus];
          setGradient(
            capitalize(keyNode) + keyStatus,
            eachStatus.colorLight,
            eachStatus.colorDark
          );
        });
      } else {
        setGradient(
          capitalize(keyNode),
          eachNode.colorLight,
          eachNode.colorDark
        );
      }
    });

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

    update();

    function update() {
      const nodes = flatten(root);
      const links = root.links();

      link = chartSvg.selectAll(".link").data(links, (d) => d.target.id);
      link.exit().remove();

      const linkEnter = link
        .enter()
        .append("line")
        .attr("class", "link")
        .style("stroke", "#ccc")
        .style("opacity", "0.2")
        .style("stroke-width", 3);

      link = linkEnter.merge(link);

      node = chartSvg.selectAll(".node").data(nodes, (d) => d.id);
      node.exit().remove();

      const nodeEnter = node
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("stroke", "#666")
        .attr("stroke-width", 0)
        .style("fill", color)
        .style("opacity", (d) => (d.data.command === "root" ? 0.9 : 0.5))
        .on("click", nodeClicked)
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
        .attr("r", (d) =>
          d.data.command === "root"
            ? 50
            : Math.max(Math.sqrt(cpuModeOn ? d.data.cpu : d.data.rss) * 15, 5)
        )
        .style("text-anchor", (d) => (d.children ? "end" : "start"))
        .text((d) => d.data.command);

      node = nodeEnter.merge(node);
      simulation.nodes(nodes);
      simulation.nodes().forEach((node) => {
        if (!node.parent) {
          node.fx = CENTER_X;
          node.fy = CENTER_Y;
          fixAllGene(node);
        }
      });
      simulation.force("link").links(links);
    }

    function fixChildren(parentNode) {
      if (parentNode.children) {
        const radius = 200;
        const numChild = parentNode.children.length;
        parentNode.children.forEach((child) => {
          child.fx =
            parentNode.fx +
            radius * Math.cos((2 * Math.PI * child.index) / numChild);
          child.fy =
            parentNode.fy +
            radius * Math.sin((2 * Math.PI * child.index) / numChild);
        });
      }
    }

    function fix2Gene(parentNode) {
      fixChildren(parentNode);
      parentNode.children.forEach((child) => {
        fixChildren(child);
      });
    }

    function fixAllGene(parentNode) {
      if (parentNode.children) {
        fixChildren(parentNode);
        parentNode.children.forEach((child) => {
          fixAllGene(child);
        });
      }
    }

    function color(d) {
      if (d.data.command === "root") {
        return "url(#areaGradientRoot)";
      }
      if (d._children || d.children) {
        return "url(#areaGradientParent)";
      }
      if ("stat" in d.data) {
        return `url(#${"areaGradientLeaf" + d.data.stat[0]})`;
      }
      return "url(#areaGradientLeafU}";
    }

    function ticked() {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
    }

    function nodeClicked(event, d) {
      node.filter((data) => data.id === d.id)
        .attr("stroke", (d) => d3.select(this).attr("stroke") == "#666" ? "red" : "#666")
        .attr("stroke-width", (d) => d3.select(this).attr("stroke-width") == 0 ? 3 : 0);
      console.log(node.filter((data) => data.id === d.id).attr("stroke"))
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

  function drawLegend(tsv) {
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

    legendSvg
      .attr("width", DIM_LEGEND.width)
      .attr(
        "height",
        statusDict.length * (DIM_LEGEND.height + DIM_LEGEND.spacing)
      );

    legendSvg.selectAll("g").remove();

    const g = legendSvg
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
        (d) => nodeType.leaf[d.stat in nodeType.leaf ? d.stat : "U"].colorLight
      )
      .style("opacity", 0.5)
      .attr("class", (d) => "rect_" + d.id);

    g.append("svg:text")
      .attr("x", DIM_LEGEND.width / 2)
      .attr("y", DIM_LEGEND.height / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(
        (d) => nodeType.leaf[d.stat in nodeType.leaf ? d.stat : "U"].displayText
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

    const countChildren = (source) =>
      source.eachAfter((node) => {
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

    hierarchySvg
      .attr("width", DIM_HIERARCHY.width)
      .attr("height", DIM_HIERARCHY.height);

    hierarchySvg.selectAll("g").remove();
    const g = hierarchySvg.append("g");

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
          (contents) => contents.data.command === command
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
            (contents) => contents.data.command === item.command
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
        const ancestorValues = data
          .ancestors()
          .map((item) => item.data.command);
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
      } else if (nextGene === currentGene) {
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
}
