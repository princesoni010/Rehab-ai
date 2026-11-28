"""
Clinical PDF Report Generator for Rehab-AI
------------------------------------------
Generates multi-page A4 vector PDF reports using matplotlib's OO Figure API
and PdfPages (thread-safe, no global pyplot state).
"""

from __future__ import annotations

from datetime import datetime, timezone
import io
import textwrap
from typing import Any

from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.figure import Figure
from matplotlib.patches import FancyBboxPatch

A4_SIZE = (8.27, 11.69)

# Palette (clean light clinical theme)
DARK_SLATE = "#0f172a"
TEXT_BODY = "#334155"
TEXT_MUTED = "#64748b"
BORDER_LIGHT = "#e2e8f0"
BG_PANEL = "#f8fafc"
BG_ZEBRA = "#f1f5f9"

TEAL = "#0d9488"
TEAL_SOFT = "#f0fdfa"
EMERALD = "#059669"
EMERALD_SOFT = "#ecfdf5"
AMBER = "#d97706"
AMBER_SOFT = "#fffbeb"
CORAL = "#e11d48"
CORAL_SOFT = "#fff1f2"
PURPLE = "#7c3aed"
PURPLE_SOFT = "#f5f3ff"


def _fmt_dt(value: Any, short: bool = False) -> str:
    if not value:
        return "-"
    try:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        elif isinstance(value, datetime):
            dt = value
        else:
            return str(value)
        if short:
            return dt.strftime("%d %b %Y")
        return dt.strftime("%d %b %Y, %H:%M")
    except Exception:
        return str(value)


def _fmt_duration(seconds: Any) -> str:
    try:
        total = max(0, int(round(float(seconds))))
    except Exception:
        return "-"
    mins, secs = divmod(total, 60)
    if mins > 0:
        return f"{mins}m {secs:02d}s"
    return f"{secs}s"


def _score_style(score: float | int | None) -> tuple[str, str, str]:
    if score is None:
        return TEXT_MUTED, BG_PANEL, "N/A"
    val = float(score)
    if val >= 85:
        return EMERALD, EMERALD_SOFT, "Excellent"
    if val >= 70:
        return TEAL, TEAL_SOFT, "Good"
    if val >= 50:
        return AMBER, AMBER_SOFT, "Fair"
    return CORAL, CORAL_SOFT, "Needs Work"


def _clean_text(text: Any) -> str:
    """Keep printable characters safe for PDF standard fonts."""
    if text is None:
        return ""
    raw = str(text)
    return "".join(ch if (32 <= ord(ch) <= 126) or ch in "\n\r\t" else " " for ch in raw).strip()


def _new_page(
    title: str,
    subtitle: str,
    meta_pairs: list[tuple[str, str]],
) -> tuple[Figure, Any, float]:
    """Create an A4 Figure with a clinical header bar and metadata strip."""
    fig = Figure(figsize=A4_SIZE, dpi=150, facecolor="white")
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    # Top header banner
    header_box = FancyBboxPatch(
        (0.05, 0.89),
        0.90,
        0.075,
        boxstyle="round,pad=0.0,rounding_size=0.012",
        facecolor=DARK_SLATE,
        edgecolor="none",
    )
    ax.add_patch(header_box)

    # Teal accent stripe on left edge of banner
    stripe = FancyBboxPatch(
        (0.05, 0.89),
        0.008,
        0.075,
        boxstyle="round,pad=0.0,rounding_size=0.002",
        facecolor=TEAL,
        edgecolor="none",
    )
    ax.add_patch(stripe)

    ax.text(0.075, 0.942, "PHYSICO HEALTH  |  REHAB AI", fontsize=8.5, fontweight="bold", color="#2dd4bf")
    ax.text(0.075, 0.910, _clean_text(title), fontsize=15, fontweight="bold", color="white")
    ax.text(0.93, 0.916, _clean_text(subtitle), fontsize=8.5, color="#cbd5e1", ha="right")

    # Metadata strip
    meta_box = FancyBboxPatch(
        (0.05, 0.828),
        0.90,
        0.052,
        boxstyle="round,pad=0.0,rounding_size=0.008",
        facecolor=BG_PANEL,
        edgecolor=BORDER_LIGHT,
        linewidth=0.8,
    )
    ax.add_patch(meta_box)

    cols = max(len(meta_pairs), 1)
    col_w = 0.86 / cols
    for idx, (label, val) in enumerate(meta_pairs):
        cx = 0.07 + idx * col_w
        ax.text(cx, 0.861, _clean_text(label).upper(), fontsize=6.8, fontweight="bold", color=TEXT_MUTED)
        ax.text(cx, 0.840, _clean_text(val)[:32], fontsize=9.2, fontweight="bold", color=DARK_SLATE)

    return fig, ax, 0.808


def _add_footer(ax: Any, page_num: int, generated_at: str) -> None:
    ax.plot([0.05, 0.95], [0.052, 0.052], color=BORDER_LIGHT, linewidth=0.8)
    ax.text(
        0.05,
        0.036,
        f"Physico Health Rehab-AI Clinical Report  |  Generated {generated_at}",
        fontsize=7.2,
        color=TEXT_MUTED,
    )
    ax.text(0.95, 0.036, f"Page {page_num}", fontsize=7.5, fontweight="bold", color=TEXT_MUTED, ha="right")


def _draw_section_title(ax: Any, y: float, title: str, right_hint: str = "") -> float:
    ax.text(0.05, y, _clean_text(title), fontsize=10.5, fontweight="bold", color=DARK_SLATE)
    if right_hint:
        ax.text(0.95, y, _clean_text(right_hint), fontsize=8, color=TEXT_MUTED, ha="right")
    ax.plot([0.05, 0.95], [y - 0.008, y - 0.008], color=BORDER_LIGHT, linewidth=0.9)
    return y - 0.022


def _draw_kpi_row(ax: Any, y_top: float, cards: list[dict[str, str]]) -> float:
    card_h = 0.082
    gap = 0.016
    n = len(cards)
    card_w = (0.90 - gap * (n - 1)) / n

    for idx, card in enumerate(cards):
        x = 0.05 + idx * (card_w + gap)
        y = y_top - card_h
        accent = card.get("accent", TEAL)
        bg = card.get("bg", BG_PANEL)

        box = FancyBboxPatch(
            (x, y),
            card_w,
            card_h,
            boxstyle="round,pad=0.0,rounding_size=0.009",
            facecolor=bg,
            edgecolor=BORDER_LIGHT,
            linewidth=0.8,
        )
        ax.add_patch(box)

        top_bar = FancyBboxPatch(
            (x, y + card_h - 0.004),
            card_w,
            0.004,
            boxstyle="square,pad=0.0",
            facecolor=accent,
            edgecolor="none",
        )
        ax.add_patch(top_bar)

        ax.text(x + 0.012, y + card_h - 0.020, _clean_text(card["label"]).upper(), fontsize=6.8, fontweight="bold", color=TEXT_MUTED)
        ax.text(x + 0.012, y + 0.028, _clean_text(card["value"]), fontsize=15, fontweight="bold", color=accent)
        ax.text(x + 0.012, y + 0.010, _clean_text(card.get("sub", "")), fontsize=7.4, color=TEXT_BODY)

    return y_top - card_h - 0.024


def _draw_text_card(
    ax: Any,
    y_top: float,
    title: str,
    body: str,
    accent: str = TEAL,
    bg: str = TEAL_SOFT,
) -> float:
    clean_body = _clean_text(body) or "-"
    lines: list[str] = []
    for paragraph in clean_body.splitlines():
        wrapped = textwrap.wrap(paragraph, width=96) or [""]
        lines.extend(wrapped)
    lines = lines[:10]

    line_h = 0.0155
    box_h = 0.036 + len(lines) * line_h
    y = y_top - box_h

    box = FancyBboxPatch(
        (0.05, y),
        0.90,
        box_h,
        boxstyle="round,pad=0.0,rounding_size=0.009",
        facecolor=bg,
        edgecolor=accent,
        linewidth=0.7,
        alpha=0.9,
    )
    ax.add_patch(box)
    ax.text(0.068, y_top - 0.020, _clean_text(title), fontsize=8.8, fontweight="bold", color=accent)

    text_y = y_top - 0.040
    for line in lines:
        ax.text(0.068, text_y, line, fontsize=8.3, color=DARK_SLATE)
        text_y -= line_h

    return y - 0.018


def _draw_rep_chart(fig: Figure, rect: list[float], reps: list[dict[str, Any]]) -> None:
    ax = fig.add_axes(rect)
    rep_nums = [int(r.get("rep") or r.get("rep_number") or (i + 1)) for i, r in enumerate(reps)]
    scores = [float(r.get("final_score") or 0.0) for r in reps]
    colors = [_score_style(s)[0] for s in scores]

    x_pos = list(range(len(rep_nums)))
    bars = ax.bar(x_pos, scores, color=colors, width=0.58, edgecolor="none", zorder=3)
    ax.axhline(85, color=EMERALD, linestyle="--", linewidth=0.8, alpha=0.6, zorder=2)
    ax.axhline(70, color=AMBER, linestyle=":", linewidth=0.8, alpha=0.6, zorder=2)

    ax.set_ylim(0, 108)
    ax.set_xticks(x_pos)
    ax.set_xticklabels([f"R{n}" for n in rep_nums], fontsize=7.5, color=TEXT_BODY)
    ax.tick_params(axis="y", labelsize=7.5, colors=TEXT_MUTED)
    ax.grid(axis="y", color=BORDER_LIGHT, linestyle="-", linewidth=0.6, zorder=1)
    ax.set_facecolor(BG_PANEL)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(BORDER_LIGHT)

    if len(bars) <= 20:
        for bar, sc in zip(bars, scores):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                min(sc + 2.5, 102),
                f"{int(round(sc))}",
                ha="center",
                va="bottom",
                fontsize=7.0,
                fontweight="bold",
                color=DARK_SLATE,
            )


def _draw_progress_chart(fig: Figure, rect: list[float], sessions: list[dict[str, Any]]) -> None:
    ax = fig.add_axes(rect)
    ordered = list(reversed(sessions[:12]))
    labels = [f"#{i + 1}" for i in range(len(ordered))]
    scores = [float((s.get("summary") or {}).get("avg_final_score", 0.0)) for s in ordered]

    x_pos = list(range(len(scores)))
    ax.plot(x_pos, scores, color=TEAL, linewidth=2.2, marker="o", markersize=5, zorder=3)
    ax.fill_between(x_pos, scores, 0, color=TEAL, alpha=0.10, zorder=2)
    ax.set_ylim(0, 105)
    ax.set_xticks(x_pos)
    ax.set_xticklabels(labels, fontsize=7.5, color=TEXT_BODY)
    ax.tick_params(axis="y", labelsize=7.5, colors=TEXT_MUTED)
    ax.grid(axis="y", color=BORDER_LIGHT, linewidth=0.6, zorder=1)
    ax.set_facecolor(BG_PANEL)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(BORDER_LIGHT)


def _draw_table(
    pdf: PdfPages,
    state: dict[str, Any],
    y: float,
    section_title: str,
    headers: list[str],
    col_x: list[float],
    col_aligns: list[str],
    rows: list[list[str]],
    cont_title: str,
    cont_subtitle: str,
    cont_meta: list[tuple[str, str]],
) -> float:
    row_h = 0.0235
    header_h = 0.025
    bottom_limit = 0.078

    def draw_header(curr_ax: Any, curr_y: float) -> float:
        curr_y = _draw_section_title(curr_ax, curr_y, section_title, f"{len(rows)} entries")
        hdr_patch = FancyBboxPatch(
            (0.05, curr_y - header_h),
            0.90,
            header_h,
            boxstyle="round,pad=0.0,rounding_size=0.004",
            facecolor=DARK_SLATE,
            edgecolor="none",
        )
        curr_ax.add_patch(hdr_patch)
        for h_text, cx, align in zip(headers, col_x, col_aligns):
            curr_ax.text(
                cx,
                curr_y - header_h + 0.008,
                h_text.upper(),
                fontsize=7.0,
                fontweight="bold",
                color="white",
                ha=align,
            )
        return curr_y - header_h - 0.003

    if y - (header_h + row_h + 0.03) < bottom_limit:
        _add_footer(state["ax"], state["page"], state["generated_at"])
        pdf.savefig(state["fig"])
        state["page"] += 1
        fig, ax, y = _new_page(cont_title, cont_subtitle, cont_meta)
        state["fig"], state["ax"] = fig, ax

    y = draw_header(state["ax"], y)

    for idx, row in enumerate(rows):
        if y - row_h < bottom_limit:
            _add_footer(state["ax"], state["page"], state["generated_at"])
            pdf.savefig(state["fig"])
            state["page"] += 1
            fig, ax, y = _new_page(cont_title, f"{cont_subtitle} (cont.)", cont_meta)
            state["fig"], state["ax"] = fig, ax
            y = draw_header(ax, y)

        if idx % 2 == 1:
            row_patch = FancyBboxPatch(
                (0.05, y - row_h),
                0.90,
                row_h,
                boxstyle="square,pad=0.0",
                facecolor=BG_ZEBRA,
                edgecolor="none",
            )
            state["ax"].add_patch(row_patch)

        for cell, cx, align in zip(row, col_x, col_aligns):
            state["ax"].text(
                cx,
                y - row_h + 0.007,
                _clean_text(cell),
                fontsize=7.8,
                color=DARK_SLATE,
                ha=align,
            )
        state["ax"].plot([0.05, 0.95], [y - row_h, y - row_h], color=BORDER_LIGHT, linewidth=0.4)
        y -= row_h

    return y - 0.020


def build_session_pdf(
    session: dict[str, Any],
    patient: dict[str, Any],
    ai_feedback: str | None = None,
) -> bytes:
    """Build a clinical PDF report for a single patient exercise session."""
    summary = session.get("summary") or {}
    reps = summary.get("reps") or []
    exercise_name = session.get("exercise_name") or summary.get("exercise") or "Exercise Session"
    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")

    avg_final = float(summary.get("avg_final_score") or 0.0)
    avg_rom = float(summary.get("avg_rom_score") or 0.0)
    avg_stab = float(summary.get("avg_stability_score") or 0.0)
    avg_tempo = float(summary.get("avg_tempo_score") or 0.0)
    avg_asym = float(summary.get("avg_asymmetry_score") or 0.0)
    total_reps = int(summary.get("total_reps") or len(reps) or 0)
    target_reps = session.get("target_reps") or "-"
    target_sets = session.get("target_sets") or 1
    duration_str = _fmt_duration(summary.get("duration_seconds"))

    final_fg, final_bg, final_lbl = _score_style(avg_final if total_reps > 0 else None)
    rom_fg, rom_bg, _ = _score_style(avg_rom if total_reps > 0 else None)
    stab_fg, stab_bg, _ = _score_style(avg_stab if total_reps > 0 else None)
    tempo_fg, tempo_bg, _ = _score_style(avg_tempo if total_reps > 0 else None)

    meta_pairs = [
        ("Patient", patient.get("name") or patient.get("username") or "Patient"),
        ("Exercise", exercise_name),
        ("Date", _fmt_dt(session.get("started_at"))),
        ("Target / Status", f"{target_sets}x{target_reps}  |  {str(session.get('status', '-')).title()}"),
    ]

    buf = io.BytesIO()
    with PdfPages(buf) as pdf:
        fig, ax, y = _new_page(
            "Exercise Session Report",
            f"Session #{str(session.get('id', ''))[-8:]}",
            meta_pairs,
        )
        state = {"fig": fig, "ax": ax, "page": 1, "generated_at": generated_at}

        kpi_cards = [
            {
                "label": "Overall Score",
                "value": f"{avg_final:.1f}/100" if total_reps else "--",
                "sub": f"Rating: {final_lbl}",
                "accent": final_fg,
                "bg": final_bg,
            },
            {
                "label": "ROM Score",
                "value": f"{avg_rom:.1f}" if total_reps else "--",
                "sub": f"Asymmetry: {avg_asym:.1f}" if total_reps else "No reps",
                "accent": rom_fg,
                "bg": rom_bg,
            },
            {
                "label": "Stability",
                "value": f"{avg_stab:.1f}" if total_reps else "--",
                "sub": f"Completed: {total_reps} reps",
                "accent": stab_fg,
                "bg": stab_bg,
            },
            {
                "label": "Tempo Score",
                "value": f"{avg_tempo:.1f}" if total_reps else "--",
                "sub": f"Duration: {duration_str}",
                "accent": tempo_fg,
                "bg": tempo_bg,
            },
        ]
        y = _draw_kpi_row(state["ax"], y, kpi_cards)

        if reps:
            y = _draw_section_title(state["ax"], y, "Per-Rep Score Breakdown", "Green >= 85  |  Amber >= 70")
            chart_h = 0.165
            _draw_rep_chart(state["fig"], [0.09, y - chart_h + 0.01, 0.84, chart_h - 0.02], reps)
            y = y - chart_h - 0.022

            headers = ["Rep", "Score", "ROM", "Stability", "Tempo", "Time", "Feedback / Cues"]
            col_x = [0.065, 0.155, 0.245, 0.345, 0.445, 0.540, 0.600]
            col_aligns = ["left", "center", "center", "center", "center", "center", "left"]
            rows: list[list[str]] = []
            for idx, r in enumerate(reps):
                fb_list = r.get("feedback") or []
                fb_text = ", ".join(str(x) for x in fb_list) if isinstance(fb_list, list) else str(fb_list)
                rows.append([
                    f"#{r.get('rep') or r.get('rep_number') or (idx + 1)}",
                    f"{float(r.get('final_score') or 0):.1f}",
                    f"{float(r.get('rom_score') or 0):.1f}",
                    f"{float(r.get('stability_score') or 0):.1f}",
                    f"{float(r.get('tempo_score') or 0):.1f}",
                    f"{float(r.get('rep_time') or 0):.1f}s",
                    (fb_text or "Good form")[:36],
                ])

            y = _draw_table(
                pdf,
                state,
                y,
                "Detailed Rep Log",
                headers,
                col_x,
                col_aligns,
                rows,
                "Exercise Session Report",
                f"Session #{str(session.get('id', ''))[-8:]}",
                meta_pairs,
            )
        else:
            y = _draw_text_card(
                state["ax"],
                y,
                "Session Summary",
                "No completed repetitions were recorded during this session.",
                accent=TEXT_MUTED,
                bg=BG_PANEL,
            )

        # Notes & Feedback blocks
        feedback_events = summary.get("feedback_events") or []
        doctor_fb = session.get("doctor_feedback")
        notes_to_draw: list[tuple[str, str, str, str]] = []

        if feedback_events:
            cues_text = "; ".join(str(c) for c in feedback_events[:8])
            notes_to_draw.append(("Observed Posture & Form Cues", cues_text, AMBER, AMBER_SOFT))
        if doctor_fb:
            notes_to_draw.append(("Doctor's Clinical Note", str(doctor_fb), PURPLE, PURPLE_SOFT))
        if ai_feedback:
            notes_to_draw.append(("AI Rehabilitation Feedback", str(ai_feedback), EMERALD, EMERALD_SOFT))

        for title_txt, body_txt, accent_c, bg_c in notes_to_draw:
            if y < 0.21:
                _add_footer(state["ax"], state["page"], state["generated_at"])
                pdf.savefig(state["fig"])
                state["page"] += 1
                fig, ax, y = _new_page(
                    "Exercise Session Report",
                    f"Session #{str(session.get('id', ''))[-8:]} (cont.)",
                    meta_pairs,
                )
                state["fig"], state["ax"] = fig, ax
            y = _draw_text_card(state["ax"], y, title_txt, body_txt, accent=accent_c, bg=bg_c)

        _add_footer(state["ax"], state["page"], state["generated_at"])
        pdf.savefig(state["fig"])

    return buf.getvalue()


def build_progress_pdf(
    patient: dict[str, Any],
    progress: dict[str, Any],
    sessions: list[dict[str, Any]],
    pain_logs: list[dict[str, Any]],
    recovery_data: dict[str, Any] | None = None,
    ai_insight: str | None = None,
) -> bytes:
    """Build a multi-session Patient Rehabilitation Progress PDF report."""
    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")
    avg_score = float(progress.get("avg_final_score") or 0.0)
    session_count = int(progress.get("session_count") or 0)
    adherence = float(progress.get("adherence_percent") or 0.0)
    trend = str(progress.get("trend") or "stable").replace("_", " ").title()

    recovery_score = float((recovery_data or {}).get("recovery_score") or avg_score)
    avg_pain = float((recovery_data or {}).get("avg_pain") or 0.0)

    rec_fg, rec_bg, _ = _score_style(recovery_score if session_count > 0 else None)
    avg_fg, avg_bg, _ = _score_style(avg_score if session_count > 0 else None)

    meta_pairs = [
        ("Patient", patient.get("name") or patient.get("username") or "Patient"),
        ("Email", patient.get("email") or "-"),
        ("Score Trend", trend),
        ("Report Date", datetime.now(timezone.utc).strftime("%d %b %Y")),
    ]

    buf = io.BytesIO()
    with PdfPages(buf) as pdf:
        fig, ax, y = _new_page(
            "Patient Rehabilitation Progress Report",
            f"{session_count} completed sessions",
            meta_pairs,
        )
        state = {"fig": fig, "ax": ax, "page": 1, "generated_at": generated_at}

        kpi_cards = [
            {
                "label": "Recovery Score",
                "value": f"{recovery_score:.1f}/100",
                "sub": "Composite index",
                "accent": rec_fg,
                "bg": rec_bg,
            },
            {
                "label": "Avg Exercise Score",
                "value": f"{avg_score:.1f}/100" if session_count else "--",
                "sub": f"Trend: {trend}",
                "accent": avg_fg,
                "bg": avg_bg,
            },
            {
                "label": "Completed Sessions",
                "value": str(session_count),
                "sub": f"Compliance: {adherence:.0f}%",
                "accent": TEAL,
                "bg": TEAL_SOFT,
            },
            {
                "label": "Avg Pain Level",
                "value": f"{avg_pain:.1f}/10",
                "sub": f"{len(pain_logs)} recent logs",
                "accent": AMBER if avg_pain <= 5 else CORAL,
                "bg": AMBER_SOFT if avg_pain <= 5 else CORAL_SOFT,
            },
        ]
        y = _draw_kpi_row(state["ax"], y, kpi_cards)

        completed_sessions = [s for s in sessions if s.get("status") == "completed"]
        if len(completed_sessions) >= 2:
            y = _draw_section_title(state["ax"], y, "Recent Session Score Trend", "Chronological (oldest -> newest)")
            chart_h = 0.165
            _draw_progress_chart(state["fig"], [0.09, y - chart_h + 0.01, 0.84, chart_h - 0.02], completed_sessions)
            y = y - chart_h - 0.022

        if ai_insight:
            y = _draw_text_card(state["ax"], y, "AI Rehabilitation Summary", ai_insight, accent=EMERALD, bg=EMERALD_SOFT)

        if sessions:
            headers = ["Date", "Exercise", "Status", "Reps", "Score", "ROM", "Stability", "Tempo"]
            col_x = [0.060, 0.210, 0.440, 0.545, 0.625, 0.710, 0.805, 0.905]
            col_aligns = ["left", "left", "center", "center", "center", "center", "center", "center"]
            rows: list[list[str]] = []
            for s in sessions[:30]:
                sm = s.get("summary") or {}
                rows.append([
                    _fmt_dt(s.get("started_at"), short=True),
                    str(s.get("exercise_name") or "-")[:22],
                    str(s.get("status") or "-").title(),
                    str(sm.get("total_reps") if sm.get("total_reps") is not None else "-"),
                    f"{float(sm.get('avg_final_score') or 0):.1f}" if sm.get("total_reps") else "--",
                    f"{float(sm.get('avg_rom_score') or 0):.1f}" if sm.get("total_reps") else "--",
                    f"{float(sm.get('avg_stability_score') or 0):.1f}" if sm.get("total_reps") else "--",
                    f"{float(sm.get('avg_tempo_score') or 0):.1f}" if sm.get("total_reps") else "--",
                ])

            y = _draw_table(
                pdf,
                state,
                y,
                "Exercise Session History",
                headers,
                col_x,
                col_aligns,
                rows,
                "Patient Rehabilitation Progress Report",
                "Session History",
                meta_pairs,
            )

        if pain_logs:
            p_headers = ["Date", "Pain Score", "Location", "Notes"]
            p_col_x = [0.065, 0.250, 0.370, 0.560]
            p_aligns = ["left", "center", "left", "left"]
            p_rows = [
                [
                    _fmt_dt(p.get("created_at")),
                    f"{p.get('score', '-')}/10",
                    str(p.get("location") or "general")[:18],
                    str(p.get("notes") or p.get("validation_note") or "-")[:40],
                ]
                for p in pain_logs[:10]
            ]
            y = _draw_table(
                pdf,
                state,
                y,
                "Recent Pain Logs",
                p_headers,
                p_col_x,
                p_aligns,
                p_rows,
                "Patient Rehabilitation Progress Report",
                "Pain Logs",
                meta_pairs,
            )

        _add_footer(state["ax"], state["page"], state["generated_at"])
        pdf.savefig(state["fig"])

    return buf.getvalue()
