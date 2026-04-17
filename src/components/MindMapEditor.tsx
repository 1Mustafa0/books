import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  Panel,
  MarkerType,
  updateEdge,
  ReactFlowProvider,
  useReactFlow,
  Viewport,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Save, Keyboard, Maximize, ZoomIn, ZoomOut, Undo2, Redo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip } from './Tooltip';
import { cn } from '@/lib/utils';

const CustomNode = ({ data, selected }: any) => {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className={cn(
        "px-6 py-4 rounded-2xl glass border-2 transition-all duration-300 min-w-[180px] text-center relative group overflow-hidden",
        selected 
          ? "border-primary shadow-[0_0_30px_rgba(242,125,38,0.3)] bg-primary/20" 
          : "border-white/10 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(242,125,38,0.15)] bg-white/5"
      )}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-primary !border-none !w-2.5 !h-2.5 !opacity-0 group-hover:!opacity-100 transition-opacity" 
      />
      
      <div className="relative z-10">
        <div className="text-sm font-bold text-white tracking-wide leading-relaxed">{data.label}</div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-primary !border-none !w-2.5 !h-2.5 !opacity-0 group-hover:!opacity-100 transition-opacity" 
      />
      
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Shine Effect */}
      <div className="absolute -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:animate-shimmer pointer-events-none" />
    </motion.div>
  );
};

const nodeTypes = {
  mindMap: CustomNode,
};

interface MindMapEditorProps {
  initialData?: { nodes: Node[]; edges: Edge[] };
  onSave: (data: { nodes: Node[]; edges: Edge[] }) => void;
  readOnly?: boolean;
}

const initialNodes: Node[] = [
  {
    id: 'root',
    type: 'mindMap',
    data: { label: 'العنوان الرئيسي' },
    position: { x: 250, y: 5 },
  },
];

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#F27D26',
  },
  style: {
    strokeWidth: 2,
    stroke: '#F27D26',
  },
};

type HistoryState = {
  nodes: Node[];
  edges: Edge[];
};

function Flow({ initialData, onSave, readOnly = false }: MindMapEditorProps) {
  const [nodes, setNodes] = useState<Node[]>(initialData?.nodes || initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialData?.edges || []);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [editingNode, setEditingNode] = useState<{ id: string; label: string } | null>(null);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // History Management
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);
  const isInternalChange = useRef(false);

  const saveToHistory = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    if (isInternalChange.current) return;
    
    setHistory((prev) => {
      const newState = { nodes: currentNodes, edges: currentEdges };
      // Only save if different from last state
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (JSON.stringify(last) === JSON.stringify(newState)) return prev;
      }
      return [...prev.slice(-19), newState]; // Keep last 20 states
    });
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (history.length <= 1) return;
    
    isInternalChange.current = true;
    const currentState = history[history.length - 1];
    const prevState = history[history.length - 2];
    
    setRedoStack((prev) => [currentState, ...prev]);
    setHistory((prev) => prev.slice(0, -1));
    
    setNodes(prevState.nodes);
    setEdges(prevState.edges);
    
    setTimeout(() => { isInternalChange.current = false; }, 0);
  }, [history]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    isInternalChange.current = true;
    const nextState = redoStack[0];
    
    setHistory((prev) => [...prev, nextState]);
    setRedoStack((prev) => prev.slice(1));
    
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    
    setTimeout(() => { isInternalChange.current = false; }, 0);
  }, [redoStack]);

  // Initialize history
  useEffect(() => {
    setHistory([{ nodes, edges }]);
  }, []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        // Only save to history on "meaningful" changes (not just selection)
        const hasPositionOrDataChange = changes.some(c => c.type === 'position' || c.type === 'reset' || c.type === 'add' || c.type === 'remove');
        if (hasPositionOrDataChange) {
          saveToHistory(updated, edges);
        }
        return updated;
      });
    },
    [edges, saveToHistory]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        saveToHistory(nodes, updated);
        return updated;
      });
    },
    [nodes, saveToHistory]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge({ ...params, ...defaultEdgeOptions }, edges);
      setEdges(newEdges);
      saveToHistory(nodes, newEdges);
    },
    [edges, nodes, saveToHistory]
  );

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      const updatedEdges = updateEdge(oldEdge, newConnection, edges);
      setEdges(updatedEdges);
      saveToHistory(nodes, updatedEdges);
    },
    [edges, nodes, saveToHistory]
  );

  const onMove = useCallback((event: any, viewport: Viewport) => {
    setZoomLevel(viewport.zoom);
  }, []);

  const addNode = useCallback(() => {
    const id = `node_${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'mindMap',
      data: { label: 'فكرة جديدة' },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
    };
    const updatedNodes = nodes.concat(newNode);
    setNodes(updatedNodes);
    saveToHistory(updatedNodes, edges);
  }, [nodes, edges, saveToHistory]);

  const deleteSelected = useCallback(() => {
    const updatedNodes = nodes.filter((node) => !node.selected);
    const updatedEdges = edges.filter((edge) => !edge.selected);
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    saveToHistory(updatedNodes, updatedEdges);
  }, [nodes, edges, saveToHistory]);

  const handleSave = useCallback(() => {
    onSave({ nodes, edges });
  }, [nodes, edges, onSave]);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (readOnly) return;
    setEditingNode({ id: node.id, label: node.data.label });
  }, [readOnly]);

  const handleUpdateNodeLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;

    const updatedNodes = nodes.map((n) => {
      if (n.id === editingNode.id) {
        return { ...n, data: { ...n.data, label: editingNode.label } };
      }
      return n;
    });
    setNodes(updatedNodes);
    saveToHistory(updatedNodes, edges);
    setEditingNode(null);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (readOnly) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        toast.success('تم حفظ الخريطة');
      }

      if ((e.altKey && e.key === 'n') || e.key === 'Insert') {
        e.preventDefault();
        addNode();
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && 
          !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        const hasSelection = nodes.some(n => n.selected) || edges.some(e => e.selected);
        if (hasSelection) {
          deleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, handleSave, addNode, deleteSelected, nodes, edges, undo, redo]);

  return (
    <div className="w-full h-full relative">
      <AnimatePresence>
        {editingNode && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingNode(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm glass border-primary/30 p-6 rounded-2xl shadow-2xl"
            >
              <form onSubmit={handleUpdateNodeLabel} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary">تعديل نص العقدة</label>
                  <input 
                    autoFocus
                    value={editingNode.label}
                    onChange={(e) => setEditingNode({ ...editingNode, label: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 transition-all"
                    placeholder="اكتب النص هنا..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 h-10 font-bold">تحديث</Button>
                  <Button type="button" variant="ghost" className="flex-1 h-10" onClick={() => setEditingNode(null)}>إلغاء</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeUpdate={onEdgeUpdate}
        onNodeDoubleClick={onNodeDoubleClick}
        onMove={onMove}
        fitView
        fitViewOptions={{ padding: 0.5 }}
        snapToGrid
        snapGrid={[15, 15]}
        minZoom={0.1}
        maxZoom={4}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
        panOnDrag={true}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        deleteKeyCode={null}
        defaultEdgeOptions={defaultEdgeOptions}
      >
        <Background color="#F27D26" gap={15} size={1} opacity={0.05} />
        <Controls showInteractive={false} />
        
        <Panel position="bottom-left" className="flex flex-col gap-2">
          <div className="glass px-2 py-1 rounded-lg border-white/5 flex gap-1">
            <Tooltip content="تراجع عن الخطوة الأخيرة (Ctrl+Z)" position="top">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 hover:bg-white/10 disabled:opacity-30" 
                onClick={undo}
                disabled={history.length <= 1}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            </Tooltip>
            <Tooltip content="إعادة الخطوة المتراجع عنها (Ctrl+Y)" position="top">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 hover:bg-white/10 disabled:opacity-30" 
                onClick={redo}
                disabled={redoStack.length === 0}
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
          <div className="glass px-3 py-1.5 rounded-lg border-white/5 flex items-center gap-3 text-xs font-bold text-primary">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-white/10" onClick={() => zoomOut()}>
                <ZoomOut className="w-3 h-3" />
              </Button>
              <span className="min-w-[40px] text-center">{Math.round(zoomLevel * 100)}%</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-white/10" onClick={() => zoomIn()}>
                <ZoomIn className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </Panel>

        {!readOnly && (
          <Panel position="top-right" className="flex flex-col items-end gap-4">
            <div className="flex gap-2">
              <Tooltip content="توسيط الخريطة لتناسب الشاشة" position="bottom">
                <Button size="sm" variant="outline" onClick={() => fitView()} className="glass border-white/10 hover:bg-white/10">
                  <Maximize className="w-4 h-4 ml-2" />
                  توسيط
                </Button>
              </Tooltip>
              <Tooltip content="إضافة عقدة فكرية جديدة (Alt+N)" position="bottom">
                <Button size="sm" variant="outline" onClick={addNode} className="glass border-white/10 hover:bg-white/10">
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة عقدة
                </Button>
              </Tooltip>
              <Tooltip content="حذف العقد أو الروابط المحددة (Del)" position="bottom">
                <Button size="sm" variant="outline" onClick={deleteSelected} className="glass border-destructive/20 text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4 ml-2" />
                  حذف المحدد
                </Button>
              </Tooltip>
              <Tooltip content="حفظ التغييرات الحالية (Ctrl+S)" position="bottom">
                <Button size="sm" onClick={handleSave} className="shadow-lg shadow-primary/20">
                  <Save className="w-4 h-4 ml-2" />
                  حفظ الخريطة
                </Button>
              </Tooltip>
            </div>
          </Panel>
        )}
      </ReactFlow>
      {readOnly && (
        <div className="absolute top-4 left-4 glass px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-primary">
          وضع العرض فقط
        </div>
      )}
    </div>
  );
}

export function MindMapEditor(props: MindMapEditorProps) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
