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
