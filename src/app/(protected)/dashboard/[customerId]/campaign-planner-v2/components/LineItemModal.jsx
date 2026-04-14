"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiEye, FiX } from "react-icons/fi";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import Spinner from "@/components/ui/Spinner";
import {
	CAMPAIGN_TYPE_FORMATS,
	SERVICE_MEDIA_OPTIONS,
} from "../constants";

const defaultForm = () => ({
	name: "",
	media: "",
	selectedChannels: [],
	selectedFormats: [],
	startDate: "",
	endDate: "",
	alwaysOn: false,
	status: "Pending",
	approvalLink: "",
	budget: "",
});

function toggleInArray(arr, value) {
	if (arr.includes(value)) return arr.filter((x) => x !== value);
	return [...arr, value];
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
		status: initialLineItem.status || "Pending",
		approvalLink: initialLineItem.approvalLink || "",
		budget:
			initialLineItem.budget != null && initialLineItem.budget !== ""
				? String(initialLineItem.budget)
				: "",
	};
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
	customerId,
	serviceName,
	initialLineItem,
	mode = "create",
}) {
	const isCreate = mode === "create";
	const [form, setForm] = useState(defaultForm);
	const [editing, setEditing] = useState(true);
	const [channelError, setChannelError] = useState("");
	const [commentDraft, setCommentDraft] = useState("");
	const [remoteComments, setRemoteComments] = useState([]);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [commentsError, setCommentsError] = useState("");
	const [commentPosting, setCommentPosting] = useState(false);

	const mediaOptions = useMemo(() => {
		return SERVICE_MEDIA_OPTIONS[serviceName] || [];
	}, [serviceName]);

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
			setEditing(true);
			setRemoteComments([]);
		} else if (initialLineItem) {
			setForm(buildFormFromLineItem(initialLineItem));
			setEditing(false);
		}
	}, [open, initialLineItem, isCreate]);

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
			setForm((prev) => ({
				...prev,
				alwaysOn: checked,
				endDate: checked ? "" : prev.endDate,
			}));
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
		setForm((prev) => ({
			...prev,
			selectedFormats: toggleInArray(prev.selectedFormats, f),
		}));
	};

	const buildPayloadCore = () => ({
		name: form.name.trim(),
		startDate: form.startDate,
		endDate: form.alwaysOn ? "" : form.endDate,
		alwaysOn: form.alwaysOn,
		status: form.status,
		approvalLink: form.approvalLink.trim(),
		budget: form.budget === "" ? null : Number(form.budget),
	});

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
				body: JSON.stringify({ lineItemId: initialLineItem.id, text: t }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Could not save comment");
			if (data.comment) {
				setRemoteComments((prev) => [...prev, data.comment]);
			}
			setCommentDraft("");
		} catch (e) {
			setCommentsError(e.message || "Could not save comment");
		} finally {
			setCommentPosting(false);
		}
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center glassmorphism2 p-4">
			<div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-3xl relative max-h-[90vh] overflow-y-auto">
				<button
					type="button"
					className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl z-10"
					onClick={onClose}
					aria-label="Close"
				>
					<FiX size={24} />
				</button>

				<div className="flex flex-wrap items-start justify-between gap-3 pr-10 mb-2">
					<div>
						<h2 className="text-xl font-bold text-gray-900">
							{isCreate ? "New campaign type" : "Campaign type"}
						</h2>
						{serviceName && (
							<p className="text-sm text-gray-500 mt-0.5">
								Channel group: {serviceName}
							</p>
						)}
					</div>
					{!isCreate && (
						<button
							type="button"
							onClick={() => {
								if (editing) exitEditMode();
								else setEditing(true);
							}}
							className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shrink-0"
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

				<form className="grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
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
												? "border-[var(--color-primary-searchmind)] bg-[var(--color-primary-searchmind)]/10"
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
								{CAMPAIGN_TYPE_FORMATS.map((f) => (
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
							</div>
						)}
					</div>

					<div>
						<FormLabel htmlFor="li-budget">Budget (optional)</FormLabel>
						{readOnly ? (
							<p className="mt-2 text-sm text-gray-900 tabular-nums">
								{form.budget !== "" && form.budget != null
									? Number(form.budget).toLocaleString("da-DK")
									: "—"}
							</p>
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

					<div>
						<FormLabel htmlFor="li-start">Start date</FormLabel>
						{readOnly ? (
							<p className="mt-2 text-sm text-gray-900">{form.startDate || "—"}</p>
						) : (
							<input
								id="li-start"
								type="date"
								name="startDate"
								value={form.startDate}
								onChange={handleChange}
								className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
							/>
						)}
					</div>

					{!form.alwaysOn && (
						<div>
							<FormLabel htmlFor="li-end">End date</FormLabel>
							{readOnly ? (
								<p className="mt-2 text-sm text-gray-900">{form.endDate || "—"}</p>
							) : (
								<input
									id="li-end"
									type="date"
									name="endDate"
									value={form.endDate}
									onChange={handleChange}
									className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
								/>
							)}
						</div>
					)}

					<div>
						<FormLabel htmlFor="li-status">Status</FormLabel>
						{readOnly ? (
							<p className="mt-2 text-sm font-medium text-[var(--color-primary-searchmind)]">
								{form.status}
							</p>
						) : (
							<select
								id="li-status"
								name="status"
								value={form.status}
								onChange={handleChange}
								className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300"
							>
								{[
									"Pending",
									"Pending Customer Approval",
									"Approved",
									"Live",
									"Ended",
								].map((s) => (
									<option key={s} value={s}>
										{s}
									</option>
								))}
							</select>
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
										className="text-[var(--color-primary-searchmind)] hover:underline break-all"
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

					{!isCreate && initialLineItem?.id && customerId && (
						<div className="rounded-lg border border-gray-200 bg-gray-50/90 p-4">
							<FormLabel>Comments</FormLabel>
							<p className="text-xs text-gray-500 mt-0.5 mb-2">
								Saved for this campaign type. Add a note for your team.
							</p>
							{commentsError && (
								<p className="text-sm text-red-600 mb-2">{commentsError}</p>
							)}
							{commentsLoading ? (
								<div className="flex justify-center py-6">
									<Spinner size={28} color="#406969" />
								</div>
							) : (
								<ul className="space-y-3 max-h-52 overflow-y-auto mb-3">
									{remoteComments.length === 0 ? (
										<li className="text-sm text-gray-400">No comments yet.</li>
									) : (
										remoteComments.map((c) => (
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
													<p className="text-gray-800 whitespace-pre-wrap mt-1">
														{c.text}
													</p>
												</div>
											</li>
										))
									)}
								</ul>
							)}
							<div className="flex gap-2">
								<textarea
									value={commentDraft}
									onChange={(e) => setCommentDraft(e.target.value)}
									rows={2}
									placeholder="Add a comment…"
									disabled={commentPosting}
									className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none disabled:opacity-60"
								/>
								<button
									type="button"
									onClick={handleAddComment}
									disabled={commentPosting || !commentDraft.trim()}
									className="shrink-0 h-fit px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
								>
									{commentPosting ? "…" : "Add"}
								</button>
							</div>
						</div>
					)}

					<div className="flex justify-end gap-2 pt-4 flex-wrap">
						<button
							type="button"
							onClick={onClose}
							className="h-11 px-5 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 text-sm font-medium"
						>
							Close
						</button>
						{!isCreate && editing && (
							<button
								type="button"
								onClick={exitEditMode}
								className="h-11 px-5 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium"
							>
								Cancel edit
							</button>
						)}
						{(isCreate || editing) && (
							<button
								type="submit"
								className="h-11 px-5 rounded-lg text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)] text-sm font-semibold"
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
