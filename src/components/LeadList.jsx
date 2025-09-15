import React from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import LeadRow from "./LeadRow";

export default function LeadList({ items, onReorder, ...rowProps }) {
  const [activeId, setActiveId] = React.useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }), // click & hold
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const activeLead = items.find((i) => i.id === activeId) || null;

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const sorted = arrayMove(items, oldIndex, newIndex);

    // compute fractional order: between previous and next
    const prev = sorted[newIndex - 1];
    const next = sorted[newIndex + 1];
    let newOrder;
    if (!prev && next) newOrder = (next.order ?? Date.now()) - 1;                 // top
    else if (prev && !next) newOrder = (prev.order ?? Date.now()) + 1;            // bottom
    else if (prev && next) newOrder = (prev.order + next.order) / 2;              // between
    else newOrder = Date.now();

    await onReorder(active.id, newOrder);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="ios-table">
          <div className="ios-table-header">
            <div>Lead</div><div>Local Time</div><div>Phone</div><div>Actions</div>
          </div>
          {items.length === 0 ? (
            <div className="ios-table-row">No leads</div>
          ) : (
            items.slice(0, 200).map((lead, idx) => (
              <LeadRow key={lead.id} lead={lead} isTop={idx === 0} {...rowProps} />
            ))
          )}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeLead ? (
          <div className="ios-table-row" style={{ boxShadow: "var(--shadow-lg)" }}>
            <div className="lead-info">
              <div className="lead-name">{activeLead.name}</div>
              <div className="lead-meta">{(activeLead.title || "—") + " • " + (activeLead.college || "—")}</div>
            </div>
            <div />
            <div />
            <div />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}