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

// Mapping of step commands to colors.
var COLORS = d3.scaleOrdinal(d3.schemeCategory10);

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

d3.tsv("./data/process_data.tsv").then(function (text) {
  const json = buildHierarchy(text);
  createVisualization(json);
});

// Main function to draw and set up the visualization, once we have the data.
function createVisualization(json) {
  // Basic setup of page elements.
  initializeBreadcrumbTrail();
  drawLegend();
  d3.select("#togglelegend").on("click", toggleLegend);
  drawHierarchy(json);

  // Bounding circle underneath the sunburst, to make it easier to detect
  // when the mouse leaves the parent g.
  vis.append("svg:circle").attr("r", RADIUS).style("opacity", 0);

  // Turn the data into a d3 hierarchy and calculate the sums.
  let root = d3
    .hierarchy(json)
    .sum((d) => {
        console.log(d)
        return d.cpu})
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
    .style("fill", (d) => {
        return COLORS(d.data.command)})
    .style("opacity", 1)
    .on("mouseover", mouseover);

  // Add the mouseleave handler to the bounding circle.
  d3.select("#container").on("mouseleave", mouseleave);

  // Get total size of the tree = value of root node from partition.
  totalSize = path.datum().value;
}

// Fade all but the current sequence, and show it in the breadcrumb trail.
function mouseover(event, d) {
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
    .attr("x", (B.w + B.t) / 2)
    .attr("y", B.h / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text((d) => d.data.command);

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

  let legend = d3
    .select("#legend")
    .append("svg:svg")
    .attr("width", li.w)
    .attr("height", Object.keys(COLORS).length * (li.h + li.s));

  let g = legend
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
    .style("fill", (d) => d[1])
    .style("opacity", 0.5)
    .attr("class", function (d) {return "rect_" + d[0]; });

  g.append("svg:text")
    .attr("x", li.w / 2)
    .attr("y", li.h / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .text((d) => d[0]);
  
  g.on("mouseover", mouseoverLegend)
    .on("mouseleave", mouseleaveLegend);
}

function toggleLegend() {
  let legend = d3.select("#legend");
  if (legend.style("visibility") == "hidden") {
    legend.style("visibility", "");
  } else {
    legend.style("visibility", "hidden");
  }
}

function mouseoverLegend(event, d) {
  // mouseoverしたボタンを濃くする
  d3.selectAll(".rect_" + d[0])
    .style("opacity", 1);

  // mouseoverした名前のデータをハイライト表示する
  d3.selectAll("path")
    .style("opacity", 0.3)
    .filter(function(nd) {return nd.data.name == d[0]; })
    .style("opacity", 1);

}

function mouseleaveLegend(event, d) {
  // ボタンの色を薄く戻す
  d3.selectAll("rect")
    .style("opacity", 0.5);

  // ハイライト表示を戻す
  d3.selectAll("path")
    .style("opacity", 1);
}

function drawHierarchy(json) {
  // 参考：https://qiita.com/e_a_s_y/items/dd1f0f9366ce5d1d1e7c
  const rectSize = {
    height: 20,
    width: 80,
  };

  // ノード間のスペースなど
  const basicSpace = {
    padding: 30,
    height: 50,
    width: 120,
  };

  const root = d3.hierarchy(json);
  const tree = d3.tree();
  tree(root);
  root.count();

  // 全体 svg 要素の高さと幅を計算し生成
  // 末端ノードの数 * ノードの高さ + (末端ノードの数 - 1) * (ノードの基準点どうしの縦幅 - ノードの高さ) + 上下の余白
  const height =
    root.value * rectSize.height +
    (root.value - 1) * (basicSpace.height - rectSize.height) +
    basicSpace.padding * 2;

  // (rootの高さ + 1) * ノードの幅 + root の高さ * (ノードの基準点どうしの横幅 - ノードの幅) + 上下の余白
  // 最終的に90度回転した状態になるため root の存在する高さで横幅を計算する
  const width =
    (root.height + 1) * rectSize.width +
    root.height * (basicSpace.width - rectSize.width) +
    basicSpace.padding * 2;

  const hierarchy = d3
    .select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // 渡された name を含む階層階層を探索（同じ parent の）
  const seekParent = (currentData, command) => {
    // 今処理しているノードの親の子たちを取得することでその階層のデータを取得
    const crntHrcy = currentData.parent.children;
    // 取得した階層に、今探しているnameを含むものがいれば、それが目的の階層
    const target = crntHrcy.find((contents) => contents.data.command == command);
    // 見つかればその階層を name とセットで返却
    // 見つからなければ親を渡して再帰処理させることで一つ上の階層を探索させる
    return target
      ? { command: command, hierarchy: crntHrcy }
      : seekParent(currentData.parent, command);
  };

  // 自分より上にいる末端ノードの数を配列として取り出す
  const calcLeaves = (commands, currentData) => {
    // 親の含まれる階層をそれぞれ抽出する（name と階層の JSON で）
    const eachHierarchies = commands.map((command) => seekParent(currentData, command));
    // それぞれの階層における、そのnameの位置（インデックス）を取得
    const eachIdxes = eachHierarchies.map((item) =>
      item.hierarchy.findIndex((contents) => contents.data.command == item.command)
    );
    // 先ほど取得したインデックスを使って、それぞれの階層をスライスする
    const filteredHierarchies = eachHierarchies.map((item, idx) =>
      item.hierarchy.slice(0, eachIdxes[idx])
    );
    // それぞれの階層に含まれるvalueを抽出
    const values = filteredHierarchies.map((hierarchy) =>
      hierarchy.map((item) => item.value)
    );
    // 平坦化して返却
    return values.flat();
  };

  // y 座標の計算
  const defineY = (data, spaceInfo) => {
    // 親をたどる配列からバインドされたデータを抽出
    const ancestorValues = data.ancestors().map((item) => item.data.command);
    // 自分より上にいる末端ノードの数を配列として取り出す
    const leaves = calcLeaves(
      ancestorValues.slice(0, ancestorValues.length - 1),
      data
    );
    // ノードの数を合計
    const sumLeaves = leaves.reduce(
      (previous, current) => previous + current,
      0
    );
    // y 座標を計算 末端ノードの数 * ノードの基準点同士の縦幅 + 上の余白
    return sumLeaves * spaceInfo.height + spaceInfo.padding;
  };

  // 位置決め
  const definePos = (treeData, spaceInfo) => {
    treeData.each((d) => {
      // x 座標は 深さ * ノード間の幅 + 左側の余白
      d.x = d.depth * spaceInfo.width + spaceInfo.padding;
      d.y = defineY(d, spaceInfo);
    });
  };
  definePos(root, basicSpace);

  // 全体をグループ化
  const g = hierarchy.append("g");

  // path要素の追加
  g.selectAll(".link")
    .data(root.descendants().slice(1))
    .enter()
    .append("path")
    .attr("class", "link")
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("d", (d) =>
      `M${d.x},${d.y}
    L${d.parent.x + rectSize.width + (basicSpace.width - rectSize.width) / 2},${
        d.y
      }
    ${d.parent.x + rectSize.width + (basicSpace.width - rectSize.width) / 2},${
        d.parent.y
      }
    ${d.parent.x + rectSize.width},${d.parent.y}`
        .replace(/\r?\n/g, "")
        .replace(/\s+/g, " ")
    )
    .attr("transform", (d) => `translate(0, ${rectSize.height / 2})`);

  // 各ノード用グループの作成
  const node = g
    .selectAll(".node")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

  // 四角
  node
    .append("rect")
    .attr("width", rectSize.width)
    .attr("height", rectSize.height)
    .attr("fill", "#fff")
    .attr("stroke", "black");

  // テキスト
  node
    .append("text")
    .text((d) => d.data.command)
    .attr("transform", `translate(5, 15)`);
}

// Take a 2-column tsv and transform it into a hierarchical structure suitable
// for a partition layout. The first column is a sequence of step names, from
// root to leaf, separated by hyphens. The second column is a count of how
// often that sequence occurred.
function buildHierarchy(tsv) {
  let root = { command: "root", children: [] };
  let length = tsv.length;
  let parentNode = root;
  let children;
  let childNode;
  for (i in tsv) {
    i = Number(i)
    tsv_row = tsv[i];
    if(i == length-1){
        break;
    }
    const user = tsv_row["USER"];
    const pid = tsv_row["PID"];
    const cpu = tsv_row["%CPU"]
    const rss = tsv_row["RSS"];
    const stat = tsv_row["STAT"];
    const command = tsv_row["COMMAND"]
    const gene = Number(tsv_row["GENE"])

    if(tsv[i+1]["GENE"] > tsv_row["GENE"]){
        childNode = { command: command, user: user, pid: pid, cpu: cpu, rss: rss, stat: stat, parent: parentNode, children: []}
        parentNode["children"].push(childNode)
        parentNode = childNode;
    }else if(tsv[i+1]["GENE"] == tsv_row["GENE"]){
        childNode = { command: command, user: user, pid: pid, cpu: cpu, rss: rss, stat: stat, parent: parentNode, children: []}
        parentNode["children"].push(childNode)
    }else{
        childNode = { command: command, user: user, pid: pid, cpu: cpu, rss: rss, stat: stat, parent: parentNode, children: []}
        parentNode["children"].push(childNode)
        gene_gap = tsv_row["GENE"] - tsv[i+1]["GENE"]
        for(let j = 0; j < gene_gap; j++){
            parentNode = parentNode["parent"]
        }
    }
  }
  return root;
}
