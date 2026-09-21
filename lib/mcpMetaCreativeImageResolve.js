import { metaGraphGet } from "./mcpMetaGraph.js";

const ADIMAGE_HASH_CHUNK = 50;
const GRAPH_FETCH_CONCURRENCY = 8;

/**
 * @param {unknown} creative
 * @param {Set<string>} into
 */
export function collectCreativeImageHashes(creative, into) {
	if (!creative || typeof creative !== "object") return;

	const oss = creative.object_story_spec;
	if (oss && typeof oss === "object") {
		const linkHash = oss.link_data?.image_hash;
		const videoHash = oss.video_data?.image_hash;
		if (linkHash) into.add(String(linkHash));
		if (videoHash) into.add(String(videoHash));
	}

	const images = creative.asset_feed_spec?.images;
	if (Array.isArray(images)) {
		for (const entry of images) {
			if (entry?.hash) into.add(String(entry.hash));
		}
	}

	const videos = creative.asset_feed_spec?.videos;
	if (Array.isArray(videos)) {
		for (const entry of videos) {
			if (entry?.thumbnail_hash) into.add(String(entry.thumbnail_hash));
		}
	}
}

/**
 * @param {unknown} creative
 */
/**
 * @param {unknown} creative
 * @returns {string[]}
 */
export function getCreativeVideoIds(creative) {
	if (!creative || typeof creative !== "object") return [];
	const ids = new Set();
	if (creative.video_id) ids.add(String(creative.video_id));
	const ossVid = creative.object_story_spec?.video_data?.video_id;
	if (ossVid) ids.add(String(ossVid));
	const feedVideos = creative.asset_feed_spec?.videos;
	if (Array.isArray(feedVideos)) {
		for (const entry of feedVideos) {
			if (entry?.video_id) ids.add(String(entry.video_id));
		}
	}
	return [...ids];
}

/** @param {unknown} creative */
export function getCreativeVideoId(creative) {
	const ids = getCreativeVideoIds(creative);
	return ids[0] || "";
}

/**
 * @param {Array<{ width?: number, height?: number, url?: string, permalink_url?: string, hash?: string }>} entries
 */
function pickLargestImageEntry(entries) {
	let best = null;
	let bestArea = -1;
	for (const entry of entries) {
		if (!entry?.url) continue;
		const w = Number(entry.width) || 0;
		const h = Number(entry.height) || 0;
		const area = w > 0 && h > 0 ? w * h : 0;
		if (!best || area > bestArea) {
			best = entry;
			bestArea = area;
		}
	}
	return best;
}

/**
 * @param {string[]} hashesInOrder
 * @param {Map<string, { url: string, permalink_url: string | null, width: number | null, height: number | null }>} hashMap
 */
function resolveFirstHashInOrder(hashesInOrder, hashMap) {
	for (const hash of hashesInOrder) {
		const hit = hashMap.get(hash);
		if (hit?.url) return { ...hit, hash };
	}
	return null;
}

/**
 * @param {string[]} hashes
 * @param {Map<string, { url: string, permalink_url: string | null, width: number | null, height: number | null }>} hashMap
 */
function resolveLargestHash(hashes, hashMap) {
	const entries = hashes
		.map((hash) => {
			const hit = hashMap.get(hash);
			return hit ? { ...hit, hash } : null;
		})
		.filter(Boolean);
	return pickLargestImageEntry(entries);
}

/**
 * @param {unknown} creative
 * @param {Map<string, { url: string, permalink_url: string | null, width: number | null, height: number | null }>} hashMap
 */
export function resolveFullImageFromHashes(creative, hashMap) {
	if (!creative || typeof creative !== "object") return null;

	if (creative.image_url) {
		return {
			full_image_url: String(creative.image_url),
			full_image_permalink_url: null,
			full_image_width: null,
			full_image_height: null,
			full_image_source: "image_url",
		};
	}

	const oss = creative.object_story_spec;
	if (oss && typeof oss === "object") {
		const ordered = [];
		if (oss.link_data?.image_hash) ordered.push(String(oss.link_data.image_hash));
		if (oss.video_data?.image_hash) ordered.push(String(oss.video_data.image_hash));
		const fromStorySpec = resolveFirstHashInOrder(ordered, hashMap);
		if (fromStorySpec) {
			return {
				full_image_url: fromStorySpec.url,
				full_image_permalink_url: fromStorySpec.permalink_url,
				full_image_width: fromStorySpec.width,
				full_image_height: fromStorySpec.height,
				full_image_source: "object_story_spec_hash",
			};
		}
	}

	const feedHashes = (creative.asset_feed_spec?.images || [])
		.map((entry) => (entry?.hash ? String(entry.hash) : ""))
		.filter(Boolean);
	const fromFeed = resolveLargestHash(feedHashes, hashMap);
	if (fromFeed) {
		return {
			full_image_url: fromFeed.url,
			full_image_permalink_url: fromFeed.permalink_url,
			full_image_width: fromFeed.width,
			full_image_height: fromFeed.height,
			full_image_source: "asset_feed_spec",
		};
	}

	const feedVideoHashes = (creative.asset_feed_spec?.videos || [])
		.map((entry) => (entry?.thumbnail_hash ? String(entry.thumbnail_hash) : ""))
		.filter(Boolean);
	const fromFeedVideoHash = resolveLargestHash(feedVideoHashes, hashMap);
	if (fromFeedVideoHash) {
		return {
			full_image_url: fromFeedVideoHash.url,
			full_image_permalink_url: fromFeedVideoHash.permalink_url,
			full_image_width: fromFeedVideoHash.width,
			full_image_height: fromFeedVideoHash.height,
			full_image_source: "asset_feed_spec_video_hash",
		};
	}

	const feedVideoThumbUrl = (creative.asset_feed_spec?.videos || [])
		.map((entry) => (entry?.thumbnail_url ? String(entry.thumbnail_url) : ""))
		.filter(Boolean)[0];
	if (feedVideoThumbUrl) {
		return {
			full_image_url: feedVideoThumbUrl,
			full_image_permalink_url: null,
			full_image_width: null,
			full_image_height: null,
			full_image_source: "asset_feed_spec_video_thumbnail",
		};
	}

	return null;
}

/**
 * @param {unknown} creative
 * @param {string | null | undefined} fullPictureUrl
 */
export function resolveFullImageFromStory(creative, fullPictureUrl) {
	if (!fullPictureUrl || !creative || typeof creative !== "object") return null;
	if (!creative.effective_object_story_id) return null;
	return {
		full_image_url: fullPictureUrl,
		full_image_permalink_url: null,
		full_image_width: null,
		full_image_height: null,
		full_image_source: "object_story_full_picture",
	};
}

/**
 * @param {{ uri: string, width?: number, height?: number } | null | undefined} thumb
 */
export function resolveFullImageFromVideo(thumb) {
	if (!thumb?.uri) return null;
	return {
		full_image_url: String(thumb.uri),
		full_image_permalink_url: null,
		full_image_width: Number(thumb.width) || null,
		full_image_height: Number(thumb.height) || null,
		full_image_source: "video_thumbnail",
	};
}

/**
 * @param {string} actId
 * @param {string} accessToken
 * @param {string[]} hashes
 */
export async function batchFetchAdImagesByHash(actId, accessToken, hashes) {
	/** @type {Map<string, { url: string, permalink_url: string | null, width: number | null, height: number | null }>} */
	const map = new Map();
	const unique = [...new Set(hashes.filter(Boolean))];
	if (unique.length === 0) return map;

	for (let i = 0; i < unique.length; i += ADIMAGE_HASH_CHUNK) {
		const chunk = unique.slice(i, i + ADIMAGE_HASH_CHUNK);
		let json;
		try {
			json = await metaGraphGet(`${actId}/adimages`, accessToken, {
				hashes: JSON.stringify(chunk),
				fields: "hash,url,permalink_url,width,height",
				limit: String(Math.max(chunk.length, 50)),
			});
		} catch {
			continue;
		}
		for (const row of json.data || []) {
			if (!row?.hash || !row?.url) continue;
			map.set(String(row.hash), {
				url: String(row.url),
				permalink_url: row.permalink_url ? String(row.permalink_url) : null,
				width: Number(row.width) || null,
				height: Number(row.height) || null,
			});
		}
	}
	return map;
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} worker
 */
async function runWithConcurrency(items, concurrency, worker) {
	const queue = [...items];
	const runners = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
		while (queue.length > 0) {
			const item = queue.shift();
			if (item === undefined) break;
			await worker(item);
		}
	});
	await Promise.all(runners);
}

/**
 * @param {string[]} storyIds
 * @param {string} accessToken
 */
export async function batchFetchStoryFullPictures(storyIds, accessToken) {
	/** @type {Map<string, string | null>} */
	const map = new Map();
	const unique = [...new Set(storyIds.filter(Boolean))];
	await runWithConcurrency(unique, GRAPH_FETCH_CONCURRENCY, async (storyId) => {
		try {
			const json = await metaGraphGet(storyId, accessToken, {
				fields: "full_picture",
			});
			map.set(storyId, json.full_picture ? String(json.full_picture) : null);
		} catch {
			map.set(storyId, null);
		}
	});
	return map;
}

/**
 * @param {string[]} videoIds
 * @param {string} accessToken
 */
export async function batchFetchVideoThumbnails(videoIds, accessToken) {
	/** @type {Map<string, { uri: string, width: number | null, height: number | null } | null>} */
	const map = new Map();
	const unique = [...new Set(videoIds.filter(Boolean))];
	await runWithConcurrency(unique, GRAPH_FETCH_CONCURRENCY, async (videoId) => {
		try {
			const json = await metaGraphGet(videoId, accessToken, {
				fields: "thumbnails",
			});
			const thumbs = json?.thumbnails?.data;
			if (!Array.isArray(thumbs) || thumbs.length === 0) {
				map.set(videoId, null);
				return;
			}
			const best = pickLargestImageEntry(
				thumbs.map((t) => ({
					url: t.uri,
					width: t.width,
					height: t.height,
				}))
			);
			if (!best?.url) {
				map.set(videoId, null);
				return;
			}
			map.set(videoId, {
				uri: best.url,
				width: Number(best.width) || null,
				height: Number(best.height) || null,
			});
		} catch {
			map.set(videoId, null);
		}
	});
	return map;
}

/**
 * @param {Array<{ creative: Record<string, unknown> }>} ads
 * @param {string} actId
 * @param {string} accessToken
 */
export async function enrichAdsWithFullCreativeImages(ads, actId, accessToken) {
	const hashSet = new Set();
	for (const ad of ads) {
		collectCreativeImageHashes(ad.creative, hashSet);
	}
	const hashMap = await batchFetchAdImagesByHash(actId, accessToken, [...hashSet]);

	/** @type {string[]} */
	const storyIdsNeeded = [];
	/** @type {string[]} */
	const videoIdsNeeded = [];

	for (const ad of ads) {
		const partial = resolveFullImageFromHashes(ad.creative, hashMap);
		if (partial) {
			Object.assign(ad.creative, partial);
			continue;
		}
		if (ad.creative.effective_object_story_id) {
			storyIdsNeeded.push(String(ad.creative.effective_object_story_id));
		}
		for (const videoId of getCreativeVideoIds(ad.creative)) {
			videoIdsNeeded.push(videoId);
		}
	}

	const storyPictures = await batchFetchStoryFullPictures(storyIdsNeeded, accessToken);
	const videoThumbs = await batchFetchVideoThumbnails(videoIdsNeeded, accessToken);

	for (const ad of ads) {
		if (ad.creative.full_image_url) continue;

		const storyId = ad.creative.effective_object_story_id
			? String(ad.creative.effective_object_story_id)
			: "";
		if (storyId && storyPictures.has(storyId)) {
			const fromStory = resolveFullImageFromStory(
				ad.creative,
				storyPictures.get(storyId)
			);
			if (fromStory) {
				Object.assign(ad.creative, fromStory);
				continue;
			}
		}

		for (const videoId of getCreativeVideoIds(ad.creative)) {
			if (!videoThumbs.has(videoId)) continue;
			const fromVideo = resolveFullImageFromVideo(videoThumbs.get(videoId));
			if (fromVideo) {
				Object.assign(ad.creative, fromVideo);
				break;
			}
		}
	}
}
