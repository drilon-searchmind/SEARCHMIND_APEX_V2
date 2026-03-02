import User from "../models/User";

/**
 * Get a single user by ID, excluding sensitive fields
 */
export async function getUserSafeById(id) {
	const user = await User.findById(id).select("-password").lean();
	return user;
}

/**
 * Update user profile fields by ID. Only allows name, email, image, and password (if provided).
 * Uses document save to trigger pre-save hooks for password hashing.
 */
export async function updateUserProfileById(id, data) {
	const doc = await User.findById(id);
	if (!doc) return null;

	const { name, email, image, password } = data || {};

	if (typeof name === "string" && name.trim()) doc.name = name.trim();
	if (typeof email === "string" && email.trim()) doc.email = email.trim().toLowerCase();
	if (typeof image === "string") doc.image = image.trim();
	if (typeof password === "string" && password.trim().length > 0) {
		doc.password = password.trim();
	}

	// Do not allow changing admin/archive/external/sharedCustomers/createdAt here

	await doc.save();
	const safe = doc.toObject();
	delete safe.password;
	return safe;
}

/**
 * Toggle a customer as favorite for a user
 * @param {string} userId - User ID
 * @param {string} customerId - Customer ID to toggle
 * @returns {Promise<object>} - Updated user object (safe)
 */
export async function toggleFavoriteCustomer(userId, customerId) {
	const user = await User.findById(userId);
	if (!user) throw new Error("User not found");

	const favoriteIndex = user.favoritedCustomers.findIndex(
		id => String(id) === String(customerId)
	);

	if (favoriteIndex > -1) {
		// Remove from favorites
		user.favoritedCustomers.splice(favoriteIndex, 1);
	} else {
		// Add to favorites
		user.favoritedCustomers.push(customerId);
	}

	await user.save();
	const safe = user.toObject();
	delete safe.password;
	return safe;
}

/**
 * Check if a customer is favorited by a user
 * @param {string} userId - User ID
 * @param {string} customerId - Customer ID to check
 * @returns {Promise<boolean>} - True if favorited
 */
export async function isCustomerFavorited(userId, customerId) {
	const user = await User.findById(userId).select("favoritedCustomers").lean();
	if (!user) return false;
	return user.favoritedCustomers.some(id => String(id) === String(customerId));
}

/**
 * Update user integrations (Slack ID and ClickUp ID)
 * @param {string} userId - User ID
 * @param {object} data - Integration data { slackId, clickupId }
 * @returns {Promise<object>} - Updated user object (safe)
 */
export async function updateUserIntegrations(userId, data) {
	const user = await User.findById(userId);
	if (!user) throw new Error("User not found");

	const { slackId, clickupId } = data || {};

	if (typeof slackId === "string") {
		user.slackId = slackId.trim();
	}

	if (typeof clickupId === "string") {
		user.clickupId = clickupId.trim();
	}

	await user.save();
	const safe = user.toObject();
	delete safe.password;
	return safe;
}

/**
 * Admin update user - allows updating all fields including admin status, external status, etc.
 * @param {string} id - User ID to update
 * @param {object} data - All allowed fields
 * @returns {Promise<object>} - Updated user object (safe)
 */
export async function adminUpdateUser(id, data) {
	const user = await User.findById(id);
	if (!user) return null;

	const { name, email, slackId, clickupId, isAdmin, isExternal, isArchived } = data || {};

	// Update basic profile fields
	if (typeof name === "string" && name.trim()) user.name = name.trim();
	if (typeof email === "string" && email.trim()) user.email = email.trim().toLowerCase();

	// Update integration fields
	if (typeof slackId === "string") user.slackId = slackId.trim();
	if (typeof clickupId === "string") user.clickupId = clickupId.trim();

	// Update admin-only fields
	if (typeof isAdmin === "boolean") user.isAdmin = isAdmin;
	if (typeof isExternal === "boolean") user.isExternal = isExternal;
	if (typeof isArchived === "boolean") user.isArchived = isArchived;

	await user.save();
	const safe = user.toObject();
	delete safe.password;
	return safe;
}

/**
 * Mark a wrapped period as opened for a user + customer (stops pulse notification).
 * @param {string} userId - User ID
 * @param {string} customerId - Customer ID
 * @param {string} period - Period string (e.g. "2025-02")
 * @returns {Promise<object>} - Updated user object (safe)
 */
export async function markOpenedWrappedPeriod(userId, customerId, period) {
	const user = await User.findById(userId);
	if (!user) throw new Error("User not found");

	const customerIdStr = String(customerId || "").trim();
	if (!customerIdStr) throw new Error("Customer ID is required");

	const periodStr = String(period).trim();
	if (!periodStr || !/^\d{4}-\d{2}$/.test(periodStr)) {
		throw new Error("Invalid period format (expected YYYY-MM)");
	}

	// Migrate legacy array format to object format; ensure we merge, not overwrite
	let existing = user.openedWrappedPeriods;
	if (Array.isArray(existing)) {
		existing = {};
	}
	if (typeof existing !== "object" || existing === null) {
		existing = {};
	}

	// Get plain object (Mongoose can return special objects)
	const existingPlain = JSON.parse(JSON.stringify(existing));
	const existingForCustomer = Array.isArray(existingPlain[customerIdStr])
		? existingPlain[customerIdStr]
		: [];
	if (existingForCustomer.includes(periodStr)) {
		const safe = user.toObject();
		delete safe.password;
		return safe;
	}

	const updated = {
		...existingPlain,
		[customerIdStr]: [...existingForCustomer, periodStr],
	};
	user.openedWrappedPeriods = updated;
	user.markModified("openedWrappedPeriods");
	await user.save();

	const safe = user.toObject();
	delete safe.password;
	return safe;
}

/**
 * Create an external user (used by admin flows and share modal).
 * Ensures email is unique and marks user as external.
 * @param {{name:string,email:string,password?:string}} data
 * @returns {Promise<object>} created user (safe)
 */
export async function createExternalUser(data) {
	const { name, email, password } = data || {};
	if (!name || !email) throw new Error('Name and email are required');

	// Check for existing email
	const existing = await User.findOne({ email: String(email).toLowerCase() });
	if (existing) throw new Error('User with that email already exists');

	const user = new User({
		name: String(name).trim(),
		email: String(email).trim().toLowerCase(),
		password: password && String(password).trim().length > 0 ? String(password).trim() : Math.random().toString(36).slice(-8),
		isExternal: true,
	});

	await user.save();
	const safe = user.toObject();
	delete safe.password;
	return safe;
}