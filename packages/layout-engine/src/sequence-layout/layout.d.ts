import type { SequenceDiagramSpec, SequenceGroup, SequenceMessage, SequenceNote, SequenceParticipant } from './model.js';
export interface SequenceLayoutParticipantBox {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    participant: SequenceParticipant;
}
export interface SequenceLayoutMessageRow {
    id: string;
    y: number;
    fromParticipantId: string;
    toParticipantId: string;
    fromX: number;
    toX: number;
    message: SequenceMessage;
}
export interface SequenceLayoutNoteBox {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    targetParticipantId: string;
    placement: SequenceNote['placement'];
    note: SequenceNote;
}
export interface SequenceLayoutGroupSpan {
    id: string;
    y: number;
    startMessageId: string;
    endMessageId: string;
    group: SequenceGroup;
}
export interface SequenceLayoutResult {
    width: number;
    height: number;
    participants: SequenceLayoutParticipantBox[];
    messages: SequenceLayoutMessageRow[];
    notes: SequenceLayoutNoteBox[];
    groups: SequenceLayoutGroupSpan[];
}
export interface SequenceLayoutConfig {
    participantWidth?: number;
    participantHeight?: number;
    participantGap?: number;
    topPadding?: number;
    sidePadding?: number;
    messageStartY?: number;
    messageRowGap?: number;
    noteWidth?: number;
    noteHeight?: number;
}
export declare function layoutSequenceDiagram(spec: SequenceDiagramSpec, config?: SequenceLayoutConfig): SequenceLayoutResult;
//# sourceMappingURL=layout.d.ts.map