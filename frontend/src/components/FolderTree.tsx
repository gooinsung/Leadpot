import { useEffect, useMemo, useState } from "react";
import {
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
  type FolderItem,
  type FolderKind,
} from "../api/client";
import { toast } from "../lib/toast";

/** 목록 필터 선택값. null = 전체, "unfiled" = 미분류, 숫자 = 특정 폴더. */
export type FolderSelection = number | null | "unfiled";

interface TreeNode extends FolderItem {
  children: TreeNode[];
}

/** 접힌 폴더 id 는 브라우저별로 기억한다(편의 기능 — 저장 실패해도 펼친 채로 동작). */
function collapsedKey(kind: FolderKind): string {
  return `leadpot.folderTree.collapsed.${kind}`;
}

function loadCollapsed(kind: FolderKind): Set<number> {
  try {
    const raw = window.localStorage.getItem(collapsedKey(kind));
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is number => typeof x === "number") : []);
  } catch {
    return new Set();
  }
}

function saveCollapsed(kind: FolderKind, ids: Set<number>) {
  try {
    window.localStorage.setItem(collapsedKey(kind), JSON.stringify([...ids]));
  } catch {
    // 저장 불가(사생활 보호 모드 등) — 이번 화면에서만 유지
  }
}

function buildTree(folders: FolderItem[]): TreeNode[] {
  const byId = new Map<number, TreeNode>(folders.map((f) => [f.id, { ...f, children: [] }]));
  const roots: TreeNode[] = [];
  for (const f of byId.values()) {
    if (f.parentId != null && byId.has(f.parentId)) byId.get(f.parentId)!.children.push(f);
    else roots.push(f);
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/**
 * 리드폼/랜딩 목록용 폴더 트리(K-폴더, 무제한 depth). '📁 새 폴더'로 생성, 더블클릭으로 이름 변경,
 * 목록 행을 드래그해서 폴더에 놓으면 이동한다(onDropItem). 하위 폴더가 있으면 ▸/▾ 로 접고 펼친다. 폴더 자체는 삭제해도 안의 항목은
 * 미분류로 남는다(서버가 처리).
 */
export function FolderTree({
  kind,
  folders,
  selected,
  onSelect,
  onReload,
  onDropItem,
  counts,
}: {
  kind: FolderKind;
  folders: FolderItem[];
  selected: FolderSelection;
  onSelect: (s: FolderSelection) => void;
  onReload: () => void;
  /** 목록 행이 폴더(또는 미분류)에 드롭됐을 때. folderId=null 이면 미분류로. */
  onDropItem: (folderId: number | null) => void;
  /** 폴더별 항목 수(선택 표시용, 없으면 숫자 안 보임). */
  counts?: Record<number, number>;
  unfiledCount?: number;
}) {
  const tree = useMemo(() => buildTree(folders), [folders]);
  const [dragOver, setDragOver] = useState<FolderSelection>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => loadCollapsed(kind));

  function toggleCollapsed(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveCollapsed(kind, next);
      return next;
    });
  }

  async function onCreate(parentId: number | null) {
    const name = window.prompt(parentId == null ? "새 폴더 이름" : "하위 폴더 이름")?.trim();
    if (!name) return;
    try {
      await createFolder({ kind, parentId, name });
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "폴더를 만들지 못했습니다.");
    }
  }

  async function onRename(f: FolderItem) {
    const name = window.prompt("폴더 이름 변경", f.name)?.trim();
    if (!name || name === f.name) return;
    try {
      await renameFolder(f.id, { name, parentId: f.parentId });
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "이름을 바꾸지 못했습니다.");
    }
  }

  async function onDelete(f: FolderItem) {
    if (!window.confirm(`'${f.name}' 폴더를 삭제할까요? 하위 폴더도 함께 삭제되고, 안에 있던 항목은 미분류로 남습니다.`)) return;
    try {
      await deleteFolder(f.id);
      if (selected === f.id) onSelect(null);
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "폴더를 삭제하지 못했습니다.");
    }
  }

  function dropProps(target: FolderSelection, folderId: number | null) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(target);
      },
      onDragLeave: () => setDragOver((d) => (d === target ? null : d)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(null);
        onDropItem(folderId);
      },
    };
  }

  function renderNode(node: TreeNode, depth: number) {
    const isOn = selected === node.id;
    const isDragOver = dragOver === node.id;
    const hasChildren = node.children.length > 0;
    const isCollapsed = hasChildren && collapsed.has(node.id);
    return (
      <div key={node.id}>
        <div
          className={`folder-row ${isOn ? "on" : ""} ${isDragOver ? "drop-over" : ""}`}
          style={{ paddingLeft: 8 + depth * 16 }}
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => onRename(node)}
          title="더블클릭: 이름 변경"
          {...dropProps(node.id, node.id)}
        >
          {hasChildren ? (
            <button
              type="button"
              className="folder-caret"
              aria-label={isCollapsed ? `${node.name} 펼치기` : `${node.name} 접기`}
              aria-expanded={!isCollapsed}
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapsed(node.id);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              {isCollapsed ? "▸" : "▾"}
            </button>
          ) : (
            <span className="folder-caret-space" />
          )}
          <span className="folder-icon">📁</span>
          <span className="folder-name">{node.name}</span>
          {counts?.[node.id] != null && <span className="folder-count">{counts[node.id]}</span>}
          <span className="folder-row-actions" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="folder-mini-btn" title="하위 폴더 만들기" onClick={() => onCreate(node.id)}>+</button>
            <button type="button" className="folder-mini-btn danger" title="삭제" onClick={() => onDelete(node)}>×</button>
          </span>
        </div>
        {!isCollapsed && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="folder-tree">
      <div className="folder-tree-head">
        <span className="folder-tree-title">폴더</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCreate(null)}>📁 새 폴더</button>
      </div>
      <div
        className={`folder-row ${selected === null ? "on" : ""}`}
        style={{ paddingLeft: 8 }}
        onClick={() => onSelect(null)}
      >
        <span className="folder-caret-space" />
        <span className="folder-icon">🗂️</span>
        <span className="folder-name">전체</span>
      </div>
      <div
        className={`folder-row ${selected === "unfiled" ? "on" : ""} ${dragOver === "unfiled" ? "drop-over" : ""}`}
        style={{ paddingLeft: 8 }}
        onClick={() => onSelect("unfiled")}
        {...dropProps("unfiled", null)}
      >
        <span className="folder-caret-space" />
        <span className="folder-icon">📄</span>
        <span className="folder-name">미분류</span>
      </div>
      {tree.map((n) => renderNode(n, 0))}
    </div>
  );
}

/**
 * 새 랜딩·리드폼을 만들 때 넣을 폴더를 고르는 드롭다운. 하위 폴더는 들여써서 트리 순서대로 보여준다.
 * value=null 이면 미분류.
 */
export function FolderSelect({
  kind,
  value,
  onChange,
}: {
  kind: FolderKind;
  value: number | null;
  onChange: (folderId: number | null) => void;
}) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  useEffect(() => {
    listFolders(kind).then(setFolders).catch(() => setFolders([]));
  }, [kind]);
  const options = useMemo(() => {
    const out: { id: number; label: string }[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        out.push({ id: n.id, label: `${"\u00a0\u00a0\u00a0".repeat(depth)}${depth > 0 ? "└ " : ""}${n.name}` });
        walk(n.children, depth + 1);
      }
    };
    walk(buildTree(folders), 0);
    return out;
  }, [folders]);
  // 넘겨받은 폴더(목록에서 고른 폴더)가 삭제됐으면 미분류로 보여준다.
  const known = value != null && options.some((o) => o.id === value);
  return (
    <select
      className="input"
      style={{ width: 160 }}
      title="만들 때 넣을 폴더"
      value={known ? String(value) : ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">📄 미분류</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>📁 {o.label}</option>
      ))}
    </select>
  );
}
