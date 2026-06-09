export type SequenceParticipantKind = 'participant' | 'actor' | 'boundary' | 'control' | 'entity' | 'database';
export type SequenceNotePlacement = 'left-of' | 'right-of' | 'over';
export interface SequenceLine {
    text: string;
}
export interface SequenceParticipantInput {
    id: string;
    label: string | string[];
    kind?: SequenceParticipantKind;
}
export interface SequenceParticipant {
    id: string;
    label: SequenceLine[];
    kind: SequenceParticipantKind;
}
export interface SequenceMessageInput {
    id?: string;
    from: string;
    to: string;
    label: string | string[];
}
export interface SequenceMessage {
    id: string;
    from: string;
    to: string;
    label: SequenceLine[];
}
export interface SequenceNoteInput {
    id?: string;
    target: string;
    placement?: SequenceNotePlacement;
    label: string | string[];
}
export interface SequenceNote {
    id: string;
    target: string;
    placement: SequenceNotePlacement;
    label: SequenceLine[];
}
export interface SequenceGroupInput {
    id: string;
    label: string | string[];
    startMessageId: string;
    endMessageId: string;
}
export interface SequenceGroup {
    id: string;
    label: SequenceLine[];
    startMessageId: string;
    endMessageId: string;
}
export interface SequenceDiagramInput {
    participants: SequenceParticipantInput[];
    messages: SequenceMessageInput[];
    notes?: SequenceNoteInput[];
    groups?: SequenceGroupInput[];
}
export interface SequenceDiagramSpec {
    participants: SequenceParticipant[];
    messages: SequenceMessage[];
    notes: SequenceNote[];
    groups: SequenceGroup[];
}
export interface SequenceModelDiagnostic {
    code: 'SEQUENCE_DUPLICATE_PARTICIPANT' | 'SEQUENCE_UNKNOWN_MESSAGE_ENDPOINT' | 'SEQUENCE_DUPLICATE_MESSAGE_ID' | 'SEQUENCE_UNKNOWN_NOTE_TARGET' | 'SEQUENCE_UNKNOWN_GROUP_MESSAGE';
    message: string;
    path: string;
}
export interface NormalizeSequenceDiagramResult {
    spec: SequenceDiagramSpec;
    errors: SequenceModelDiagnostic[];
}
export declare function normalizeSequenceDiagram(input: SequenceDiagramInput): NormalizeSequenceDiagramResult;
//# sourceMappingURL=model.d.ts.map