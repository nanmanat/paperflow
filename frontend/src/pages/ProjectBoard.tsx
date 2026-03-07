import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import { Plus, GitBranch, GitPullRequest, Trash2, ExternalLink } from 'lucide-react';

import { useKanbanStore, COLUMNS, ColumnId, KanbanCard } from '@/store/kanbanStore';
import { useProjectStore } from '@/store/projectStore';
import { useConfigStore } from '@/store/configStore';
import { listBranches, createBranch, createPull, mergePull, GitHubBranch } from '@/api/github';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { slugify } from '@/lib/utils';

function SortableCard({ card, owner, repo, onClick }: { card: KanbanCard; owner: string; repo: string; onClick: () => void }) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'Card', card } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const branchUrl = card.branchName
    ? `https://github.com/${owner}/${repo}/tree/${card.branchName}`
    : null;

  const showBranchLink = (card.column === 'in_progress' || card.column === 'in_review') && branchUrl;
  const showPrLink = card.column === 'in_review' && card.prNumber;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        onClick();
      }}
      className="bg-card border border-border rounded-md p-3 mb-3 cursor-grab hover:border-primary/50 transition-colors flex flex-col gap-2 shadow-sm relative group"
    >
      <div className="font-medium text-sm text-foreground leading-snug break-words pr-4">
        {card.title}
      </div>
      {card.description && (
        <div className="text-xs text-muted-foreground line-clamp-2">
          {card.description}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-1">
        {card.branchName && (
          showBranchLink ? (
            <a
              href={branchUrl!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.preventDefault(); window.open(branchUrl!, '_blank'); }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Badge variant="secondary" className="text-[10px] font-mono flex items-center gap-1 hover:bg-secondary/80 cursor-pointer">
                <GitBranch className="w-3 h-3" />
                {card.branchName}
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </Badge>
            </a>
          ) : (
            <Badge variant="secondary" className="text-[10px] font-mono flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              {card.branchName}
            </Badge>
          )
        )}
        {card.prNumber && (
          showPrLink ? (
            <span
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/projects/${card.projectId}/pulls/${card.prNumber}`); }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Badge
                variant={card.prMerged ? 'secondary' : 'success'}
                className="text-[10px] flex items-center gap-1 hover:opacity-80 cursor-pointer"
              >
                <GitPullRequest className="w-3 h-3" />
                !{card.prNumber}
              </Badge>
            </span>
          ) : (
            <Badge
              variant={card.prMerged ? 'secondary' : 'success'}
              className="text-[10px] flex items-center gap-1"
            >
              <GitPullRequest className="w-3 h-3" />
              !{card.prNumber}
            </Badge>
          )
        )}
      </div>
    </div>
  );
}

function ColumnDroppable({ id }: { id: string }) {
  const { setNodeRef } = useDroppable({ id, data: { type: 'Column' } });
  return <div ref={setNodeRef} className="h-4 w-full" />;
}

export function ProjectBoard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { projects, loading: projectsLoading, fetchProjects, getProject } = useProjectStore();
  const project = getProject(id!);
  const { cards, columns, loading, fetchBoard, addCard, updateCard, deleteCard, moveCard, reorderColumn } = useKanbanStore();
  const { githubToken } = useConfigStore();

  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addDesc, setAddDesc] = useState('');

  const [editCard, setEditCard] = useState<KanbanCard | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [branchDialogCard, setBranchDialogCard] = useState<KanbanCard | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [baseBranch, setBaseBranch] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);

  const [prDialogCard, setPrDialogCard] = useState<KanbanCard | null>(null);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [isCreatingPr, setIsCreatingPr] = useState(false);

  useEffect(() => {
    if (projects.length === 0) fetchProjects();
  }, []);

  useEffect(() => {
    if (id) fetchBoard(id);
  }, [id, fetchBoard]);

  useEffect(() => {
    if (!githubToken) {
      toast('No GitHub token — read-only mode. Set a token in Settings to take actions.', { icon: '⚠️' });
    }
  }, [githubToken]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (projectsLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (!project) {
    return <div className="p-8 text-center text-muted-foreground">Project not found</div>;
  }

  const handleAddSubmit = async () => {
    if (!addTitle.trim()) return;
    if (!githubToken) { toast.error('Set your GitHub token in Settings to add cards'); return; }
    try {
      await addCard({ projectId: project.id, title: addTitle.trim(), description: addDesc.trim(), column: 'backlog' });
      setIsAddOpen(false);
      setAddTitle('');
      setAddDesc('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to add card');
    }
  };

  const handleEditSubmit = async () => {
    if (!editCard || !editTitle.trim()) return;
    if (!githubToken) { toast.error('Set your GitHub token in Settings to edit cards'); return; }
    try {
      await updateCard(project.id, editCard.id, { title: editTitle.trim(), description: editDesc.trim() });
      setEditCard(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update card');
    }
  };

  const handleDeleteCard = async () => {
    if (!editCard) return;
    if (!githubToken) { toast.error('Set your GitHub token in Settings to delete cards'); return; }
    try {
      await deleteCard(project.id, editCard.id);
      setEditCard(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete card');
    }
  };

  const openBranchDialog = async (card: KanbanCard) => {
    if (!githubToken) { toast.error('Set your GitHub token in Settings to create branches'); return; }
    setBranchDialogCard(card);
    setBranchName(`feature/${slugify(card.title)}`);
    setBaseBranch(project.github.defaultBranch);
    try {
      const bs = await listBranches(project.github.owner, project.github.repo);
      setBranches(bs);
    } catch (e: any) {
      toast.error(e.message || 'Failed to fetch branches');
    }
  };

  const handleCreateBranch = async () => {
    if (!branchDialogCard || !branchName.trim()) return;
    setIsCreatingBranch(true);
    try {
      await createBranch(project.github.owner, project.github.repo, branchName.trim(), baseBranch);
      await updateCard(project.id, branchDialogCard.id, { branchName: branchName.trim() });
      toast.success('Branch created successfully');
      setBranchDialogCard(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create branch');
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const openPrDialog = (card: KanbanCard) => {
    if (!githubToken) { toast.error('Set your GitHub token in Settings to create pull requests'); return; }
    setPrDialogCard(card);
    setPrTitle(card.title);
    setPrBody(card.description || '');
  };

  const handleCreatePr = async () => {
    if (!prDialogCard || !prTitle.trim() || !prDialogCard.branchName) return;
    setIsCreatingPr(true);
    try {
      const pr = await createPull(project.github.owner, project.github.repo, {
        title: prTitle.trim(),
        body: prBody.trim(),
        head: prDialogCard.branchName,
        base: project.github.defaultBranch,
      });
      await updateCard(project.id, prDialogCard.id, { prNumber: pr.number });
      toast.success(`Merge Request !${pr.number} created`);
      setPrDialogCard(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create PR');
    } finally {
      setIsCreatingPr(false);
    }
  };

  const handleDragStart = (e: DragStartEvent) => {
    if (e.active.data.current?.type === 'Card') {
      setActiveCard(e.active.data.current.card);
    }
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveCard = active.data.current?.type === 'Card';
    const isOverCard = over.data.current?.type === 'Card';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveCard) return;

    const activeCardData = cards[activeId];
    if (!activeCardData) return;

    if (isOverColumn) {
      const targetColumn = overId as ColumnId;
      if (activeCardData.column !== targetColumn) {
        moveCard(project.id, activeId, targetColumn).catch(() => {});
      }
    } else if (isOverCard) {
      const overCardData = cards[overId];
      if (!overCardData) return;
      if (activeCardData.column !== overCardData.column) {
        moveCard(project.id, activeId, overCardData.column).catch(() => {});
      }
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const cardData = cards[activeId];
    if (!cardData) return;

    const targetColumn = (over.data.current?.type === 'Column' ? overId : cards[overId]?.column) as ColumnId;
    if (!targetColumn) return;

    if (cardData.column === targetColumn) {
      const colCards = columns[targetColumn] || [];
      const oldIndex = colCards.indexOf(activeId);
      const newIndex = isNaN(colCards.indexOf(overId)) ? oldIndex : colCards.indexOf(overId);
      if (oldIndex !== newIndex) {
        reorderColumn(project.id, targetColumn, arrayMove(colCards, oldIndex, newIndex)).catch(() => {});
      }
    }

    if (targetColumn === 'in_progress' && !cardData.branchName) {
      openBranchDialog(cardData);
    } else if (targetColumn === 'in_review' && cardData.branchName && !cardData.prNumber) {
      openPrDialog(cardData);
    } else if (targetColumn === 'done' && cardData.prNumber && !cardData.prMerged) {
      if (!githubToken) { toast.error('Set your GitHub token in Settings to merge pull requests'); return; }
      toast((t) => (
        <div className="flex items-center gap-4">
          <span>Mark PR !{cardData.prNumber} as merged?</span>
          <Button variant="outline" size="sm" onClick={() => toast.dismiss(t.id)}>Cancel</Button>
          <Button size="sm" onClick={async () => {
            toast.dismiss(t.id);
            try {
              await mergePull(project.github.owner, project.github.repo, cardData.prNumber!);
              await updateCard(project.id, cardData.id, { prMerged: true });
              toast.success('PR Merged');
            } catch (err: any) {
              toast.error(err.message || 'Merge failed');
              moveCard(project.id, cardData.id, cardData.column).catch(() => {});
            }
          }}>Merge</Button>
        </div>
      ), { duration: 10000 });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex-none px-6 py-4 border-b border-border bg-card flex items-center justify-between z-10">
        <div>
          <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.github.owner}/{project.github.repo}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(`/projects/${project.id}/pulls`)}>
            <GitPullRequest className="w-4 h-4 mr-2" />
            View Merge Requests
          </Button>
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Card
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Loading board…</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full gap-6 items-start">
              {COLUMNS.map((col) => {
                const colCardIds = columns[col.id] || [];
                const colCards = colCardIds
                  .map((cid) => cards[cid])
                  .filter(Boolean)
                  .filter((c) => c.projectId === project.id);

                return (
                  <div key={col.id} className="w-80 flex-none flex flex-col max-h-full bg-card/50 rounded-lg border border-border overflow-hidden">
                    <div className="p-3 border-b border-border flex items-center justify-between bg-card/80">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-current ${col.color}`} />
                        <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
                      </div>
                      <Badge variant="secondary" className="px-1.5 min-w-[1.5rem] justify-center text-xs">
                        {colCards.length}
                      </Badge>
                    </div>

                    <SortableContext id={col.id} items={colCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="p-3 flex-1 overflow-y-auto min-h-[100px]">
                        {colCards.map((card) => (
                          <SortableCard
                            key={card.id}
                            card={card}
                            owner={project.github.owner}
                            repo={project.github.repo}
                            onClick={() => {
                              setEditCard(card);
                              setEditTitle(card.title);
                              setEditDesc(card.description || '');
                            }}
                          />
                        ))}
                        <ColumnDroppable id={col.id} />
                      </div>
                    </SortableContext>
                  </div>
                );
              })}
            </div>

            <DragOverlay>
              {activeCard ? (
                <div className="bg-card border border-primary rounded-md p-3 opacity-90 shadow-lg rotate-2 w-80">
                  <div className="font-medium text-sm text-foreground">{activeCard.title}</div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="Card title" autoFocus />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={addDesc} onChange={(e) => setAddDesc(e.target.value)} placeholder="Optional details..." rows={3} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSubmit} disabled={!addTitle.trim()}>Add Card</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCard} onOpenChange={(o) => !o && setEditCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2 mt-4">
            <Button variant="destructive" onClick={handleDeleteCard} title="Delete Card">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            <div className="flex gap-2 mt-4 sm:mt-0">
              <Button variant="outline" onClick={() => setEditCard(null)}>Cancel</Button>
              <Button onClick={handleEditSubmit} disabled={!editTitle.trim()}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!branchDialogCard} onOpenChange={(o) => !o && setBranchDialogCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Branch Name</label>
              <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Branch</label>
              <Select value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)}>
                <option value="" disabled>Select base branch</option>
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
            <Button variant="outline" onClick={() => setBranchDialogCard(null)} disabled={isCreatingBranch}>Cancel</Button>
            <Button onClick={handleCreateBranch} disabled={isCreatingBranch || !branchName.trim() || !baseBranch}>
              {isCreatingBranch ? 'Creating...' : 'Create Branch'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!prDialogCard} onOpenChange={(o) => !o && setPrDialogCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Merge Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-3 rounded-md text-sm border border-border font-mono flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <span>{prDialogCard?.branchName}</span>
              <span className="text-muted-foreground">→</span>
              <span>{project.github.defaultBranch}</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={prBody} onChange={(e) => setPrBody(e.target.value)} rows={4} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
            <Button variant="outline" onClick={() => setPrDialogCard(null)} disabled={isCreatingPr}>Cancel</Button>
            <Button onClick={handleCreatePr} disabled={isCreatingPr || !prTitle.trim()}>
              {isCreatingPr ? 'Creating...' : 'Create MR'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
