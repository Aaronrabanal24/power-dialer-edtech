import React, { Fragment } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getLocalHour, getLocalTime, callWindowForTitle } from "../utils/time";
import { formatDisplayPhone } from "../utils/phone";

export default function LeadRow({ lead, isTop, onCall, onOutcome, onToggleDnc, onDelete, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: "grab",
    opacity: isDragging ? 0.85 : 1,
  };

  const hour = getLocalHour(lead.timezone);
  const win = callWindowForTitle(lead.title);
  const inWindow = hour >= win.start && hour <= win.end;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ios-table-row ${isTop ? "priority" : ""}`}
      onClick={() => onSelect?.(lead)}
      {...attributes}
      {...listeners}  // drag starts on click & hold
    >
      <div className="lead-info">
        <div className="lead-name ellipsis">{lead.name}</div>
        <div className="lead-meta ellipsis">{(lead.title || "—") + " • " + (lead.college || "—")}</div>
      </div>
      <div>
        <div className={`time-badge ${inWindow ? "in-window" : "outside"}`}>{getLocalTime(lead.timezone)}</div>
      </div>
      <div className="mono">{formatDisplayPhone(lead.phone)}</div>
      <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
        {isTop ? (
          <button className="action-btn primary" onClick={() => onCall(lead)}>📞 Call</button>
        ) : (
          <Fragment>
            <button className="action-btn" onClick={() => onOutcome(lead, "No answer")}>NA</button>
            <button className="action-btn" onClick={() => onOutcome(lead, "Left VM")}>VM</button>
            <button className="action-btn" onClick={() => onOutcome(lead, "Conversation")}>Conv</button>
          </Fragment>
        )}
        <button className="action-btn" onClick={() => onToggleDnc(lead)}>{lead.dnc ? "Undnc" : "DNC"}</button>
        <button className="action-btn" onClick={() => onDelete(lead)}>Delete</button>
      </div>
    </div>
  );
}