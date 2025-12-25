/**
 * Unit tests for File Explorer Store
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFileExplorerStore } from '../stores/file-explorer-store';
import type { FileNode } from '../../shared/types';

function makeNode(overrides: Partial<FileNode>): FileNode {
  return {
    name: 'file.txt',
    path: '/root/file.txt',
    isDirectory: false,
    ...overrides
  } as FileNode;
}

describe('FileExplorerStore', () => {
  let electronAPI: { listDirectory: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    electronAPI = {
      listDirectory: vi.fn()
    };

    if (!(globalThis as typeof globalThis & { window?: Window }).window) {
      (globalThis as typeof globalThis & { window: Window }).window = {} as Window;
    }

    (window as Window & { electronAPI: typeof electronAPI }).electronAPI = electronAPI;

    useFileExplorerStore.setState({
      isOpen: false,
      expandedFolders: new Set(),
      files: new Map(),
      isLoading: new Map(),
      error: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('toggles and explicitly opens/closes the panel', () => {
    const store = useFileExplorerStore.getState();

    store.open();
    expect(useFileExplorerStore.getState().isOpen).toBe(true);

    store.toggle();
    expect(useFileExplorerStore.getState().isOpen).toBe(false);

    store.close();
    expect(useFileExplorerStore.getState().isOpen).toBe(false);
  });

  it('expands, collapses, and toggles folders', () => {
    const store = useFileExplorerStore.getState();

    store.expandFolder('/root');
    expect(store.isExpanded('/root')).toBe(true);

    store.toggleFolder('/root');
    expect(store.isExpanded('/root')).toBe(false);

    store.toggleFolder('/root');
    expect(store.isExpanded('/root')).toBe(true);

    store.collapseFolder('/root');
    expect(store.isExpanded('/root')).toBe(false);
  });

  it('loads directory contents and caches results', async () => {
    const files = [makeNode({ name: 'index.ts', path: '/root/index.ts' })];
    electronAPI.listDirectory.mockResolvedValue({ success: true, data: files });

    const result = await useFileExplorerStore.getState().loadDirectory('/root');

    expect(electronAPI.listDirectory).toHaveBeenCalledWith('/root');
    expect(result).toEqual(files);
    expect(useFileExplorerStore.getState().getFiles('/root')).toEqual(files);
    expect(useFileExplorerStore.getState().isLoadingDir('/root')).toBe(false);

    // Cached result should not call IPC again
    electronAPI.listDirectory.mockClear();
    const cached = await useFileExplorerStore.getState().loadDirectory('/root');
    expect(cached).toEqual(files);
    expect(electronAPI.listDirectory).not.toHaveBeenCalled();
  });

  it('records errors when directory load fails', async () => {
    electronAPI.listDirectory.mockResolvedValue({ success: false, error: 'Failed' });

    const result = await useFileExplorerStore.getState().loadDirectory('/root');

    expect(result).toEqual([]);
    expect(useFileExplorerStore.getState().error).toBe('Failed');
    expect(useFileExplorerStore.getState().isLoadingDir('/root')).toBe(false);
  });

  it('computes visible files based on expanded folders', () => {
    const root = '/root';
    const dirA = makeNode({ name: 'src', path: '/root/src', isDirectory: true });
    const file1 = makeNode({ name: 'README.md', path: '/root/README.md' });
    const file2 = makeNode({ name: 'index.ts', path: '/root/src/index.ts' });

    const files = new Map<string, FileNode[]>([
      [root, [dirA, file1]],
      ['/root/src', [file2]]
    ]);

    useFileExplorerStore.setState({
      files,
      expandedFolders: new Set(['/root/src'])
    });

    const visible = useFileExplorerStore.getState().getVisibleFiles(root);
    expect(visible.map((node) => node.path)).toEqual([
      '/root/src',
      '/root/src/index.ts',
      '/root/README.md'
    ]);

    const computed = useFileExplorerStore.getState().computeVisibleItems(root);
    expect(computed.count).toBe(3);
    expect(computed.nodes.map((node) => node.path)).toEqual([
      '/root/src',
      '/root/src/index.ts',
      '/root/README.md'
    ]);
  });

  it('clears cache and expanded state', () => {
    useFileExplorerStore.setState({
      files: new Map([['/root', [makeNode({})]]]),
      expandedFolders: new Set(['/root'])
    });

    useFileExplorerStore.getState().clearCache();

    expect(useFileExplorerStore.getState().getFiles('/root')).toBeUndefined();
    expect(useFileExplorerStore.getState().getAllExpandedFiles().size).toBe(0);
  });
});
