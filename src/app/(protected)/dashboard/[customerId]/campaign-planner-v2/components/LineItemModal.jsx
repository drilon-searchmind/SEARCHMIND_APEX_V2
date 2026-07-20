"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCopy, FiEdit2, FiEye, FiTrash2, FiX } from "react-icons/fi";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import Spinner from "@/components/ui/Spinner";
import { useUser } from "@/contexts/UserContext";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import {
	CAMPAIGN_TYPE_FORMATS,
	SERVICE_MEDIA_OPTIONS,
	LINE_ITEM_STATUSES,
} from "../constants";
import {
	defaultLineItemStatusStyle,
	LINE_ITEM_STATUS_STYLES,
	normalizeLineItemStatus,
} from "../lib/lineItemStatus";
import { useInternalUsers } from "@/hooks/useInternalUsers";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";

const defaultForm = () => ({
	name: "",
	media: "",
	selectedChannels: [],
	selectedFormats: [],
	startDate: "",
	endDate: "",
	alwaysOn: false,
	status: "Pending Searchmind",
	approvalLink: "",
	budget: "",
});

function toggleInArray(arr, value) {
	if (arr.includes(value)) return arr.filter((x) => x !== value);
	return [...arr, value];
}

/** Split a total budget (whole currency units) fairly across n rows; remainder to first rows. */
function splitBudgetTotal(total, n) {
	if (n <= 0 || total == null || Number.isNaN(total)) {
		return () => null;
	}
	const t = Math.max(0, Math.floor(Number(total)));
	const each = n > 0 ? Math.floor(t / n) : 0;
	const rem = n > 0 ? t - each * n : 0;
	return (index) => {
		if (n <= 0) return null;
		return each + (index < rem ? 1 : 0);
	};
}

function buildFormFromLineItem(initialLineItem) {
	const formats =
		initialLineItem.formats?.length > 0
			? [...initialLineItem.formats]
			: initialLineItem.format
				? [initialLineItem.format]
				: [];
	return {
		name: initialLineItem.name || "",
		media: initialLineItem.media || "",
		selectedChannels: [],
		selectedFormats: formats,
		startDate: initialLineItem.startDate || "",
		endDate: initialLineItem.endDate || "",
		alwaysOn: !!initialLineItem.alwaysOn,
		status: normalizeLineItemStatus(initialLineItem.status),
		approvalLink: initialLineItem.approvalLink || "",
		budget:
			initialLineItem.budget != null && initialLineItem.budget !== ""
				? String(initialLineItem.budget)
				: "",
	};
}

function parentDateBounds(parent) {
	if (!parent) return { min: "", max: "", alwaysOn: false };
	const min = parent.startDate ? String(parent.startDate).slice(0, 10) : "";
	if (parent.alwaysOn) return { min, max: "", alwaysOn: true };
	const max = parent.endDate ? String(parent.endDate).slice(0, 10) : "";
	return { min, max, alwaysOn: false };
}

function clampDateStr(value, min, max) {
	let v = value;
	if (min && v && v < min) v = min;
	if (max && v && v > max) v = max;
	return v;
}

/** Active @mention at caret: text from @ to caret must not contain whitespace. */
function getActiveMention(text, caretPos) {
	if (caretPos == null || caretPos < 0) return null;
	const before = text.slice(0, caretPos);
	const at = before.lastIndexOf("@");
	if (at === -1) return null;
	const chunk = before.slice(at + 1);
	if (/[\s\n]/.test(chunk)) return null;
	return { start: at, query: chunk };
}

function filterUsersForMention(users, query) {
	const list = Array.isArray(users) ? users : [];
	const q = (query || "").toLowerCase().trim();
	if (!q) return list;
	return list.filter((u) => (u.name || "").toLowerCase().includes(q));
}

/** Split comment text into plain runs and @mentions matched against known user names (longest name first). */
function splitCommentIntoSegments(text, users) {
	const raw = text ?? "";
	const list = [];
	const safeUsers = Array.isArray(users) ? users : [];
	const byNameLen = [...safeUsers].sort(
		(a, b) => (b.name || "").length - (a.name || "").length
	);
	let i = 0;
	while (i < raw.length) {
		if (raw[i] === "@") {
			const after = raw.slice(i + 1);
			let matchedLen = 0;
			for (const u of byNameLen) {
				const n = (u.name || "").trim();
				if (!n) continue;
				if (after.startsWith(n)) {
					const boundary = after[n.length];
					if (
						boundary === undefined ||
						/\s/.test(boundary) ||
						/[.,!?;:)\]"'…]/.test(boundary)
					) {
						matchedLen = 1 + n.length;
						break;
					}
				}
			}
			if (matchedLen > 0) {
				list.push({ type: "mention", value: raw.slice(i, i + matchedLen) });
				i += matchedLen;
				continue;
			}
		}
		const start = i;
		while (i < raw.length && raw[i] !== "@") i++;
		list.push({ type: "text", value: raw.slice(start, i) });
	}
	return list;
}

function CommentTextWithMentions({ text, users }) {
	const segments = useMemo(
		() => splitCommentIntoSegments(text, users),
		[text, users]
	);
	return (
		<>
			{segments.map((seg, idx) =>
				seg.type === "mention" ? (
					<span
						key={idx}
						className="rounded px-1 py-0.5 bg-sky-100 text-sky-700 font-medium"
					>
						{seg.value}
					</span>
				) : (
					<React.Fragment key={idx}>{seg.value}</React.Fragment>
				)
			)}
		</>
	);
}

/** Grouped block with header for cleaner modal layout */
function ModalSection({ title, description, children }) {
	return (
		<section className="apex-cp-inner-panel overflow-visible h-full min-h-0 flex flex-col">
			<div className="pb-3 mb-3 border-b border-[var(--color-rule)]">
				<h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
				{description ? (
					<p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
						{description}
					</p>
				) : null}
			</div>
			<div className="space-y-4 flex-1 min-h-0">{children}</div>
		</section>
	);
}

function CommentAvatar({ name, imageUrl }) {
	const [broken, setBroken] = useState(false);
	const initial = (name || "?").trim().slice(0, 1).toUpperCase();
	if (imageUrl && !broken) {
		return (
			// eslint-disable-next-line @next/next/no-img-element -- external profile URLs
			<img
				src={imageUrl}
				alt=""
				className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0 bg-white"
				onError={() => setBroken(true)}
			/>
		);
	}
	return (
		<div
			className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 border border-gray-200 shrink-0"
			aria-hidden
		>
			{initial}
		</div>
	);
}

export default function LineItemModal({
	open,
	onClose,
	onSave,
	onDuplicate,
	customerId,
	serviceName,
	initialLineItem,
	mode = "create",
	parentCampaign = null,
	customFormats = [],
	extraMediaByService = {},
	onAddCustomFormat,
	onAddExtraMedia,
}) {
	const sessionUser = useUser();
	const sessionUserId = sessionUser?.id || sessionUser?._id || null;

	const isCreate = mode === "create";
	const [form, setForm] = useState(defaultForm);
	/** per media key — optional; empty means “use shared total and split” */
	const [channelBudgets, setChannelBudgets] = useState({});
	const [editing, setEditing] = useState(true);
	const [channelError, setChannelError] = useState("");
	const [commentDraft, setCommentDraft] = useState("");
	const [remoteComments, setRemoteComments] = useState([]);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [commentsError, setCommentsError] = useState("");
	const [commentPosting, setCommentPosting] = useState(false);
	const [newFormatLabel, setNewFormatLabel] = useState("");
	const [newMediaLabel, setNewMediaLabel] = useState("");
	const [editingComment, setEditingComment] = useState(null);
	const [editCommentText, setEditCommentText] = useState("");
	const [mentionPick, setMentionPick] = useState(null);
	const commentTextareaRef = useRef(null);
	const editCommentTextareaRef = useRef(null);
	const { internalUsers } = useInternalUsers();

	const bounds = useMemo(() => parentDateBounds(parentCampaign), [parentCampaign]);

	const mentionFiltered = useMemo(() => {
		if (!mentionPick) return [];
		return filterUsersForMention(internalUsers, mentionPick.query);
	}, [mentionPick, internalUsers]);

	const mediaOptions = useMemo(() => {
		const base = SERVICE_MEDIA_OPTIONS[serviceName] || [];
		const extra = extraMediaByService?.[serviceName] || [];
		const add = Array.isArray(extra) ? extra : [];
		const out = [...base];
		add.forEach((x) => {
			if (x && !out.includes(x)) out.push(x);
		});
		return out;
	}, [serviceName, extraMediaByService]);

	const allFormatOptions = useMemo(() => {
		const out = [...CAMPAIGN_TYPE_FORMATS];
		(customFormats || []).forEach((f) => {
			if (f && !out.includes(f)) out.push(f);
		});
		return out;
	}, [customFormats]);

	const isEmailNewsletter = useMemo(() => {
		const formats =
			isCreate
				? form.selectedFormats
				: initialLineItem?.formats?.length
					? initialLineItem.formats
					: initialLineItem?.format
						? [initialLineItem.format]
						: [];
		const hasNewsletter = (formats || []).some((f) => f === "Newsletter");
		const hasEmail =
			isCreate
				? form.selectedChannels.includes("Email")
				: (initialLineItem?.media || form.media) === "Email";
		return serviceName === "Email Marketing" && hasNewsletter && hasEmail;
	}, [
		isCreate,
		serviceName,
		form.selectedFormats,
		form.selectedChannels,
		form.media,
		initialLineItem,
	]);

	const readOnly = !isCreate && !editing;

	const loadComments = useCallback(async () => {
		if (!customerId || !initialLineItem?.id || isCreate) {
			setRemoteComments([]);
			return;
		}
		setCommentsLoading(true);
		setCommentsError("");
		try {
			const res = await fetch(
				`/api/campaign-planner/${customerId}/comments?lineItemId=${encodeURIComponent(initialLineItem.id)}`
			);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Could not load comments");
			setRemoteComments(Array.isArray(data.comments) ? data.comments : []);
		} catch (e) {
			setCommentsError(e.message || "Could not load comments");
			setRemoteComments([]);
		} finally {
			setCommentsLoading(false);
		}
	}, [customerId, initialLineItem?.id, isCreate]);

	useEffect(() => {
		if (!open) return;
		setChannelError("");
		setCommentDraft("");
		setCommentsError("");
		if (isCreate) {
			setForm(defaultForm());
			setChannelBudgets({});
			setEditing(true);
			setRemoteComments([]);
		} else if (initialLineItem) {
			setForm(buildFormFromLineItem(initialLineItem));
			setEditing(false);
		}
		setEditingComment(null);
		setEditCommentText("");
		setMentionPick(null);
	}, [open, initialLineItem, isCreate]);

	useEffect(() => {
		if (!isCreate) return;
		setChannelBudgets((prev) => {
			const next = { ...prev };
			form.selectedChannels.forEach((ch) => {
				if (next[ch] === undefined) next[ch] = "";
			});
			Object.keys(next).forEach((k) => {
				if (!form.selectedChannels.includes(k)) delete next[k];
			});
			return next;
		});
	}, [isCreate, form.selectedChannels]);

	const syncMention = useCallback((text, caret, field) => {
		const m = getActiveMention(text, caret);
		if (m) {
			setMentionPick((prev) => {
				const same =
					prev &&
					prev.field === field &&
					prev.start === m.start &&
					prev.query === m.query;
				return {
					field,
					start: m.start,
					query: m.query,
					highlight: same ? prev.highlight : 0,
				};
			});
		} else {
			setMentionPick(null);
		}
	}, []);

	const insertMentionUser = useCallback(
		(text, setText, textareaRef, pick, user) => {
			const el = textareaRef.current;
			const caret = el?.selectionStart ?? text.length;
			const before = text.slice(0, pick.start);
			const after = text.slice(caret);
			const tag = `@${user.name} `;
			setText(before + tag + after);
			setMentionPick(null);
			requestAnimationFrame(() => {
				if (!el) return;
				const pos = before.length + tag.length;
				el.focus();
				el.setSelectionRange(pos, pos);
			});
		},
		[]
	);

	const handleMentionKeyDown = useCallback(
		(e, field, text, setText, textareaRef) => {
			if (!mentionPick || mentionPick.field !== field) return;
			if (e.key === "Escape") {
				e.preventDefault();
				setMentionPick(null);
				return;
			}
			const filtered = filterUsersForMention(internalUsers, mentionPick.query);
			if (filtered.length === 0) return;
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setMentionPick((p) => {
					if (!p || p.field !== field) return p;
					const f = filterUsersForMention(internalUsers, p.query);
					if (!f.length) return p;
					return { ...p, highlight: Math.min(f.length - 1, p.highlight + 1) };
				});
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setMentionPick((p) => {
					if (!p || p.field !== field) return p;
					const f = filterUsersForMention(internalUsers, p.query);
					if (!f.length) return p;
					return { ...p, highlight: Math.max(0, p.highlight - 1) };
				});
				return;
			}
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				const hi = Math.min(mentionPick.highlight, filtered.length - 1);
				const u = filtered[hi];
				if (u) insertMentionUser(text, setText, textareaRef, mentionPick, u);
			}
		},
		[mentionPick, internalUsers, insertMentionUser]
	);

	useEffect(() => {
		if (!open || isCreate || !initialLineItem?.id || !customerId) return;
		loadComments();
	}, [open, isCreate, initialLineItem?.id, customerId, loadComments]);

	const exitEditMode = useCallback(() => {
		if (initialLineItem) {
			setForm(buildFormFromLineItem(initialLineItem));
		}
		setEditing(false);
		setChannelError("");
	}, [initialLineItem]);

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		if (name === "alwaysOn") {
			if (isEmailNewsletter) return;
			setForm((prev) => ({
				...prev,
				alwaysOn: checked,
				endDate: checked ? "" : prev.endDate,
			}));
			return;
		}
		if (name === "startDate" && !readOnly) {
			const v = clampDateStr(value, bounds.min, bounds.max || undefined);
			if (isEmailNewsletter) {
				setForm((prev) => ({
					...prev,
					startDate: v,
					endDate: v,
					alwaysOn: false,
				}));
				return;
			}
			setForm((prev) => ({ ...prev, startDate: v }));
			return;
		}
		if (name === "endDate" && !readOnly) {
			const v = clampDateStr(value, bounds.min || undefined, bounds.max || undefined);
			if (isEmailNewsletter) {
				setForm((prev) => ({
					...prev,
					startDate: v,
					endDate: v,
					alwaysOn: false,
				}));
				return;
			}
			setForm((prev) => ({ ...prev, endDate: v }));
			return;
		}
		setForm((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}));
	};

	const toggleChannel = (m) => {
		setChannelError("");
		setForm((prev) => ({
			...prev,
			selectedChannels: toggleInArray(prev.selectedChannels, m),
		}));
	};

	const toggleFormat = (f) => {
		setForm((prev) => {
			const selectedFormats = toggleInArray(prev.selectedFormats, f);
			let next = { ...prev, selectedFormats };
			if (
				f === "Newsletter" &&
				serviceName === "Email Marketing" &&
				selectedFormats.includes("Newsletter")
			) {
				const d = next.startDate || next.endDate;
				next = { ...next, startDate: d, endDate: d, alwaysOn: false };
			}
			return next;
		});
	};

	const buildPayloadCore = () => {
		const startDate = form.startDate;
		let endDate = form.alwaysOn ? "" : form.endDate;
		if (isEmailNewsletter) {
			endDate = startDate;
		}
		return {
			name: form.name.trim(),
			startDate,
			endDate,
			alwaysOn: isEmailNewsletter ? false : form.alwaysOn,
			status: normalizeLineItemStatus(form.status),
			approvalLink: form.approvalLink.trim(),
			budget: form.budget === "" ? null : Number(form.budget),
		};
	};

	function budgetForLineItemChannel(channels, media) {
		const n = channels.length;
		const parseField = (ch) => {
			const raw = channelBudgets[ch];
			if (raw == null || String(raw).trim() === "") return null;
			const x = Number(raw);
			return Number.isNaN(x) ? null : x;
		};
		const hasAny = channels.some((ch) => parseField(ch) != null);
		if (hasAny) {
			return parseField(media);
		}
		const g =
			form.budget === "" || form.budget == null
				? null
				: Number(form.budget);
		if (g == null || Number.isNaN(g) || n === 0) return null;
		const i = channels.indexOf(media);
		return splitBudgetTotal(g, n)(i);
	}

	const handleStatusChange = (e) => {
		const value = e.target.value;
		if (!isCreate && !editing) {
			setForm((prev) => ({ ...prev, status: value }));
			onSave({ status: normalizeLineItemStatus(value) });
			return;
		}
		handleChange(e);
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		if (!isCreate && !editing) return;
		if (!form.name.trim()) return;

		const core = buildPayloadCore();
		const formats = form.selectedFormats;
		const formatFirst = formats[0] || "";

		if (!isCreate) {
			onSave({
				...core,
				media: form.media,
				formats,
				format: formatFirst,
			});
			onClose();
			return;
		}

		if (mediaOptions.length > 0 && form.selectedChannels.length === 0) {
			setChannelError("Select at least one channel.");
			return;
		}

		const channels =
			form.selectedChannels.length > 0 ? form.selectedChannels : [""];

		const bulkPayloads = channels.map((media) => ({
			...core,
			budget: budgetForLineItemChannel(channels, media),
			media,
			formats,
			format: formatFirst,
		}));

		onSave({ bulkPayloads });
		onClose();
	};

	const handleAddComment = async () => {
		const t = commentDraft.trim();
		if (!t || !customerId || !initialLineItem?.id) return;
		setCommentPosting(true);
		setCommentsError("");
		try {
			const res = await fetch(`/api/campaign-planner/${customerId}/comments`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					lineItemId: initialLineItem.id,
					text: t,
					campaignTypeName: initialLineItem.name || "",
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Could not save comment");
			if (data.comment) {
				setRemoteComments((prev) => [...prev, data.comment]);
				pushGTMEvent(GTM_EVENTS.CAMPAIGN_PLANNER_V2_LINE_ITEM_COMMENT_ADDED, {
					eventData: {
						customerId: customerId ? String(customerId) : "",
						lineItemId: String(initialLineItem.id),
					},
				});
			}
			setCommentDraft("");
		} catch (e) {
			setCommentsError(e.message || "Could not save comment");
		} finally {
			setCommentPosting(false);
		}
	};

	const saveEditedComment = async () => {
		if (!editingComment || !customerId) return;
		const t = editCommentText.trim();
		if (!t) return;
		setCommentPosting(true);
		setCommentsError("");
		try {
			const res = await fetch(
				`/api/campaign-planner/${customerId}/comments/${editingComment}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
					text: t,
					campaignTypeName: initialLineItem?.name || "",
				}),
				}
			);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Could not update comment");
			if (data.comment) {
				setRemoteComments((prev) =>
					prev.map((c) => (c.id === data.comment.id ? data.comment : c))
				);
			}
			setEditingComment(null);
			setEditCommentText("");
			setMentionPick(null);
		} catch (e) {
			setCommentsError(e.message || "Could not update comment");
		} finally {
			setCommentPosting(false);
		}
	};

	const deleteComment = async (commentId) => {
		if (!commentId || !customerId) return;
		if (!window.confirm("Delete this comment?")) return;
		setCommentsError("");
		try {
			const res = await fetch(
				`/api/campaign-planner/${customerId}/comments/${commentId}`,
				{ method: "DELETE" }
			);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || "Could not delete comment");
			setRemoteComments((prev) => prev.filter((c) => c.id !== commentId));
		} catch (e) {
			setCommentsError(e.message || "Could not delete comment");
		}
	};

	if (!open) return null;

	return (
		<div className="apex-cp-modal-backdrop">
			<div className="apex-cp-modal max-w-6xl">
				<button
					type="button"
					className="apex-cp-modal__close"
					onClick={onClose}
					aria-label="Close"
				>
					<FiX size={24} />
				</button>

				<div className="flex flex-wrap items-start justify-between gap-3 pr-10 mb-2">
					<div>
						<h2 className="apex-cp-panel-card__title">
							{isCreate ? "New campaign type" : "Campaign type"}
						</h2>
						{serviceName && (
							<p className="text-sm text-[var(--color-muted)] mt-0.5">
								Channel group: {serviceName}
							</p>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-2 shrink-0">
						{!isCreate && onDuplicate && (
							<button
								type="button"
								onClick={onDuplicate}
								className="apex-cp-btn"
							>
								<FiCopy className="w-4 h-4" />
								Duplicate
							</button>
						)}
						{!isCreate && (
							<button
								type="button"
								onClick={() => {
									if (editing) exitEditMode();
									else setEditing(true);
								}}
								className="apex-cp-btn"
							>
								{editing ? (
									<>
										<FiEye className="w-4 h-4" />
										View
									</>
								) : (
									<>
										<FiEdit2 className="w-4 h-4" />
										Edit
									</>
								)}
							</button>
						)}
					</div>
				</div>

				<form className="grid grid-cols-1 gap-6 mt-2" onSubmit={handleSubmit}>
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-stretch">
					<ModalSection
						title="Campaign type"
						description="Name, channel selection, and formats for this campaign type row."
					>
					<div>
						<FormLabel htmlFor="li-name" required>
							Name
						</FormLabel>
						{readOnly ? (
							<p className="mt-2 text-sm text-gray-900 font-medium">{form.name || "—"}</p>
						) : (
							<FormInputText
								id="li-name"
								name="name"
								value={form.name}
								onChange={handleChange}
								required
							/>
						)}
					</div>

					{isCreate && mediaOptions.length > 0 && (
						<div>
							<FormLabel>Channels (one campaign type per channel)</FormLabel>
							<p className="text-xs text-gray-500 mt-0.5 mb-2">
								Select platforms; we create one row per channel with the same
								details.
							</p>
							<div className="flex flex-wrap gap-2">
								{mediaOptions.map((m) => (
									<label
										key={m}
										className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${form.selectedChannels.includes(m)
												? "border-[var(--color-ink)] bg-[var(--color-paper-2)]"
												: "border-gray-200 bg-white"
											}`}
									>
										<input
											type="checkbox"
											className="rounded border-gray-300"
											checked={form.selectedChannels.includes(m)}
											onChange={() => toggleChannel(m)}
										/>
										{m}
									</label>
								))}
							</div>
							{channelError && (
								<p className="text-sm text-red-600 mt-1">{channelError}</p>
							)}
						</div>
					)}

					{!isCreate && (
						<div>
							<FormLabel>Channel</FormLabel>
							{readOnly ? (
								<p className="mt-2 text-sm text-gray-900">{form.media || "—"}</p>
							) : (
								<select
									id="li-media"
									name="media"
									value={form.media}
									onChange={handleChange}
									className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
								>
									<option value="">—</option>
									{mediaOptions.map((m) => (
										<option key={m} value={m}>
											{m}
										</option>
									))}
								</select>
							)}
							{!readOnly && onAddExtraMedia && serviceName && (
								<div className="mt-2 flex flex-wrap gap-2 items-center">
									<input
										type="text"
										value={newMediaLabel}
										onChange={(e) => setNewMediaLabel(e.target.value)}
										placeholder="New channel / media type"
										className="flex-1 min-w-[140px] h-9 rounded-lg border border-gray-300 px-3 text-sm"
									/>
									<button
										type="button"
										onClick={() => {
											onAddExtraMedia(serviceName, newMediaLabel);
											setNewMediaLabel("");
										}}
										className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
									>
										Add media
									</button>
								</div>
							)}
						</div>
					)}

					{isCreate && onAddExtraMedia && serviceName && mediaOptions.length > 0 && (
						<div className="flex flex-wrap gap-2 items-center -mt-2">
							<input
								type="text"
								value={newMediaLabel}
								onChange={(e) => setNewMediaLabel(e.target.value)}
								placeholder="Add custom channel for this service"
								className="flex-1 min-w-[140px] h-9 rounded-lg border border-gray-300 px-3 text-sm"
							/>
							<button
								type="button"
								onClick={() => {
									onAddExtraMedia(serviceName, newMediaLabel);
									setNewMediaLabel("");
								}}
								className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
							>
								Add channel
							</button>
						</div>
					)}

					<div>
						<FormLabel>Campaign formats / media types</FormLabel>
						{readOnly ? (
							<div className="mt-2 flex flex-wrap gap-2">
								{form.selectedFormats.length === 0 ? (
									<span className="text-sm text-gray-500">—</span>
								) : (
									form.selectedFormats.map((f) => (
										<span
											key={f}
											className="inline-flex px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-xs text-gray-800"
										>
											{f}
										</span>
									))
								)}
							</div>
						) : (
							<div className="mt-2 flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 rounded-lg border border-gray-100 bg-gray-50/80">
								{allFormatOptions.map((f) => (
									<label
										key={f}
										className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs cursor-pointer ${form.selectedFormats.includes(f)
												? "border-gray-800 bg-gray-900 text-white"
												: "border-gray-200 bg-white text-gray-800"
											}`}
									>
										<input
											type="checkbox"
											className="rounded border-gray-300 sr-only"
											checked={form.selectedFormats.includes(f)}
											onChange={() => toggleFormat(f)}
										/>
										{f}
									</label>
								))}
								{onAddCustomFormat && (
									<div className="flex flex-wrap gap-2 items-center w-full mt-1 pt-2 border-t border-gray-200">
										<input
											type="text"
											value={newFormatLabel}
											onChange={(e) => setNewFormatLabel(e.target.value)}
											placeholder="New format name"
											className="flex-1 min-w-[120px] h-9 rounded-lg border border-gray-300 px-3 text-xs"
										/>
										<button
											type="button"
											onClick={() => {
												onAddCustomFormat(newFormatLabel);
												setNewFormatLabel("");
											}}
											className="h-9 px-3 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
										>
											Add format
										</button>
									</div>
								)}
							</div>
						)}
					</div>
					</ModalSection>

					<ModalSection
						title="Budget & schedule"
						description={
							parentCampaign && (bounds.min || bounds.max)
								? `Stay within the parent campaign window${bounds.min ? ` (from ${bounds.min}` : ""}${bounds.max ? ` to ${bounds.max}` : bounds.alwaysOn ? " onward" : ""}${bounds.min || bounds.max ? ")." : ""}`
								: "Optional budget and when this campaign type runs."
						}
					>
					<div>
						<FormLabel htmlFor="li-budget">Budget (optional)</FormLabel>
						{readOnly ? (
							<p className="mt-2 text-sm text-gray-900 tabular-nums">
								{form.budget !== "" && form.budget != null
									? Number(form.budget).toLocaleString("da-DK")
									: "—"}
							</p>
						) : isCreate &&
						  mediaOptions.length > 0 &&
						  form.selectedChannels.length > 1 ? (
							<>
								<p className="text-xs text-gray-500 mt-0.5 mb-2">
									Total is split evenly across the selected channels unless you set
									per-channel amounts (overrides split).
								</p>
								<FormInputText
									id="li-budget"
									name="budget"
									type="number"
									min="0"
									step="1"
									value={form.budget}
									onChange={handleChange}
									placeholder="Total to split across channels"
								/>
								<div className="mt-3 rounded-lg border border-gray-200 overflow-hidden">
									<div className="grid grid-cols-[1fr,minmax(0,7.5rem)] gap-2 px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600">
										<span>Channel</span>
										<span className="text-right">Budget</span>
									</div>
									{form.selectedChannels.map((ch) => (
										<div
											key={ch}
											className="grid grid-cols-[1fr,minmax(0,7.5rem)] gap-2 px-3 py-2 border-t border-gray-100 items-center"
										>
											<span className="text-sm text-gray-800">{ch}</span>
											<input
												type="number"
												min="0"
												step="1"
												className="w-full h-9 rounded border border-gray-300 px-2 text-sm tabular-nums"
												placeholder="Override"
												aria-label={`Budget for ${ch}`}
												value={channelBudgets[ch] ?? ""}
												onChange={(e) =>
													setChannelBudgets((prev) => ({
														...prev,
														[ch]: e.target.value,
													}))
												}
											/>
										</div>
									))}
								</div>
							</>
						) : (
							<FormInputText
								id="li-budget"
								name="budget"
								type="number"
								min="0"
								step="1"
								value={form.budget}
								onChange={handleChange}
								placeholder="Amount for this campaign type"
							/>
						)}
					</div>

					{!isEmailNewsletter && (
						<div className="flex items-center gap-2">
							{readOnly ? (
								<p className="text-sm text-gray-900">
									<span className="text-gray-500">Always on: </span>
									{form.alwaysOn ? "Yes" : "No"}
								</p>
							) : (
								<>
									<input
										id="li-alwaysOn"
										name="alwaysOn"
										type="checkbox"
										checked={form.alwaysOn}
										onChange={handleChange}
										className="rounded border-gray-300"
									/>
									<label htmlFor="li-alwaysOn" className="text-sm text-gray-700">
										Always on
									</label>
								</>
							)}
						</div>
					)}

					{readOnly && isEmailNewsletter ? (
						<div>
							<FormLabel>Send date</FormLabel>
							<p className="mt-2 text-sm text-gray-900">
								{form.startDate || "—"}
								<span className="text-gray-500 text-xs ml-2">
									(start and end match for newsletters)
								</span>
							</p>
						</div>
					) : readOnly ? (
						<>
							<div>
								<FormLabel>Start date</FormLabel>
								<p className="mt-2 text-sm text-gray-900">{form.startDate || "—"}</p>
							</div>
							{!form.alwaysOn && (
								<div>
									<FormLabel>End date</FormLabel>
									<p className="mt-2 text-sm text-gray-900">{form.endDate || "—"}</p>
								</div>
							)}
						</>
					) : isEmailNewsletter ? (
						<div>
							<FormLabel htmlFor="li-newsletter-date">Send date</FormLabel>
							<p className="text-xs text-gray-500 mt-0.5 mb-2">
								Newsletters use a single send date; start and end are stored as the
								same day.
							</p>
							<input
								id="li-newsletter-date"
								type="date"
								name="startDate"
								value={form.startDate}
								onChange={handleChange}
								min={bounds.min || undefined}
								max={bounds.max || undefined}
								className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
							/>
						</div>
					) : form.alwaysOn ? (
						<div>
							<FormLabel htmlFor="li-start">Start date</FormLabel>
							<input
								id="li-start"
								type="date"
								name="startDate"
								value={form.startDate}
								onChange={handleChange}
								min={bounds.min || undefined}
								max={bounds.max || undefined}
								className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
							/>
						</div>
					) : (
						<div>
							<FormLabel>Schedule</FormLabel>
							<div className="mt-2 flex flex-wrap items-center gap-2">
								<DateRangePicker
									usePortal
									onApply={() => {}}
									startDate={form.startDate}
									endDate={form.endDate}
									onStartDateChange={(v) => {
										const x = clampDateStr(
											v,
											bounds.min,
											bounds.max || undefined
										);
										setForm((prev) => ({ ...prev, startDate: x }));
									}}
									onEndDateChange={(v) => {
										const x = clampDateStr(
											v,
											bounds.min || undefined,
											bounds.max || undefined
										);
										setForm((prev) => ({ ...prev, endDate: x }));
									}}
								/>
							</div>
						</div>
					)}
					</ModalSection>

					<ModalSection
						title="Workflow & approval"
						description="Kanban status and optional client approval link."
					>
					<div>
						<FormLabel htmlFor="li-status">Status</FormLabel>
						{(() => {
							const st =
								LINE_ITEM_STATUS_STYLES[normalizeLineItemStatus(form.status)] ||
								defaultLineItemStatusStyle();
							return (
								<select
									id="li-status"
									name="status"
									value={form.status}
									onChange={
										!isCreate && !editing ? handleStatusChange : handleChange
									}
									className="mt-2 h-11 w-full max-w-md rounded-lg border-2 px-4 py-2.5 text-sm font-semibold border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]/15"
									style={{
										backgroundColor: st.bg,
										borderColor: st.border,
										color: "var(--color-ink)",
									}}
								>
									{LINE_ITEM_STATUSES.map((s) => (
										<option key={s} value={s}>
											{s}
										</option>
									))}
								</select>
							);
						})()}
						{!isCreate && !editing && (
							<p className="text-xs text-gray-500 mt-1.5">
								Click to change status — no need to open edit mode.
							</p>
						)}
					</div>

					<div>
						<FormLabel htmlFor="li-approval">Approval link</FormLabel>
						{readOnly ? (
							<p className="mt-2 text-sm">
								{form.approvalLink?.trim() ? (
									<a
										href={form.approvalLink}
										target="_blank"
										rel="noopener noreferrer"
										className="text-[var(--color-ink)] hover:underline break-all"
									>
										{form.approvalLink}
									</a>
								) : (
									"—"
								)}
							</p>
						) : (
							<FormInputText
								id="li-approval"
								name="approvalLink"
								value={form.approvalLink}
								onChange={handleChange}
								placeholder="https://"
							/>
						)}
					</div>
					</ModalSection>
					</div>

					{!isCreate && initialLineItem?.id && customerId && (
						<ModalSection
							title="Team comments"
							description="Notes for this campaign type. Type @ to mention a teammate."
						>
							{commentsError && (
								<p className="text-sm text-red-600 mb-2">{commentsError}</p>
							)}
							{commentsLoading ? (
								<div className="flex justify-center py-6">
									<Spinner size={28} color="#131313" />
								</div>
							) : (
								<ul className="space-y-3 max-h-52 overflow-y-auto mb-3">
									{remoteComments.length === 0 ? (
										<li className="text-sm text-gray-400">No comments yet.</li>
									) : (
										remoteComments.map((c) => {
											const own =
												sessionUserId &&
												String(c.userId) === String(sessionUserId);
											return (
												<li
													key={c.id}
													className="flex gap-3 text-sm bg-white border border-gray-100 rounded-lg px-3 py-2.5"
												>
													<CommentAvatar
														name={c.userName}
														imageUrl={c.userImage}
													/>
													<div className="min-w-0 flex-1">
														<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
															<span className="font-semibold text-gray-900">
																{c.userName || "User"}
															</span>
															<span className="text-xs text-gray-400">
																{c.createdAt
																	? new Date(c.createdAt).toLocaleString("en-GB", {
																		day: "numeric",
																		month: "short",
																		year: "numeric",
																		hour: "2-digit",
																		minute: "2-digit",
																	})
																	: ""}
															</span>
														</div>
														{editingComment === c.id ? (
															<div className="mt-2 space-y-2 relative">
																<textarea
																	ref={editCommentTextareaRef}
																	value={editCommentText}
																	onChange={(e) => {
																		setEditCommentText(e.target.value);
																		syncMention(
																			e.target.value,
																			e.target.selectionStart,
																			"edit"
																		);
																	}}
																	onClick={(e) =>
																		syncMention(
																			e.target.value,
																			e.target.selectionStart,
																			"edit"
																		)
																	}
																	onKeyUp={(e) =>
																		syncMention(
																			e.target.value,
																			e.target.selectionStart,
																			"edit"
																		)
																	}
																	onKeyDown={(e) =>
																		handleMentionKeyDown(
																			e,
																			"edit",
																			editCommentText,
																			setEditCommentText,
																			editCommentTextareaRef
																		)
																	}
																	rows={3}
																	className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
																/>
																{mentionPick?.field === "edit" &&
																	mentionFiltered.length > 0 && (
																		<ul className="absolute left-0 right-0 top-full mt-1 z-[70] max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
																			{mentionFiltered.map((u, i) => (
																				<li key={u.id}>
																					<button
																						type="button"
																						className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${
																							i === mentionPick.highlight
																								? "bg-gray-100"
																								: ""
																						}`}
																						onMouseDown={(ev) => {
																							ev.preventDefault();
																							insertMentionUser(
																								editCommentText,
																								setEditCommentText,
																								editCommentTextareaRef,
																								mentionPick,
																								u
																							);
																						}}
																						onMouseEnter={() =>
																							setMentionPick((p) =>
																								p?.field === "edit"
																									? { ...p, highlight: i }
																									: p
																							)
																						}
																					>
																						<CommentAvatar
																							name={u.name}
																							imageUrl={u.image}
																						/>
																						<span className="truncate font-medium text-gray-900">
																							{u.name}
																						</span>
																					</button>
																				</li>
																			))}
																		</ul>
																	)}
																<div className="flex gap-2">
																	<button
																		type="button"
																		onClick={saveEditedComment}
																		disabled={commentPosting}
																		className="px-3 py-1.5 rounded-lg bg-[var(--color-ink)] text-white text-xs font-medium disabled:opacity-50"
																	>
																		Save
																	</button>
																	<button
																		type="button"
																		onClick={() => {
																			setEditingComment(null);
																			setEditCommentText("");
																			setMentionPick(null);
																		}}
																		className="px-3 py-1.5 rounded-lg border text-xs"
																	>
																		Cancel
																	</button>
																</div>
															</div>
														) : (
															<p className="text-gray-800 whitespace-pre-wrap mt-1">
																<CommentTextWithMentions
																	text={c.text}
																	users={internalUsers}
																/>
															</p>
														)}
														{own && editingComment !== c.id && (
															<div className="mt-2 flex gap-2">
																<button
																	type="button"
																	onClick={() => {
																		setEditingComment(c.id);
																		setEditCommentText(c.text);
																		setMentionPick(null);
																	}}
																	className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
																>
																	<FiEdit2 className="w-3.5 h-3.5" />
																	Edit
																</button>
																<button
																	type="button"
																	onClick={() => deleteComment(c.id)}
																	className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
																>
																	<FiTrash2 className="w-3.5 h-3.5" />
																	Delete
																</button>
															</div>
														)}
													</div>
												</li>
											);
										})
									)}
								</ul>
							)}
							<div className="relative flex gap-2 w-full">
								<textarea
									ref={commentTextareaRef}
									value={commentDraft}
									onChange={(e) => {
										setCommentDraft(e.target.value);
										syncMention(
											e.target.value,
											e.target.selectionStart,
											"draft"
										);
									}}
									onClick={(e) =>
										syncMention(e.target.value, e.target.selectionStart, "draft")
									}
									onKeyUp={(e) =>
										syncMention(e.target.value, e.target.selectionStart, "draft")
									}
									onKeyDown={(e) =>
										handleMentionKeyDown(
											e,
											"draft",
											commentDraft,
											setCommentDraft,
											commentTextareaRef
										)
									}
									rows={2}
									placeholder="Add a comment… (type @ to mention)"
									disabled={commentPosting}
									className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none disabled:opacity-60"
								/>
								{mentionPick?.field === "draft" &&
									mentionFiltered.length > 0 && (
										<ul className="absolute left-0 right-0 top-full mt-1 z-[70] max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
											{mentionFiltered.map((u, i) => (
												<li key={u.id}>
													<button
														type="button"
														className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 ${
															i === mentionPick.highlight
																? "bg-gray-100"
																: ""
														}`}
														onMouseDown={(ev) => {
															ev.preventDefault();
															insertMentionUser(
																commentDraft,
																setCommentDraft,
																commentTextareaRef,
																mentionPick,
																u
															);
														}}
														onMouseEnter={() =>
															setMentionPick((p) =>
																p?.field === "draft"
																	? { ...p, highlight: i }
																	: p
															)
														}
													>
														<CommentAvatar
															name={u.name}
															imageUrl={u.image}
														/>
														<span className="truncate font-medium text-gray-900">
															{u.name}
														</span>
													</button>
												</li>
											))}
										</ul>
									)}
								<button
									type="button"
									onClick={handleAddComment}
									disabled={commentPosting || !commentDraft.trim()}
									className="shrink-0 h-fit px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
								>
									{commentPosting ? "…" : "Add"}
								</button>
							</div>
						</ModalSection>
					)}

					<div className="flex justify-end gap-2 pt-2 flex-wrap border-t border-[var(--color-rule)] mt-2">
						<button type="button" onClick={onClose} className="apex-cp-btn">
							Close
						</button>
						{!isCreate && editing && (
							<button
								type="button"
								onClick={exitEditMode}
								className="apex-cp-btn"
							>
								Cancel edit
							</button>
						)}
						{(isCreate || editing) && (
							<button
								type="submit"
								className="apex-perf-btn apex-perf-btn--primary"
							>
								{isCreate ? "Add" : "Save changes"}
							</button>
						)}
					</div>
				</form>
			</div>
		</div>
	);
}
