"""Attention QKV – four-quadrant attention mechanism explainer.

Declarative definition using the diagram model.

Each quadrant is a **frameless** panel (no border) containing a matrix
tile, word boxes, and description helpers — matching the v1 open-area
look.  MatrixWidgets are placed inside panels as grid children.  Fan-out
arrows are top-level Arrow components that reference child IDs via
_register_child_bounds.

Grid layout: 2 columns × 3 rows.
  (0,0) Query panel  |  (1,0) Keys panel
  (0,1) Match panel  |  (1,1) Value panel
  (0,2) Legend        |
"""

from __future__ import annotations

from diagram_model import (
    Annotation,
    Arrow,
    Border,
    Box,
    BoxStyle,
    Diagram,
    Fill,
    Legend,
    LegendEntry,
    Line,
    MatrixWidget,
    Panel,
)
from diagram_shared import ARROW_GAP

WHITE = "#FFFFFF"
BLACK = "#000000"
GREY = "#F3F3F3"
HELPER = "#666666"


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


def _helper(text: str) -> Line:
    return Line(text, fill=HELPER)


attention_qkv = Diagram(
    title="Attention QKV",
    arrangement=Diagram.Arrangement.GRID,
    cols=2,
    col_gap=24,
    row_gap=24,
    outer_margin=24,
    components=[
        # ── (0,0) Query panel – frameless ──
        Panel(
            id="query",
            heading=_heading('The query (Q): the "question"'),
            cols=2,
            col_width=240,
            col_gap=8,
            row_gap=ARROW_GAP,  # arrows route between matrix and box rows
            fill=Fill.WHITE,
            border=Border.NONE,
            uniform_height=False,
            col=0, row=0,
            children=[
                MatrixWidget(label="Q", id="q_matrix", col=0, row=0),
                Box(
                    id="q_ubuntu",
                    label=[_body("Ubuntu:")],
                    fill=Fill.GREY,
                    col=0, row=1,
                ),
                Annotation(
                    lines=[
                        _helper("I am a noun at the start of a"),
                        _helper("sentence followed by a colon."),
                    ],
                    col=1, row=1,
                ),
                Annotation(
                    lines=[
                        _helper("I am a noun at the start of a sentence followed"),
                        _helper("by a colon. I am likely a subject being defined."),
                        _helper("What in this sentence explains what I am?"),
                    ],
                    col=0, row=2, col_span=2,
                ),
            ],
        ),

        # ── (1,0) Keys panel – frameless ──
        Panel(
            id="keys",
            heading=_heading('The keys (K): the "advertisements"'),
            cols=4,
            col_width=192,
            col_gap=8,
            row_gap=ARROW_GAP,  # arrows route between matrix and box rows
            fill=Fill.WHITE,
            border=Border.NONE,
            uniform_height=False,
            col=1, row=0,
            children=[
                MatrixWidget(label="K", id="k_matrix", col=1, row=0),
                Box(id="k_linux", label=[_body("Linux")],
                    style=BoxStyle.HIGHLIGHT, col=0, row=1),
                Box(id="k_for", label=[_body("for")],
                    fill=Fill.WHITE, col=1, row=1),
                Box(id="k_human", label=[_body("human")],
                    fill=Fill.GREY, col=2, row=1),
                Box(id="k_beings", label=[_body("beings")],
                    fill=Fill.WHITE, col=3, row=1),
                Annotation(
                    lines=[
                        _helper("I am a technical"),
                        _helper("OS kernel"),
                        _helper("category."),
                    ],
                    col=0, row=2,
                ),
                Annotation(
                    lines=[
                        _helper("I am a preposition"),
                        _helper("indicating a target"),
                        _helper("audience."),
                    ],
                    col=1, row=2,
                ),
                Annotation(
                    lines=[
                        _helper("I am the adjective"),
                        _helper("that narrows the"),
                        _helper("species or type."),
                    ],
                    col=2, row=2,
                ),
                Annotation(
                    lines=[
                        _helper("I am the plural noun,"),
                        _helper("the object of the"),
                        _helper("audience."),
                    ],
                    col=3, row=2,
                ),
            ],
        ),

        # ── (0,1) Match panel – frameless ──
        Panel(
            id="match",
            heading=_heading('The match (QK\u1d40): the "relevance check"'),
            cols=4,
            col_width=192,
            col_gap=8,
            row_gap=ARROW_GAP,  # arrows route between matrix and box rows
            fill=Fill.WHITE,
            border=Border.NONE,
            uniform_height=False,
            col=0, row=1,
            children=[
                MatrixWidget(label="QK", id="qk_matrix", col=1, row=0),
                Box(id="m_linux", label=[_body("Linux")],
                    style=BoxStyle.HIGHLIGHT, col=0, row=1),
                Box(id="m_for", label=[_body("for")],
                    fill=Fill.WHITE, col=1, row=1),
                Box(id="m_human", label=[_body("human")],
                    fill=Fill.GREY, col=2, row=1),
                Box(id="m_beings", label=[_body("beings")],
                    fill=Fill.WHITE, col=3, row=1),
                Annotation(
                    lines=[
                        _helper("Best semantic match:"),
                        _helper("the likely subject"),
                        _helper("being defined."),
                    ],
                    col=0, row=2,
                ),
                Annotation(
                    lines=[
                        _helper("Relevant as context,"),
                        _helper("but not the thing"),
                        _helper("being defined."),
                    ],
                    col=1, row=2,
                ),
                Annotation(
                    lines=[
                        _helper("Useful modifier,"),
                        _helper("but not stronger than"),
                        _helper("the main noun."),
                    ],
                    col=2, row=2,
                ),
                Annotation(
                    lines=[
                        _helper("Part of the phrase,"),
                        _helper("yet less direct than"),
                        _helper("the kernel word."),
                    ],
                    col=3, row=2,
                ),
            ],
        ),

        # Legend below match panel
        Legend(
            entries=[
                LegendEntry(color=WHITE, label="Low"),
                LegendEntry(color=GREY, label="Medium"),
                LegendEntry(color=BLACK, label="High"),
            ],
            col=0, row=2,
        ),

        # ── (1,1) Value panel – frameless ──
        # 3 columns: Ubuntu | Linux | helper text beside boxes
        Panel(
            id="value",
            heading=_heading('The value (V): the "knowledge transfer"'),
            cols=3,
            col_width=192,
            col_gap=24,
            row_gap=ARROW_GAP,  # arrows route between matrix and box rows
            fill=Fill.WHITE,
            border=Border.NONE,
            uniform_height=False,
            col=1, row=1,
            children=[
                MatrixWidget(label="Q", id="vq_matrix", col=0, row=0),
                MatrixWidget(label="K", id="vk_matrix", col=1, row=0),
                Box(
                    id="v_ubuntu",
                    label=[_body("Ubuntu:")],
                    fill=Fill.GREY,
                    col=0, row=1,
                ),
                Box(
                    id="v_linux",
                    label=[_body("Linux")],
                    style=BoxStyle.HIGHLIGHT,
                    col=1, row=1,
                ),
                Annotation(
                    lines=[
                        _helper('Strongest meaning comes from "Linux",'),
                        _helper("with extra audience context from"),
                        _helper('"human beings".'),
                    ],
                    col=2, row=1,
                ),
                Box(
                    id="value_transfer",
                    label=[_heading("Value transfer (V)")],
                    fill=Fill.GREY,
                    col=0, row=2, col_span=2,
                ),
                Annotation(
                    lines=[
                        _helper('Now that the model knows "Linux" is the most relevant'),
                        _helper("word, it takes the value step to transfer the actual"),
                        _helper('semantic meaning of "Linux" and "human beings" into'),
                        _helper('the representation of "Ubuntu".'),
                    ],
                    col=0, row=3, col_span=3,
                ),
            ],
        ),

        # ── Arrows ──
        # Query: Q matrix → Ubuntu box
        Arrow(source="q_matrix.bottom", target="q_ubuntu.top"),

        # Keys: K matrix fan-out to 4 word boxes
        Arrow(source="k_matrix.bottom", target="k_linux.top"),
        Arrow(source="k_matrix.bottom", target="k_for.top"),
        Arrow(source="k_matrix.bottom", target="k_human.top"),
        Arrow(source="k_matrix.bottom", target="k_beings.top"),

        # Match: QK matrix fan-out to 4 word boxes
        Arrow(source="qk_matrix.bottom", target="m_linux.top"),
        Arrow(source="qk_matrix.bottom", target="m_for.top"),
        Arrow(source="qk_matrix.bottom", target="m_human.top"),
        Arrow(source="qk_matrix.bottom", target="m_beings.top"),

        # Value: matrix tiles → boxes, Ubuntu→Linux, Linux→Value Transfer
        Arrow(source="vq_matrix.bottom", target="v_ubuntu.top"),
        Arrow(source="vk_matrix.bottom", target="v_linux.top"),
        Arrow(source="v_ubuntu.right", target="v_linux.left"),
        Arrow(source="v_linux.bottom", target="value_transfer.top"),
    ],
)
