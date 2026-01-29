import type PptxGenJS from "pptxgenjs";

export interface OrgNode {
  id: string;
  label: string;
  subtitle?: string;
  type: "company" | "department" | "person" | "subsidiary";
  roleBadge?: string;
  roleCategory?: "smf" | "cf" | "other";
  ownershipPercent?: number;
  regulatoryStatus?: string;
  linkedFirmId?: string;
  depth: number;
  children: OrgNode[];
  crossDepartment?: boolean;
  managerId?: string;
  managerName?: string;
  department?: string;
  peopleCount?: number;
}

interface LayoutNode {
  node: OrgNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

const CARD_W = 2.4;
const CARD_H = 1.0;
const H_GAP = 0.4;
const V_GAP = 0.7;

function layoutTree(root: OrgNode): LayoutNode[] {
  const nodes: LayoutNode[] = [];
  let nextX = 0.5;

  function measure(node: OrgNode): number {
    if (node.children.length === 0) {
      return CARD_W;
    }
    let totalWidth = 0;
    for (const child of node.children) {
      if (totalWidth > 0) totalWidth += H_GAP;
      totalWidth += measure(child);
    }
    return Math.max(CARD_W, totalWidth);
  }

  function place(node: OrgNode, xStart: number, depth: number) {
    const subtreeWidth = measure(node);
    const x = xStart + subtreeWidth / 2 - CARD_W / 2;
    const y = 1.2 + depth * (CARD_H + V_GAP);
    nodes.push({ node, x, y, width: CARD_W, height: CARD_H });

    let childX = xStart;
    for (const child of node.children) {
      const childWidth = measure(child);
      place(child, childX, depth + 1);
      childX += childWidth + H_GAP;
    }
  }

  measure(root);
  place(root, nextX, 0);
  return nodes;
}

function getNodeFill(type: OrgNode["type"], roleCategory?: string): string {
  switch (type) {
    case "company":
      return "1A5276";
    case "department":
      return "2C3E50";
    case "subsidiary":
      return "1A5276";
    case "person":
      if (roleCategory === "smf") return "FEF9E7";
      if (roleCategory === "cf") return "EBF5FB";
      return "FFFFFF";
    default:
      return "FFFFFF";
  }
}

function getNodeTextColor(type: OrgNode["type"], roleCategory?: string): string {
  if (type === "person") return "1F2933";
  return "FFFFFF";
}

function getBorderColor(type: OrgNode["type"], roleCategory?: string): string {
  if (type === "person") {
    if (roleCategory === "smf") return "F6A609";
    if (roleCategory === "cf") return "2E86C1";
    return "BDC3C7";
  }
  if (type === "subsidiary") return "2E86C1";
  return "1A5276";
}

export async function exportOrgChartPPTX(
  tree: OrgNode,
  firmName: string,
  viewType: "people" | "group"
) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pres = new PptxGenJS();

  pres.layout = "LAYOUT_WIDE";
  pres.author = "MEMA SMCR Tool";
  pres.title = `${firmName} - Org Chart`;

  const slide = pres.addSlide();

  // Title
  slide.addText(`${firmName} — ${viewType === "group" ? "Group Structure" : "Organisation Chart"}`, {
    x: 0.5,
    y: 0.2,
    w: 9,
    h: 0.6,
    fontSize: 18,
    bold: true,
    color: "1F2933",
    fontFace: "Arial",
  });

  // Date
  slide.addText(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), {
    x: 0.5,
    y: 0.7,
    w: 4,
    h: 0.3,
    fontSize: 10,
    color: "7F8C8D",
    fontFace: "Arial",
  });

  const layoutNodes = layoutTree(tree);
  const nodeMap = new Map<string, LayoutNode>();
  for (const ln of layoutNodes) {
    nodeMap.set(ln.node.id, ln);
  }

  // Draw connectors first (behind nodes)
  function drawConnectors(node: OrgNode) {
    const parentLayout = nodeMap.get(node.id);
    if (!parentLayout) return;

    for (const child of node.children) {
      const childLayout = nodeMap.get(child.id);
      if (!childLayout) continue;

      const startX = parentLayout.x + parentLayout.width / 2;
      const startY = parentLayout.y + parentLayout.height;
      const endX = childLayout.x + childLayout.width / 2;
      const endY = childLayout.y;

      const midY = startY + (endY - startY) / 2;

      const connColor = child.crossDepartment ? "E74C3C" : "7F8C8D";
      const connDash: PptxGenJS.ShapeLineProps["dashType"] = child.crossDepartment ? "dash" : "solid";

      // Vertical line down from parent
      slide.addShape("line", {
        x: startX,
        y: startY,
        w: 0,
        h: midY - startY,
        line: { color: connColor, width: 1.5, dashType: connDash },
      });

      // Horizontal line
      if (Math.abs(startX - endX) > 0.01) {
        const lineX = Math.min(startX, endX);
        const lineW = Math.abs(endX - startX);
        slide.addShape("line", {
          x: lineX,
          y: midY,
          w: lineW,
          h: 0,
          line: { color: connColor, width: 1.5, dashType: connDash },
        });
      }

      // Vertical line down to child
      slide.addShape("line", {
        x: endX,
        y: midY,
        w: 0,
        h: endY - midY,
        line: { color: connColor, width: 1.5, dashType: connDash },
      });

      // Ownership % label on connector
      if (child.ownershipPercent != null) {
        slide.addText(`${child.ownershipPercent}%`, {
          x: endX - 0.3,
          y: midY - 0.15,
          w: 0.6,
          h: 0.3,
          fontSize: 8,
          bold: true,
          color: "E74C3C",
          align: "center",
          fontFace: "Arial",
        });
      }

      drawConnectors(child);
    }
  }

  drawConnectors(tree);

  // Draw nodes
  for (const ln of layoutNodes) {
    const { node, x, y, width, height } = ln;
    const fill = getNodeFill(node.type, node.roleCategory);
    const textColor = getNodeTextColor(node.type, node.roleCategory);
    const border = getBorderColor(node.type, node.roleCategory);

    slide.addShape("roundRect", {
      x,
      y,
      w: width,
      h: height,
      fill: { color: fill },
      line: { color: border, width: 1.5 },
      rectRadius: 0.1,
    });

    // Label
    slide.addText(node.label, {
      x: x + 0.1,
      y: y + 0.08,
      w: width - 0.2,
      h: 0.35,
      fontSize: 10,
      bold: true,
      color: textColor,
      fontFace: "Arial",
      valign: "middle",
      shrinkText: true,
    });

    // Subtitle
    if (node.subtitle) {
      slide.addText(node.subtitle, {
        x: x + 0.1,
        y: y + 0.4,
        w: width - 0.2,
        h: 0.25,
        fontSize: 7,
        color: node.type === "person" ? "7F8C8D" : "BDC3C7",
        fontFace: "Arial",
        valign: "middle",
        shrinkText: true,
      });
    }

    // Role badge
    if (node.roleBadge) {
      slide.addText(node.roleBadge, {
        x: x + 0.1,
        y: y + height - 0.28,
        w: width - 0.2,
        h: 0.2,
        fontSize: 7,
        bold: true,
        color: node.roleCategory === "smf" ? "D4AC0D" : "2E86C1",
        fontFace: "Arial",
        valign: "middle",
      });
    }

    // Regulatory status for group entities
    if (node.regulatoryStatus) {
      slide.addText(node.regulatoryStatus, {
        x: x + 0.1,
        y: y + height - 0.28,
        w: width - 0.2,
        h: 0.2,
        fontSize: 7,
        italic: true,
        color: node.type === "person" ? "7F8C8D" : "BDC3C7",
        fontFace: "Arial",
        valign: "middle",
      });
    }
  }

  // Legend
  const legendY = 7.0;
  const legends = viewType === "group"
    ? [
        { color: "1A5276", label: "Parent / Subsidiary" },
        { color: "E74C3C", label: "Ownership %" },
      ]
    : [
        { color: "1A5276", label: "Company" },
        { color: "2C3E50", label: "Department" },
        { color: "F6A609", label: "SMF Role" },
        { color: "2E86C1", label: "CF Role" },
      ];

  legends.forEach((item, i) => {
    slide.addShape("rect", {
      x: 0.5 + i * 2.2,
      y: legendY,
      w: 0.25,
      h: 0.25,
      fill: { color: item.color },
      line: { color: item.color, width: 0.5 },
    });
    slide.addText(item.label, {
      x: 0.85 + i * 2.2,
      y: legendY,
      w: 1.5,
      h: 0.25,
      fontSize: 8,
      color: "7F8C8D",
      fontFace: "Arial",
      valign: "middle",
    });
  });

  await pres.writeFile({ fileName: `${firmName.replace(/[^a-zA-Z0-9]/g, "_")}_OrgChart.pptx` });
}
