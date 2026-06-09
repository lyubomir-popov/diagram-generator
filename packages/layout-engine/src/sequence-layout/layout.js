const DEFAULT_CONFIG = {
    participantWidth: 176,
    participantHeight: 56,
    participantGap: 96,
    topPadding: 48,
    sidePadding: 48,
    messageStartY: 152,
    messageRowGap: 88,
    noteWidth: 160,
    noteHeight: 56,
};
export function layoutSequenceDiagram(spec, config = {}) {
    const resolved = { ...DEFAULT_CONFIG, ...config };
    const participants = spec.participants.map((participant, index) => ({
        id: participant.id,
        x: resolved.sidePadding + index * (resolved.participantWidth + resolved.participantGap),
        y: resolved.topPadding,
        width: resolved.participantWidth,
        height: resolved.participantHeight,
        participant,
    }));
    const participantCenters = new Map(participants.map((participant) => [
        participant.id,
        participant.x + participant.width / 2,
    ]));
    const messages = spec.messages.map((message, index) => ({
        id: message.id,
        y: resolved.messageStartY + index * resolved.messageRowGap,
        fromParticipantId: message.from,
        toParticipantId: message.to,
        fromX: participantCenters.get(message.from) ?? resolved.sidePadding,
        toX: participantCenters.get(message.to) ?? resolved.sidePadding,
        message,
    }));
    const messageRowsById = new Map(messages.map((message) => [message.id, message]));
    const notes = spec.notes.map((note, index) => {
        const participant = participants.find((entry) => entry.id === note.target);
        const anchorX = participant?.x ?? resolved.sidePadding;
        const anchorY = resolved.messageStartY + index * resolved.messageRowGap;
        const x = note.placement === 'left-of'
            ? anchorX - resolved.noteWidth - 24
            : note.placement === 'right-of'
                ? anchorX + resolved.participantWidth + 24
                : anchorX + (resolved.participantWidth - resolved.noteWidth) / 2;
        return {
            id: note.id,
            x,
            y: anchorY,
            width: resolved.noteWidth,
            height: resolved.noteHeight,
            targetParticipantId: note.target,
            placement: note.placement,
            note,
        };
    });
    const groups = spec.groups.map((group) => ({
        id: group.id,
        y: messageRowsById.get(group.startMessageId)?.y ?? resolved.messageStartY,
        startMessageId: group.startMessageId,
        endMessageId: group.endMessageId,
        group,
    }));
    const rightMostParticipant = participants[participants.length - 1];
    const width = rightMostParticipant
        ? rightMostParticipant.x + rightMostParticipant.width + resolved.sidePadding
        : resolved.sidePadding * 2;
    const lastMessage = messages[messages.length - 1];
    const lastNote = notes[notes.length - 1];
    const height = Math.max(resolved.messageStartY, (lastMessage?.y ?? resolved.messageStartY) + resolved.messageRowGap, (lastNote?.y ?? 0) + resolved.noteHeight + resolved.topPadding);
    return {
        width,
        height,
        participants,
        messages,
        notes,
        groups,
    };
}
//# sourceMappingURL=layout.js.map