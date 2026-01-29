"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Building2,
  Building,
  Users,
  User,
  ChevronDown,
  Plus,
  Trash2,
  Link as LinkIcon,
  ExternalLink,
  Download,
  FileImage,
  FileSpreadsheet,
  X,
  Network,
  GitBranch,
} from "lucide-react";
import { useSmcrStore, type GroupEntity } from "@/stores/useSmcrStore";
import type { Individual } from "@/lib/validation";
import type { OrgNode } from "./utils/export-pptx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "people" | "group";

interface OrgPerson extends Individual {
  department?: string;
  managerId?: string;
  roleCategory?: "smf" | "cf" | "other";
}

// ---------------------------------------------------------------------------
// Tree builders
// ---------------------------------------------------------------------------

function buildPeopleTree(
  firmName: string,
  individuals: Individual[]
): OrgNode {
  const people: OrgPerson[] = individuals.map((ind) => ({
    ...ind,
    department: extractDepartment(ind),
    roleCategory: ind.smfRoles.some((r) => r.startsWith("SMF")) ? "smf" : "other",
  }));

  // Group by department
  const deptMap = new Map<string, OrgPerson[]>();
  for (const p of people) {
    const dept = p.department || "Unassigned";
    if (!deptMap.has(dept)) deptMap.set(dept, []);
    deptMap.get(dept)!.push(p);
  }

  // Build department children
  const deptNodes: OrgNode[] = [];
  Array.from(deptMap.entries()).forEach(([dept, members]) => {
    // Within each department, build manager hierarchy
    const personNodes = buildManagerHierarchy(members, people);
    deptNodes.push({
      id: `dept-${dept}`,
      label: dept,
      type: "department",
      depth: 1,
      children: personNodes,
    });
  });

  // Sort: Unassigned last
  deptNodes.sort((a, b) => {
    if (a.label === "Unassigned") return 1;
    if (b.label === "Unassigned") return -1;
    return a.label.localeCompare(b.label);
  });

  return {
    id: "root",
    label: firmName || "Organisation",
    type: "company",
    depth: 0,
    children: deptNodes,
  };
}

function extractDepartment(ind: Individual): string {
  // Infer department from SMF roles
  for (const role of ind.smfRoles) {
    if (role.includes("Compliance")) return "Compliance";
    if (role.includes("Risk")) return "Risk";
    if (role.includes("Audit")) return "Audit";
    if (role.includes("Finance") || role.includes("CFO")) return "Finance";
    if (role.includes("Operations") || role.includes("COO")) return "Operations";
    if (role.includes("Actuary") || role.includes("Underwriting")) return "Underwriting";
    if (role.includes("Chief Executive") || role.includes("CEO")) return "Executive";
    if (role.includes("Executive Director")) return "Executive";
    if (role.includes("Chair")) return "Board";
    if (role.includes("MLRO") || role.includes("Money Laundering")) return "Financial Crime";
  }
  return "General";
}

function buildManagerHierarchy(
  members: OrgPerson[],
  allPeople: OrgPerson[]
): OrgNode[] {
  const managerMap = new Map<string | undefined, OrgPerson[]>();
  for (const m of members) {
    const mgrId = m.managerId;
    if (!managerMap.has(mgrId)) managerMap.set(mgrId, []);
    managerMap.get(mgrId)!.push(m);
  }

  // People without managers are roots; if none exist, show all as flat list
  const topLevel = managerMap.get(undefined) ?? [];
  const roots = topLevel.length > 0 ? topLevel : members;

  function buildPersonNode(person: OrgPerson, depth: number, visited: Set<string>): OrgNode {
    // Guard against circular managerId references
    if (visited.has(person.id)) {
      return {
        id: person.id,
        label: person.name,
        type: "person",
        depth,
        children: [],
      };
    }
    const nextVisited = new Set(visited);
    nextVisited.add(person.id);

    const reports = managerMap.get(person.id) || [];
    const managerPerson = person.managerId
      ? allPeople.find((p) => p.id === person.managerId)
      : undefined;
    const crossDept =
      managerPerson != null && managerPerson.department !== person.department;

    return {
      id: person.id,
      label: person.name,
      subtitle: person.smfRoles.join(", "),
      type: "person",
      roleBadge: person.smfRoles
        .map((r) => r.split(" - ")[0])
        .filter(Boolean)
        .join(", "),
      roleCategory: person.roleCategory,
      depth,
      children: reports.map((r) => buildPersonNode(r, depth + 1, nextVisited)),
      crossDepartment: crossDept,
      managerId: person.managerId,
      managerName: managerPerson?.name,
      department: person.department,
    };
  }

  return roots.map((p) => buildPersonNode(p, 2, new Set()));
}

function buildGroupTree(entities: GroupEntity[]): OrgNode {
  const roots = entities.filter((e) => !e.parentId);
  const childMap = new Map<string, GroupEntity[]>();
  for (const e of entities) {
    if (e.parentId) {
      if (!childMap.has(e.parentId)) childMap.set(e.parentId, []);
      childMap.get(e.parentId)!.push(e);
    }
  }

  function toNode(entity: GroupEntity, depth: number, visited: Set<string>): OrgNode {
    // Guard against circular parentId references or extreme depth
    if (visited.has(entity.id) || depth > 50) {
      return {
        id: entity.id,
        label: entity.name,
        type: entity.type === "parent" ? "company" : "subsidiary",
        depth,
        children: [],
      };
    }
    const nextVisited = new Set(visited);
    nextVisited.add(entity.id);

    const children = (childMap.get(entity.id) || []).map((c) =>
      toNode(c, depth + 1, nextVisited)
    );
    return {
      id: entity.id,
      label: entity.name,
      subtitle: entity.country || undefined,
      type: entity.type === "parent" ? "company" : "subsidiary",
      ownershipPercent: entity.ownershipPercent,
      regulatoryStatus: entity.regulatoryStatus,
      linkedFirmId: entity.linkedFirmId,
      depth,
      children,
    };
  }

  if (roots.length === 0) {
    return {
      id: "empty-group",
      label: "No group entities",
      type: "company",
      depth: 0,
      children: [],
    };
  }

  if (roots.length === 1) {
    return toNode(roots[0], 0, new Set());
  }

  // Multiple roots — wrap in a virtual holding node
  return {
    id: "group-root",
    label: "Corporate Group",
    type: "company",
    depth: 0,
    children: roots.map((r) => toNode(r, 1, new Set())),
  };
}

// ---------------------------------------------------------------------------
// Connector SVG renderer
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Node card components
// ---------------------------------------------------------------------------

function CompanyCard({
  node,
  highlighted,
  onClick,
}: {
  node: OrgNode;
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Company: ${node.label}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`rounded-2xl border-2 px-4 py-3 cursor-pointer transition-all min-w-[180px] max-w-[220px] focus:outline-none focus:ring-2 focus:ring-emerald ${
        highlighted
          ? "border-emerald bg-emerald/20 shadow-lg"
          : "border-blue-600 bg-blue-900/60 hover:bg-blue-900/80"
      }`}
    >
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-blue-300 shrink-0" />
        <span className="text-sm font-bold text-white truncate">
          {node.label}
        </span>
      </div>
      {node.subtitle && (
        <p className="text-xs text-blue-200 mt-1 truncate">{node.subtitle}</p>
      )}
    </div>
  );
}

function DepartmentCard({
  node,
  highlighted,
  onClick,
}: {
  node: OrgNode;
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Department: ${node.label}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`rounded-xl border px-3 py-2 cursor-pointer transition-all min-w-[160px] max-w-[200px] focus:outline-none focus:ring-2 focus:ring-emerald ${
        highlighted
          ? "border-emerald bg-emerald/20 shadow-lg"
          : "border-slate-500 bg-slate-700/60 hover:bg-slate-700/80"
      }`}
    >
      <div className="flex items-center gap-2">
        <Users className="size-4 text-slate-300 shrink-0" />
        <span className="text-xs font-semibold text-slate-100 truncate">
          {node.label}
        </span>
      </div>
    </div>
  );
}

function PersonCard({
  node,
  highlighted,
  onClick,
}: {
  node: OrgNode;
  highlighted: boolean;
  onClick: () => void;
}) {
  const borderClass =
    node.roleCategory === "smf"
      ? "border-warning"
      : node.roleCategory === "cf"
      ? "border-blue-400"
      : "border-white/20";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Person: ${node.label}${node.roleBadge ? `, roles: ${node.roleBadge}` : ""}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`rounded-xl border-2 px-3 py-2 cursor-pointer transition-all min-w-[160px] max-w-[200px] focus:outline-none focus:ring-2 focus:ring-emerald ${
        highlighted
          ? `${borderClass} bg-emerald/20 shadow-lg ring-2 ring-emerald`
          : `${borderClass} bg-white/5 hover:bg-white/10`
      }`}
    >
      <div className="flex items-center gap-2">
        <User className="size-4 text-sand/70 shrink-0" />
        <span className="text-xs font-semibold text-sand truncate">
          {node.label}
        </span>
      </div>
      {node.roleBadge && (
        <div className="mt-1 flex flex-wrap gap-1">
          {node.roleBadge.split(", ").map((badge, idx) => (
            <span
              key={`${badge}-${idx}`}
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                node.roleCategory === "smf"
                  ? "bg-warning/20 text-warning"
                  : "bg-blue-400/20 text-blue-300"
              }`}
            >
              {badge}
            </span>
          ))}
        </div>
      )}
      {node.managerName && (
        <p className="text-[10px] text-sand/50 mt-1 truncate">
          Reports to: {node.managerName}
        </p>
      )}
    </div>
  );
}

function SubsidiaryCard({
  node,
  highlighted,
  onClick,
}: {
  node: OrgNode;
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Subsidiary: ${node.label}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`rounded-2xl border-2 px-4 py-3 cursor-pointer transition-all min-w-[180px] max-w-[220px] focus:outline-none focus:ring-2 focus:ring-emerald ${
        highlighted
          ? "border-emerald bg-emerald/20 shadow-lg"
          : "border-blue-400 bg-blue-800/40 hover:bg-blue-800/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <Building className="size-4 text-blue-300 shrink-0" />
        <span className="text-sm font-semibold text-white truncate">
          {node.label}
        </span>
      </div>
      {node.regulatoryStatus && (
        <p className="text-[10px] text-blue-200 mt-1 italic truncate">
          {node.regulatoryStatus}
        </p>
      )}
      {node.linkedFirmId && (
        <div className="flex items-center gap-1 mt-1 text-emerald text-[10px]">
          <LinkIcon className="size-3" />
          <span>Linked firm</span>
          {node.peopleCount != null && (
            <span className="ml-1 text-sand/50">
              ({node.peopleCount} people)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recursive tree renderer
// ---------------------------------------------------------------------------

function TreeNodeRenderer({
  node,
  highlightedChain,
  onNodeClick,
}: {
  node: OrgNode;
  highlightedChain: Set<string>;
  onNodeClick: (nodeId: string) => void;
}) {
  const isHighlighted = highlightedChain.has(node.id);

  const card = (() => {
    switch (node.type) {
      case "company":
        return (
          <CompanyCard
            node={node}
            highlighted={isHighlighted}
            onClick={() => onNodeClick(node.id)}
          />
        );
      case "department":
        return (
          <DepartmentCard
            node={node}
            highlighted={isHighlighted}
            onClick={() => onNodeClick(node.id)}
          />
        );
      case "person":
        return (
          <PersonCard
            node={node}
            highlighted={isHighlighted}
            onClick={() => onNodeClick(node.id)}
          />
        );
      case "subsidiary":
        return (
          <SubsidiaryCard
            node={node}
            highlighted={isHighlighted}
            onClick={() => onNodeClick(node.id)}
          />
        );
    }
  })();

  return (
    <div className="flex flex-col items-center">
      {card}
      {node.children.length > 0 && (
        <div className="mt-1 flex flex-col items-center">
          {/* Connector line down */}
          <div
            className={`w-px h-6 ${
              node.children.some((c) => c.crossDepartment)
                ? "border-l-2 border-dashed border-danger"
                : "bg-slate-500"
            }`}
          />
          {/* Horizontal bar */}
          {node.children.length > 1 && (
            <div className="flex items-start">
              <div className="h-px bg-slate-500 self-start" style={{ width: `${(node.children.length - 1) * 200}px` }} />
            </div>
          )}
          <div className="flex gap-4 flex-wrap justify-center">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Connector line down to child */}
                <div
                  className={`w-px h-4 ${
                    child.crossDepartment
                      ? "border-l-2 border-dashed border-danger"
                      : "bg-slate-500"
                  }`}
                />
                {child.ownershipPercent != null && (
                  <span className="mb-1 px-2 py-0.5 rounded-full bg-blue-900 text-blue-200 text-[10px] font-bold">
                    {child.ownershipPercent}%
                  </span>
                )}
                <TreeNodeRenderer
                  node={child}
                  highlightedChain={highlightedChain}
                  onNodeClick={onNodeClick}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Entity Dialog
// ---------------------------------------------------------------------------

function AddEntityDialog({
  parentEntities,
  onAdd,
  onClose,
}: {
  parentEntities: GroupEntity[];
  onAdd: (entity: Omit<GroupEntity, "id">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<GroupEntity["type"]>("subsidiary");
  const [parentId, setParentId] = useState<string>("");
  const [ownershipPercent, setOwnershipPercent] = useState<string>("");
  const [country, setCountry] = useState("");
  const [regulatoryStatus, setRegulatoryStatus] = useState("");
  const [linkedProjectName, setLinkedProjectName] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      type,
      parentId: parentId || undefined,
      ownershipPercent: ownershipPercent && !isNaN(Number(ownershipPercent))
        ? Number(ownershipPercent)
        : undefined,
      country: country || undefined,
      regulatoryStatus: regulatoryStatus || undefined,
      linkedProjectName: linkedProjectName || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Add Group Entity"
    >
      <div className="glass-panel p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-sand">Add Group Entity</h3>
          <button onClick={onClose} className="text-sand/50 hover:text-sand">
            <X className="size-5" />
          </button>
        </div>

        <label className="block text-sm text-sand/80">
          Entity Name *
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-xl border border-white/20 bg-midnight/60 px-3 py-2 text-sand focus:border-emerald focus:outline-none"
            placeholder="e.g. Fanta Ltd"
            autoFocus
          />
        </label>

        <label className="block text-sm text-sand/80">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as GroupEntity["type"])}
            className="mt-1 w-full rounded-xl border border-white/20 bg-midnight/60 px-3 py-2 text-sand focus:border-emerald focus:outline-none"
          >
            <option value="parent">Parent</option>
            <option value="subsidiary">Subsidiary</option>
            <option value="associate">Associate</option>
          </select>
        </label>

        {parentEntities.length > 0 && (
          <label className="block text-sm text-sand/80">
            Parent Entity
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/20 bg-midnight/60 px-3 py-2 text-sand focus:border-emerald focus:outline-none"
            >
              <option value="">None (top-level)</option>
              {parentEntities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm text-sand/80">
          Ownership %
          <input
            type="number"
            min={0}
            max={100}
            value={ownershipPercent}
            onChange={(e) => setOwnershipPercent(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/20 bg-midnight/60 px-3 py-2 text-sand focus:border-emerald focus:outline-none"
            placeholder="e.g. 25"
          />
        </label>

        <label className="block text-sm text-sand/80">
          Country
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-xl border border-white/20 bg-midnight/60 px-3 py-2 text-sand focus:border-emerald focus:outline-none"
            placeholder="e.g. United Kingdom"
          />
        </label>

        <label className="block text-sm text-sand/80">
          Regulatory Status
          <input
            type="text"
            value={regulatoryStatus}
            onChange={(e) => setRegulatoryStatus(e.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-xl border border-white/20 bg-midnight/60 px-3 py-2 text-sand focus:border-emerald focus:outline-none"
            placeholder="e.g. FCA Authorised"
          />
        </label>

        <label className="block text-sm text-sand/80">
          Link to Authorization Project (optional)
          <input
            type="text"
            value={linkedProjectName}
            onChange={(e) => setLinkedProjectName(e.target.value)}
            maxLength={200}
            className="mt-1 w-full rounded-xl border border-white/20 bg-midnight/60 px-3 py-2 text-sand focus:border-emerald focus:outline-none"
            placeholder="Project name"
          />
        </label>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            className="flex-1 rounded-full bg-emerald/90 text-midnight px-4 py-2 font-semibold hover:bg-emerald transition"
          >
            Add Entity
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-white/20 text-sand px-4 py-2 hover:bg-white/5 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entity Detail Panel
// ---------------------------------------------------------------------------

function EntityDetailPanel({
  entity,
  onClose,
  onDelete,
  onUpdate,
}: {
  entity: GroupEntity;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<GroupEntity>) => void;
}) {
  const [isLinkingProject, setIsLinkingProject] = useState(false);
  const [projectInput, setProjectInput] = useState("");

  const handleLinkProject = () => {
    const trimmed = projectInput.trim();
    if (trimmed) {
      onUpdate({ linkedProjectName: trimmed });
      setProjectInput("");
      setIsLinkingProject(false);
    }
  };

  return (
    <div className="glass-panel p-4 space-y-3 w-72">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-sand">{entity.name}</h4>
        <button onClick={onClose} className="text-sand/50 hover:text-sand">
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-2 text-xs text-sand/70">
        <p>
          <span className="text-sand/50">Type:</span>{" "}
          {entity.type}
        </p>
        {entity.ownershipPercent != null && (
          <p>
            <span className="text-sand/50">Ownership:</span>{" "}
            {entity.ownershipPercent}%
          </p>
        )}
        {entity.country && (
          <p>
            <span className="text-sand/50">Country:</span> {entity.country}
          </p>
        )}
        {entity.regulatoryStatus && (
          <p>
            <span className="text-sand/50">Status:</span>{" "}
            {entity.regulatoryStatus}
          </p>
        )}
        {entity.linkedProjectName ? (
          <div className="flex items-center gap-1 text-emerald">
            <ExternalLink className="size-3" />
            <span>{entity.linkedProjectName}</span>
          </div>
        ) : isLinkingProject ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={projectInput}
              onChange={(e) => setProjectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLinkProject();
                if (e.key === "Escape") setIsLinkingProject(false);
              }}
              maxLength={200}
              className="w-full rounded-lg border border-white/20 bg-midnight/60 px-2 py-1 text-xs text-sand focus:border-emerald focus:outline-none"
              placeholder="Authorization project name"
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={handleLinkProject}
                className="flex-1 rounded-lg bg-emerald/80 text-midnight text-[10px] py-1 font-semibold hover:bg-emerald transition"
              >
                Link
              </button>
              <button
                onClick={() => {
                  setIsLinkingProject(false);
                  setProjectInput("");
                }}
                className="flex-1 rounded-lg border border-white/20 text-sand/60 text-[10px] py-1 hover:bg-white/5 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsLinkingProject(true)}
            className="inline-flex items-center gap-1 text-emerald hover:text-emerald/80"
          >
            <LinkIcon className="size-3" />
            Link to Authorization Project
          </button>
        )}
      </div>
      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-1 rounded-lg border border-danger/30 text-danger text-xs py-1.5 hover:bg-danger/10 transition"
      >
        <Trash2 className="size-3" />
        Remove Entity
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export Dropdown
// ---------------------------------------------------------------------------

function ExportDropdown({
  onExportPPTX,
  onExportPNG,
}: {
  onExportPPTX: () => void;
  onExportPNG: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-sand hover:bg-white/5 transition"
      >
        <Download className="size-4" />
        Export
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 glass-panel rounded-xl overflow-hidden min-w-[180px]">
            <button
              onClick={() => {
                onExportPPTX();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-sand hover:bg-white/10 transition"
            >
              <FileSpreadsheet className="size-4 text-emerald" />
              Export as PPTX
            </button>
            <button
              onClick={() => {
                onExportPNG();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-sand hover:bg-white/10 transition border-t border-white/10"
            >
              <FileImage className="size-4 text-blue-400" />
              Export as PNG
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function OrgChartClient() {
  const firmProfile = useSmcrStore((s) => s.firmProfile);
  const individuals = useSmcrStore((s) => s.individuals);
  const groupEntities = useSmcrStore((s) => s.groupEntities);
  const addGroupEntity = useSmcrStore((s) => s.addGroupEntity);
  const updateGroupEntity = useSmcrStore((s) => s.updateGroupEntity);
  const removeGroupEntity = useSmcrStore((s) => s.removeGroupEntity);

  const [viewMode, setViewMode] = useState<ViewMode>("people");
  const [highlightedChain, setHighlightedChain] = useState<Set<string>>(
    new Set()
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Build trees
  const peopleTree = useMemo(
    () => buildPeopleTree(firmProfile.firmName || "Organisation", individuals),
    [firmProfile.firmName, individuals]
  );

  const groupTree = useMemo(
    () => buildGroupTree(groupEntities),
    [groupEntities]
  );

  const activeTree = viewMode === "people" ? peopleTree : groupTree;

  // Reporting chain highlight
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (viewMode === "group") {
        setSelectedEntityId((prev) => (prev === nodeId ? null : nodeId));
        return;
      }

      // Build chain upward from clicked node
      const chain = new Set<string>();
      function findChain(node: OrgNode, target: string, path: string[]): boolean {
        if (node.id === target) {
          for (const id of [...path, target]) chain.add(id);
          return true;
        }
        for (const child of node.children) {
          if (findChain(child, target, [...path, node.id])) return true;
        }
        return false;
      }
      findChain(activeTree, nodeId, []);

      // Toggle: if already highlighted, clear (functional update avoids stale closure)
      setHighlightedChain((prev) => {
        if (prev.has(nodeId) && prev.size > 0) {
          return new Set();
        }
        return chain;
      });
    },
    [activeTree, viewMode]
  );

  // Export handlers
  const handleExportPPTX = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const { exportOrgChartPPTX } = await import("./utils/export-pptx");
      await exportOrgChartPPTX(
        activeTree,
        firmProfile.firmName || "Organisation",
        viewMode
      );
    } catch (err) {
      console.error("Failed to export PPTX:", err);
      alert("Failed to export PPTX. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [activeTree, firmProfile.firmName, viewMode, isExporting]);

  const handleExportPNG = useCallback(async () => {
    if (isExporting) return;
    if (!chartRef.current) {
      alert("Chart not ready for export. Please try again.");
      return;
    }
    setIsExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#032029",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${(firmProfile.firmName || "OrgChart").replace(/[^a-zA-Z0-9]/g, "_")}_OrgChart.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export PNG:", err);
      alert("Failed to export PNG. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [firmProfile.firmName, isExporting]);

  // Selected entity for detail panel
  const selectedEntity = selectedEntityId
    ? groupEntities.find((e) => e.id === selectedEntityId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">
            org chart
          </p>
          <h2 className="text-2xl font-display">
            {firmProfile.firmName || "Organisation"} — Structure
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <ExportDropdown
            onExportPPTX={handleExportPPTX}
            onExportPNG={handleExportPNG}
          />
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("people")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            viewMode === "people"
              ? "bg-emerald/20 text-emerald border border-emerald/40"
              : "text-sand/60 border border-white/10 hover:bg-white/5"
          }`}
        >
          <Network className="size-4" />
          People View
        </button>
        <button
          onClick={() => setViewMode("group")}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            viewMode === "group"
              ? "bg-emerald/20 text-emerald border border-emerald/40"
              : "text-sand/60 border border-white/10 hover:bg-white/5"
          }`}
        >
          <GitBranch className="size-4" />
          Group View
        </button>

        {viewMode === "group" && (
          <button
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald/90 text-midnight px-4 py-2 text-sm font-semibold hover:bg-emerald transition ml-auto"
          >
            <Plus className="size-4" />
            Add Entity
          </button>
        )}
      </div>

      {/* Chart Area */}
      <div className="glass-panel p-6 overflow-x-auto">
        <div
          ref={chartRef}
          className="flex justify-center min-w-[600px] py-4"
        >
          {viewMode === "people" && individuals.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Users className="size-12 text-sand/30 mx-auto" />
              <p className="text-sand/50 text-sm">
                No individuals added yet. Add SMF individuals in the Builder to
                see the organisation chart.
              </p>
            </div>
          ) : viewMode === "group" && groupEntities.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Building2 className="size-12 text-sand/30 mx-auto" />
              <p className="text-sand/50 text-sm">
                No group entities added yet. Click &quot;Add Entity&quot; to
                build your corporate group structure.
              </p>
            </div>
          ) : (
            <TreeNodeRenderer
              node={activeTree}
              highlightedChain={highlightedChain}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-sand/60">
        {viewMode === "people" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-900 border border-blue-600" />
              <span>Company</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-slate-700 border border-slate-500" />
              <span>Department</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-white/5 border-2 border-warning" />
              <span>SMF Role</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-white/5 border-2 border-blue-400" />
              <span>CF Role</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 border-t-2 border-dashed border-danger" />
              <span>Cross-department report</span>
            </div>
            <div className="flex items-center gap-2 ml-4 text-sand/40 italic">
              Click a person to highlight their reporting chain
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-900 border border-blue-600" />
              <span>Parent / Company</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-800/40 border-2 border-blue-400" />
              <span>Subsidiary / Associate</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-blue-900 text-blue-200 text-[10px] font-bold">
                25%
              </span>
              <span>Ownership %</span>
            </div>
          </>
        )}
      </div>

      {/* Entity Detail Panel */}
      {selectedEntity && (
        <div className="fixed bottom-4 right-4 z-40">
          <EntityDetailPanel
            entity={selectedEntity}
            onClose={() => setSelectedEntityId(null)}
            onDelete={() => {
              removeGroupEntity(selectedEntity.id);
              setSelectedEntityId(null);
            }}
            onUpdate={(updates) =>
              updateGroupEntity(selectedEntity.id, updates)
            }
          />
        </div>
      )}

      {/* Add Entity Dialog */}
      {showAddDialog && (
        <AddEntityDialog
          parentEntities={groupEntities}
          onAdd={addGroupEntity}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  );
}
